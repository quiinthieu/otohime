import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import committed from "../../../../../content/ledger.json" with { type: "json" };
import { HANDS, inkFilter } from "../../../../../lib/ink-modes.ts";
import { endOf, ledgerGrid, SMUDGES, WEEKDAYS, WEEKS, WINDOW_DAYS } from "../../../../../lib/ledger.ts";
import { parseLedger, type Ledger, type LedgerDay } from "../../../../../lib/ledger-data.ts";
import { cellLabel, centre, daysOf, GUTTER, longDate, moveIndex, PITCH, rosette, shortDate, SMUDGE_FILTERS, totals, VIEW } from "./calendar.ts";

const DIR = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(DIR, p), "utf8");
const day = (d: Partial<LedgerDay> = {}): LedgerDay => ({ commits: 0, notes: 0, sketches: 0, releases: [], ...d });

const LEDGER: Ledger = {
  generated: "2026-10-26T09:00:00.000Z",
  days: {
    "2025-10-27": day({ commits: 1 }),
    "2026-03-12": day({ commits: 5 }),
    "2026-03-13": day({ commits: 1, notes: 1, sketches: 2, releases: ["v1.2"] }),
    "2026-10-26": day({ commits: 40 }),
    "2024-01-01": day({ commits: 99 }), // outside the window
  },
};
const grid = ledgerGrid(LEDGER, endOf(LEDGER)!);

test("the grid's days come out in date order, the whole window and nothing else", () => {
  const cells = daysOf(grid);
  assert.equal(cells.length, WINDOW_DAYS);
  assert.equal(cells[0].date, "2025-10-27");
  assert.equal(cells.at(-1)!.date, "2026-10-26");
  for (let i = 1; i < cells.length; i++) assert.ok(cells[i - 1].date < cells[i].date, cells[i].date);
});

test("a day reads as '12 Mar: 5 commits', with every kind of thing and its releases", () => {
  const cells = daysOf(grid);
  const at = (date: string) => cells.find((c) => c.date === date)!;
  assert.equal(cellLabel(at("2026-03-12")), "12 Mar: 5 commits");
  assert.equal(cellLabel(at("2026-03-13")), "13 Mar: 1 commit, 1 note, 2 sketches, release v1.2");
  assert.equal(cellLabel(at("2026-03-14")), "14 Mar: no ink");
  assert.equal(cellLabel({ date: "2026-01-01", day: day({ notes: 2, sketches: 1 }) }), "1 Jan: 2 notes, 1 sketch");
});

test("dates print short and long, unpadded", () => {
  assert.equal(shortDate("2026-03-02"), "2 Mar");
  assert.equal(shortDate("2026-12-31"), "31 Dec");
  assert.equal(longDate("2026-10-26"), "26 Oct 2026");
});

test("no two days in a window share a short date, so the labels stay unambiguous", () => {
  for (const end of ["2026-10-26", "2028-02-29", "2028-03-01", "2027-12-31"]) {
    const labels = daysOf(ledgerGrid({ generated: null, days: {} }, end)).map((c) => shortDate(c.date));
    assert.equal(new Set(labels).size, labels.length, end);
  }
});

test("arrows step a day up and down and a week sideways, stopping at the ends", () => {
  const n = 365;
  assert.equal(moveIndex(10, "ArrowDown", n), 11);
  assert.equal(moveIndex(10, "ArrowUp", n), 9);
  assert.equal(moveIndex(10, "ArrowRight", n), 17);
  assert.equal(moveIndex(10, "ArrowLeft", n), 3);
  assert.equal(moveIndex(3, "ArrowLeft", n), 0);
  assert.equal(moveIndex(0, "ArrowUp", n), 0);
  assert.equal(moveIndex(360, "ArrowRight", n), 364);
  assert.equal(moveIndex(364, "ArrowDown", n), 364);
  assert.equal(moveIndex(200, "Home", n), 0);
  assert.equal(moveIndex(200, "End", n), 364);
  assert.equal(moveIndex(200, "a", n), null);
  assert.equal(moveIndex(200, "Tab", n), null);
  assert.equal(moveIndex(0, "ArrowDown", 0), null);
});

test("a week sideways lands on the same weekday in the next column", () => {
  const cells = daysOf(grid);
  const i = 100;
  const j = moveIndex(i, "ArrowRight", cells.length)!;
  assert.equal(cells[j].weekday, cells[i].weekday);
  assert.equal(cells[j].week, cells[i].week + 1);
});

test("totals sum the window only and count the inked days", () => {
  assert.deepEqual(totals(daysOf(grid)), { commits: 47, notes: 1, sketches: 2, releases: 1, inked: 4 });
  assert.deepEqual(totals([]), { commits: 0, notes: 0, sketches: 0, releases: 0, inked: 0 });
});

test("every day's square sits inside the sheet, PITCH apart", () => {
  const first = centre(0, 0);
  const last = centre(WEEKS - 1, WEEKDAYS - 1);
  assert.deepEqual(first, { x: GUTTER.left + PITCH / 2, y: GUTTER.top + PITCH / 2 });
  assert.ok(last.x + PITCH / 2 <= VIEW.w && last.y + PITCH / 2 <= VIEW.h);
  assert.equal(centre(1, 0).x - first.x, PITCH);
});

test("one shared ink filter per smudge, all different, built from lib/ink-modes", () => {
  assert.equal(SMUDGE_FILTERS.length, SMUDGES);
  for (const f of SMUDGE_FILTERS) {
    assert.ok(HANDS.includes(f.hand));
    assert.ok(f.wobble > 0 && f.wobble <= 3);
  }
  const shapes = SMUDGE_FILTERS.map((f) => JSON.stringify(inkFilter(f.hand, f.seed, f.wobble)));
  assert.equal(new Set(shapes).size, SMUDGES);
  // every smudge the model hands out has a filter
  for (const c of daysOf(grid)) assert.ok(c.style.smudge >= 0 && c.style.smudge < SMUDGE_FILTERS.length);
});

test("the rosette is a closed star of 2n points between its radii", () => {
  const d = rosette(7, 4.6, 10);
  assert.match(d, /^M0\.00 -7\.00/);
  assert.ok(d.endsWith("Z"));
  const points = d.slice(1, -1).split("L").map((p) => p.split(" ").map(Number));
  assert.equal(points.length, 20);
  points.forEach(([x, y], k) => assert.ok(Math.abs(Math.hypot(x, y) - (k % 2 ? 4.6 : 7)) < 0.01, `${k}`));
  assert.equal(rosette(5, 3, 1).split("L").length, 6);
});

test("the committed ledger draws a full year", () => {
  const ledger = parseLedger(committed);
  const end = endOf(ledger);
  assert.ok(end);
  assert.equal(daysOf(ledgerGrid(ledger, end)).length, WINDOW_DAYS);
});

test("the page reads content/ledger.json through parseLedger, cached for a day, and never fetches", () => {
  const page = read("page.tsx");
  assert.match(page, /import raw from "@\/content\/ledger\.json"/);
  assert.match(page, /parseLedger\(raw\)/);
  assert.match(page, /"use cache";\s*cacheLife\("days"\)/);
  assert.doesNotMatch(page, /export const revalidate/);
  const component = read("_components/stamp-calendar.tsx");
  assert.doesNotMatch(page + component, /\bfetch\(/);
});

test("the calendar is one SVG: a <symbol> stamp, <use> per day, SMUDGES shared filters, button cells with a roving tabindex", () => {
  const src = read("_components/stamp-calendar.tsx");
  assert.equal(src.match(/<svg\b/g)!.length - (src.match(/<svg key=|<svg viewBox="-8/g) ?? []).length, 1);
  assert.match(src, /<symbol id=\{`\$\{id\}-stamp`\}/);
  assert.match(src, /<use\b/);
  // filters are made once per SMUDGE_FILTERS entry, and stamps reference them by smudge group
  assert.equal(src.match(/<filter\b/g)!.length, 1);
  assert.match(src, /SMUDGE_FILTERS\.map\(/);
  assert.match(src, /filter=\{`url\(#\$\{id\}-smudge-\$\{s\}\)`\}/);
  assert.match(src, /role="button"/);
  assert.match(src, /tabIndex=\{i === active \? 0 : -1\}/);
  assert.match(src, /aria-label=\{cellLabel\(c\)\}/);
  for (const handler of ["onFocus", "onPointerEnter", "onClick", "onKeyDown"]) assert.match(src, new RegExp(`${handler}=`));
});

test("Work links to the ledger", () => {
  const work = readFileSync(resolve(DIR, "../work/page.tsx"), "utf8");
  assert.match(work, /<Link href="\/ledger"/);
});
