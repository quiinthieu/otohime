import assert from "node:assert/strict";
import { test } from "node:test";
import { cupLevel, DIAL_WORDS, mercuryHeight, needleAngle, QUIET, vaneAngle } from "./dial.ts";

const near = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test("the needle: the ends and the middle of the dial", () => {
  assert.equal(needleAngle(950), -135);
  assert.equal(needleAngle(1000), 0);
  assert.equal(needleAngle(1050), 135);
});

test("the needle: 1011.2 hPa is 30.24 degrees, Mexico City's 1021.7 is 58.59", () => {
  near(needleAngle(1011.2), 30.24, 1e-9);
  near(needleAngle(1021.7), 58.59, 1e-9);
});

test("the needle clamps outside 950..1050", () => {
  assert.equal(needleAngle(900), -135);
  assert.equal(needleAngle(1100), 135);
  assert.equal(needleAngle(0), -135);
});

test("the needle is monotonic over 950..1050", () => {
  for (let p = 950; p < 1050; p++) assert.ok(needleAngle(p + 1) > needleAngle(p), String(p));
});

test("the dial's words, in order, each on the dial", () => {
  assert.deepEqual(
    DIAL_WORDS.map((w) => [w.hpa, w.word]),
    [[955, "Stormy"], [975, "Rain"], [1000, "Change"], [1025, "Fair"], [1045, "Very Dry"]],
  );
  for (const w of DIAL_WORDS) assert.ok(Math.abs(needleAngle(w.hpa)) <= 135, w.word);
});

test("mercury: 26.9 °C stands at 0.7215 and the column clamps", () => {
  near(mercuryHeight(26.9), 0.7215, 1e-4);
  assert.equal(mercuryHeight(-20), 0);
  assert.equal(mercuryHeight(45), 1);
  assert.equal(mercuryHeight(-50), 0);
  assert.equal(mercuryHeight(60), 1);
});

test("the cup: 0.1 mm is 0.02, full at 5 mm, and it clamps", () => {
  near(cupLevel(0.1), 0.02, 1e-12);
  assert.equal(cupLevel(5), 1);
  assert.equal(cupLevel(40), 1);
  assert.equal(cupLevel(0), 0);
  assert.equal(cupLevel(-1), 0);
});

test("the vane: degrees wrap at 360", () => {
  assert.equal(vaneAngle(336), 336);
  assert.equal(vaneAngle(0), 0);
  assert.equal(vaneAngle(360), 0);
  assert.equal(vaneAngle(370), 10);
  assert.equal(vaneAngle(-90), 270);
});

test("the station at rest", () => {
  assert.deepEqual({ ...QUIET }, { needle: -135, mercury: 0, vane: 0, cup: 0 });
  assert.equal(QUIET.needle, needleAngle(950));
});
