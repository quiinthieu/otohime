// The red string, without a cork board: how far it sags, the curve and its d
// attribute, and which projects it joins.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_SAG,
  relatedPairs,
  sagFor,
  SAG_RATIO,
  stringControl,
  stringPath,
  stringPoint,
  type Point,
} from "./desk-string.ts";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const nearPoint = (p: Point, q: Point) => (near(p.x, q.x), near(p.y, q.y));

test("the string sags a quarter of the gap, up to MAX_SAG", () => {
  assert.equal(SAG_RATIO, 0.25);
  assert.equal(sagFor({ x: 0, y: 0 }, { x: 100, y: 0 }), 25);
  assert.equal(sagFor({ x: 0, y: 0 }, { x: 30, y: 40 }), 12.5);
  assert.equal(sagFor({ x: 0, y: 0 }, { x: 1000, y: 0 }), MAX_SAG);
  assert.equal(sagFor({ x: 0, y: 0 }, { x: 1000, y: 0 }, 10), 10);
  assert.equal(sagFor({ x: 7, y: 7 }, { x: 7, y: 7 }), 0);
});

test("the path is a quadratic from A to B with its control below the chord", () => {
  assert.equal(stringPath({ x: 0, y: 0 }, { x: 100, y: 0 }), "M 0 0 Q 50 50 100 0");
  assert.equal(stringPath({ x: 0, y: 0 }, { x: 1000, y: 0 }), `M 0 0 Q 500 ${2 * MAX_SAG} 1000 0`);
  assert.match(
    stringPath({ x: 12.3, y: 45.6 }, { x: 210.9, y: 80.1 }),
    /^M -?\d+(\.\d{1,2})? -?\d+(\.\d{1,2})? Q -?\d+(\.\d{1,2})? -?\d+(\.\d{1,2})? -?\d+(\.\d{1,2})? -?\d+(\.\d{1,2})?$/,
  );
});

test("the curve drops exactly the sag at its middle, and passes through both pins", () => {
  const cases: [Point, Point][] = [
    [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    [{ x: 40, y: 200 }, { x: 320, y: 90 }],
    [{ x: 0, y: 0 }, { x: 2000, y: 300 }],
  ];
  for (const [a, b] of cases) {
    const mid = stringPoint(a, b, 0.5);
    nearPoint(mid, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + sagFor(a, b) });
    nearPoint(stringPoint(a, b, 0), a);
    nearPoint(stringPoint(a, b, 1), b);
    // Sagging means hanging: every point between the pins lies on or below the chord.
    for (let t = 0.05; t < 1; t += 0.05) {
      const p = stringPoint(a, b, t);
      const chordY = a.y + ((b.y - a.y) * (p.x - a.x)) / (b.x - a.x);
      assert.ok(p.y >= chordY - 1e-9, `t ${t} rides above the chord`);
    }
  }
});

test("the string hangs the same whichever pin is dragged", () => {
  const a = { x: 15, y: 260 };
  const b = { x: 400, y: 20 };
  nearPoint(stringControl(a, b), stringControl(b, a));
  // Following a drag: moving B moves the control, and the sag tracks the new gap.
  const moved = { x: 60, y: 260 };
  nearPoint(stringControl(a, moved), { x: 37.5, y: 260 + 2 * 11.25 });
});

test("pins on top of each other give a zero-length string, not NaN", () => {
  assert.equal(stringPath({ x: 5, y: 5 }, { x: 5, y: 5 }), "M 5 5 Q 5 5 5 5");
});

test("numbers print to two decimals, never as -0 or in exponent form", () => {
  assert.equal(stringPath({ x: 1 / 3, y: -0 }, { x: 2 / 3, y: -0.001 }), "M 0.33 0 Q 0.5 0.17 0.67 0");
  assert.equal(stringPath({ x: 1e-9, y: 1e-9 }, { x: 1e-9, y: 1e-9 }), "M 0 0 Q 0 0 0 0");
  assert.doesNotMatch(stringPath({ x: -0.004, y: 1 }, { x: 1e5, y: 3 }), /e|-0\b/);
});

test("projects sharing a tag are joined, each pair once, in list order", () => {
  const pairs = relatedPairs([
    { id: "shore", tags: ["timer", "Sea"] },
    { id: "orrery", tags: ["space", "ink"] },
    { id: "planisphere", tags: ["Space ", "maps"] },
    { id: "vinyl", tags: ["music", "sea"] },
    { id: "rotor", tags: [] },
  ]);
  assert.deepEqual(pairs, [
    ["shore", "vinyl"],
    ["orrery", "planisphere"],
  ]);
});

test("blank tags join nothing and a repeated id is read once", () => {
  assert.deepEqual(
    relatedPairs([
      { id: "a", tags: ["", "  "] },
      { id: "b", tags: [" "] },
    ]),
    [],
  );
  assert.deepEqual(
    relatedPairs([
      { id: "a", tags: ["x"] },
      { id: "a", tags: ["x"] },
      { id: "b", tags: ["x", "y"] },
    ]),
    [["a", "b"]],
  );
  assert.deepEqual(relatedPairs([]), []);
});
