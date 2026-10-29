import assert from "node:assert/strict";
import { test } from "node:test";
import { optimiseStrokes, plotterSvg, simplify, splitSubpaths, type PlotStroke } from "./plotter.ts";
const stroke = (id: string, x: number, y: number, colour = "#231e16"): PlotStroke => ({ id, colour, points: [[x, y], [x + 1, y]] });

test("travel sorting preserves colours, deduplicates reversed paths, and never increases travel", () => {
  const one = stroke("a", 0, 0);
  const input = [one, stroke("b", 100, 0), stroke("c", 10, 0), stroke("d", 20, 0, "#ff0000"), { ...one, points: [...one.points].reverse() }];
  const result = optimiseStrokes(input);
  assert.ok(result.after < result.before);
  assert.equal(result.strokes.length, 4);
  assert.deepEqual(result.strokes.map(s => s.id), ["a", "c", "b", "d"]);
  assert.equal(optimiseStrokes([stroke("bad", NaN, 0)]).strokes.length, 0);
});
test("simplification retains corners and nearby endpoints merge", () => {
  assert.deepEqual(simplify([[0, 0], [1, 0], [2, 0], [2, 2]]), [[0, 0], [2, 0], [2, 2]]);
  assert.equal(optimiseStrokes([stroke("a", 0, 0), stroke("b", 1, 0)]).strokes.length, 1);
});
test("SVG movetos lift the pen, including relative moves after curves and closing", () => {
  assert.deepEqual(splitSubpaths("M10 10h10v20z m30 0 c1 2 3 4 5 6 m2 3l4 5"), ["M 10 10 h 10 v 20 Z", "M 40 10 c 1 2 3 4 5 6", "M 47 19 l 4 5"]);
  assert.deepEqual(splitSubpaths("M1e2,-2e-2 110,0 M0 0L2 2"), ["M 100 -0.02 L 110 0", "M 0 0 L 2 2"]);
});
test("physical SVG output has safe flattened single-line colour layers", () => {
  const svg = plotterSvg([stroke('evil"><script>', -20, -30), stroke("red", 20, 40, "#ff0000")]);
  assert.match(svg, /width="210mm" height="297mm"/);
  assert.equal((svg.match(/inkscape:groupmode="layer"/g) ?? []).length, 2);
  assert.match(svg, /fill="none"/);
  assert.doesNotMatch(svg, /script|transform|foreignObject|image|evil|NaN/);
  assert.match(plotterSvg([stroke("a", 0, 0)], "A5"), /width="148mm"/);
  assert.throws(() => plotterSvg([]), /No inline/);
});
