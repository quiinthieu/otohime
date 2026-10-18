import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boardBusy,
  conveyor,
  conveyorBusy,
  LANES,
  newClaw,
  newConveyor,
  claw,
  newBoard,
  newPad,
  pad,
  PLUG,
  SLOTS,
  switchboard,
  type BoardAction,
  type ClawAction,
  type ConveyorAction,
  type PadAction,
} from "./machines.ts";

const call = (...actions: BoardAction[]) => actions.reduce(switchboard, newBoard());

test("a call plugs in, rings, then someone picks up", () => {
  const ringing = call(0, ...Array<BoardAction>(PLUG).fill("tick"));
  assert.equal(boardBusy(ringing), true);
  const s = call(0, "settle");
  assert.equal(boardBusy(s), false);
  assert.equal(s.line, 0);
  assert.equal(s.calls, 1);
  assert.equal(switchboard(s, 0), s);
});

test("another line mid-call moves the cord; the same line carries on", () => {
  const s = call(0, "tick", "tick", 2);
  assert.equal(s.line, 2);
  assert.equal(s.t, 0);
  assert.equal(s.calls, 0);
  assert.equal(call(0, "tick", 0).t, 1);
});

const tap = (...actions: PadAction[]) => actions.reduce(pad, newPad(4));

test("the console's cursor wraps around the menu both ways", () => {
  assert.equal(tap("up").cursor, 3);
  assert.equal(tap("down", "down", "down", "down").cursor, 0);
  assert.equal(tap("a").cursor, 0);
});

test("a console button stays down for two frames, then lets go", () => {
  assert.equal(tap("a").pressed, "a");
  assert.equal(tap("a", "tick").pressed, "a");
  assert.equal(tap("a", "tick", "tick").pressed, null);
  assert.equal(tap("down", "settle").pressed, null);
  assert.equal(tap("down", "settle").cursor, 1);
});

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
