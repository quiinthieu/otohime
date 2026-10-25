// The ink hero's particle engine, stepped by hand: a blow pushes specks away from the pointer, they come back and
// settle within a fixed number of steps, a seed always gives the same field, and each tier holds its N.
import assert from "node:assert/strict";
import { test } from "node:test";
import { INK_MARK_HEIGHT, INK_MARK_STROKES, INK_MARK_WIDTH, inkMarkPoints } from "../components/ink-hero-mark.ts";
import {
  INK_FPS,
  INK_TIERS,
  SETTLE_PX,
  SETTLE_STEPS,
  SIM_HZ,
  blow,
  createField,
  inkTier,
  maxDisplacement,
  pointerGain,
  sampleTargets,
  settled,
  step,
} from "./ink-particles.ts";

const POINTS = inkMarkPoints();
// the mark drawn 352 px wide, as on a desktop
const SCALE = 352 / INK_MARK_WIDTH;
// 3 s of simulation: the probe's bound from a pointer move back to settled
const RETURN_STEPS = 3 * SIM_HZ;

const field = (n = 1200, seed = 7, spread = 0) => createField(sampleTargets(POINTS, n, seed, SCALE, 2.2), seed, spread);
const run = (f: ReturnType<typeof field>, steps: number) => {
  let k = 0;
  while (k < steps && !step(f)) k++;
  return k;
};

test("the constants the hero runs on", () => {
  assert.equal(INK_FPS, 24);
  assert.equal(SIM_HZ, 60);
  assert.deepEqual([...INK_TIERS], [2400, 1200, 600]);
  assert.equal(SETTLE_PX, 0.3);
  assert.equal(SETTLE_STEPS, 6);
});

test("the mark's points lie inside its viewBox, every stroke long enough to sample", () => {
  assert.ok(POINTS.length / 2 > 1000, `${POINTS.length / 2} points`);
  for (let i = 0; i < POINTS.length; i += 2) {
    assert.ok(POINTS[i] > 0 && POINTS[i] < INK_MARK_WIDTH && POINTS[i + 1] > 0 && POINTS[i + 1] < INK_MARK_HEIGHT);
  }
  assert.ok(INK_MARK_STROKES.every((s) => s.length >= 4 && s.length % 2 === 0));
});

test("each tier holds its N, and the device picks the tier", () => {
  for (const n of INK_TIERS) {
    const f = field(n);
    assert.equal(f.n, n);
    for (const a of [f.x, f.y, f.vx, f.vy, f.tx, f.ty]) {
      assert.ok(a instanceof Float32Array);
      assert.equal(a.length, n);
    }
  }
  assert.equal(inkTier({ webgl2: true, width: 1366, cores: 8 }), 2400);
  assert.equal(inkTier({ webgl2: true, width: 390, cores: 8 }), 1200);
  assert.equal(inkTier({ webgl2: true, width: 1366, cores: 2 }), 1200);
  assert.equal(inkTier({ webgl2: false, width: 1366, cores: 8 }), 600);
  assert.equal(inkTier({ webgl2: false, width: 390, cores: 2 }), 600);
});

test("the same seed gives the same targets and the same flight; another seed does not", () => {
  const a = field(600, 11, 30);
  const b = field(600, 11, 30);
  const c = field(600, 12, 30);
  assert.deepEqual(a.tx, b.tx);
  assert.deepEqual(a.x, b.x);
  assert.notDeepEqual(a.tx, c.tx);
  for (const f of [a, b]) {
    blow(f, 150, 60, 400, 60);
    run(f, 40);
  }
  assert.deepEqual(a.x, b.x);
  assert.deepEqual(a.vy, b.vy);
});

test("a blow pushes specks straight away from the pointer, harder near it and for a faster pointer", () => {
  const f = createField(Float32Array.from([110, 50, 90, 50, 100, 70, 100, 30, 130, 50, 200, 50]));
  const touched = blow(f, 100, 50, 0, 40);
  assert.equal(touched, 5, "the speck 100 px off is outside the 40 px radius");
  assert.ok(f.vx[0] > 0 && Math.abs(f.vy[0]) < 1e-6, "right of the pointer goes right");
  assert.ok(f.vx[1] < 0 && Math.abs(f.vy[1]) < 1e-6, "left goes left");
  assert.ok(f.vy[2] > 0 && Math.abs(f.vx[2]) < 1e-6, "below goes down");
  assert.ok(f.vy[3] < 0, "above goes up");
  assert.ok(f.vx[0] > f.vx[4] && f.vx[4] > 0, "falls off with distance");
  // (1 - d/R)^2: at 10 px of 40 that is 0.5625, at 30 px it is 0.0625
  assert.ok(Math.abs(f.vx[0] / f.vx[4] - 0.5625 / 0.0625) < 1e-3, `${f.vx[0] / f.vx[4]}`);
  assert.equal(f.vx[5], 0);
  assert.ok(!settled(f), "a blow unsettles the field");

  const slow = createField(Float32Array.from([110, 50]));
  const fast = createField(Float32Array.from([110, 50]));
  blow(slow, 100, 50, 0, 40);
  blow(fast, 100, 50, 2000, 40);
  assert.ok(fast.vx[0] > slow.vx[0] * 2, "a fast pointer blows harder");
  assert.ok(pointerGain(0) > 0, "a still pointer (one synthetic move, a tap) still blows");
  assert.equal(pointerGain(1e6), 2);
});

test("after a blow the specks fly out, then return and settle within 3 s of steps", () => {
  for (const n of INK_TIERS) {
    const f = field(n);
    assert.ok(settled(f));
    // the hardest blow, at the middle of the mark
    blow(f, 176, 66, 1e6, 64);
    run(f, 6);
    const out = maxDisplacement(f);
    assert.ok(out > 20, `N=${n}: flew ${out.toFixed(1)} px`);
    const k = run(f, RETURN_STEPS);
    assert.ok(settled(f), `N=${n}: not settled after ${RETURN_STEPS} steps (still ${maxDisplacement(f).toFixed(2)} px off)`);
    assert.ok(k < RETURN_STEPS, `N=${n}: ${k} steps`);
    assert.equal(maxDisplacement(f), 0, "a settled field sits exactly on its targets");
  }
});

test("a field that starts spread out bleeds into shape and settles", () => {
  const f = field(1200, 3, 24);
  assert.ok(!settled(f));
  assert.ok(maxDisplacement(f) > 10);
  run(f, RETURN_STEPS);
  assert.ok(settled(f));
});

test("settled() wants SETTLE_STEPS calm steps in a row, under SETTLE_PX", () => {
  const f = createField(Float32Array.from([50, 50]));
  f.x[0] = 50 + SETTLE_PX * 0.5;
  f.calm = 0;
  for (let i = 1; i < SETTLE_STEPS; i++) {
    assert.equal(step(f), false, `step ${i}`);
    assert.equal(f.calm, i);
  }
  assert.equal(step(f), true);
  // a nudge past the threshold resets the count
  f.x[0] = 50 + SETTLE_PX * 10;
  f.calm = 0;
  step(f);
  assert.equal(f.calm, 0);
  assert.equal(settled(f), false);
});

test("a settled field does not move when stepped", () => {
  const f = field(600);
  const x = Float32Array.from(f.x);
  for (let i = 0; i < 30; i++) assert.equal(step(f), true);
  assert.deepEqual(f.x, x);
});
