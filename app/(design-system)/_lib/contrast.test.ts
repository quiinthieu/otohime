// The rule line, checked against WCAG 2's own numbers: 21 for black on
// white, and the board's papers and spots as a contrast checker gives them.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT, PAPERS, SPOTS, turn } from "./board.ts";
import { contrast, luminance, OFF_SAY, rule } from "./contrast.ts";

const near = (actual: number, expected: number, tol = 0.05) => assert.ok(Math.abs(actual - expected) <= tol, `${actual.toFixed(3)}, not ${expected}`);

test("luminance: black 0, white 1, and only #rrggbb", () => {
  assert.equal(luminance("#000000"), 0);
  assert.equal(luminance("#ffffff"), 1);
  near(luminance("#808080"), 0.2159, 0.0005);
  assert.throws(() => luminance("#fff"));
  assert.throws(() => luminance("blue"));
});

test("contrast is WCAG 2's ratio", () => {
  assert.equal(contrast("#000000", "#ffffff"), 21);
  near(contrast("#2456b3", "#f6f3ea"), 6.2);
  near(contrast("#ef6a4c", "#f6f3ea"), 2.8);
  near(contrast("#2456b3", "#161513"), 2.7);
  near(contrast("#f4b829", "#161513"), 10.2);
  near(contrast("#1d1b17", "#f6f3ea"), 15.5);
  assert.equal(contrast("#123456", "#123456"), 1);
});

test("contrast is symmetric", () => {
  const colours = [...Object.values(SPOTS), ...Object.values(PAPERS).flatMap((p) => [p.paper, p.ink])];
  for (const a of colours) for (const b of colours) assert.equal(contrast(a, b), contrast(b, a), `${a} ${b}`);
});

test("the default board passes: ink 15.5, spot 6.2", () => {
  const r = rule(DEFAULT);
  assert.equal(r.say, "Ink on paper 15.5 to 1, passes. Spot on paper 6.2 to 1, passes.");
  assert.equal(r.passes, true);
  near(r.ink, 15.5);
  near(r.spot, 6.2);
});

test("spot coral on cream fails, and the rule line says so", () => {
  const r = rule(turn(DEFAULT, { knob: "spot", to: "coral" }).board);
  assert.equal(r.passes, false);
  assert.equal(r.say, "Ink on paper 15.5 to 1, passes. Spot on paper 2.8 to 1, fails.");
});

test("on night paper, spot blue fails and spot yellow passes", () => {
  const night = turn(DEFAULT, { knob: "paper", to: "night" }).board;
  const blue = rule(night);
  assert.equal(blue.passes, false);
  assert.match(blue.say, /Spot on paper 2\.7 to 1, fails\.$/);
  const yellow = rule(turn(night, { knob: "spot", to: "yellow" }).board);
  assert.equal(yellow.passes, true);
  assert.match(yellow.say, /Spot on paper 10\.2 to 1, passes\.$/);
});

test("shade mends coral on cream", () => {
  assert.equal(rule(turn(DEFAULT, { knob: "spot", to: "shade" }).board).passes, true);
});

test("with the system off there is no rule to check", () => {
  const off = turn(DEFAULT, { knob: "system", to: false }).board;
  const r = rule(off);
  assert.equal(r.say, "No system, so no rule to check: 9 parts pick their own colours.");
  assert.equal(r.say, OFF_SAY);
  assert.equal(r.passes, false);
});
