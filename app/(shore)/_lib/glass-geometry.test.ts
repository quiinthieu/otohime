import assert from "node:assert/strict";
import { test } from "node:test";
import { buildContour, contourSegments } from "./sea-glass.mjs";

test("vendored buildContour is deterministic for a seed", () => {
  const a = buildContour(72, 70, "disc", 0.025, 2_020_003);
  assert.deepEqual(a, buildContour(72, 70, "disc", 0.025, 2_020_003));
  assert.notDeepEqual(a, buildContour(72, 70, "disc", 0.025, 2_020_004));
});

test("vendored buildContour stays inside its box", () => {
  for (const seed of [0, 1, 42, 2_020_000, 2_020_011]) {
    const pts = buildContour(72, 70, "disc", 0.025, seed);
    assert.ok(pts.length >= 64);
    for (const p of pts) {
      assert.ok(p.x >= 0 && p.x <= 72, `x ${p.x}`);
      assert.ok(p.y >= 0 && p.y <= 70, `y ${p.y}`);
    }
    assert.equal(contourSegments(pts).length, pts.length);
  }
});
