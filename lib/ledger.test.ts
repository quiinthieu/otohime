// The Stamp Ledger's model, without a page: intensity, stamp style, the 53x7
// grid, milestones and the hover receipt.
import assert from "node:assert/strict";
import { test } from "node:test";
import committed from "../content/ledger.json" with { type: "json" };
import { EMPTY_LEDGER, parseLedger, type Ledger, type LedgerDay } from "./ledger-data.ts";
import {
  endDay,
  endOf,
  hash,
  INK,
  intensity,
  ledgerGrid,
  MAX_LEVEL,
  MAX_ROTATION,
  milestones,
  MIN_SCALE,
  PRESS_MS,
  PRESS_SOUND_EVERY,
  pressDue,
  pressSounds,
  receiptLines,
  receiptText,
  SMUDGES,
  stampStyle,
  total,
  WEEKDAYS,
  WEEKS,
  WINDOW_DAYS,
  type LedgerCell,
  type LedgerGrid,
} from "./ledger.ts";

const DAY_MS = 86_400_000;
const day = (over: Partial<LedgerDay> = {}): LedgerDay => ({ commits: 0, notes: 0, sketches: 0, releases: [], ...over });
const ledger = (days: Record<string, LedgerDay>, generated: string | null = null): Ledger => ({ generated, days });
const cells = (grid: LedgerGrid) => grid.weeks.flat().filter((c): c is LedgerCell => c !== null);
const cell = (grid: LedgerGrid, date: string) => {
  const c = cells(grid).find((x) => x.date === date);
  assert.ok(c, `no cell for ${date}`);
  return c;
};
// Every day of a range, as YYYY-MM-DD.
const daysFrom = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * DAY_MS).toISOString().slice(0, 10));

test("intensity is 0 for nothing, at least 1 for anything, and MAX_LEVEL at the scale", () => {
  assert.equal(intensity(0), 0);
  for (const n of [-1, Number.NaN]) assert.equal(intensity(n), 0, String(n));
  assert.equal(intensity(1), 1);
  assert.equal(intensity(MIN_SCALE), MAX_LEVEL);
  assert.equal(intensity(1e9), MAX_LEVEL);
  assert.equal(intensity(100, 100), MAX_LEVEL);
  assert.equal(intensity(1000, 100), MAX_LEVEL);
});

test("intensity is log-quantised: monotonic, every level reached, doubling not linear", () => {
  const scale = 255;
  let last = 0;
  const seen = new Set<number>();
  for (let n = 0; n <= 400; n++) {
    const l = intensity(n, scale);
    assert.ok(Number.isInteger(l) && l >= 0 && l <= MAX_LEVEL, `${n} -> ${l}`);
    assert.ok(l >= last, `not monotonic at ${n}`);
    last = l;
    seen.add(l);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
  // Quarters of log1p(255) = log(256) fall at 1 + n = 4, 16 and 64, not at 64, 128 and 192.
  assert.equal(intensity(2, scale), 1);
  assert.equal(intensity(4, scale), 2);
  assert.equal(intensity(14, scale), 2);
  assert.equal(intensity(16, scale), 3);
  assert.equal(intensity(62, scale), 3);
  assert.equal(intensity(64, scale), 4);
});

test("a scale below MIN_SCALE is raised to it, so a quiet year stays light", () => {
  assert.equal(intensity(1, 1), intensity(1, MIN_SCALE));
  assert.equal(intensity(2, 2), intensity(2, MIN_SCALE));
  assert.ok(intensity(2, 2) < MAX_LEVEL);
});

test("stampStyle is deterministic and stays in bounds", () => {
  for (const date of daysFrom("2024-01-01", 2 * 366)) {
    const a = stampStyle(date, 3);
    assert.deepEqual(stampStyle(date, 3), a, date);
    assert.ok(Math.abs(a.rotation) <= MAX_ROTATION, `${date} rotation ${a.rotation}`);
    assert.equal(Math.round(a.rotation * 10) / 10, a.rotation, `${date} not to a tenth`);
    assert.ok(!Object.is(a.rotation, -0), date);
    assert.ok(Number.isInteger(a.smudge) && a.smudge >= 0 && a.smudge < SMUDGES, `${date} smudge ${a.smudge}`);
  }
  // A fixed date pins the hash, so a change to it is a deliberate one.
  assert.equal(hash("2026-10-26"), 32036010);
  assert.deepEqual(stampStyle("2026-10-26", 2), { rotation: -5.9, smudge: 2, ink: INK[2] });
  assert.notEqual(hash("2026-10-26"), hash("2026-10-27"));
});

test("stampStyle spreads a year across both leans and every smudge", () => {
  const year = daysFrom("2026-01-01", 365).map((d) => stampStyle(d, 2));
  const smudges = new Map<number, number>();
  for (const s of year) smudges.set(s.smudge, (smudges.get(s.smudge) ?? 0) + 1);
  assert.equal(smudges.size, SMUDGES);
  for (const [k, n] of smudges) assert.ok(n > 365 / SMUDGES / 2, `smudge ${k} only ${n} times`);
  const left = year.filter((s) => s.rotation < -MAX_ROTATION / 2).length;
  const right = year.filter((s) => s.rotation > MAX_ROTATION / 2).length;
  assert.ok(left > 40 && right > 40, `left ${left}, right ${right}`);
  // Neighbouring days do not lean in lockstep.
  let same = 0;
  for (let i = 1; i < year.length; i++) if (Math.sign(year[i].rotation) === Math.sign(year[i - 1].rotation)) same++;
  assert.ok(same < 0.7 * year.length, `${same} neighbours lean alike`);
});

test("stampStyle's ink follows the level; rotation and smudge follow only the date", () => {
  const date = "2026-03-14";
  for (let l = 0; l <= MAX_LEVEL; l++) {
    const s = stampStyle(date, l);
    assert.equal(s.ink, INK[l]);
    assert.equal(s.rotation, stampStyle(date, 0).rotation);
    assert.equal(s.smudge, stampStyle(date, 0).smudge);
  }
  for (let l = 1; l <= MAX_LEVEL; l++) assert.ok(INK[l] > INK[l - 1]);
  assert.equal(stampStyle(date, 0).ink, 0);
  assert.equal(stampStyle(date, 99).ink, INK[MAX_LEVEL]);
  assert.equal(stampStyle(date, -3).ink, 0);
  assert.equal(stampStyle(date, Number.NaN).ink, 0);
  assert.equal(stampStyle(date, 2.4).ink, INK[2]);
});

test("ledgerGrid is 53 weeks of 7 days, Sunday first, holding exactly the window", () => {
  for (const end of daysFrom("2026-10-25", 7)) {
    const grid = ledgerGrid(EMPTY_LEDGER, end);
    assert.equal(grid.weeks.length, WEEKS);
    for (const column of grid.weeks) assert.equal(column.length, WEEKDAYS);
    const all = cells(grid);
    assert.equal(all.length, WINDOW_DAYS, end);
    assert.deepEqual(
      all.map((c) => c.date),
      daysFrom(grid.from, WINDOW_DAYS),
    );
    assert.equal(grid.to, end);
    assert.equal(all[all.length - 1].date, end);
    for (const c of all) {
      assert.equal(grid.weeks[c.week][c.weekday], c);
      assert.equal(new Date(`${c.date}T00:00:00Z`).getUTCDay(), c.weekday, c.date);
    }
    // The end sits in the last column; nothing after it is drawn.
    const last = grid.weeks[WEEKS - 1];
    const at = last.findIndex((c) => c?.date === end);
    assert.ok(at >= 0, end);
    assert.ok(last.slice(at + 1).every((c) => c === null));
  }
});

test("empty days are blank stamps: level 0, no ink, no milestones, all counts 0", () => {
  const grid = ledgerGrid(ledger({ "2026-10-20": day({ commits: 2 }) }), "2026-10-26");
  const blank = cell(grid, "2026-10-21");
  assert.deepEqual(blank.day, day());
  assert.equal(blank.total, 0);
  assert.equal(blank.level, 0);
  assert.equal(blank.style.ink, 0);
  assert.deepEqual(blank.milestones, []);
  assert.equal(cells(ledgerGrid(EMPTY_LEDGER, "2026-10-26")).filter((c) => c.level > 0).length, 0);
  // A day that is in the file but all zero is still blank.
  assert.equal(cell(ledgerGrid(ledger({ "2026-10-22": day() }), "2026-10-26"), "2026-10-22").level, 0);
});

test("ledgerGrid scales to the busiest day in the window and ignores days outside it", () => {
  const data = ledger({
    "2025-01-01": day({ commits: 5000 }),
    "2026-06-01": day({ commits: 60, notes: 4 }),
    "2026-06-02": day({ commits: 1 }),
    "2026-11-01": day({ commits: 9000 }),
  });
  const grid = ledgerGrid(data, "2026-10-26");
  assert.equal(grid.scale, 64);
  assert.equal(cell(grid, "2026-06-01").level, MAX_LEVEL);
  assert.equal(cell(grid, "2026-06-02").level, 1);
  assert.ok(!cells(grid).some((c) => c.date === "2025-01-01" || c.date === "2026-11-01"));
  assert.equal(ledgerGrid(ledger({ "2026-06-02": day({ commits: 1 }) }), "2026-10-26").scale, MIN_SCALE);
});

test("the window crosses a leap day: 2024-02-29 is a cell, and 365 days end on 2025-02-27", () => {
  const grid = ledgerGrid(ledger({ "2024-02-29": day({ sketches: 1 }) }), "2025-02-27");
  assert.equal(grid.from, "2024-02-29");
  assert.equal(cell(grid, "2024-02-29").total, 1);
  assert.equal(cells(grid).length, WINDOW_DAYS);
  const leap = ledgerGrid(EMPTY_LEDGER, "2024-12-31");
  assert.equal(leap.from, "2024-01-02");
  assert.ok(cells(leap).some((c) => c.date === "2024-02-29"));
  // A non-leap year has no Feb 29 and its window is a whole calendar year.
  const plain = ledgerGrid(EMPTY_LEDGER, "2026-12-31");
  assert.equal(plain.from, "2026-01-01");
  assert.ok(!cells(plain).some((c) => c.date.endsWith("-02-29")));
});

test("ledgerGrid reads its end in UTC, whatever the offset or the host's zone", () => {
  assert.equal(endDay("2026-12-31T23:30:00-02:00"), "2027-01-01");
  assert.equal(endDay("2027-01-01T00:30:00+05:00"), "2026-12-31");
  assert.equal(endDay("2026-12-31T23:59:59.999Z"), "2026-12-31");
  assert.equal(endDay("2027-01-01T00:00:00.000Z"), "2027-01-01");
  assert.equal(endDay("2026-10-26"), "2026-10-26");
  for (const bad of ["2026-02-30", "2026-13-01", "yesterday", ""]) assert.equal(endDay(bad), null, bad);
  assert.equal(ledgerGrid(EMPTY_LEDGER, "2026-12-31T23:30:00-02:00").to, "2027-01-01");
  assert.deepEqual(ledgerGrid(EMPTY_LEDGER, "2027-01-01T03:00:00+09:00"), ledgerGrid(EMPTY_LEDGER, "2026-12-31"));
  assert.throws(() => ledgerGrid(EMPTY_LEDGER, "not a day"), RangeError);
});

test("endOf takes the generated day, else the last day in the file, else null", () => {
  assert.equal(endOf(ledger({ "2026-01-01": day() }, "2026-10-26T22:00:00-05:00")), "2026-10-27");
  assert.equal(endOf(ledger({ "2026-01-01": day(), "2026-03-01": day() })), "2026-03-01");
  assert.equal(endOf(EMPTY_LEDGER), null);
});

test("month labels sit on the column holding each month's first day", () => {
  const grid = ledgerGrid(EMPTY_LEDGER, "2026-12-31");
  assert.deepEqual(
    grid.months.map((m) => m.label),
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  );
  for (const m of grid.months) assert.ok(grid.weeks[m.week].some((c) => c?.date.endsWith("-01")));
  for (let i = 1; i < grid.months.length; i++) assert.ok(grid.months[i].week > grid.months[i - 1].week);
});

test("milestones: one per release, then a post for new notes; sketches and commits alone are none", () => {
  assert.deepEqual(milestones(day({ releases: ["otohime v1", "ink 0.2"], notes: 1 })), [
    { kind: "release", label: "otohime v1" },
    { kind: "release", label: "ink 0.2" },
    { kind: "post", label: "new post" },
  ]);
  assert.deepEqual(milestones(day({ notes: 3 })), [{ kind: "post", label: "3 new posts" }]);
  assert.deepEqual(milestones(day({ commits: 40, sketches: 2 })), []);
  // A release with no commits that day is still a milestone, on a blank stamp.
  const grid = ledgerGrid(ledger({ "2026-10-01": day({ releases: ["v2"] }) }), "2026-10-26");
  const c = cell(grid, "2026-10-01");
  assert.equal(c.level, 0);
  assert.deepEqual(c.milestones, [{ kind: "release", label: "v2" }]);
  assert.equal(total(c.day), 0);
});

test("receiptText names the UTC day and what was done, with plurals", () => {
  assert.equal(
    receiptText({ date: "2026-10-26", day: day({ commits: 3, notes: 1, sketches: 2, releases: ["otohime v1"] }) }),
    "MON 26 OCT 2026\n3 commits\n1 note\n2 sketches\nrelease: otohime v1",
  );
  assert.deepEqual(receiptLines({ date: "2024-02-29", day: day({ commits: 1, notes: 2, sketches: 1 }) }), [
    "THU 29 FEB 2024",
    "1 commit",
    "2 notes",
    "1 sketch",
  ]);
  assert.equal(receiptText({ date: "2027-01-01", day: day() }), "FRI 01 JAN 2027\nno ink today");
  // A grid cell is a receipt's input as it is.
  const grid = ledgerGrid(ledger({ "2026-10-12": day({ notes: 1 }) }), "2026-10-26");
  assert.equal(receiptText(cell(grid, "2026-10-12")), "MON 12 OCT 2026\n1 note");
});

test("the committed fallback ledger builds a full grid", () => {
  const data = parseLedger(committed);
  const end = endOf(data);
  assert.ok(end);
  const grid = ledgerGrid(data, end);
  assert.equal(cells(grid).length, WINDOW_DAYS);
  for (const date of Object.keys(data.days)) {
    if (date < grid.from || date > grid.to) continue;
    const c = cell(grid, date);
    assert.equal(c.total, total(data.days[date]));
    assert.ok(c.level > 0 || c.total === 0);
  }
});

test("pressDue: the first day on the first frame, then one per PRESS_MS, capped at n", () => {
  assert.equal(pressDue(0, WINDOW_DAYS), 1);
  assert.equal(pressDue(-5, WINDOW_DAYS), 1);
  assert.equal(pressDue(PRESS_MS - 1, WINDOW_DAYS), 1);
  assert.equal(pressDue(PRESS_MS, WINDOW_DAYS), 2);
  assert.equal(pressDue(10 * PRESS_MS + 1, WINDOW_DAYS), 11);
  assert.equal(pressDue(1e9, WINDOW_DAYS), WINDOW_DAYS);
  assert.equal(pressDue(100, 0), 0);
  assert.equal(pressDue(0, 0), 0);
  assert.equal(pressDue(100, Number.NaN), 0);
  assert.equal(pressDue(50, 10, 10), 6);
  // The whole year takes (WINDOW_DAYS - 1) steps after the first frame.
  assert.equal(pressDue((WINDOW_DAYS - 1) * PRESS_MS, WINDOW_DAYS), WINDOW_DAYS);
  assert.equal(pressDue((WINDOW_DAYS - 1) * PRESS_MS - 1, WINDOW_DAYS), WINDOW_DAYS - 1);
});

test("pressSounds thuds when a pressed day is a multiple of PRESS_SOUND_EVERY, once a week", () => {
  assert.equal(PRESS_SOUND_EVERY, WEEKDAYS);
  assert.equal(pressSounds(0, 1), true, "the first day thuds");
  assert.equal(pressSounds(1, 2), false);
  assert.equal(pressSounds(6, 7), false);
  assert.equal(pressSounds(7, 8), true);
  assert.equal(pressSounds(3, 3), false, "no step, no thud");
  assert.equal(pressSounds(5, 3), false, "never backwards");
  // A step that skips over two multiples still thuds once (the throttle).
  assert.equal(pressSounds(1, 20), true);
  assert.equal(pressSounds(8, 14), false, "8..13 hold no multiple of 7");
  assert.equal(pressSounds(8, 15), true, "14 is pressed");
  assert.equal(pressSounds(0, 3, 0), true, "a nonsense every thuds every day");
});

test("one day a frame thuds exactly ceil(n / PRESS_SOUND_EVERY) times; dropped frames only thud less", () => {
  const thuds = (steps: number[]) => {
    let from = 0;
    let count = 0;
    for (const to of steps) {
      if (pressSounds(from, to)) count++;
      from = to;
    }
    return count;
  };
  const oneByOne = Array.from({ length: WINDOW_DAYS }, (_, i) => i + 1);
  assert.equal(thuds(oneByOne), Math.ceil(WINDOW_DAYS / PRESS_SOUND_EVERY));
  // Frames at 60 Hz against a 16 ms step: sometimes two days in a frame.
  const frames: number[] = [];
  for (let t = 0; frames.at(-1) !== WINDOW_DAYS; t += 1000 / 60) frames.push(pressDue(t, WINDOW_DAYS));
  // 351 frames for 365 days: no frame spans two thud days, so all 53 thuds remain.
  assert.equal(frames.length, 351);
  assert.equal(thuds(frames), 53);
  // One giant frame (a backgrounded tab) is one thud, not 53.
  assert.equal(thuds([WINDOW_DAYS]), 1);
});
