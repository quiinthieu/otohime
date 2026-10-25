import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boardBusy,
  conveyor,
  CORD,
  cordSag,
  jackAt,
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
  SNAP,
  SPRING,
  springAt,
  switchboard,
  type BoardAction,
  type ClawAction,
  type ConveyorAction,
  type PadAction,
  type XY,
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

// Two jacks on a row, and a plug lying well away from both.
const JACKS: XY[] = [
  [100, 100],
  [160, 100],
];
const REST: XY = [130, 220];
const grab = (at: XY = REST): BoardAction => ({ type: "grab", at });
const move = (at: XY): BoardAction => ({ type: "move", at });
const release = (at: XY): BoardAction => ({ type: "release", at, jacks: JACKS });
const ticks = (n: number) => Array<BoardAction>(n).fill("tick");

test("a plug let go within the snap radius of a jack connects that line, ringing then picked up", () => {
  const s = call(grab(), move([150, 120]), release([160 - SNAP, 100]));
  assert.equal(s.line, 1);
  assert.equal(s.held, null);
  assert.equal(s.t, PLUG); // already in the jack: no swing, straight to ringing
  assert.equal(boardBusy(s), true);
  const up = switchboard(s, "settle");
  assert.equal(up.calls, 1);
  assert.equal(boardBusy(up), false);
  // the same result as pressing the line's chip, once both rest
  assert.deepEqual({ line: up.line, calls: up.calls }, { line: call(1, "settle").line, calls: call(1, "settle").calls });
});

test("the snap radius is inclusive at fourteen units and misses just past it", () => {
  assert.equal(jackAt([100 + SNAP, 100], JACKS), 0);
  assert.equal(jackAt([100, 100 - SNAP], JACKS), 0);
  assert.equal(jackAt([100 + SNAP + 0.01, 100], JACKS), null);
  const diagonal = SNAP / Math.SQRT2;
  assert.equal(jackAt([160 - diagonal, 100 + diagonal], JACKS), 1);
  assert.equal(jackAt([130, 100], JACKS), null); // between the two, 30 from each
  assert.equal(jackAt([108, 100], [[100, 100], [112, 100]]), 1); // the nearer of two in reach
  assert.equal(call(grab(), release([160, 100 + SNAP + 0.01])).line, null);
});

test("a missed release springs home over six frames and leaves the line alone", () => {
  const before = call(0, "settle");
  const s = switchboard(switchboard(switchboard(before, grab([100, 100])), move([40, 40])), release([40, 40]));
  assert.equal(s.line, 0);
  assert.equal(s.calls, 1);
  assert.equal(s.held, null);
  assert.deepEqual(s.from, [40, 40]);
  assert.equal(s.back, SPRING);
  assert.equal(springAt(s), 0);
  assert.equal(boardBusy(s), true);
  const five = ticks(SPRING - 1).reduce(switchboard, s);
  assert.equal(boardBusy(five), true);
  assert.notEqual(springAt(five), 1);
  const home = switchboard(five, "tick");
  assert.equal(boardBusy(home), false);
  assert.equal(home.back, 0);
  assert.equal(home.from, null);
  assert.equal(springAt(home), 1);
  assert.equal(home.calls, 1);
});

test("the spring overshoots, comes back and terminates; further ticks change nothing", () => {
  const s = call(grab(), release([10, 10]));
  const path = [springAt(s)];
  let t = s;
  for (let i = 0; i < SPRING; i++) path.push(springAt((t = switchboard(t, "tick"))));
  assert.equal(path[0], 0);
  assert.equal(path.at(-1), 1);
  assert.ok(Math.max(...path) > 1 && Math.max(...path) < 1.15);
  assert.equal(switchboard(t, "tick"), t);
  assert.equal(switchboard(t, "settle"), t);
});

test("pointercancel drops the plug where it was held and springs it home", () => {
  const s = call(grab(), move([70, 60]), { type: "cancel" });
  assert.equal(s.line, null);
  assert.equal(s.held, null);
  assert.deepEqual(s.from, [70, 60]);
  assert.equal(s.back, SPRING);
  // nothing in hand: cancel, move and release are no-ops
  const idle = newBoard();
  assert.equal(switchboard(idle, { type: "cancel" }), idle);
  assert.equal(switchboard(idle, move([1, 1])), idle);
  assert.equal(switchboard(idle, release([100, 100])), idle);
});

test("under reduced motion a miss settles at once and a hit settles connected", () => {
  const missed = call(grab(), release([10, 10]), "settle");
  assert.equal(boardBusy(missed), false);
  assert.equal(missed.back, 0);
  assert.equal(springAt(missed), 1);
  assert.equal(missed.line, null);
  const hit = call(grab(), release([100, 100]), "settle");
  assert.equal(hit.line, 0);
  assert.equal(hit.calls, 1);
  assert.equal(boardBusy(hit), false);
});

test("a chip mid-drag or mid-spring takes the cord out of the hand", () => {
  const held = call(grab(), move([20, 20]), 1);
  assert.equal(held.held, null);
  assert.equal(held.line, 1);
  assert.equal(held.t, 0);
  const springing = call(grab(), release([10, 10]), 0);
  assert.equal(springing.back, 0);
  assert.equal(springing.from, null);
  assert.equal(springing.line, 0);
});

test("dropping the plug back in its own jack keeps the call", () => {
  const up = call(0, "settle");
  const s = call(0, "settle", grab([100, 100]), release([101, 99]));
  assert.equal(s.line, 0);
  assert.equal(s.calls, up.calls);
  assert.equal(boardBusy(s), false);
});

test("the cord sags with slack and runs straight at full length", () => {
  assert.equal(cordSag(0), 0);
  assert.equal(cordSag(CORD), 0);
  assert.equal(cordSag(CORD + 50), 0);
  assert.ok(cordSag(40) > 20);
  assert.ok(cordSag(CORD - 10) < cordSag(CORD / 2));
  assert.ok([10, 60, 120, 200].every((d) => cordSag(d) <= 40));
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

test("B swaps the console to its game and back; the cursor holds meanwhile", () => {
  assert.equal(tap("b").game, true);
  assert.equal(tap("b").pressed, "b");
  assert.equal(tap("b", "b").game, false);
  assert.equal(newPad(4).game, undefined, "a new pad is on its menu");
  // in the game the d-pad steers the snake, not the cursor
  assert.equal(tap("down", "b", "down", "up", "up", "left", "right").cursor, 1);
  assert.equal(tap("down", "b", "down", "b").cursor, 1);
  assert.equal(tap("down", "b", "down", "b", "down").cursor, 2);
  // left and right light their arm and leave the menu alone
  assert.equal(tap("left").cursor, 0);
  assert.equal(tap("right").pressed, "right");
  assert.equal(tap("b", "settle").pressed, null);
  assert.equal(tap("b", "settle").game, true);
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
