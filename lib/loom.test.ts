import assert from "node:assert/strict";
import { test } from "node:test";
import { blankPattern, decodePattern, demoPattern, encodePattern, hasBlot, loomNoise, SCORE, scoreBlots, stepSeconds, toggleBlot } from "./loom.ts";

test("every cell, including the high bit, survives a share round trip", () => {
  let pattern = blankPattern();
  for (let row = 0; row < 8; row++) for (let step = 0; step < 16; step++) pattern = toggleBlot(pattern, row, step);
  assert.deepEqual(pattern.rows, Array(8).fill(65535));
  assert.deepEqual(decodePattern(encodePattern(pattern)), pattern);
  assert.deepEqual(decodePattern(encodePattern(demoPattern())), demoPattern());
  const changed = toggleBlot(pattern, 7, 15);
  assert.equal(hasBlot(changed, 7, 15), false);
  assert.equal(hasBlot(pattern, 7, 15), true);
});
test("malformed, excessive, missing and out-of-range hashes fail closed", () => {
  const valid = encodePattern(blankPattern());
  for (const hash of ["", "#hello", valid + "&t=90", valid.replace("108", "181"), valid.replace("108", "59"), valid.replace("s=0", "s=51"), valid.slice(0, -1), valid + "0", valid.replace(/0$/, "z"), valid.replace("t=108", "t=NaN")]) assert.equal(decodePattern(hash), null, hash);
});
test("swing preserves beat length at tempo extremes and on wrap", () => {
  for (const tempo of [60, 108, 180]) for (const swing of [0, 18, 50]) {
    const steps = Array.from({ length: 16 }, (_, step) => stepSeconds(tempo, swing, step));
    assert.ok(steps.every(n => n > 0));
    assert.ok(Math.abs(steps.reduce((a, b) => a + b) - 240 / tempo) < 1e-12);
    assert.equal(stepSeconds(tempo, swing, 16), steps[0]);
  }
});
test("score includes all 128 blots within its printable bounds", () => {
  const blots = scoreBlots({ ...blankPattern(), rows: Array(8).fill(65535) });
  assert.equal(blots.length, 128);
  assert.ok(blots.every(({ x, y }) => x > 0 && y > 0 && x < SCORE.width && y < SCORE.height));
  assert.equal(scoreBlots(blankPattern()).length, 0);
});
test("noise is reproducible, bounded and varies with the seed", () => {
  const samples = loomNoise(285, 4096);
  assert.deepEqual(loomNoise(285, 4096), samples);
  assert.notDeepEqual(loomNoise(286, 4096), samples);
  assert.ok(samples.every(n => n >= -1 && n <= 1));
  assert.ok(samples.some(n => n < -.8) && samples.some(n => n > .8));
});
