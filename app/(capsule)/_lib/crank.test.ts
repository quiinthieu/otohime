import assert from "node:assert/strict";
import { test } from "node:test";
import { CRANK_FIRE, angleAt, crankDrag, crankStart, type CrankDrag } from "./crank.ts";

// Run a drag through a list of angles; return the final state and the
// indices of the moves that fired.
function pull(angles: number[]): { s: CrankDrag; fired: number[] } {
  let s = crankStart(angles[0]);
  const fired: number[] = [];
  angles.slice(1).forEach((a, i) => {
    const next = crankDrag(s, a);
    if (next.fire) fired.push(i + 1);
    s = { last: next.last, total: next.total };
  });
  return { s, fired };
}

test("angleAt gives 0, 90, 180 and 270 at the compass points", () => {
  assert.equal(angleAt(50, 50, 50, 10), 0); // 12 o'clock (y is down)
  assert.equal(angleAt(50, 50, 90, 50), 90); // 3 o'clock
  assert.equal(angleAt(50, 50, 50, 90), 180); // 6 o'clock
  assert.equal(angleAt(50, 50, 10, 50), 270); // 9 o'clock
  assert.equal(Object.is(angleAt(50, 50, 50, 10), -0), false);
});

test("angleAt is clockwise and stays in [0, 360)", () => {
  assert.ok(Math.abs(angleAt(0, 0, 1, -1) - 45) < 1e-9);
  assert.ok(Math.abs(angleAt(0, 0, -1, -1) - 315) < 1e-9);
  for (let i = 0; i < 72; i++) {
    const r = (i * 5 * Math.PI) / 180;
    const a = angleAt(0, 0, Math.sin(r), -Math.cos(r));
    assert.ok(a >= 0 && a < 360, `angle ${a}`);
  }
});

test("a quarter turn clockwise fires once, at 90", () => {
  assert.equal(CRANK_FIRE, 90);
  const angles = [90, 100, 120, 140, 160, 179, 180, 200, 240];
  const { s, fired } = pull(angles);
  assert.deepEqual(fired, [angles.indexOf(180)]);
  assert.equal(s.total, 150);
  // just short of a quarter turn does not fire
  assert.deepEqual(pull([0, 30, 60, 89]).fired, []);
  assert.equal(crankDrag({ last: 0, total: 89 }, 1).fire, true);
});

test("counter-clockwise never fires and never goes below zero", () => {
  const { s, fired } = pull([90, 60, 30, 0, 330, 300, 270, 180, 90, 0]);
  assert.deepEqual(fired, []);
  assert.equal(s.total, 0);
  // pulled back, then forward: only the clockwise part from zero counts
  const back = pull([90, 45, 90, 120]);
  assert.equal(back.s.total, 75);
  assert.deepEqual(back.fired, []);
});

test("a drag across 12 o'clock counts the short way round", () => {
  assert.equal(crankDrag({ last: 350, total: 0 }, 20).total, 30);
  assert.equal(crankDrag({ last: 20, total: 40 }, 350).total, 10);
  assert.equal(pull([300, 330, 359, 10, 30]).s.total, 90);
});

test("a jittery drag fires at most once", () => {
  const angles = [0, 40, 30, 70, 85, 95, 80, 92, 70, 100, 85, 120, 60, 150];
  const { s, fired } = pull(angles);
  assert.equal(fired.length, 1);
  assert.equal(fired[0], angles.indexOf(95));
  assert.ok(s.total >= CRANK_FIRE);
  // a seeded storm of small wobbles, mostly forward
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  let a = 0;
  const storm = [a];
  for (let i = 0; i < 400; i++) storm.push((a = (a + (rand() * 20 - 8) + 360) % 360));
  assert.ok(pull(storm).fired.length <= 1);
});
