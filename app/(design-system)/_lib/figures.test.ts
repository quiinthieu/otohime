// The three infographics agree with the engine: each fits the frame with
// legible labels and something in spot; the box names POTS, PARTS and
// PATTERNS by their lengths and draws that many; the follow card's columns
// are turn()'s counts; the here card has one scrap a SIBLINGS row; and each
// draws the same twice.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT, PARTS, PATTERNS, POTS, turn } from "./board.ts";
import { boxFigure } from "./figures/box.ts";
import { FOLLOW_TURN, followFigure, followTurns } from "./figures/follow.ts";
import { hereFigure, NO_PAPER } from "./figures/here.ts";
import { figureProblems, SMALL, type Figure } from "./kit.ts";
import { CREAMS, INK_COUNT, PAPER_COUNT, SIBLINGS } from "./siblings.ts";

const numbers = (fig: Figure) => fig.labels.flatMap((l) => [...l.text.matchAll(/\d+/g)].map((m) => Number(m[0])));

const FIGURES: [string, () => Figure, number][] = [
  ["box", boxFigure, 12],
  ["follow", followFigure, 12],
  ["here", hereFigure, 2 * SIBLINGS.length + 3],
];

for (const [name, draw, maxLabels] of FIGURES) {
  const fig = draw();
  test(`${name}: in frame, at most ${maxLabels} labels of ${SMALL} or more, something in spot`, () => {
    assert.deepEqual(figureProblems(fig, maxLabels), []);
    assert.ok(fig.labels.every((l) => l.size >= SMALL));
    assert.ok(fig.spot.length > 0 || fig.labels.some((l) => l.spot), "something in spot");
  });
  test(`${name}: the same figure twice`, () => {
    assert.deepEqual(draw(), fig);
  });
}

test(`the box names ${POTS.length} pots, ${PARTS.length} parts and ${PATTERNS.length} patterns from the constants`, () => {
  const fig = boxFigure();
  assert.deepEqual(numbers(fig), [POTS.length, PARTS.length, PATTERNS.length]);
  assert.deepEqual(numbers(fig), [8, 9, 3]);
  for (const text of [`${POTS.length} pots`, `${PARTS.length} parts`, `${PATTERNS.length} patterns`]) {
    assert.ok(fig.labels.some((l) => l.text === text), text);
  }
  assert.ok(fig.labels.some((l) => /rulebook/.test(l.text)), "the rulebook on the lid");
  // one spot pot (a circle) and one arrow in two legs (three strokes each)
  assert.equal(fig.spot.length, 1 + 2 * 3);
});

test("the follow card's columns are turn()'s: the system on follows with every part, off with none", () => {
  const { on, off } = followTurns();
  assert.deepEqual(on, turn(DEFAULT, FOLLOW_TURN));
  assert.deepEqual(FOLLOW_TURN, { knob: "spot", to: "coral" });
  assert.equal(on.followed.length, PARTS.length);
  assert.equal(off.followed.length, 0);
  const fig = followFigure();
  // the one pot, then a spot line to each part that followed
  assert.equal(fig.spot.length, 1 + on.followed.length + off.followed.length);
  assert.ok(fig.labels.some((l) => l.text === `1 pot, ${on.followed.length} followed` && l.spot));
  assert.ok(fig.labels.some((l) => l.text === `${PARTS.length} hands, ${off.followed.length} followed`));
  assert.deepEqual(numbers(fig), [1, PARTS.length, PARTS.length, 0]);
});

test(`the here card has ${SIBLINGS.length} scraps, one a sheet, each with its hex and its decisions`, () => {
  const fig = hereFigure();
  assert.equal(fig.scraps.length, SIBLINGS.length);
  assert.deepEqual(fig.scraps.map((s) => s.sheet), SIBLINGS.map((s) => s.group));
  assert.equal(new Set(fig.scraps.map((s) => s.sheet)).size, SIBLINGS.length);
  SIBLINGS.forEach((s, i) => {
    assert.equal(fig.scraps[i].paper, s.paper, s.group);
    assert.equal(fig.scraps[i].decisions, s.decisions, s.group);
    assert.ok(fig.labels.some((l) => l.text === (s.paper ?? NO_PAPER)), `${s.group}'s hex`);
    assert.ok(fig.labels.some((l) => l.text === s.group), `${s.group}'s name`);
  });
  // a scrap is two paths (its fill and outline, or with no paper its outline
  // and a cross), then one box a decision
  const decisions = SIBLINGS.reduce((n, s) => n + s.decisions, 0);
  assert.equal(fig.paths.length, 2 * SIBLINGS.length + decisions);
  assert.ok(fig.paths.filter((p) => p.fill).every((p) => SIBLINGS.some((s) => s.paper === p.fill)), "scraps filled with their own paper");
  // the counts in spot are the pins'
  const spot = fig.labels.filter((l) => l.spot).map((l) => l.text);
  assert.deepEqual(spot, [`--paper in ${PAPER_COUNT}`, `--ink in ${INK_COUNT}`, `${CREAMS} creams`]);
});
