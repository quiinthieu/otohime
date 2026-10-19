import assert from "node:assert/strict";
import { test } from "node:test";
import { closed, view, type ViewAction } from "./view.ts";

const play = (...actions: ViewAction[]) => actions.reduce(view, closed);

test("starts closed", () => {
  assert.deepEqual(closed, { open: null });
});

test("open then next and prev step by one", () => {
  assert.deepEqual(play({ type: "open", n: 26 }), { open: 26 });
  assert.deepEqual(play({ type: "open", n: 26 }, { type: "next" }), { open: 27 });
  assert.deepEqual(play({ type: "open", n: 26 }, { type: "prev" }, { type: "prev" }), { open: 24 });
});

test("prev from 1 and next from 118 stay put", () => {
  assert.deepEqual(play({ type: "open", n: 1 }, { type: "prev" }), { open: 1 });
  assert.deepEqual(play({ type: "open", n: 118 }, { type: "next" }), { open: 118 });
  const s = play({ type: "open", n: 118 });
  assert.equal(view(s, { type: "next" }), s, "unchanged state keeps its identity");
});

test("close clears, and next/prev/close while closed do nothing", () => {
  assert.deepEqual(play({ type: "open", n: 5 }, { type: "close" }), closed);
  assert.equal(view(closed, { type: "next" }), closed);
  assert.equal(view(closed, { type: "prev" }), closed);
  assert.equal(view(closed, { type: "close" }), closed);
});

test("open clamps to 1..118 and switches straight from one element to another", () => {
  assert.deepEqual(play({ type: "open", n: 0 }), { open: 1 });
  assert.deepEqual(play({ type: "open", n: 500 }), { open: 118 });
  assert.deepEqual(play({ type: "open", n: 3 }, { type: "open", n: 80 }), { open: 80 });
});

test("all 118 can be walked with next and back with prev", () => {
  let s = play({ type: "open", n: 1 });
  for (let i = 2; i <= 118; i++) {
    s = view(s, { type: "next" });
    assert.equal(s.open, i);
  }
  for (let i = 117; i >= 1; i--) s = view(s, { type: "prev" });
  assert.equal(s.open, 1);
});
