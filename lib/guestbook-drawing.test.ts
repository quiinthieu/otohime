import assert from "node:assert/strict";
import { test } from "node:test";
import { brushWidth, drawingPoint, readyStrokes } from "./guestbook-drawing.ts";

test("brush responds to pressure and speed within the stored width range", () => {
  assert.ok(brushWidth(0.8, 0) > brushWidth(0.2, 0));
  assert.ok(brushWidth(0.5, 0) > brushWidth(0.5, 20));
  assert.ok(brushWidth(100, -100) <= 15);
  assert.ok(brushWidth(-1, 100) >= 1);
});

test("stored points stay on the sheet and undo data is copied", () => {
  assert.deepEqual(drawingPoint(-4, 200), [0, 160]);
  const original = { c: 0 as const, p: [1, 2, 3, 4], w: [2, 3], t0: 0, d: 1 };
  const prepared = readyStrokes([original]);
  prepared[0].p[0] = 20;
  assert.equal(original.p[0], 1);
});
