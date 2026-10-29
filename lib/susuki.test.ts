import assert from "node:assert/strict";
import { test } from "node:test";
import { SEASONS } from "./seasons.ts";
import {
  chooseSusukiMode,
  createFoxState,
  createSusukiBlades,
  FOX_DEPTH,
  FOX_IDLE_SECONDS,
  FOX_TROT_SECONDS,
  foxGustAt,
  POINTER_OMEGA,
  SCROLL_GUST_MAX,
  SCROLL_GUST_SPEED,
  SCROLL_GUST_TAU,
  stepFoxState,
  stepPointerSpring,
  stepScrollGust,
  SUSUKI_BLADE_STRIDE,
  SUSUKI_GUST_RADIUS,
  SUSUKI_GUST_STRENGTH,
  SUSUKI_MAX_BLADES,
  SUSUKI_MIN_BLADES,
  susukiBladeCount,
  susukiDisplacement,
  susukiSeasonTint,
  type PointerSpring,
  type SusukiPoint,
} from "./susuki.ts";

function near(actual: number, expected: number, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function nearSpring(actual: PointerSpring, expected: PointerSpring) {
  for (const key of ["x", "y", "vx", "vy"] as const) near(actual[key], expected[key]);
}

test("blade budget scales monotonically from 2400 to 8000 over viewport width", () => {
  assert.equal(susukiBladeCount(360), SUSUKI_MIN_BLADES);
  assert.equal(susukiBladeCount(1920), SUSUKI_MAX_BLADES);
  assert.equal(susukiBladeCount(1140), 5200);
  let previous = 0;
  for (let width = 0; width <= 4000; width++) {
    const n = susukiBladeCount(width);
    assert.ok(Number.isInteger(n) && n >= 2400 && n <= 8000);
    assert.ok(n >= previous);
    previous = n;
  }
});

test("observed >20ms frames halve the baseline once, including narrow screens", () => {
  for (const width of [0, 360, 768, 1140, 1920, 4000]) {
    const baseline = susukiBladeCount(width);
    const slowFrames = [16, 20, 20.01].filter(ms => ms > 20).length;
    assert.equal(susukiBladeCount(width, slowFrames), Math.floor(baseline / 2));
    assert.equal(susukiBladeCount(width, 200), Math.floor(baseline / 2));
    assert.equal(susukiBladeCount(width, 0), baseline);
    assert.equal(susukiBladeCount(width, -1), baseline);
  }
});

test("unknown widths use the mobile budget and negative widths clamp", () => {
  for (const width of [-100, NaN, Infinity, -Infinity]) assert.equal(susukiBladeCount(width), 2400);
});

test("seeded buffers replay byte-for-byte, vary by seed, and keep stable prefixes", () => {
  for (const seed of [0, 1, -1, 42, 0xffffffff]) {
    const blades = createSusukiBlades(8000, seed);
    assert.ok(blades instanceof Float32Array);
    assert.equal(blades.length, 8000 * SUSUKI_BLADE_STRIDE);
    assert.deepEqual(blades, createSusukiBlades(8000, seed));
    assert.deepEqual(blades.subarray(0, 1200 * SUSUKI_BLADE_STRIDE), createSusukiBlades(1200, seed));
    assert.notDeepEqual(blades, createSusukiBlades(8000, seed + 1));
  }
  const first = createSusukiBlades(1, 42);
  first.fill(0);
  assert.notDeepEqual(first, createSusukiBlades(1, 42), "buffers must not share storage");
});

test("all six blade attributes are finite, bounded, and distributed across their ranges", () => {
  // Float32 may round the phase up to the nearest representable 2π.
  const bounds = [[0, 1], [0, 1], [0.25, 1], [-0.25, 0.25], [0, Math.fround(Math.PI * 2)], [0.125, 0.375]];
  for (const seed of [0, 17, -323, 0x7fffffff]) {
    const blades = createSusukiBlades(8000, seed);
    for (let attribute = 0; attribute < 6; attribute++) {
      const [lo, hi] = bounds[attribute];
      let min = hi;
      let max = lo;
      for (let i = attribute; i < blades.length; i += SUSUKI_BLADE_STRIDE) {
        const value = blades[i];
        assert.ok(Number.isFinite(value) && value >= lo && value <= hi, `attribute ${attribute}: ${value}`);
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      assert.ok(min < lo + (hi - lo) * 0.05 && max > hi - (hi - lo) * 0.05);
    }
  }
});

test("blade allocations floor fractional counts, cap huge counts, and reject nonfinite counts", () => {
  assert.equal(createSusukiBlades(2.9, 1).length, 12);
  assert.equal(createSusukiBlades(Number.MAX_VALUE, 1).length, 48000);
  for (const count of [0, -1, NaN, Infinity, -Infinity]) assert.equal(createSusukiBlades(count, 1).length, 0);
});

test("pointer spring follows the critical step response and approaches without overshoot", () => {
  const start = Object.freeze({ x: 0, y: 1, vx: 0, vy: 0 });
  const target = Object.freeze({ x: 1, y: 0 });
  const dt = 0.1;
  const expected = 1 - (1 + POINTER_OMEGA * dt) * Math.exp(-POINTER_OMEGA * dt);
  const first = stepPointerSpring(start, target, dt);
  near(first.x, expected);
  near(first.y, 1 - expected);
  let state: PointerSpring = start;
  for (let i = 0; i < 300; i++) {
    const next = stepPointerSpring(state, target, 1 / 60);
    assert.ok(next.x >= state.x && next.x <= 1);
    assert.ok(next.y <= state.y && next.y >= 0);
    state = next;
  }
  nearSpring(state, { ...target, vx: 0, vy: 0 });
  assert.deepEqual(start, { x: 0, y: 1, vx: 0, vy: 0 });
});

test("pointer spring is frame independent, including velocity, target changes and long frames", () => {
  const start = { x: -0.4, y: 0.8, vx: 2, vy: -3 };
  const target = { x: 0.2, y: 0.4 };
  let fine = start;
  for (let i = 0; i < 60; i++) fine = stepPointerSpring(fine, target, 1 / 60);
  nearSpring(fine, stepPointerSpring(start, target, 1));
  for (const dt of [1 / 120, 1 / 30, 0.25, 1, 10, 60, Number.MAX_VALUE]) {
    let state: PointerSpring = start;
    for (let i = 0; i < Math.ceil(5 / dt); i++) state = stepPointerSpring(state, target, dt);
    nearSpring(state, { ...target, vx: 0, vy: 0 });
    const back = stepPointerSpring(state, { x: 0, y: 0 }, 10);
    nearSpring(back, { x: 0, y: 0, vx: 0, vy: 0 });
  }
});

test("invalid spring time leaves the state untouched, and a resting spring stays still", () => {
  const state = { x: 0.5, y: 0.6, vx: 1, vy: 2 };
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) assert.equal(stepPointerSpring(state, { x: 0, y: 0 }, dt), state);
  const rest = { ...state, vx: 0, vy: 0 };
  assert.deepEqual(stepPointerSpring(rest, rest, 0.4), rest);
});

test("scroll boost low-passes absolute pixel speed with a bounded exponential response", () => {
  const dt = 1 / 60;
  const delta = SCROLL_GUST_SPEED * dt;
  const expected = 1 - Math.exp(-dt / SCROLL_GUST_TAU);
  near(stepScrollGust(0, delta, dt), expected);
  near(stepScrollGust(0, -delta, dt), expected);
  let gust = 0;
  for (let i = 0; i < 300; i++) {
    const next = stepScrollGust(gust, 1e9, dt);
    assert.ok(next >= gust && next <= SCROLL_GUST_MAX);
    gust = next;
  }
  near(gust, SCROLL_GUST_MAX);
  for (let i = 0; i < 300; i++) {
    const next = stepScrollGust(gust, 0, dt);
    assert.ok(next <= gust && next >= 0);
    gust = next;
  }
  near(gust, 0);
});

test("scroll response is frame independent at equal speed and rejects invalid inputs", () => {
  let fine = 0;
  for (let i = 0; i < 60; i++) fine = stepScrollGust(fine, 20, 1 / 60);
  near(fine, stepScrollGust(0, 1200, 1));
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) assert.equal(stepScrollGust(1, 100, dt), 1);
  assert.equal(stepScrollGust(NaN, 0, 0), 0);
  assert.equal(stepScrollGust(-100, 0, 0), 0);
  assert.equal(stepScrollGust(100, 0, 0), SCROLL_GUST_MAX);
  for (const delta of [NaN, Infinity, -Infinity]) near(stepScrollGust(1, delta, 1), Math.exp(-1 / SCROLL_GUST_TAU));
  near(stepScrollGust(0, Number.MAX_VALUE, Number.MIN_VALUE), 0);
  assert.ok(Number.isFinite(stepScrollGust(3, 0, Number.MAX_VALUE)));
});

test("all four seasons have distinct normalized paper, ink and plume tuples in both schemes", () => {
  const all = new Set<string>();
  for (const scheme of ["light", "dark"] as const) {
    for (const channel of ["paper", "ink", "plume"] as const) {
      assert.equal(new Set(SEASONS.map(season => JSON.stringify(susukiSeasonTint(season, scheme)[channel]))).size, 4);
    }
    for (const season of SEASONS) {
      const tint = susukiSeasonTint(season, scheme);
      all.add(JSON.stringify(tint));
      for (const tuple of Object.values(tint)) {
        assert.equal(tuple.length, 3);
        assert.ok(Object.isFrozen(tuple));
        for (const value of tuple) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
      }
      assert.ok(Object.isFrozen(tint));
      for (let i = 0; i < 3; i++) {
        assert.ok(scheme === "light" ? tint.paper[i] > tint.ink[i] : tint.paper[i] < tint.ink[i]);
        assert.ok(tint.plume[i] > tint.ink[i], "plumes must be lighter than the stems");
      }
    }
  }
  assert.equal(all.size, 8);
  near(susukiSeasonTint("autumn", "light").plume[0], 191 / 255);
  const original = susukiSeasonTint("winter", "dark");
  assert.equal(Reflect.set(original.ink, 0, 0), false);
  assert.equal(Reflect.set(original, "ink", [0, 0, 0]), false);
});

test("cursor displacement has a quadratic radial falloff and a finite deterministic centre", () => {
  const source = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  const full = susukiDisplacement(source, source);
  near(full.x, SUSUKI_GUST_STRENGTH * 0.35);
  near(full.y, 0);
  const radius = SUSUKI_GUST_RADIUS;
  near(susukiDisplacement({ x: source.x + radius / 2, y: source.y }, source).x, full.x / 4);
  assert.deepEqual(susukiDisplacement({ x: 1, y: 1 }, source), { x: 0, y: 0 });
  assert.deepEqual(susukiDisplacement({ x: radius, y: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }), { x: 0, y: 0 });
  assert.ok(susukiDisplacement({ x: 0.45, y: 0.5 }, source).x < 0);
  assert.ok(susukiDisplacement({ x: 0.5, y: 0.55 }, source).y > 0);
  const moving = { ...source, vx: 0, vy: -2 };
  near(susukiDisplacement(moving, moving).y, -SUSUKI_GUST_STRENGTH * 2);
  for (const badRadius of [0, -1, NaN, Infinity]) assert.deepEqual(susukiDisplacement(source, source, badRadius), { x: 0, y: 0 });
});

test("fox waits exactly 14 seconds, starts at zero, and finishes at one with no gust", () => {
  const start = Object.freeze(createFoxState());
  assert.equal(start.idleThreshold, FOX_IDLE_SECONDS);
  assert.equal(start.trotDuration, FOX_TROT_SECONDS);
  assert.equal(start.phase, "waiting");
  const waiting = stepFoxState(start, 13.5);
  assert.equal(waiting.phase, "waiting");
  assert.equal(waiting.hasRun, false);
  const active = stepFoxState(waiting, 0.5);
  assert.equal(active.phase, "trotting");
  assert.equal(active.x, 0);
  assert.equal(active.hasRun, true);
  assert.deepEqual(active.gust, { x: 0, y: FOX_DEPTH, vx: 1 / 6, vy: 0 });
  const midway = stepFoxState(active, 3);
  near(midway.x, 0.5);
  const done = stepFoxState(midway, 3);
  assert.equal(done.phase, "done");
  assert.equal(done.x, 1);
  assert.equal(done.hasRun, true);
  assert.equal(done.gust, null);
  assert.equal(start.idleSeconds, 0, "stepping never mutates the initial state");
});

test("fox carries excess idle time into its trot and stays bounded through a long frame", () => {
  const start = createFoxState();
  const coarse = stepFoxState(start, 17);
  const fine = stepFoxState(stepFoxState(start, 14), 3);
  assert.deepEqual(coarse, fine);
  near(coarse.x, 0.5);
  const done = stepFoxState(start, Number.MAX_VALUE);
  assert.equal(done.phase, "done");
  assert.equal(done.x, 1);
});

test("explicit trigger starts immediately, never restarts an active or completed trot", () => {
  const active = stepFoxState(createFoxState(), { type: "trigger" });
  assert.equal(active.phase, "trotting");
  assert.equal(active.idleSeconds, 0);
  assert.equal(stepFoxState(active, { type: "trigger" }), active);
  const done = stepFoxState(active, FOX_TROT_SECONDS);
  assert.equal(stepFoxState(done, { type: "trigger" }), done);
  assert.equal(stepFoxState(done, 100), done);
});

for (const input of ["pointer", "scroll", "key"] as const) {
  test(`${input} resets idle time and immediately cancels the fox, consuming its session`, () => {
    const waiting = stepFoxState(createFoxState(), 13);
    const reset = stepFoxState(waiting, { type: input });
    assert.equal(reset.phase, "waiting");
    assert.equal(reset.idleSeconds, 0);
    assert.equal(reset.hasRun, false);
    assert.equal(stepFoxState(reset, 13).phase, "waiting");
    const active = stepFoxState(reset, { type: "trigger" });
    const cancelled = stepFoxState(active, { type: input });
    assert.equal(cancelled.phase, "done");
    assert.equal(cancelled.gust, null);
    assert.equal(cancelled.hasRun, true);
    assert.equal(stepFoxState(cancelled, { type: "trigger" }), cancelled);
    assert.equal(stepFoxState(cancelled, 1000), cancelled);
    const remounted = createFoxState({ hasRun: cancelled.hasRun });
    assert.equal(remounted.phase, "done");
    assert.equal(stepFoxState(remounted, { type: "trigger" }), remounted);
    assert.equal(stepFoxState(remounted, 1000), remounted);
  });
}

test("fox configuration is explicit and session lock can be restored after completion", () => {
  const start = createFoxState({ idleThreshold: 2, trotDuration: 4 });
  const halfway = stepFoxState(start, 4);
  near(halfway.x, 0.5);
  const done = stepFoxState(halfway, 2);
  const remounted = createFoxState({ hasRun: done.hasRun });
  assert.equal(remounted.phase, "done");
  assert.equal(stepFoxState(remounted, 100), remounted);
  // Negative control: a fresh session may still play; there is no module-global lock.
  assert.equal(stepFoxState(createFoxState(), { type: "trigger" }).phase, "trotting");
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.equal(createFoxState({ idleThreshold: invalid }).idleThreshold, FOX_IDLE_SECONDS);
    assert.equal(createFoxState({ trotDuration: invalid }).trotDuration, FOX_TROT_SECONDS);
  }
});

test("invalid elapsed time does not change waiting or trotting fox states", () => {
  const waiting = createFoxState();
  const active = stepFoxState(waiting, { type: "trigger" });
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
    assert.equal(stepFoxState(waiting, dt), waiting);
    assert.equal(stepFoxState(active, dt), active);
  }
});

test("fox gust uses the cursor displacement, follows the fox and vanishes on cancellation", () => {
  const start = createFoxState();
  const active = stepFoxState(start, 17);
  const point: SusukiPoint = { x: active.x + 0.04, y: FOX_DEPTH };
  assert.ok(active.gust);
  assert.deepEqual(foxGustAt(active, point), susukiDisplacement(point, active.gust));
  assert.ok(foxGustAt(active, point).x > 0);
  assert.deepEqual(foxGustAt(active, { x: 0, y: 0 }), { x: 0, y: 0 });
  const moved = stepFoxState(active, 2);
  assert.deepEqual(foxGustAt(moved, point), { x: 0, y: 0 });
  for (const state of [start, stepFoxState(active, { type: "key" }), stepFoxState(active, 3)]) {
    assert.deepEqual(foxGustAt(state, point), { x: 0, y: 0 });
  }
});

test("live mode requires WebGL2 and every motion/data/context permission", () => {
  for (const webgl2 of [false, true]) {
    for (const reducedMotion of [false, true]) {
      for (const saveData of [false, true]) {
        for (const contextLost of [false, true]) {
          assert.equal(chooseSusukiMode({ webgl2, reducedMotion, saveData, contextLost }),
            webgl2 && !reducedMotion && !saveData && !contextLost ? "live" : "static");
        }
      }
    }
  }
  assert.equal(chooseSusukiMode({ webgl2: true, reducedMotion: false, saveData: false }), "live");
  assert.equal(chooseSusukiMode({ webgl2: true, reducedMotion: false, saveData: false, contextLost: true }), "static");
  assert.equal(chooseSusukiMode({ webgl2: true, reducedMotion: false, saveData: false, contextLost: false }), "live");
});
