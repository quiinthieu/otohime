// The costs card agrees with the machine: every number it prints and every
// box it draws is costs()'s, for each of the eight; it fits the frame with
// legible labels, puts the cheapest row in spot, and draws the same twice.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BAND_WORDS, COST_ROWS, costRows, costsFigure } from "./costs.ts";
import { figureProblems } from "./kit.ts";
import { STRUCTURES } from "./structures/index.ts";

const MAX_LABELS = 14;

for (const s of STRUCTURES) {
  const costs = s.costs();
  const fig = costsFigure(s.slug);
  const summary = COST_ROWS.map((n) => `${n} ${costs[n].steps}`).join(", ");

  test(`${s.slug}: in frame, labels legible, a spot (${summary})`, () => {
    assert.deepEqual(figureProblems(fig, MAX_LABELS), []);
  });

  test(`${s.slug}: every number on the card is costs()'s`, () => {
    const printed = fig.labels.flatMap((l) => [...l.text.matchAll(/\d+/g)].map((m) => Number(m[0])));
    assert.deepEqual(printed, COST_ROWS.map((n) => costs[n].steps));
    for (const n of COST_ROWS) {
      assert.ok(fig.labels.some((l) => l.text === `${n}: ${BAND_WORDS[costs[n].band]}`), `${n}'s band word`);
    }
  });

  test(`${s.slug}: one box a step, ${COST_ROWS.map((n) => costs[n].steps).reduce((a, b) => a + b)} in all`, () => {
    // each box is one ink outline, so the card's paths are its steps
    const total = COST_ROWS.reduce((sum, n) => sum + costs[n].steps, 0);
    assert.equal(fig.paths.length + fig.spot.length, total);
    const best = costRows(s.slug).filter((r) => r.best);
    assert.equal(fig.spot.length, best.reduce((sum, r) => sum + r.steps, 0));
    const least = Math.min(...COST_ROWS.map((n) => costs[n].steps));
    assert.ok(best.length > 0 && best.every((r) => r.steps === least));
  });

  test(`${s.slug}: the same card twice`, () => {
    assert.deepEqual(costsFigure(s.slug), fig);
  });
}

test("rows in card order; an unknown slug throws", () => {
  assert.deepEqual(costRows("stack").map((r) => r.name), ["find", "add", "remove"]);
  assert.ok(costRows("stack").every((r) => r.best), "the stack's three moves tie at one step");
  assert.deepEqual(costRows("array").filter((r) => r.best).map((r) => r.name), ["find", "remove"], "8 looks tie 8 moves");
  assert.throws(() => costRows("nope"));
});
