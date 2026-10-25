// Node-only smoke for the 404 lost sheet model: replays a fixed stroke list
// through lib/lost.ts and asserts the crumple level after each stroke.
// Run with --experimental-strip-types so the .ts import resolves.
import assert from "node:assert/strict";
import {
  applyStroke,
  createLostSheet,
  crumpleLevel,
  isSmoothed,
  SMOOTH_DISTANCE,
} from "../lib/lost.ts";

assert.equal(SMOOTH_DISTANCE, 1600, "fixture lengths assume SMOOTH_DISTANCE=1600");

// [stroke, crumple level expected after it]
const STROKES = [
  [[], 1],
  [[{ x: 20, y: 20 }], 1],
  [[{ x: 0, y: 0 }, { x: 400, y: 0 }], 0.75],
  [[{ x: 0, y: 0 }, { x: 300, y: 400 }], 0.4375],
  [[{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 0 }], 0.1875],
  [[{ x: 10, y: 10 }, { x: 10, y: 10 }], 0.1875],
  [[{ x: 0, y: 0 }, { x: 0, y: 900 }], 0],
  [[{ x: 0, y: 0 }, { x: 50, y: 0 }], 0],
];

let sheet = createLostSheet();
assert.equal(crumpleLevel(sheet), 1);
STROKES.forEach(([stroke, want], i) => {
  sheet = applyStroke(sheet, stroke);
  const got = crumpleLevel(sheet);
  assert.ok(Math.abs(got - want) < 1e-9, `stroke ${i}: crumple ${got}, want ${want}`);
  assert.equal(isSmoothed(sheet), want === 0, `stroke ${i}: isSmoothed`);
});

console.log(`probe-lost: ok ${STROKES.length} strokes, crumple ${crumpleLevel(sheet)}`);
