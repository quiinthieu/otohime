import assert from "node:assert/strict";
import { test } from "node:test";
import { cueLength, MAX_DB } from "./sound.ts";
import { main as strataMain } from "../scripts/strata-index.ts";
import {
  buildPaperRustleCue,
  buildStrataData,
  buildStrataLayers,
  computeStrataParallax,
  findNearestStrataWeek,
  isoWeekBounds,
  isoWeekOf,
  resolveStrataYearSelection,
  scaleWeekHeight,
  shouldTriggerRustle,
  stepStrataWeekIndex,
} from "./strata.ts";

const data = buildStrataData({
  generatedAt: "2026-10-29T00:00:00.000Z",
  head: null,
  commits: ["2026-10-19T01:00:00+07:00", "2026-10-19T02:00:00+07:00", "2026-10-12T08:00:00+07:00"],
  notes: [{ date: "2026-10-12", title: "Backfills are a feature" }],
  projects: [{ title: "Shore", shipped: "2026-10-19", started: "2026-10-19" }],
});

test("weekly buckets keep 52 weeks and separate git years from the archive", () => {
  assert.deepEqual(data.years.map((year) => year.year), [2024, 2025, 2026]);
  assert.deepEqual(data.years.map((year) => year.source), ["archive", "archive", "git"]);
  for (const year of data.years) assert.equal(year.weeks.length, 52);
  const week = data.years[2].weeks.find((item) => item.startDate <= "2026-10-19" && item.endDate >= "2026-10-19");
  assert.ok(week);
  assert.equal(week.commits, 2);
  assert.deepEqual(week.shippedProjects, ["Shore"]);
  const noted = data.years[2].weeks.find((item) => item.startDate <= "2026-10-12" && item.endDate >= "2026-10-12");
  assert.equal(noted?.notes, 1);
  assert.equal(noted?.activity, noted!.notes + noted!.commits);
  const { isoYear, week: number } = isoWeekOf("2026-10-19");
  const bounds = isoWeekBounds(isoYear, number);
  assert.equal(isoYear, 2026);
  assert.ok(bounds.startDate <= "2026-10-19" && bounds.endDate >= "2026-10-19");
  assert.ok(data.years[0].weeks[0].highlights.some((line) => /archive/i.test(line)));
});

test("sqrt height keeps a valley floor and does not let one week flatten the year", () => {
  assert.equal(scaleWeekHeight(0, 10), 0.08);
  assert.equal(scaleWeekHeight(0, 0), 0.08);
  assert.equal(scaleWeekHeight(10, 10), 1);
  const low = scaleWeekHeight(1, 100);
  const mid = scaleWeekHeight(25, 100);
  assert.ok(low < mid && mid < 1);
  assert.ok(mid > low + (1 - low) * 0.2, "the square root lifts the quieter weeks");
});

test("six cut-paper layers are deterministic wavy polygons", () => {
  const layers = buildStrataLayers(data.years[2], { seed: 3 });
  assert.equal(layers.length, 6);
  const again = buildStrataLayers(data.years[2], { seed: 3 });
  assert.deepEqual(layers.map((layer) => layer.d), again.map((layer) => layer.d));
  assert.notEqual(layers[0].d, buildStrataLayers(data.years[2], { seed: 9 })[0].d);
  for (const layer of layers) {
    assert.match(layer.d, /^M -?\d+\.\d+,-?\d+\.\d+( L -?\d+\.\d+,-?\d+\.\d+)+ Z$/);
    assert.equal(layer.anchors.length, 52);
    assert.ok(layer.threshold >= 0 && layer.threshold < 1);
    assert.ok(layer.swatch.startsWith("--"));
  }
});

test("parallax follows the pointer and drops to zero when motion is reduced", () => {
  const still = computeStrataParallax(1, -1, true);
  assert.equal(still.length, 6);
  assert.ok(still.every((offset) => offset.dx === 0 && offset.dy === 0));
  const moving = computeStrataParallax(1, -1, false);
  assert.ok(moving[5].dx === 14 && moving[5].dy === -8);
  assert.ok(moving[0].dx > 0 && moving[0].dx < moving[5].dx);
  assert.ok(computeStrataParallax(40, 40, false).every((offset) => Math.abs(offset.dx) <= 14 && Math.abs(offset.dy) <= 8));
});

test("nearest week and arrow keys walk the year", () => {
  const weeks = data.years[2].weeks;
  assert.equal(findNearestStrataWeek(weeks, 0).week, 1);
  assert.equal(findNearestStrataWeek(weeks, 1).week, 52);
  assert.equal(stepStrataWeekIndex(0, "ArrowLeft", 52), 0);
  assert.equal(stepStrataWeekIndex(0, "ArrowRight", 52), 1);
  assert.equal(stepStrataWeekIndex(10, "Home", 52), 0);
  assert.equal(stepStrataWeekIndex(10, "End", 52), 51);
  assert.equal(stepStrataWeekIndex(4, "Enter", 52), 4);
});

test("the scrubber keeps every year and degrades to a single year", () => {
  const many = resolveStrataYearSelection(data.years, 2024);
  assert.equal(many.canScrub, true);
  assert.equal(many.current.year, 2024);
  assert.deepEqual(many.availableYears, [2024, 2025, 2026]);
  const one = resolveStrataYearSelection([data.years[2]], 2024);
  assert.equal(one.canScrub, false);
  assert.equal(one.current.year, 2026);
  assert.deepEqual(one.availableYears, [2026]);
});

test("paper rustle stays under the cue ceiling", () => {
  for (const index of [0, 1, 2]) {
    const cue = buildPaperRustleCue(index, 3);
    assert.ok(cue.db <= -18 && cue.db <= MAX_DB);
    assert.ok(cue.notes.every((note) => note.attack === 0.006));
    const duration = cueLength(cue);
    assert.ok(duration >= 0.055 && duration <= 0.095, String(duration));
  }
  assert.equal(shouldTriggerRustle(0, 89, 90), false);
  assert.equal(shouldTriggerRustle(0, 90, 90), true);
});

test("the committed strata index matches this checkout", () => {
  assert.equal(strataMain(["--check"]), 0);
});
