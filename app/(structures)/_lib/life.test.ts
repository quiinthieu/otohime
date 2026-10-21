// The eight In life drawings: one per page in series order, each in frame at
// 480 wide with labels legible on a 390 px phone, at most 10 of them, one
// spot (the thing the rule is about), and the same drawing every time.
import assert from "node:assert/strict";
import { test } from "node:test";
import { figureProblems, SMALL, type Figure } from "./kit.ts";
import { LIFE, lifeFigure } from "./life/index.ts";
import { STRUCTURES } from "./structures/index.ts";

const MAX_LABELS = 10;

test("one drawing per structure, in series order", () => {
  assert.deepEqual(Object.keys(LIFE), STRUCTURES.map((s) => s.slug));
  assert.throws(() => lifeFigure("nope"));
});

for (const s of STRUCTURES) {
  const fig = lifeFigure(s.slug);
  const [w, h] = fig.viewBox;

  test(`${s.slug}: in its ${w}×${h} frame, ≤ ${MAX_LABELS} labels of ${SMALL} or more, a spot`, () => {
    assert.deepEqual(figureProblems(fig, MAX_LABELS), []);
  });

  test(`${s.slug}: the spot is one thing, drawn in spot`, () => {
    assert.ok(fig.spot.length > 0);
    assert.ok(fig.spot.every((p) => p.stroke === fig.spot[0].stroke));
    assert.ok(fig.paths.every((p) => p.stroke !== fig.spot[0].stroke), "no ink in the spot colour");
  });

  test(`${s.slug}: drawn the same every time`, () => {
    assert.deepEqual(lifeFigure(s.slug), fig);
  });
}

test("the checker flags what it should", () => {
  const ok: Figure = { viewBox: [480, 100], paths: [{ d: "M10 10 L50 50", stroke: "#000", strokeWidth: 1 }], spot: [{ d: "M20 20 L30 30", stroke: "#00f", strokeWidth: 1 }], labels: [{ x: 10, y: 40, text: "hi", size: 18 }] };
  assert.deepEqual(figureProblems(ok, 10), []);
  assert.deepEqual(figureProblems({ ...ok, paths: [{ d: "M1 50 L50 50", stroke: "#000", strokeWidth: 1 }] }, 10), ["ink path 0: x=1"]);
  assert.deepEqual(figureProblems({ ...ok, labels: [{ x: 10, y: 40, text: "hi", size: 14 }] }, 10), ["label hi is size 14"]);
  assert.deepEqual(figureProblems({ ...ok, labels: [{ x: 470, y: 40, text: "too long", size: 18 }] }, 10), ["label too long runs 470,27 to 545,45"]);
  assert.deepEqual(figureProblems({ ...ok, spot: [] }, 10), ["nothing in spot"]);
  assert.deepEqual(figureProblems(ok, 0), ["1 labels"]);
});
