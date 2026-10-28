import assert from "node:assert/strict";
import test from "node:test";
import { createFortuneState, fortuneReducer, visibleNumbers, FORTUNE_COLOURS, type FortuneColour } from "./fortune.ts";
import type { FortuneTarget } from "./fortune-targets.ts";

const targets: FortuneTarget[] = [{ id: "a", label: "A", href: "/notes#a", kind: "note" }, { id: "b", label: "B", href: "/shore", kind: "project" }];
const reduce = fortuneReducer;

test("each colour and number completes the strict game sequence", () => {
  for (const colour of FORTUNE_COLOURS) for (const first of [1, 2, 3, 4, 5, 6, 7, 8]) {
    let state = createFortuneState("same", targets);
    state = reduce(state, { type: "choose-colour", colour: colour.id });
    assert.equal(state.phase, "count-colour");
    assert.equal(reduce(state, { type: "choose-first-number", number: first }), state);
    state = reduce(state, { type: "finish-counting" });
    assert.equal(state.phase, "choose-first-number");
    if (!visibleNumbers(state).includes(first)) continue;
    state = reduce(state, { type: "choose-first-number", number: first });
    assert.equal(state.phase, "count-number");
    state = reduce(state, { type: "finish-counting" });
    assert.equal(state.phase, "choose-final-number");
    const final = visibleNumbers(state)[0];
    state = reduce(state, { type: "choose-final-number", number: final });
    assert.equal(state.phase, "ready-reveal");
    state = reduce(state, { type: "reveal" });
    assert.equal(state.phase, "revealed");
    assert.ok(state.target?.href.startsWith("/"));
    assert.equal(reduce(state, { type: "reveal" }), state);
  }
});

test("count ticks, pinches, malformed input and reset cannot skip phases", () => {
  const start = createFortuneState(7, targets);
  assert.equal(reduce(start, { type: "tick" }), start);
  assert.equal(reduce(start, { type: "choose-colour", colour: "bogus" as FortuneColour }), start);
  let state = reduce(start, { type: "pinch" });
  assert.equal(state.phase, "choose-colour");
  state = reduce(state, { type: "choose-colour", colour: "coral" });
  assert.equal(reduce(state, { type: "choose-colour", colour: "blue" }), state);
  for (let i = 0; i < 5; i++) state = reduce(state, { type: "tick" });
  assert.equal(state.phase, "choose-first-number");
  assert.equal(state.count, 5);
  assert.equal(reduce(state, { type: "choose-first-number", number: 9 }), state);
  assert.equal(reduce(state, { type: "choose-first-number", number: visibleNumbers(state)[0] + 1 }), state);
  assert.deepEqual(reduce(state, { type: "reset", seed: "new", targets }), createFortuneState("new", targets));
});

test("seed and content snapshot reproduce a target; empty sources stay local", () => {
  function play(seed: string, pool: FortuneTarget[]) {
    let s = createFortuneState(seed, pool);
    s = reduce(s, { type: "choose-colour", colour: "yellow" });
    s = reduce(s, { type: "finish-counting" });
    s = reduce(s, { type: "choose-first-number", number: visibleNumbers(s)[0] });
    s = reduce(s, { type: "finish-counting" });
    s = reduce(s, { type: "choose-final-number", number: visibleNumbers(s)[0] });
    return reduce(s, { type: "reveal" }).target;
  }
  assert.deepEqual(play("a", targets), play("a", targets));
  assert.deepEqual(play("empty", []), { id: "fortune-fallback", label: "Projects", href: "/projects", kind: "project" });
  assert.deepEqual(play("unsafe", [{ id: "bad", label: "Bad", href: "//evil.test", kind: "project" }]), { id: "fortune-fallback", label: "Projects", href: "/projects", kind: "project" });
  assert.ok(["a", "b"].includes(play("a", targets)?.id ?? ""));
  assert.equal(play("a", [...targets, { id: "c", label: "C", href: "/music#c", kind: "song" }])?.href.startsWith("/"), true);
});

test("seed changes shuffle order without mutating the supplied pool", () => {
  const pool = Array.from({ length: 12 }, (_, i): FortuneTarget => ({ id: String(i), label: String(i), href: `/p${i}`, kind: "project" }));
  const before = pool.map((item) => item.id);
  const orders = new Set(["first", "second", "third"].map((seed) => createFortuneState(seed, pool).pool.map((item) => item.id).join(",")));
  assert.ok(orders.size > 1);
  assert.deepEqual(pool.map((item) => item.id), before);
});
