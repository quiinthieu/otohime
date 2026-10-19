import assert from "node:assert/strict";
import { test } from "node:test";
import { begin, format, pause, remaining, resume } from "./timer.ts";

const MIN = 60_000;

test("a fresh session has its full length left", () => {
  assert.equal(remaining(1000, begin(25, 1000)), 25 * MIN);
});

test("time runs down and stops at zero", () => {
  const s = begin(15, 0);
  assert.equal(remaining(5 * MIN, s), 10 * MIN);
  assert.equal(remaining(15 * MIN, s), 0);
  assert.equal(remaining(99 * MIN, s), 0);
});

test("a paused session holds still however long the pause", () => {
  const p = pause(begin(25, 0), 10 * MIN);
  assert.equal(remaining(10 * MIN, p), 15 * MIN);
  assert.equal(remaining(500 * MIN, p), 15 * MIN);
});

test("resume skips the paused span", () => {
  const s = resume(pause(begin(25, 0), 10 * MIN), 40 * MIN);
  assert.equal(s.pausedMs, 30 * MIN);
  assert.equal(remaining(45 * MIN, s), 10 * MIN);
  assert.equal(remaining(55 * MIN, s), 0);
});

test("several pauses add up", () => {
  let s = begin(45, 0);
  s = resume(pause(s, 5 * MIN), 10 * MIN);
  s = resume(pause(s, 20 * MIN), 30 * MIN);
  assert.equal(s.pausedMs, 15 * MIN);
  assert.equal(remaining(40 * MIN, s), 20 * MIN);
});

test("pause and resume are no-ops in the wrong state", () => {
  const s = begin(15, 0);
  assert.equal(resume(s, 5), s);
  const p = pause(s, 5);
  assert.equal(pause(p, 9), p);
});

test("a clock that jumps backwards never adds time", () => {
  const s = begin(25, 10 * MIN);
  assert.equal(remaining(0, s), 25 * MIN);
  const p = pause(s, 12 * MIN);
  assert.equal(remaining(0, p), 23 * MIN);
  // resuming with a clock behind the pause start adds no negative pause
  assert.equal(resume(p, 11 * MIN).pausedMs, 0);
});

test("format rounds up to whole seconds", () => {
  assert.equal(format(25 * MIN), "25:00");
  assert.equal(format(24 * MIN + 59_001), "25:00");
  assert.equal(format(999), "00:01");
  assert.equal(format(0), "00:00");
  assert.equal(format(-5), "00:00");
});
