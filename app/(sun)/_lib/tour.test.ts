import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAPTER_COUNT, ENTER_FRAMES, HOLD_FRAMES, newTour, step, type Tour, type TourAction } from "./tour.ts";

const run = (t: Tour, ...actions: TourAction[]) => actions.reduce(step, t);
const ticks = (t: Tour, n: number) => {
  for (let i = 0; i < n; i++) t = step(t, "tick");
  return t;
};
const settled = (chapter: number): Tour => ({ ...newTour(), chapter });

test("a new tour rests on chapter 0, not playing", () => {
  assert.deepEqual(newTour(), { chapter: 0, phase: "settled", frame: 0, playing: false, held: 0 });
  assert.equal(CHAPTER_COUNT, 8);
});

test("next and back move to a different chapter, entering at frame 0", () => {
  const n = step(newTour(), "next");
  assert.deepEqual(n, { chapter: 1, phase: "entering", frame: 0, playing: false, held: 0 });
  assert.deepEqual(step(settled(3), "back"), { chapter: 2, phase: "entering", frame: 0, playing: false, held: 0 });
});

test("next on the last, back on the first and goto the current chapter do nothing", () => {
  const last = settled(7);
  const first = newTour();
  assert.equal(step(last, "next"), last);
  assert.equal(step(first, "back"), first);
  const here = settled(4);
  assert.equal(step(here, { goto: 4 }), here);
  assert.deepEqual(step(settled(4), { goto: 4 }), settled(4));
});

test("goto clamps to [0, 7] and ignores non-integers", () => {
  assert.equal(step(newTour(), { goto: 99 }).chapter, 7);
  assert.equal(step(settled(5), { goto: -3 }).chapter, 0);
  assert.equal(step(settled(2), { goto: 5 }).chapter, 5);
  for (const bad of [1.5, NaN, Infinity]) {
    const t = settled(2);
    assert.deepEqual(step(t, { goto: bad }), t);
  }
});

test("frames only advance on tick", () => {
  const t = step(newTour(), "next");
  assert.deepEqual(run(t, "pause", "pause"), t);
  assert.equal(ticks(t, 3).frame, 3);
  assert.equal(run(newTour(), "pause", "back").frame, 0);
});

test("entering settles after ENTER_FRAMES ticks, and holds do not count until then", () => {
  let t = run(newTour(), "play", "next");
  t = run(t, "play");
  assert.equal(t.phase, "entering");
  t = ticks(t, ENTER_FRAMES - 1);
  assert.equal(t.phase, "entering");
  assert.equal(t.held, 0);
  t = step(t, "tick");
  assert.deepEqual(t, { chapter: 1, phase: "settled", frame: 0, playing: true, held: 0 });
  assert.equal(step(t, "tick").held, 1);
});

test("a settled tour that is not playing ignores ticks", () => {
  assert.deepEqual(ticks(newTour(), 500), newTour());
});

test("settle ends entering at once and leaves held and playing alone", () => {
  const t = { chapter: 3, phase: "entering", frame: 4, playing: true, held: 7 } as const;
  assert.deepEqual(step(t, "settle"), { chapter: 3, phase: "settled", frame: 0, playing: true, held: 7 });
  const s = settled(2);
  assert.deepEqual(step(s, "settle"), s);
  assert.equal(step({ ...s, playing: true, held: 5 }, "settle").held, 5);
});

test("a manual press stops Play", () => {
  const playing = run(newTour(), "play");
  assert.equal(playing.playing, true);
  assert.equal(step(playing, "next").playing, false);
  assert.equal(step(settled(3), "play").playing, true);
  assert.equal(run(settled(3), "play", "back").playing, false);
  assert.equal(run(settled(3), "play", { goto: 6 }).playing, false);
  assert.equal(run(settled(3), "play", "pause").playing, false);
});

test("play resets the hold; at the last chapter it restarts at chapter 0", () => {
  const p = step({ ...settled(2), held: 40 }, "play");
  assert.deepEqual(p, { chapter: 2, phase: "settled", frame: 0, playing: true, held: 0 });
  assert.deepEqual(step(settled(7), "play"), { chapter: 0, phase: "entering", frame: 0, playing: true, held: 0 });
});

test("Play visits every chapter in order on ticks alone and stops on the last", () => {
  let t = step(newTour(), "play");
  const seen = [t.chapter];
  let n = 0;
  while (t.playing && n < 8 * (ENTER_FRAMES + HOLD_FRAMES)) {
    t = step(t, "tick");
    n++;
    if (t.chapter !== seen[seen.length - 1]) seen.push(t.chapter);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(t.chapter, 7);
  assert.equal(t.playing, false);
  assert.ok(n <= 8 * (ENTER_FRAMES + HOLD_FRAMES));
  // and it stays put afterwards
  assert.deepEqual(ticks(t, 500), t);
});

test("a chapter holds for HOLD_FRAMES ticks before Play moves on", () => {
  let t = step(newTour(), "play");
  t = ticks(t, HOLD_FRAMES - 1);
  assert.equal(t.chapter, 0);
  t = step(t, "tick");
  assert.deepEqual(t, { chapter: 1, phase: "entering", frame: 0, playing: true, held: 0 });
});
