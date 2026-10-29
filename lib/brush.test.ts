import assert from "node:assert/strict";
import { test } from "node:test";
import { BRISTLES, MAX_STEPS, brushLoad, brushWidth, createBrush, deposit, fibreBleed } from "./brush.ts";

test("pressure and speed taper change the real bristle deposition width", () => {
  const a = { x: 50, y: 50, t: 0 };
  assert.ok(brushWidth(a, { x: 100, y: 50, t: 200 }) > brushWidth(a, { x: 100, y: 50, t: 10 }));
  assert.ok(brushWidth(a, { x: 100, y: 50, t: 100, pressure: .9 }) > brushWidth(a, { x: 100, y: 50, t: 100, pressure: .1 }));
  assert.equal(createBrush().bristles.length, 40);
});
test("bristles drain individually into dry streaks, dip restores ink, and work is bounded", () => {
  let brush = createBrush(9), count = 0;
  const a = { x: 0, y: 0, t: 0 }, b = { x: 600, y: 600, t: 200 };
  const wet = deposit(brush, a, b);
  assert.ok(wet.marks.length <= BRISTLES * MAX_STEPS);
  for (let i = 0; i < 8; i++) { const plan = deposit(brush, a, b); brush = plan.brush; count = plan.marks.length; }
  assert.ok(brushLoad(brush) < .01);
  assert.ok(count < wet.marks.length);
  assert.equal(brushLoad(createBrush(9)), 1);
  assert.deepEqual(deposit(createBrush(9), a, b), wet);
  assert.ok(wet.marks.every(m => [m.x, m.y, m.x2, m.y2].every(x => x >= 0 && x <= 600)));
});
test("rice fibre bleed is deterministic, directional, and bounded", () => {
  const points = Array.from({ length: 1000 }, (_, i) => ({ x: i % 600, y: 50, t: i }));
  const marks = fibreBleed(points, 17);
  assert.equal(marks.length, 160);
  assert.deepEqual(fibreBleed(points, 17), marks);
  assert.notDeepEqual(fibreBleed(points, 18), marks);
  assert.ok(marks.every(m => Math.abs(m.x2 - m.x) > Math.abs(m.y2 - m.y)));
});
