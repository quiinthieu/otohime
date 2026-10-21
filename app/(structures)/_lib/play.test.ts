// The clock: 12 fps on twos, so a 4-beat move is done after 24 ticks and not
// after 23; settle lands on the last beat; step mode ignores ticks and shows a
// beat a press; the drawing lands on the beat landing() picks.
import assert from "node:assert/strict";
import { test } from "node:test";
import { replay, type Beat, type Move } from "./machine.ts";
import { busy, finished, FPS, landing, lit, next, saying, setMode, settle, shown, sofar, start, stepsSoFar, tick, TICK_MS, TICKS_PER_BEAT, type Play } from "./play.ts";
import { sceneFor } from "./scenes.ts";
import { bySlug } from "./structures/index.ts";

const four: Beat[] = [
  { say: "6 is less than 8, so go left.", hot: ["n8"], step: true },
  { say: "6 is more than 3, so go right.", hot: ["n3"], step: true },
  { say: "This is 6: found it.", hot: ["n6"], step: true },
  { say: "Found 6 in 3 steps.", hot: ["n6"] },
];
const move = (trace: Beat[]): Move<string> => ({ state: "after", trace, steps: trace.filter((b) => b.step).length });
const ticks = <S>(p: Play<S>, n: number) => {
  for (let i = 0; i < n; i++) p = tick(p);
  return p;
};

test("12 frames a second, 6 a beat: half a second a beat", () => {
  assert.equal(FPS, 12);
  assert.equal(TICKS_PER_BEAT, 6);
  assert.equal(TICK_MS * TICKS_PER_BEAT, 500);
});

test("a 4-beat trace is done after 24 ticks, not after 23", () => {
  const p = start("before", move(four));
  assert.equal(p.beat, 0);
  assert.equal(p.done, false);
  assert.ok(busy(p));
  assert.equal(ticks(p, 5).beat, 0);
  assert.equal(ticks(p, 6).beat, 1);
  assert.equal(ticks(p, 18).beat, 3);
  assert.equal(saying(ticks(p, 18)), "Found 6 in 3 steps.");
  assert.equal(ticks(p, 23).done, false);
  assert.equal(ticks(p, 24).done, true);
  assert.equal(ticks(p, 24).beat, 3);
  assert.ok(!busy(ticks(p, 24)));
  assert.deepEqual(ticks(p, 30), ticks(p, 24), "a done move ignores ticks");
});

test("settle lands on the last beat at once", () => {
  const p = settle(start("before", move(four)));
  assert.equal(p.beat, 3);
  assert.equal(p.done, true);
  assert.equal(saying(p), "Found 6 in 3 steps.");
  assert.equal(shown(p), "after");
  assert.equal(sofar(p).length, 4);
  assert.equal(stepsSoFar(p), 3);
});

test("step mode ignores ticks and shows one more beat a press", () => {
  const p = start("before", move(four), "step");
  assert.ok(!busy(p), "the buttons do not wait in step mode");
  assert.deepEqual(ticks(p, 50), p);
  const said = [p, next(p), next(next(p)), next(next(next(p)))].map(saying);
  assert.deepEqual(said, four.map((b) => b.say));
  assert.equal(next(next(p)).done, false);
  assert.equal(next(next(next(p))).done, true);
  assert.deepEqual(next(next(next(next(p)))), next(next(next(p))), "past the last beat nothing changes");
  assert.equal(stepsSoFar(next(p)), 2);
});

test("switching mode keeps the beat; a one-beat move is done at once in step mode", () => {
  const p = ticks(start("before", move(four)), 7);
  const s = setMode(p, "step");
  assert.equal(s.beat, 1);
  assert.equal(s.mode, "step");
  assert.deepEqual(tick(s), s);
  const back = setMode(next(s), "play");
  assert.equal(back.beat, 2);
  assert.equal(ticks(back, 12).done, true);
  assert.equal(start("x", move([{ say: "Nope." }]), "step").done, true);
  assert.equal(start("x", move([{ say: "Nope." }])).done, false);
});

test("the drawing shows the state before the move until the landing beat", () => {
  const p = start("before", move(four), "play", 2);
  assert.equal(shown(p), "before");
  assert.equal(shown(ticks(p, 6)), "before");
  assert.equal(shown(ticks(p, 12)), "after");
  assert.deepEqual([...lit(p)], ["n8"]);
});

test("landing: the first beat that lights something new, else the last step, else the last beat", () => {
  assert.equal(landing(four, new Set(["n8", "n3", "n6"])), 2, "a find lands on its last look");
  assert.equal(landing([{ say: "a", hot: ["p0"] }, { say: "b", hot: ["p9"], step: true }, { say: "c" }], new Set(["p0"])), 1);
  assert.equal(landing([{ say: "a" }, { say: "b" }], new Set()), 1);
  assert.equal(landing([], new Set()), 0);
});

test("on the stack, Push lands on its first beat and Pop on its first, with the plate gone", () => {
  const stack = bySlug("stack")!;
  const { state } = replay(stack, stack.example);
  const ids = (s: unknown) => new Set(sceneFor("stack", s).stamps.map((p) => p.id));
  const push = stack.reduce(state, { move: "push", value: 9 });
  assert.equal(landing(push.trace, ids(state)), 0);
  const pop = stack.reduce(state, { move: "pop" });
  assert.equal(landing(pop.trace, ids(state)), 0);
});

test("finished: the page's first picture is the example's last move, played out", () => {
  const stack = bySlug("stack")!;
  const { state, last } = replay(stack, stack.example);
  const p = finished(state, last.trace);
  assert.equal(p.done, true);
  assert.equal(saying(p), "2 goes on top.");
  assert.equal(sofar(p).length, last.trace.length);
  assert.equal(shown(p), state);
  assert.equal(finished(state, []).beat, 0);
});
