// The Stamp Ledger's data: the parser over content/ledger.json, and
// scripts/ledger-fetch.mjs driven by a fake fetch against a scratch content dir.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import committed from "../content/ledger.json" with { type: "json" };
import {
  buildLedger,
  noteDates,
  run,
  sketchDates,
  slices,
  SLICE_DAYS,
  WINDOW_DAYS,
  yearWindow,
} from "../scripts/ledger-fetch.mjs";
import { EMPTY_LEDGER, isDay, MAX_COUNT, MAX_RELEASES, parseDay, parseLedger, RELEASE_NAME } from "./ledger-data.ts";

const day = (over: Record<string, unknown> = {}) => ({ commits: 1, notes: 0, sketches: 0, releases: [], ...over });

test("isDay takes real UTC calendar days only", () => {
  for (const d of ["2026-01-01", "2024-02-29", "2026-12-31"]) assert.ok(isDay(d), d);
  for (const d of ["2026-02-29", "2026-13-01", "2026-1-1", "2026-01-01T00:00:00Z", 20260101, null, ""]) assert.ok(!isDay(d), String(d));
});

test("parseDay keeps counts and release names, and fills missing counts with 0", () => {
  assert.deepEqual(parseDay({ commits: 3, releases: ["otohime v1"] }), { commits: 3, notes: 0, sketches: 0, releases: ["otohime v1"] });
  assert.deepEqual(parseDay({ notes: 1, sketches: 2 }), { commits: 0, notes: 1, sketches: 2, releases: [] });
});

test("parseDay refuses malformed counts and release lists", () => {
  for (const bad of [-1, 1.5, "3", Number.NaN, Infinity, MAX_COUNT + 1, null]) assert.equal(parseDay(day({ commits: bad })), null, String(bad));
  assert.equal(parseDay(day({ releases: "v1" })), null);
  for (const bad of [null, [], "day", 3]) assert.equal(parseDay(bad), null);
});

test("parseDay cleans, cuts and caps release names", () => {
  const long = "x".repeat(RELEASE_NAME + 10);
  const parsed = parseDay(day({ releases: ["  a\u0000b\n c ", "", 7, null, long, ...Array(20).fill("r")] }));
  assert.ok(parsed);
  assert.equal(parsed.releases[0], "a b c");
  assert.equal(Array.from(parsed.releases[1]).length, RELEASE_NAME);
  assert.ok(parsed.releases[1].endsWith("…"));
  assert.equal(parsed.releases.length, MAX_RELEASES);
});

test("parseLedger drops bad days and keeps the rest in date order", () => {
  const parsed = parseLedger({
    generated: "2026-10-26T00:00:00.000Z",
    days: {
      "2026-10-12": day({ notes: 1 }),
      "2026-02-30": day(),
      "yesterday": day(),
      "2026-03-01": day({ commits: -2 }),
      "2026-01-05": day({ commits: 4 }),
    },
  });
  assert.equal(parsed.generated, "2026-10-26T00:00:00.000Z");
  assert.deepEqual(Object.keys(parsed.days), ["2026-01-05", "2026-10-12"]);
  assert.equal(parsed.days["2026-01-05"].commits, 4);
});

test("parseLedger reads anything unusable as the empty ledger", () => {
  for (const bad of [null, "{}", [], {}, { days: [] }, { days: "x" }]) assert.deepEqual(parseLedger(bad), EMPTY_LEDGER);
  assert.equal(parseLedger({ generated: "soon", days: {} }).generated, null);
});

test("the committed content/ledger.json parses whole", () => {
  const parsed = parseLedger(committed);
  assert.ok(parsed.generated);
  assert.deepEqual(Object.keys(parsed.days), Object.keys(committed.days));
  assert.deepEqual(parsed.days, committed.days);
});

test("the window is WINDOW_DAYS UTC days ending today, cut into slices of at most SLICE_DAYS", () => {
  const w = yearWindow(new Date("2026-10-26T23:30:00-05:00"));
  assert.deepEqual(w, { from: "2025-10-28", to: "2026-10-27" });
  const parts = slices(w.from, w.to);
  assert.equal(parts[0].from, w.from);
  assert.equal(parts.at(-1)?.to, w.to);
  let total = 0;
  for (const [i, p] of parts.entries()) {
    const n = (Date.parse(p.to) - Date.parse(p.from)) / 86_400_000 + 1;
    assert.ok(n >= 1 && n <= SLICE_DAYS);
    total += n;
    if (i > 0) assert.equal(Date.parse(p.from) - Date.parse(parts[i - 1].to), 86_400_000);
  }
  assert.equal(total, WINDOW_DAYS);
});

test("noteDates reads the notes list's dates and throws when the list is gone", () => {
  const src = `export const site = {\n  other: [{ date: "2020-01-01" }],\n  notes: [\n    { date: "2026-10-12", title: "a ] b" },\n    { date: '2026-09-28', body: "x" },\n  ],\n  work: "y",\n};\n`;
  assert.deepEqual(noteDates(src), ["2026-10-12", "2026-09-28"]);
  assert.throws(() => noteDates("export const site = {};"));
});

test("sketchDates takes portrait review days, from a list or { records }", () => {
  const rec = (reviewedAt: unknown) => ({ review: { reviewedAt } });
  assert.deepEqual(sketchDates([rec("2026-10-01T23:30:00-02:00"), rec("nope"), {}, null]), ["2026-10-02"]);
  assert.deepEqual(sketchDates({ records: [rec("2026-05-05")] }), ["2026-05-05"]);
  assert.deepEqual(sketchDates({}), []);
});

test("buildLedger merges sources by UTC day, inside the window only", () => {
  const ledger = buildLedger({
    now: new Date("2026-10-26T12:00:00Z"),
    window: { from: "2026-01-01", to: "2026-10-26" },
    commits: { "2026-03-02": 5, "2025-12-31": 9, "2026-03-03": 0 },
    releases: { "2026-03-02": ["otohime v1"] },
    notes: ["2026-10-12", "2026-10-12", "2027-01-01"],
    sketches: ["2026-03-02"],
  });
  assert.deepEqual(ledger, {
    generated: "2026-10-26T12:00:00.000Z",
    days: {
      "2026-03-02": { commits: 5, notes: 0, sketches: 1, releases: ["otohime v1"] },
      "2026-10-12": { commits: 0, notes: 2, sketches: 0, releases: [] },
    },
  });
});

// A scratch content dir: site.ts with one note, no portraits, and a sentinel ledger.
const scratch: string[] = [];
after(() => Promise.all(scratch.map((d) => rm(d, { recursive: true, force: true }))));
const SENTINEL = '{ "generated": "sentinel", "days": {} }\n';
async function root() {
  const dir = await mkdtemp(path.join(tmpdir(), "ledger-"));
  scratch.push(dir);
  await mkdir(path.join(dir, "content"));
  await writeFile(path.join(dir, "content", "site.ts"), 'export const site = {\n  notes: [\n    { date: "2026-10-12", title: "t" },\n  ],\n};\n');
  await writeFile(path.join(dir, "content", "portraits.json"), "[]\n");
  await writeFile(path.join(dir, "content", "ledger.json"), SENTINEL);
  return dir;
}
const ledgerAt = (dir: string) => readFile(path.join(dir, "content", "ledger.json"), "utf8");

const NOW = new Date("2026-10-26T08:00:00Z");
type Call = { url: string; auth: string; query: string; variables: Record<string, string> };

// GitHub as the scripts sees it: one public and one private repo, each with a
// commit day in every slice, and releases on both.
function fakeGithub(override?: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const call: Call = { url: String(url), auth: new Headers(init?.headers).get("authorization") ?? "", query: body.query, variables: body.variables };
    calls.push(call);
    const forced = override?.(call);
    if (forced) return forced;
    if (call.query.includes("contributionsCollection")) {
      const from = call.variables.from.slice(0, 10);
      const repo = (isPrivate: boolean, n: number) => ({
        repository: { isPrivate },
        contributions: { nodes: [{ occurredAt: `${from}T00:00:00Z`, commitCount: n }] },
      });
      return Response.json({ data: { user: { contributionsCollection: { commitContributionsByRepository: [repo(false, 2), repo(true, 50)] } } } });
    }
    const rel = (name: string | null, publishedAt: string, isDraft = false) => ({ name, tagName: "v0", publishedAt, isDraft });
    return Response.json({
      data: {
        user: {
          repositories: {
            nodes: [
              { name: "otohime", isPrivate: false, releases: { nodes: [rel("v1.0", "2026-10-12T15:00:00Z"), rel(null, "2026-10-13T00:00:00Z"), rel("draft", "2026-10-14T00:00:00Z", true), rel("old", "2024-01-01T00:00:00Z")] } },
              { name: "secret", isPrivate: true, releases: { nodes: [rel("hidden", "2026-10-12T00:00:00Z")] } },
            ],
          },
        },
      },
    });
  };
  return { calls, fetch: impl as typeof fetch };
}

test("run writes public commits, public release names and note days from a fake GitHub", async () => {
  const dir = await root();
  const gh = fakeGithub();
  const logs: string[] = [];
  const result = await run({ fetch: gh.fetch, env: { GITHUB_TOKEN: "t0ken" }, root: dir, now: NOW, log: (m) => logs.push(m) });
  assert.equal(result.status, "written");

  const w = yearWindow(NOW);
  const parts = slices(w.from, w.to);
  assert.equal(gh.calls.length, parts.length + 1);
  for (const call of gh.calls) {
    assert.equal(call.url, "https://api.github.com/graphql");
    assert.equal(call.auth, "bearer t0ken");
    assert.match(call.query, /user\(login: \$owner\)/, "activity belongs to the site owner, not the token holder");
    assert.doesNotMatch(call.query, /\bviewer\b/);
    assert.equal(call.variables.owner, "quiinthieu");
  }
  assert.deepEqual(
    gh.calls.filter((c) => c.query.includes("contributionsCollection")).map((c) => c.variables),
    parts.map((p) => ({ owner: "quiinthieu", from: `${p.from}T00:00:00Z`, to: `${p.to}T23:59:59Z` })),
  );

  const text = await ledgerAt(dir);
  assert.doesNotMatch(text, /secret|hidden|draft|t0ken/);
  const raw = JSON.parse(text);
  const parsed = parseLedger(raw);
  assert.deepEqual(parsed.days, raw.days);
  assert.equal(parsed.generated, NOW.toISOString());
  for (const p of parts) assert.equal(parsed.days[p.from].commits, 2, p.from);
  assert.deepEqual(parsed.days["2026-10-12"], { commits: 0, notes: 1, sketches: 0, releases: ["otohime v1.0"] });
  assert.deepEqual(parsed.days["2026-10-13"].releases, ["otohime v0"]);
  assert.equal(parsed.days["2026-10-14"], undefined);
  assert.equal(Object.values(parsed.days).reduce((n, d) => n + d.commits, 0), 2 * parts.length);
  assert.match(logs.join("\n"), /wrote content\/ledger\.json/);
});

test("run keeps the file and asks nothing without a token", async () => {
  for (const env of [{}, { GITHUB_TOKEN: "" }, { GITHUB_TOKEN: "  " }]) {
    const dir = await root();
    const gh = fakeGithub();
    const result = await run({ fetch: gh.fetch, env, root: dir, now: NOW, log: () => {} });
    assert.deepEqual(result, { status: "kept", reason: "no GITHUB_TOKEN" });
    assert.equal(gh.calls.length, 0);
    assert.equal(await ledgerAt(dir), SENTINEL);
  }
});

test("run keeps the file byte for byte on every kind of failure", async () => {
  const failures: Array<[string, (call: Call) => Response | undefined]> = [
    ["HTTP 401", () => new Response("bad credentials", { status: 401 })],
    ["HTTP 502 on releases", (c) => (c.query.includes("repositories") ? new Response("", { status: 502 }) : undefined)],
    ["GraphQL errors", () => Response.json({ data: null, errors: [{ message: "rate limited" }] })],
    ["not JSON", () => new Response("<html>")],
    ["no owner", () => Response.json({ data: {} })],
    ["token holder only", () => Response.json({ data: { viewer: { contributionsCollection: { commitContributionsByRepository: [] } } } })],
    ["late slice malformed", (c) => (c.query.includes("contributionsCollection") && c.variables.from.startsWith("2026-07") ? Response.json({ data: { user: { contributionsCollection: {} } } }) : undefined)],
    ["no repositories", (c) => (c.query.includes("repositories") ? Response.json({ data: { user: {} } }) : undefined)],
  ];
  for (const [name, override] of failures) {
    const dir = await root();
    const result = await run({ fetch: fakeGithub(override).fetch, env: { GITHUB_TOKEN: "t" }, root: dir, now: NOW, log: () => {} });
    assert.equal(result.status, "kept", name);
    assert.equal(await ledgerAt(dir), SENTINEL, name);
  }

  const thrown = await root();
  const offline = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  assert.deepEqual(await run({ fetch: offline, env: { GITHUB_TOKEN: "t" }, root: thrown, now: NOW, log: () => {} }), { status: "kept", reason: "fetch failed" });
  assert.equal(await ledgerAt(thrown), SENTINEL);

  const noNotes = await root();
  await writeFile(path.join(noNotes, "content", "site.ts"), "export const site = {};\n");
  const gh = fakeGithub();
  assert.equal((await run({ fetch: gh.fetch, env: { GITHUB_TOKEN: "t" }, root: noNotes, now: NOW, log: () => {} })).status, "kept");
  assert.equal(await ledgerAt(noNotes), SENTINEL);
});
