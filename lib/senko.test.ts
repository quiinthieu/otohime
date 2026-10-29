import assert from "node:assert/strict";
import { test } from "node:test";
import { seeded } from "./ink-particles.ts";
import { cueGain, cueLength, dbToGain, noteEnd, type Cue } from "./sound.ts";
import * as routeCore from "../app/(site)/(app)/play/senko/_lib/senko.ts";
import {
  SENKO_STAGES, SENKO_STAGE_THRESHOLDS_MS, SENKO_JITTER_WINDOW_MS, SENKO_JITTER_BUDGET,
  SENKO_DROP_MS, SENKO_MAX_PARTICLES, SENKO_CRACKLE_INTERVAL_MS,
  createSenkoState, stepSenkoState, jumpToSenkoStage, describeSenkoStatus, stepSenkoSteadiness,
  createSenkoPool, stepSenkoParticles, buildSenkoCrackleCue, canPlaySenkoCrackle,
  type SenkoStage, type SenkoState,
} from "./senko.ts";

const liveStages = ["botan", "matsuba", "yanagi", "chiri-giku"] as const;
const active = (pool: ReturnType<typeof createSenkoPool>) => pool.particles.filter((p) => p.active);

test("route re-export imports the real zero-DOM model and constructs a session", () => {
  assert.equal(routeCore.createSenkoState, createSenkoState);
  assert.equal(routeCore.stepSenkoParticles, stepSenkoParticles);
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(createSenkoState().stage, "idle");
  assert.equal(createSenkoPool().particles.length, 200);
  assert.deepEqual(createSenkoState(42), createSenkoState(42));
  assert.notEqual(createSenkoState(42).seed, createSenkoState(43).seed);
});

test("fake elapsed clock visits every stage at the exact documented boundary", () => {
  const boundaries: [number, SenkoStage][] = [
    [0, "lighting"], [599, "lighting"], [600, "botan"], [3199, "botan"],
    [3200, "matsuba"], [6799, "matsuba"], [6800, "yanagi"],
    [10399, "yanagi"], [10400, "chiri-giku"], [13199, "chiri-giku"], [13200, "out"],
  ];
  let state = createSenkoState(1), lastAt = 0;
  const visited: SenkoStage[] = [state.stage];
  for (const [now, stage] of boundaries) {
    const original = structuredClone(state);
    const next = stepSenkoState(state, { dtMs: now - lastAt, holding: true });
    assert.deepEqual(state, original, "caller state remains unchanged");
    state = next; lastAt = now;
    assert.equal(state.stage, stage, `fake clock at ${now}ms`);
    assert.equal(state.heldMs, now);
    assert.ok(state.beadGlow >= 0 && state.beadGlow <= 1);
    if (visited.at(-1) !== stage) visited.push(stage);
  }
  assert.deepEqual(visited, ["idle", "lighting", ...liveStages, "out"]);
  assert.equal(state.beadGlow, 0);
  assert.equal(state.beadRadius, 0);
  assert.deepEqual(stepSenkoState(state, { dtMs: 99999, holding: true }), state, "out cannot auto-reignite");
});

test("elapsed partitioning, large clock jumps and invalid deltas cannot reverse the state", () => {
  let state = createSenkoState(21);
  for (let i = 0; i < 80; i++) state = stepSenkoState(state, { dtMs: 100, holding: true });
  assert.deepEqual(state, stepSenkoState(createSenkoState(21), { dtMs: 8000, holding: true }));
  for (const dtMs of [NaN, Infinity, -100]) assert.deepEqual(stepSenkoState(state, { dtMs, holding: true }), state);
  assert.equal(stepSenkoState(state, { dtMs: 1e9, holding: true }).heldMs, 13200);
});

test("release extinguishes, reset is idle even while holding, latch holds without a pointer", () => {
  const idle = createSenkoState(8);
  assert.deepEqual(stepSenkoState(idle, { dtMs: 500, holding: false }), idle);
  for (const stage of ["lighting", ...liveStages] as const) {
    const state = jumpToSenkoStage(idle, stage);
    const out = stepSenkoState(state, { dtMs: 100, holding: false });
    assert.equal(out.stage, "out"); assert.equal(out.beadGlow, 0); assert.equal(out.beadRadius, 0);
    assert.deepEqual(stepSenkoState(out, { dtMs: 100, holding: true, reset: true }), idle);
  }
  assert.equal(stepSenkoState(idle, { dtMs: 600, holding: false, steadyLatch: true }).stage, "botan");
});

test("stage inspection selects exact elapsed starts and supplies distinct live descriptions", () => {
  const seed = createSenkoState(3);
  assert.deepEqual(SENKO_STAGE_THRESHOLDS_MS, { lighting: 0, botan: 600, matsuba: 3200, yanagi: 6800, "chiri-giku": 10400, out: 13200 });
  assert.deepEqual(SENKO_STAGES.map((s) => s.id), ["idle", "lighting", ...liveStages, "dropped", "out"]);
  const descriptions = new Set<string>();
  for (const metadata of SENKO_STAGES) {
    assert.ok(metadata.title.length > 0 && metadata.japaneseTitle.length > 0);
    const state = jumpToSenkoStage(seed, metadata.id);
    assert.equal(state.stage, metadata.id);
    assert.equal(state.stageMs, 0);
    descriptions.add(describeSenkoStatus(state));
    if (liveStages.some((stage) => stage === state.stage)) {
      assert.equal(state.heldMs, SENKO_STAGE_THRESHOLDS_MS[state.stage as typeof liveStages[number]]);
      assert.ok(state.beadRadius > 0 && state.beadGlow > 0);
    }
  }
  assert.equal(descriptions.size, SENKO_STAGES.length);
  const fading = stepSenkoState(jumpToSenkoStage(seed, "chiri-giku"), { dtMs: 1400, holding: true });
  assert.ok(fading.beadGlow < jumpToSenkoStage(seed, "chiri-giku").beadGlow);
});

const hand = (state: SenkoState, dx: number, pointerType = "mouse", dtMs = 16, steadyLatch = false) =>
  stepSenkoSteadiness(state, { dx, dy: 0, dtMs, pointerType, steadyLatch });

test("jitter reaches the inclusive mouse/pen budget before the larger touch budget", () => {
  const state = jumpToSenkoStage(createSenkoState(), "matsuba");
  assert.ok(SENKO_JITTER_BUDGET.touch >= SENKO_JITTER_BUDGET.mouse * 1.6);
  for (const pointer of ["mouse", "pen", ""]) {
    assert.equal(hand(state, 23.99, pointer).stage, "matsuba");
    const dropped = hand(state, 24, pointer);
    assert.equal(dropped.stage, "dropped"); assert.equal(dropped.jitterRatio, 1);
    assert.ok(dropped.beadVy > 0); assert.ok(dropped.beadGlow > 0);
  }
  assert.equal(hand(state, 24, "touch").stage, "matsuba");
  assert.equal(hand(state, 41.99, "touch").stage, "matsuba");
  assert.equal(hand(state, 42, "touch").stage, "dropped");
  assert.equal(stepSenkoSteadiness(state, { dx: 18, dy: 18, dtMs: 16, pointerType: "mouse" }).stage, "dropped");
  let mouse = state, touch = state, mouseDroppedAt = 0, touchDroppedAt = 0;
  for (let i = 1; i <= 20; i++) {
    mouse = hand(mouse, i % 2 ? 5 : -5); touch = hand(touch, i % 2 ? 5 : -5, "touch");
    if (!mouseDroppedAt && mouse.stage === "dropped") mouseDroppedAt = i;
    if (!touchDroppedAt && touch.stage === "dropped") touchDroppedAt = i;
  }
  assert.ok(mouseDroppedAt > 0 && mouseDroppedAt < touchDroppedAt);
});

test("jitter remembers reversing motion, decays with time, and bypasses keyboard/latch", () => {
  const state = jumpToSenkoStage(createSenkoState(), "botan");
  const jittery = hand(state, 20);
  assert.equal(hand(jittery, -10).stage, "dropped", "movement cannot cancel a previous displacement");
  const rested = hand(jittery, 0, "mouse", SENKO_JITTER_WINDOW_MS);
  assert.ok(Math.abs(rested.jitter - 20 / Math.E) < 1e-10);
  assert.equal(hand(rested, 10).stage, "botan", "the same jolt is safe after resting");
  for (const pointer of ["keyboard", "touch", "mouse", "pen"]) {
    let safe = jittery;
    for (let i = 0; i < 20; i++) safe = hand(safe, 1e6, pointer, 16, pointer !== "keyboard");
    assert.equal(safe.stage, "botan"); assert.equal(safe.jitter, 0); assert.equal(safe.jitterRatio, 0);
    assert.equal(hand(safe, 1).stage, "botan", "bypass leaves no stale jitter");
  }
  assert.equal(hand(createSenkoState(), 1e6).stage, "idle");
  assert.equal(hand(jumpToSenkoStage(state, "out"), 1e6).stage, "out");
});

test("integrated jitter detaches the bead, drop accelerates downward, then extinguishes", () => {
  const lit = jumpToSenkoStage(createSenkoState(9), "yanagi");
  const dropped = stepSenkoState(lit, { holding: true, dtMs: 16, dx: 50, dy: 0 });
  assert.equal(dropped.stage, "dropped"); assert.ok(dropped.beadVy > 0);
  const falling = stepSenkoState(dropped, { holding: false, dtMs: 100 });
  assert.ok(falling.beadY > dropped.beadY && falling.beadVy > dropped.beadVy);
  assert.ok(falling.beadGlow < dropped.beadGlow);
  const oneStep = stepSenkoState(dropped, { holding: true, dtMs: 400 });
  let partitioned = dropped;
  for (let i = 0; i < 4; i++) partitioned = stepSenkoState(partitioned, { holding: true, dtMs: 100 });
  assert.ok(Math.abs(partitioned.beadY - oneStep.beadY) < 1e-10);
  assert.deepEqual(stepSenkoState(dropped, { holding: true, dtMs: 0 }), dropped);
  const out = stepSenkoState(falling, { holding: true, dtMs: SENKO_DROP_MS });
  assert.equal(out.stage, "out"); assert.equal(out.beadGlow, 0); assert.equal(out.beadRadius, 0);
  assert.deepEqual(stepSenkoState(out, { holding: true, dtMs: 0, reset: true }), createSenkoState(9));
});

function simulate(stage: SenkoStage, reducedMotion = false, seed = 7, frames = 100, dtMs = 10) {
  const pool = createSenkoPool(), rng = seeded(seed);
  for (let i = 0; i < frames; i++) stepSenkoParticles(pool, stage, dtMs, rng, reducedMotion);
  return pool;
}

test("seeded spark simulation is repeatable and independent of display frame partitions", () => {
  const a = simulate("matsuba"), b = simulate("matsuba");
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, simulate("matsuba", false, 8));
  assert.deepEqual(a, simulate("matsuba", false, 7, 50, 20));
  assert.deepEqual(a, simulate("matsuba", false, 7, 200, 5));
});

test("Matsuba splits in flight into 2–3 short-lived children without recursive branching", () => {
  const pool = createSenkoPool(), rng = seeded(12);
  const seen = new Map<number, { parentId: number | null; lifeMs: number; ageMs: number; x: number; y: number }>();
  const families = new Map<number, Set<number>>();
  for (let i = 0; i < 200; i++) {
    stepSenkoParticles(pool, "matsuba", 10, rng, false);
    for (const p of active(pool)) {
      if (p.parentId !== null) {
        const family = families.get(p.parentId) ?? new Set<number>();
        family.add(p.id); families.set(p.parentId, family);
        const parent = seen.get(p.parentId)!;
        assert.equal(parent.parentId, null);
        assert.ok(p.lifeMs < parent.lifeMs);
        assert.ok(p.branched, "children never split again");
        if (!seen.has(p.id)) assert.ok(Math.hypot(p.x, p.y) > 0, "born at a flying parent's location");
      }
      seen.set(p.id, { parentId: p.parentId, lifeMs: p.lifeMs, ageMs: p.ageMs, x: p.x, y: p.y });
    }
    assert.ok(pool.activeCount <= 200);
    assert.equal(pool.activeCount, active(pool).length);
  }
  assert.ok(families.size > 10);
  assert.deepEqual(new Set([...families.values()].map((ids) => ids.size)), new Set([2, 3]));
});

test("fixed slots enforce all capacities, recycle spent sparks, and bound suspension catch-up", () => {
  assert.equal(SENKO_MAX_PARTICLES, 200);
  assert.equal(createSenkoPool(9999).maxParticles, 200);
  for (const capacity of [0, 1, 2, 3, 8, 200]) {
    const pool = createSenkoPool(capacity), rng = seeded(18), slots = [...pool.particles];
    for (let i = 0; i < 120; i++) {
      assert.equal(stepSenkoParticles(pool, "matsuba", 100, rng, false), pool);
      assert.equal(pool.particles.length, capacity);
      assert.equal(pool.activeCount, active(pool).length);
      assert.ok(pool.activeCount <= capacity);
      for (const p of active(pool)) {
        assert.ok([p.x, p.y, p.vx, p.vy, p.ageMs, p.lifeMs].every(Number.isFinite));
      }
    }
    slots.forEach((slot, i) => assert.equal(pool.particles[i], slot, "objects are reused"));
    if (capacity) assert.ok(pool.nextId > capacity + 1, "the pool recycles after filling");
  }
  for (const n of [-1, 1.5, NaN, Infinity]) assert.throws(() => createSenkoPool(n), RangeError);
  const pool = createSenkoPool(), rng = seeded(1);
  stepSenkoParticles(pool, "matsuba", 1e12, rng, false);
  assert.equal(pool.elapsedMs, 250);
  const saved = structuredClone(pool);
  for (const dtMs of [-1, NaN, Infinity, 0]) stepSenkoParticles(pool, "matsuba", dtMs, rng, false);
  assert.deepEqual(pool, saved);
});

test("stage profiles produce slow thick peonies, long falling willows and sparse fading chrysanthemums", () => {
  const botan = active(simulate("botan", false, 2, 25));
  const matsuba = active(simulate("matsuba", false, 2, 25)).filter((p) => p.parentId === null);
  const yanagi = active(simulate("yanagi", false, 2, 25));
  const chiri = active(simulate("chiri-giku", false, 2, 25));
  assert.ok(botan.length > chiri.length && matsuba.length > botan.length);
  assert.ok(botan[0].width > matsuba[0].width);
  assert.ok(yanagi[0].lifeMs > botan[0].lifeMs);
  assert.ok(chiri[0].glow < botan[0].glow && chiri[0].lifeMs < botan[0].lifeMs);
  assert.ok(Math.abs(matsuba[0].vx) > Math.abs(botan[0].vx));
  const pool = simulate("yanagi", false, 2, 10), p = active(pool)[0], initialVy = p.vy;
  const rng = seeded(3);
  for (let i = 0; i < 3; i++) stepSenkoParticles(pool, "yanagi", 200, rng, false);
  assert.ok(p.vy > initialVy && p.y > p.prevY, "willow sparks curve down under gravity");
});

test("reduced motion halves primary emission at every stage and immediately zeroes stem tremor", () => {
  for (const stage of liveStages) {
    const normal = simulate(stage, false, 3, 200), calm = simulate(stage, true, 3, 200);
    const count = (reduced: boolean) => {
      const pool = createSenkoPool(), rng = seeded(3), ids = new Set<number>();
      for (let i = 0; i < 200; i++) {
        stepSenkoParticles(pool, stage, 10, rng, reduced);
        if (reduced) assert.equal(pool.tremor, 0);
        active(pool).filter((p) => p.parentId === null).forEach((p) => ids.add(p.id));
      }
      return ids.size;
    };
    assert.equal(count(true) * 2, count(false), stage);
    assert.ok(calm.activeCount < normal.activeCount);
    assert.notEqual(normal.tremor, 0);
    stepSenkoParticles(normal, stage, 0, seeded(1), true);
    assert.equal(normal.tremor, 0);
  }
});

test("inactive stages emit nothing, stop tremor, and allow all existing sparks to expire", () => {
  for (const stage of ["idle", "lighting", "dropped", "out"] as const) {
    assert.equal(simulate(stage).activeCount, 0);
    const pool = simulate("matsuba"), nextId = pool.nextId, rng = seeded(1);
    for (let i = 0; i < 20; i++) stepSenkoParticles(pool, stage, 100, rng, false);
    assert.equal(pool.nextId, nextId, "no emission or branching after extinguishing");
    assert.equal(pool.activeCount, 0); assert.equal(pool.tremor, 0);
  }
});

test("crackle cues stay within -24dB, 1100–1950Hz and 50ms with no overlapping voices", () => {
  const validate = (cue: Cue) => {
    assert.ok(cue.db <= -24);
    assert.ok(cueGain(cue) <= dbToGain(-24));
    assert.ok(cueLength(cue) <= 0.05);
    let end = 0;
    for (const note of cue.notes) {
      assert.ok(note.hz >= 1100 && note.hz <= 1950);
      assert.ok(note.attack > 0 && note.decay > 0 && note.at >= end);
      end = noteEnd(note);
    }
  };
  for (const { id } of SENKO_STAGES) {
    for (let seed = 0; seed < 128; seed++) validate(buildSenkoCrackleCue(id, seed));
    const cue = buildSenkoCrackleCue(id, 1);
    assert.deepEqual(cue, buildSenkoCrackleCue(id, 1));
    assert.equal(cue.notes.length > 0, liveStages.some((stage) => stage === id));
  }
  assert.notDeepEqual(buildSenkoCrackleCue("matsuba", 1), buildSenkoCrackleCue("matsuba", 2));
});

test("crackle is silent when muted and rate-limited to ten per second even under rapid requests", () => {
  assert.equal(SENKO_CRACKLE_INTERVAL_MS, 100);
  assert.equal(canPlaySenkoCrackle(null, 0, false), false);
  assert.equal(canPlaySenkoCrackle(null, 0, true), true);
  assert.equal(canPlaySenkoCrackle(-Infinity, 0, true), true);
  assert.equal(canPlaySenkoCrackle(0, 99.999, true), false);
  assert.equal(canPlaySenkoCrackle(0, 100, true), true);
  assert.equal(canPlaySenkoCrackle(100, 99, true), false);
  for (const bad of [NaN, Infinity, -1]) assert.equal(canPlaySenkoCrackle(null, bad, true), false);
  assert.equal(canPlaySenkoCrackle(NaN, 100, true), false);
  const played: number[] = [];
  let last: number | null = null;
  for (let now = 0; now < 1000; now++) {
    if (canPlaySenkoCrackle(last, now, true)) { played.push(now); last = now; }
  }
  assert.equal(played.length, 10);
  for (let i = 1; i < played.length; i++) assert.ok(played[i] - played[i - 1] >= 100);
});
