import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import {
  applyStroke,
  createLostSheet,
  crumpleLevel,
  isSmoothed,
  progress,
  SMOOTH_DISTANCE,
  strokeLength,
  type LostSheet,
  type LostStroke,
} from "./lost.ts";

const ROOT = join(import.meta.dirname, "..");

const line = (length: number): LostStroke => [
  { x: 0, y: 0 },
  { x: length, y: 0 },
];

test("a new sheet is fully crumpled and not smoothed", () => {
  const s = createLostSheet();
  assert.equal(progress(s), 0);
  assert.equal(crumpleLevel(s), 1);
  assert.equal(isSmoothed(s), false);
});

test("an empty stroke is a no-op", () => {
  const s = applyStroke(createLostSheet(), line(400));
  assert.equal(applyStroke(s, []), s);
  assert.equal(applyStroke(s, [{ x: 10, y: 10 }]), s);
  assert.equal(applyStroke(s, [{ x: 5, y: 5 }, { x: 5, y: 5 }]), s);
});

test("stroke length is the polyline length and skips non-finite segments", () => {
  assert.equal(strokeLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 0 }]), 9);
  assert.equal(strokeLength([{ x: 0, y: 0 }, { x: Number.NaN, y: 0 }, { x: 0, y: 0 }]), 0);
  const s = applyStroke(createLostSheet(), [{ x: 0, y: 0 }, { x: Infinity, y: 0 }]);
  assert.equal(progress(s), 0);
});

test("progress grows with stroke length over the fixed distance", () => {
  const s = applyStroke(createLostSheet(), line(SMOOTH_DISTANCE / 4));
  assert.equal(progress(s), 0.25);
  assert.equal(crumpleLevel(s), 0.75);
});

test("progress clamps at 1 and stays there", () => {
  const s = applyStroke(createLostSheet(), line(SMOOTH_DISTANCE * 3));
  assert.equal(progress(s), 1);
  assert.equal(crumpleLevel(s), 0);
  assert.equal(progress(applyStroke(s, line(500))), 1);
});

test("crumpleLevel is 1 - progress and progress is monotonic", () => {
  let s: LostSheet = createLostSheet();
  let last = progress(s);
  for (const len of [10, 0, 300, 1, 250, 900, 2000]) {
    s = applyStroke(s, line(len));
    assert.ok(progress(s) >= last);
    assert.ok(progress(s) >= 0 && progress(s) <= 1);
    assert.equal(crumpleLevel(s), 1 - progress(s));
    last = progress(s);
  }
});

test("isSmoothed only once progress reaches 1", () => {
  const almost = applyStroke(createLostSheet(), line(SMOOTH_DISTANCE - 1));
  assert.equal(isSmoothed(almost), false);
  assert.ok(crumpleLevel(almost) > 0);
  const done = applyStroke(almost, line(1));
  assert.equal(isSmoothed(done), true);
  assert.equal(crumpleLevel(done), 0);
});

test("tiny strokes accumulate to a smooth sheet", () => {
  let s: LostSheet = createLostSheet();
  for (let i = 0; i < SMOOTH_DISTANCE / 2 - 1; i++) s = applyStroke(s, line(2));
  assert.equal(isSmoothed(s), false);
  assert.ok(progress(s) > 0.99);
  s = applyStroke(s, line(2));
  assert.equal(isSmoothed(s), true);
  assert.equal(crumpleLevel(s), 0);
});

test("applyStroke does not mutate the input state", () => {
  const s = createLostSheet();
  applyStroke(s, line(100));
  assert.equal(s.rubbed, 0);
});

test("the node smoke replays its strokes to a smooth sheet", () => {
  const run = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      join(ROOT, "scripts/probe-lost.mjs"),
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /probe-lost: ok \d+ strokes, crumple 0/);
});
