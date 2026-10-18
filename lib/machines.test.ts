import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claw,
  conveyor,
  conveyorBusy,
  LANES,
  newClaw,
  newConveyor,
  SLOTS,
  type ClawAction,
  type ConveyorAction,
} from "./machines.ts";

const press = (n: number, action: ClawAction): ClawAction[] => Array(n).fill(action);
const play = (start = newClaw(6), ...actions: ClawAction[]) => actions.reduce(claw, start);

test("a drop over a capsule wins that game and carries it to the chute", () => {
  const s = play(undefined, ...press(3, "right"), "drop", "settle");
  assert.equal(s.phase, "idle");
  assert.equal(s.prizes, 1);
  assert.equal(s.last, 2);
  assert.equal(s.slot, 0);
  assert.equal(s.capsules.length, 5);
  assert.ok(s.capsules.every((c) => c.slot !== 3));
});

test("a drop over the chute comes back empty", () => {
  const s = play(undefined, "drop", "settle");
  assert.equal(s.prizes, 0);
  assert.equal(s.missed, true);
  assert.deepEqual(s.capsules, newClaw(6).capsules);
});

test("the claw ignores moves mid-drop and stays in the cabinet", () => {
  assert.equal(play(undefined, "drop", "tick", "right").slot, 0);
  assert.equal(play(undefined, "left").slot, 0);
  assert.equal(play(undefined, ...press(SLOTS + 3, "right")).slot, SLOTS);
});

test("winning the last capsule refills the cabinet", () => {
  const s = play(newClaw(2), "right", "drop", "settle", ...press(2, "right"), "drop", "settle");
  assert.equal(s.prizes, 2);
  assert.deepEqual(s.capsules, newClaw(2).capsules);
});

const run = (...actions: ConveyorAction[]) => actions.reduce(conveyor, newConveyor());
const total = (bins: number[]) => bins.reduce((a, b) => a + b, 0);

test("a batch runs every parcel into a bin", () => {
  const s = run("run", "settle");
  assert.equal(conveyorBusy(s), false);
  assert.equal(total(s.bins), 8);
  assert.equal(s.batches, 1);
  assert.ok(s.rows > 0);
  assert.equal(s.rows, s.batch);
});

test("the belt ignores run mid-batch, and truncate empties the bins", () => {
  assert.equal(run("run", "tick", "run").queue.length, 7);
  const s = run("run", "settle", "truncate");
  assert.deepEqual(s.bins, Array(LANES).fill(0));
  assert.equal(s.rows, 0);
  assert.equal(s.batches, 1);
});
