import assert from "node:assert/strict";
import { test } from "node:test";
import { createPreviewCommit, type PreviewClock } from "./preview-commit.ts";

function fixture() {
  let id = 0;
  const frames = new Map<number, () => void>();
  const timers = new Map<number, { callback: () => void; ms: number }>();
  const clock: PreviewClock = {
    frame(callback) { frames.set(++id, callback); return id; },
    cancelFrame(id) { frames.delete(id); },
    later(callback, ms) { timers.set(++id, { callback, ms }); return id; },
    cancelLater(id) { timers.delete(id); },
  };
  return { queue: createPreviewCommit(clock), frames, timers };
}

test("a burst commits only its latest input on the next frame and cancels the deadline", () => {
  const { queue, frames, timers } = fixture();
  const values: number[] = [];
  for (const n of [1, 2, 3]) queue.schedule(() => values.push(n));
  assert.equal(frames.size, 1);
  const lateTimer = [...timers.values()][0]?.callback;
  [...frames.values()][0]();
  assert.deepEqual(values, [3]);
  assert.equal(frames.size + timers.size, 0);
  lateTimer?.();
  assert.deepEqual(values, [3], "a queued losing callback cannot commit twice");
});

test("a withheld animation frame still commits the latest input at the 16ms deadline", () => {
  const { queue, frames, timers } = fixture();
  const values: number[] = [];
  queue.schedule(() => values.push(1));
  queue.schedule(() => values.push(2));
  const lateFrame = [...frames.values()][0];
  assert.equal(timers.size, 1, "late rAF needs an independent deadline");
  const timer = [...timers.values()][0];
  assert.equal(timer.ms, 16);
  timer.callback();
  assert.deepEqual(values, [2]);
  assert.equal(frames.size + timers.size, 0);
  lateFrame();
  assert.deepEqual(values, [2]);
});

test("cancel clears both schedules and stale callbacks cannot commit a later generation", () => {
  const { queue, frames, timers } = fixture();
  const values: number[] = [];
  queue.schedule(() => values.push(1));
  const old = [...frames.values(), ...[...timers.values()].map(t => t.callback)];
  queue.cancel();
  assert.equal(frames.size + timers.size, 0);
  queue.schedule(() => values.push(2));
  for (const callback of old) callback();
  assert.deepEqual(values, []);
  [...frames.values()][0]();
  assert.deepEqual(values, [2]);
});

test("a commit can schedule another update without losing it to the old cleanup", () => {
  const { queue, frames, timers } = fixture();
  const values: number[] = [];
  queue.schedule(() => {
    values.push(1);
    queue.schedule(() => values.push(2));
  });
  [...frames.values()][0]();
  assert.equal(frames.size, 1);
  assert.equal(timers.size, 1);
  [...frames.values()][0]();
  assert.deepEqual(values, [1, 2]);
  assert.equal(frames.size + timers.size, 0);
});
