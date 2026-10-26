// The desk's spring, without a desk: it settles, overshoots once on the way,
// survives long and odd frames, and leans with its velocity.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advance,
  MAX_FRAME,
  MAX_SUBSTEP,
  MAX_WOBBLE,
  settled,
  SPRING,
  step,
  wobble,
  type Spring,
  type SpringConfig,
} from "./spring.ts";

const FRAME = 1 / 60;

// Run frames of dt until settled or out of time; keep the furthest point reached.
function run(target: number, dt: number, seconds = 5, from: Spring = { x: 0, v: 0 }, config: SpringConfig = SPRING) {
  let state = from;
  let peak = from.x;
  let crossings = 0;
  let t = 0;
  let done = false;
  while (t < seconds && !done) {
    const before = state.x - target;
    ({ state, done } = advance(state, target, dt, config));
    const after = state.x - target;
    if (before !== 0 && after !== 0 && Math.sign(before) !== Math.sign(after)) crossings++;
    peak = Math.max(peak, state.x);
    t += dt;
  }
  return { state, peak, crossings, t, done };
}

test("the desk spring is underdamped: k 170, c 14, damping ratio about 0.54", () => {
  assert.deepEqual(SPRING, { k: 170, c: 14 });
  const zeta = SPRING.c / (2 * Math.sqrt(SPRING.k));
  assert.ok(zeta > 0.5 && zeta < 0.6, `zeta ${zeta}`);
});

test("a step from rest converges onto the target and stops", () => {
  const r = run(100, FRAME);
  assert.ok(r.done, "never settled");
  assert.ok(r.t < 1.5, `took ${r.t}s`);
  assert.deepEqual(r.state, { x: 100, v: 0 });
  assert.ok(settled(r.state, 100));
});

test("it overshoots the target by about an eighth, then comes back", () => {
  const r = run(100, FRAME);
  const overshoot = (r.peak - 100) / 100;
  // The analytic overshoot for zeta 0.54 is exp(-pi zeta / sqrt(1 - zeta^2)), about 13.4%.
  const zeta = SPRING.c / (2 * Math.sqrt(SPRING.k));
  const expected = Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
  assert.ok(Math.abs(overshoot - expected) < 0.02, `overshoot ${overshoot}, expected ~${expected}`);
  assert.ok(r.crossings >= 2, `crossed the target ${r.crossings} times`);
});

test("negative control: an overdamped spring creeps in without overshooting", () => {
  const r = run(100, FRAME, 10, { x: 0, v: 0 }, { k: 170, c: 40 });
  assert.ok(r.done);
  assert.ok(r.peak <= 100, `peak ${r.peak}`);
  assert.equal(r.crossings, 0);
});

test("the same spring settles from either side and from a throw", () => {
  assert.deepEqual(run(-40, FRAME, 5, { x: 60, v: 0 }).state, { x: -40, v: 0 });
  const thrown = run(0, FRAME, 5, { x: 0, v: 2000 });
  assert.ok(thrown.done);
  assert.ok(thrown.peak > 0);
});

test("long frames stay stable: a 1 s frame is cut to MAX_FRAME and run in small substeps", () => {
  assert.ok(MAX_SUBSTEP <= 1 / 60 && MAX_FRAME >= MAX_SUBSTEP);
  const once = step({ x: 0, v: 0 }, 100, 1);
  assert.deepEqual(once, step({ x: 0, v: 0 }, 100, MAX_FRAME));
  for (const dt of [0.05, 0.1, 0.25, 1, 10]) {
    let state: Spring = { x: 0, v: 0 };
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      state = step(state, 100, dt);
      assert.ok(Number.isFinite(state.x) && Number.isFinite(state.v), `dt ${dt} went non-finite`);
      worst = Math.max(worst, Math.abs(state.x - 100));
    }
    assert.ok(worst <= 100, `dt ${dt} swung ${worst} from the target`);
    assert.ok(settled(state, 100), `dt ${dt} ended at ${state.x}`);
  }
});

test("frame rate does not change the motion: three 60 fps frames match one 20 fps frame", () => {
  let fine: Spring = { x: 0, v: 0 };
  for (let i = 0; i < 3; i++) fine = step(fine, 100, FRAME);
  const coarse = step({ x: 0, v: 0 }, 100, 3 * FRAME);
  assert.ok(Math.abs(fine.x - coarse.x) < 1e-9 && Math.abs(fine.v - coarse.v) < 1e-9);
});

test("a frame that did not happen leaves the spring where it was", () => {
  const s = { x: 3, v: -2 };
  for (const dt of [0, -1, Number.NaN]) assert.equal(step(s, 100, dt), s);
});

test("settled needs both closeness and stillness", () => {
  assert.ok(settled({ x: 100.005, v: 0.005 }, 100));
  assert.ok(!settled({ x: 100, v: 5 }, 100), "passing through the target at speed is not rest");
  assert.ok(!settled({ x: 101, v: 0 }, 100));
  assert.ok(settled({ x: 101, v: 0 }, 100, 2));
  const moving = advance({ x: 0, v: 0 }, 100, FRAME);
  assert.equal(moving.done, false);
  assert.ok(moving.state.x > 0 && moving.state.v > 0);
});

test("wobble leans with the velocity and is capped either way", () => {
  assert.equal(wobble(0), 0);
  assert.ok(wobble(100) > 0 && wobble(-100) < 0);
  assert.equal(wobble(100), -wobble(-100));
  assert.equal(wobble(1e6), MAX_WOBBLE);
  assert.equal(wobble(-1e6), -MAX_WOBBLE);
  assert.equal(wobble(Number.NaN), 0);
  assert.equal(wobble(Infinity), 0);
  assert.equal(wobble(10, 1, 3), 3);
  assert.ok(Object.is(wobble(-0), 0));
});

test("the lean dies away as the spring settles", () => {
  let state: Spring = { x: 0, v: 0 };
  const leans: number[] = [];
  for (let i = 0; i < 120; i++) {
    state = step(state, 300, FRAME);
    leans.push(Math.abs(wobble(state.v)));
  }
  assert.ok(Math.max(...leans.slice(0, 20)) > 1, "a long drop barely leaned");
  assert.ok(leans[leans.length - 1] < 0.05, `still leaning ${leans[leans.length - 1]}`);
});
