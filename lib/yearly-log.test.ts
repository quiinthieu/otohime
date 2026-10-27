import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildYearlyLog,
  cleanSubject,
  DEFAULT_YEAR,
  EMPTY_YEARLY_LOG,
  emptyYearlyLog,
  flowerForMonth,
  isMonthKey,
  isoSecond,
  MAX_COMMITS_PER_MONTH,
  MAX_HIGHLIGHTS_PER_MONTH,
  MAX_NOTES_PER_MONTH,
  MAX_PROJECTS_PER_MONTH,
  MONTH_KEYS,
  MONTHLY_FLOWERS,
  monthKeyOf,
  monthLog,
  parseYearlyLog,
  readYearlyLog,
  serializeYearlyLog,
  SUBJECT_MAX,
  splitPrefix,
  utcDayOf,
  validateYearlyLog,
  type YearlyLog,
} from "./yearly-log.ts";

test("all 12 calendar months map to traditional Hanafuda flower names", () => {
  assert.equal(MONTH_KEYS.length, 12);
  const expected: [string, number, string][] = [
    ["01", 1, "Pine"],
    ["02", 2, "Plum"],
    ["03", 3, "Cherry"],
    ["04", 4, "Wisteria"],
    ["05", 5, "Iris"],
    ["06", 6, "Peony"],
    ["07", 7, "Bush Clover"],
    ["08", 8, "Susuki Grass"],
    ["09", 9, "Chrysanthemum"],
    ["10", 10, "Maple"],
    ["11", 11, "Willow"],
    ["12", 12, "Paulownia"],
  ];
  for (const [key, num, flower] of expected) {
    assert.equal(isMonthKey(key), true);
    assert.equal(MONTHLY_FLOWERS[key as keyof typeof MONTHLY_FLOWERS], flower);
    assert.equal(monthKeyOf(num), key);
    assert.equal(monthKeyOf(String(num)), key);
    assert.equal(monthKeyOf(key), key);
    assert.equal(monthKeyOf(`2026-${key}-15`), key);
    assert.equal(flowerForMonth(num), flower);
    assert.equal(flowerForMonth(key), flower);
    assert.equal(flowerForMonth(`2026-${key}-15T10:00:00Z`), flower);
  }
  assert.equal(isMonthKey("00"), false);
  assert.equal(isMonthKey("13"), false);
  assert.equal(isMonthKey(1), false);
  assert.equal(monthKeyOf(0), null);
  assert.equal(monthKeyOf(13), null);
  assert.equal(monthKeyOf("2026-02-30"), null);
  assert.equal(flowerForMonth(99), null);
});

test("date and subject helpers normalize valid values and reject invalid calendar dates", () => {
  assert.equal(isoSecond("2026-10-26T12:30:05+02:00"), "2026-10-26T10:30:05Z");
  assert.equal(isoSecond("2026-10-26"), null);
  assert.equal(isoSecond("not-a-date"), null);

  assert.equal(utcDayOf("2026-09-28"), "2026-09-28");
  assert.equal(utcDayOf("2026-10-26T23:30:00Z"), "2026-10-26");
  assert.equal(utcDayOf("2026-02-29"), null); // 2026 is not a leap year
  assert.equal(utcDayOf("2024-02-29"), "2024-02-29");
  assert.equal(utcDayOf(123), null);

  assert.deepEqual(splitPrefix("pm-293/t-1673: Shared yearly shipped digest"), {
    plan: "pm-293",
    task: "t-1673",
    subject: "Shared yearly shipped digest",
  });
  assert.deepEqual(splitPrefix("feat: standalone commit"), {
    plan: null,
    task: null,
    subject: "feat: standalone commit",
  });

  assert.equal(cleanSubject("  a\tb\n  c  "), "a b c");
  const capped = cleanSubject("w".repeat(SUBJECT_MAX + 25));
  assert.equal([...capped].length, SUBJECT_MAX);
  assert.ok(capped.endsWith("…"));
});

test("buildYearlyLog aggregates commits, projects, notes, and ledger across all 12 months", () => {
  const sha = (n: number) => n.toString(16).padStart(40, "0");
  const commits = [
    {
      sha: sha(10),
      date: "2026-12-20T18:00:00Z",
      subject: "pm-293/t-1677: Ship Hanafuda board",
    },
    // 6 commits in October to test MAX_HIGHLIGHTS_PER_MONTH = 5 cap
    ...Array.from({ length: 6 }, (_, i) => ({
      sha: sha(9 - i),
      date: `2026-10-${String(25 - i).padStart(2, "0")}T12:00:00Z`,
      subject: `pm-290/t-${100 - i}: October step ${i}`,
    })),
    {
      sha: sha(2),
      date: "2026-05-10T09:15:00Z",
      subject: "pm-181/t-1052: add Shore focus timer",
    },
    {
      sha: sha(1),
      date: "2026-01-04T08:00:00Z",
      subject: "Initial commit",
    },
  ];

  const projects = [
    { title: "Shore", href: "/shore", status: "live" }, // inferred from May commit
    { title: "Orrery", href: "/orrery", status: "live", shipped: "2026-10-20" }, // explicit shipped date
    { title: "WIP Doll", href: "/wip", status: "building", started: "2026-10-01" }, // unshipped -> excluded
    { title: "Old Experiment", status: "shelved", shipped: "2026-03-10", abandoned: true }, // abandoned -> excluded
  ];

  const notes = [
    { title: "Spring note", date: "2026-03-15" },
    { title: "Autumn early", date: "2026-09-03" },
    { title: "Autumn late", date: "2026-09-28" },
    { title: "Autumn late", date: "2026-09-28" }, // duplicate -> deduplicated
  ];

  const ledger = {
    generated: "2026-10-26T00:00:00.000Z",
    days: {
      "2026-01-04": { commits: 1, notes: 0, sketches: 0, releases: [] }, // same day as git commit -> max(1, 1) = 1
      "2026-01-19": { commits: 3, notes: 0, sketches: 0, releases: [] }, // ledger-only day -> +3
      "2026-07-07": { commits: 4, notes: 0, sketches: 0, releases: [] }, // July ledger activity
    },
  };

  const log = buildYearlyLog({ commits, projects, notes, ledger });
  assert.equal(validateYearlyLog(log), log);
  assert.equal(log.head, sha(10));
  assert.equal(log.generatedYear, 2026);

  // Month 01: 1 git commit on Jan 4 + 3 ledger commits on Jan 19 = 4
  assert.equal(log.months["01"].flower, "Pine");
  assert.equal(log.months["01"].commits, 4);
  assert.equal(log.months["01"].highlights.length, 1);
  assert.equal(log.months["01"].highlights[0].subject, "Initial commit");

  // Month 03: note present, abandoned project excluded
  assert.deepEqual(log.months["03"].notes, [{ title: "Spring note", date: "2026-03-15" }]);
  assert.deepEqual(log.months["03"].shippedProjects, []);

  // Month 05: Shore inferred from commit subject
  assert.deepEqual(log.months["05"].shippedProjects, [
    { title: "Shore", href: "/shore", shipped: "2026-05-10" },
  ]);

  // Month 07: 4 commits from ledger, 0 git highlights
  assert.equal(log.months["07"].commits, 4);
  assert.equal(log.months["07"].highlights.length, 0);

  // Month 09: notes sorted newest-first and deduplicated
  assert.deepEqual(log.months["09"].notes, [
    { title: "Autumn late", date: "2026-09-28" },
    { title: "Autumn early", date: "2026-09-03" },
  ]);

  // Month 10: 6 git commits, highlights capped at MAX_HIGHLIGHTS_PER_MONTH = 5, Orrery shipped
  assert.equal(log.months["10"].commits, 6);
  assert.equal(log.months["10"].highlights.length, MAX_HIGHLIGHTS_PER_MONTH);
  assert.equal(log.months["10"].highlights[0].subject, "October step 0");
  assert.equal(log.months["10"].highlights[4].subject, "October step 4");
  assert.deepEqual(log.months["10"].shippedProjects, [
    { title: "Orrery", href: "/orrery", shipped: "2026-10-20" },
  ]);

  // Month 12: newest commit
  assert.equal(log.months["12"].commits, 1);
  assert.equal(log.months["12"].highlights[0].sha, sha(10).slice(0, 10));
  assert.equal(log.months["12"].highlights[0].plan, "pm-293");
});

test("validateYearlyLog rejects malformed inputs, out-of-bounds lists, and head mismatches", () => {
  assert.deepEqual(validateYearlyLog(EMPTY_YEARLY_LOG), EMPTY_YEARLY_LOG);
  const sample = buildYearlyLog({
    commits: [
      {
        sha: "0123456789abcdef0123456789abcdef01234567",
        date: "2026-10-26T10:30:05Z",
        subject: "pm-293/t-1673: Build digest",
      },
    ],
    projects: [{ title: "Shore", href: "/shore", shipped: "2026-10-19" }],
    notes: [{ title: "Backfills are a feature", date: "2026-10-12" }],
  });
  assert.deepEqual(validateYearlyLog(sample), sample);

  const clone = (): YearlyLog => JSON.parse(serializeYearlyLog(sample)) as YearlyLog;

  const badCases: unknown[] = [
    null,
    "not an object",
    [],
    { ...clone(), version: 2 },
    { ...clone(), extra: true },
    { ...clone(), head: "not-a-40-char-sha" },
    { ...clone(), head: "f".repeat(40) }, // head prefix does not match any month's newest highlight
    { ...clone(), head: null }, // null head while highlights exist
    { ...emptyYearlyLog(2026), head: "0".repeat(40) }, // non-null head with zero highlights
    { ...clone(), generatedYear: 1800 },
    { ...clone(), generatedYear: 2026.5 },
    { ...clone(), months: null },
    (() => {
      const c = clone();
      delete (c.months as Record<string, unknown>)["12"];
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["01"].month = 2;
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["01"].flower = "Rose";
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].commits = 0; // fewer commits than highlights.length
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["01"].commits = MAX_COMMITS_PER_MONTH + 1;
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].shippedProjects = [{ title: "Wrong month", shipped: "2026-09-19" }];
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].shippedProjects = [{ title: "Bad href", href: "has space", shipped: "2026-10-19" }];
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].shippedProjects = Array.from({ length: MAX_PROJECTS_PER_MONTH + 1 }, (_, i) => ({
        title: `P${i}`,
        shipped: "2026-10-19",
      }));
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].notes = [{ title: "Wrong month", date: "2026-11-01" }];
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].notes = Array.from({ length: MAX_NOTES_PER_MONTH + 1 }, (_, i) => ({
        title: `N${i}`,
        date: "2026-10-12",
      }));
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].highlights[0].sha = "UPPERCASE0";
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].highlights[0].date = "2026-10-26"; // missing time
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].highlights[0].plan = "bad-plan";
      return c;
    })(),
    (() => {
      const c = clone();
      c.months["10"].commits = 10;
      c.months["10"].highlights = Array.from({ length: MAX_HIGHLIGHTS_PER_MONTH + 1 }, () => ({
        ...sample.months["10"].highlights[0],
      }));
      return c;
    })(),
  ];

  badCases.forEach((candidate, i) => {
    assert.equal(validateYearlyLog(candidate), null, `bad case ${i} must be rejected`);
  });

  assert.equal(parseYearlyLog("{invalid json"), null);
  assert.deepEqual(readYearlyLog("{invalid"), EMPTY_YEARLY_LOG);
  assert.equal(monthLog(sample, 10)?.flower, "Maple");
  assert.equal(monthLog(sample, "09")?.flower, "Chrysanthemum");
  assert.equal(monthLog(sample, 13), null);
  assert.equal(EMPTY_YEARLY_LOG.generatedYear, DEFAULT_YEAR);
});

test("serializeYearlyLog is canonical and round-trips deterministically", () => {
  const emptyText = serializeYearlyLog(EMPTY_YEARLY_LOG);
  assert.deepEqual(parseYearlyLog(emptyText), EMPTY_YEARLY_LOG);
  assert.equal(serializeYearlyLog(parseYearlyLog(emptyText)!), emptyText);

  const built = buildYearlyLog({
    commits: [
      {
        sha: "abcdef0123456789abcdef0123456789abcdef01",
        date: "2026-10-27T12:00:00Z",
        subject: "pm-293/t-1673: Canonical check",
      },
    ],
    projects: [{ title: "Shore", href: "/shore", shipped: "2026-10-19" }],
    notes: [{ title: "Backfills are a feature", date: "2026-10-12" }],
  });
  const text = serializeYearlyLog(built);
  const parsed = parseYearlyLog(text);
  assert.ok(parsed);
  assert.equal(serializeYearlyLog(parsed), text);
  assert.ok(text.endsWith("\n"));
});
