// Senko Hanabi's model: injected elapsed time and RNG, no browser or wall clock.
import { seeded } from "./ink-particles.ts";
import type { Cue } from "./sound.ts";

export const SENKO_STAGES = [
  { id: "idle", title: "Ready", japaneseTitle: "線香花火", description: "Hold to light the sparkler." },
  { id: "lighting", title: "Lighting", japaneseTitle: "点火", description: "Lighting — keep holding as the ember forms." },
  { id: "botan", title: "Peony", japaneseTitle: "牡丹", description: "Botan — peony, thick slow sparks around the glowing bead." },
  { id: "matsuba", title: "Pine needles", japaneseTitle: "松葉", description: "Matsuba — pine needles, brisk sparks branching in flight." },
  { id: "yanagi", title: "Willow", japaneseTitle: "柳", description: "Yanagi — willow, long sparks weeping down the paper." },
  { id: "chiri-giku", title: "Falling chrysanthemum", japaneseTitle: "散り菊", description: "Chiri-giku — falling chrysanthemum, the last faint sparks." },
  { id: "dropped", title: "Ember dropped", japaneseTitle: "落下", description: "The ember dropped — your hand moved too quickly." },
  { id: "out", title: "Out", japaneseTitle: "消灯", description: "The sparkler is out. Reset to light another." },
] as const;
export type SenkoStage = (typeof SENKO_STAGES)[number]["id"];
export type SenkoBurningStage = "botan" | "matsuba" | "yanagi" | "chiri-giku";

/** Inclusive starts in milliseconds of held time, including the lighting period. */
export const SENKO_STAGE_THRESHOLDS_MS = {
  lighting: 0, botan: 600, matsuba: 3200, yanagi: 6800, "chiri-giku": 10400, out: 13200,
} as const;
export const SENKO_JITTER_WINDOW_MS = 250;
/** Displacement in CSS pixels; touch is 1.75 times as forgiving. */
export const SENKO_JITTER_BUDGET = { mouse: 24, pen: 24, touch: 42 } as const;
export const SENKO_DROP_MS = 700;
export const SENKO_MAX_PARTICLES = 200;
export const SENKO_CRACKLE_INTERVAL_MS = 100;

export type SenkoState = {
  seed: number;
  stage: SenkoStage;
  heldMs: number;
  stageMs: number;
  jitter: number;
  jitterRatio: number;
  /** Bead coordinates are relative to the stem tip; +y points down, px and px/s. */
  beadY: number;
  beadVy: number;
  beadRadius: number;
  beadGlow: number;
};
export type SenkoSteadinessInput = {
  dx: number; dy: number; dtMs: number;
  /** Accepts PointerEvent.pointerType directly, plus the accessible keyboard path. */
  pointerType: string;
  steadyLatch?: boolean;
};
export type SenkoInput = {
  dtMs: number;
  holding: boolean;
  reset?: boolean;
  dx?: number; dy?: number; pointerType?: string; steadyLatch?: boolean;
};

const elapsed = (ms: number) => Number.isFinite(ms) ? Math.max(0, ms) : 0;
const burning = (stage: SenkoStage): stage is SenkoBurningStage =>
  stage === "botan" || stage === "matsuba" || stage === "yanagi" || stage === "chiri-giku";
const lit = (stage: SenkoStage) => stage === "lighting" || burning(stage);

export function createSenkoState(seed = 0x5e4c0): SenkoState {
  return { seed: seed >>> 0, stage: "idle", heldMs: 0, stageMs: 0, jitter: 0, jitterRatio: 0,
    beadY: 0, beadVy: 0, beadRadius: 0, beadGlow: 0 };
}

export function describeSenkoStatus(state: SenkoState): string {
  return SENKO_STAGES.find(({ id }) => id === state.stage)!.description;
}

function beadAt(stage: SenkoStage, heldMs: number): Pick<SenkoState, "beadRadius" | "beadGlow"> {
  if (stage === "lighting") {
    const progress = heldMs / SENKO_STAGE_THRESHOLDS_MS.botan;
    return { beadRadius: 3 * progress, beadGlow: 0.8 * progress };
  }
  if (stage === "botan") return { beadRadius: 3.4, beadGlow: 0.85 };
  if (stage === "matsuba") return { beadRadius: 3.8, beadGlow: 1 };
  if (stage === "yanagi") return { beadRadius: 3, beadGlow: 0.65 };
  if (stage === "chiri-giku") {
    const remaining = (13200 - heldMs) / (13200 - 10400);
    return { beadRadius: 2.6 * remaining, beadGlow: 0.5 * remaining };
  }
  return { beadRadius: 0, beadGlow: 0 };
}

/** New state; stage inspection clears hand jitter and any previous drop. */
export function jumpToSenkoStage(state: SenkoState, stage: SenkoStage): SenkoState {
  if (stage === "idle") return createSenkoState(state.seed);
  if (stage === "dropped") return { ...state, stage, stageMs: 0, jitter: 0, jitterRatio: 0,
    beadY: 0, beadVy: 45, beadRadius: Math.max(2, state.beadRadius), beadGlow: 0.6 };
  const heldMs = SENKO_STAGE_THRESHOLDS_MS[stage];
  return { ...createSenkoState(state.seed), stage, heldMs, ...beadAt(stage, heldMs) };
}

/** Exponential displacement memory; opposite movements add instead of cancelling.
 * Invalid deltas do not rewind time. Keyboard/latch clears memory before handing back to a pointer. */
export function stepSenkoSteadiness(state: SenkoState, input: SenkoSteadinessInput): SenkoState {
  if (!lit(state.stage)) return state;
  if (input.steadyLatch || input.pointerType === "keyboard") return { ...state, jitter: 0, jitterRatio: 0 };
  const distance = Number.isFinite(input.dx) && Number.isFinite(input.dy) ? Math.hypot(input.dx, input.dy) : 0;
  const jitter = state.jitter * Math.exp(-elapsed(input.dtMs) / SENKO_JITTER_WINDOW_MS) + distance;
  const budget = input.pointerType === "touch" ? SENKO_JITTER_BUDGET.touch : SENKO_JITTER_BUDGET.mouse;
  const jitterRatio = jitter / budget;
  const next = { ...state, jitter, jitterRatio };
  return jitterRatio >= 1 ? { ...next, stage: "dropped", stageMs: 0, beadVy: 45 } : next;
}

/** Immutable state step. Supply only active elapsed time (exclude hidden-tab time).
 * Out/dropped never relight while held: reset, or jump to a stage explicitly. */
export function stepSenkoState(state: SenkoState, input: SenkoInput): SenkoState {
  if (input.reset) return createSenkoState(state.seed);
  const dtMs = elapsed(input.dtMs);
  if (state.stage === "dropped") {
    const stageMs = Math.min(SENKO_DROP_MS, state.stageMs + dtMs);
    const seconds = (stageMs - state.stageMs) / 1000;
    const next = { ...state, stageMs,
      beadY: state.beadY + state.beadVy * seconds + 0.5 * 480 * seconds * seconds,
      beadVy: state.beadVy + 480 * seconds,
      beadGlow: state.beadGlow * ((SENKO_DROP_MS - stageMs) / (SENKO_DROP_MS - state.stageMs)) };
    return stageMs === SENKO_DROP_MS ? { ...next, stage: "out", beadRadius: 0, beadGlow: 0 } : next;
  }
  if (state.stage === "out") return state;
  if (!input.holding && !input.steadyLatch) {
    return state.stage === "idle" ? state : { ...state, stage: "out", stageMs: 0, beadGlow: 0, beadRadius: 0 };
  }
  const heldMs = Math.min(SENKO_STAGE_THRESHOLDS_MS.out, state.heldMs + dtMs);
  let stage: Exclude<SenkoStage, "idle" | "dropped"> = "lighting";
  for (const candidate of ["botan", "matsuba", "yanagi", "chiri-giku", "out"] as const) {
    if (heldMs >= SENKO_STAGE_THRESHOLDS_MS[candidate]) stage = candidate;
  }
  const next = { ...state, stage, heldMs, stageMs: heldMs - SENKO_STAGE_THRESHOLDS_MS[stage], ...beadAt(stage, heldMs) };
  return stepSenkoSteadiness(next, { dx: input.dx ?? 0, dy: input.dy ?? 0, dtMs,
    pointerType: input.pointerType ?? "mouse", steadyLatch: input.steadyLatch });
}

export type SenkoParticle = {
  active: boolean;
  id: number;
  parentId: number | null;
  stage: SenkoBurningStage;
  x: number; y: number; prevX: number; prevY: number;
  vx: number; vy: number; gravity: number;
  ageMs: number; lifeMs: number; splitAtMs: number;
  branched: boolean;
  width: number; glow: number;
};
export type SenkoPool = {
  maxParticles: number;
  /** Fixed slots, allocated once. Draw only active slots. */
  particles: SenkoParticle[];
  activeCount: number;
  nextId: number;
  elapsedMs: number;
  remainderMs: number;
  emissionRemainder: number;
  /** Horizontal stem offset in px; exactly zero under reduced motion. */
  tremor: number;
};

export function createSenkoPool(maxParticles = SENKO_MAX_PARTICLES): SenkoPool {
  if (!Number.isInteger(maxParticles) || maxParticles < 0) throw new RangeError("Invalid Senko particle capacity");
  const capacity = Math.min(SENKO_MAX_PARTICLES, maxParticles);
  return { maxParticles: capacity, activeCount: 0, nextId: 1, elapsedMs: 0, remainderMs: 0, emissionRemainder: 0, tremor: 0,
    particles: Array.from({ length: capacity }, () => ({ active: false, id: 0, parentId: null, stage: "botan",
      x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, gravity: 0,
      ageMs: 0, lifeMs: 0, splitAtMs: 0, branched: false, width: 0, glow: 0 })) };
}

// Rates in sparks/s; speeds in px/s, gravity in px/s², lifetimes in ms.
const SPARKS = {
  botan: { rate: 16, speed: 38, gravity: 32, life: 700, width: 2.3, glow: 0.9 },
  matsuba: { rate: 40, speed: 105, gravity: 40, life: 540, width: 1.1, glow: 1 },
  yanagi: { rate: 12, speed: 48, gravity: 110, life: 1350, width: 1.3, glow: 0.6 },
  "chiri-giku": { rate: 5, speed: 22, gravity: 42, life: 340, width: 0.8, glow: 0.3 },
} as const;

function spawn(pool: SenkoPool, stage: SenkoBurningStage, rng: () => number, parent?: SenkoParticle) {
  const p = pool.particles.find((slot) => !slot.active);
  if (!p) return;
  const profile = SPARKS[stage];
  const angle = parent ? Math.atan2(parent.vy, parent.vx) + (rng() - 0.5) * 1.8 : rng() * Math.PI * 2;
  const speed = profile.speed * (0.75 + rng() * 0.5) * (parent ? 0.65 : 1);
  p.active = true; p.id = pool.nextId++; p.parentId = parent?.id ?? null; p.stage = stage;
  p.x = p.prevX = parent?.x ?? 0; p.y = p.prevY = parent?.y ?? 0;
  p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
  p.gravity = profile.gravity; p.ageMs = 0;
  p.lifeMs = parent ? 120 + rng() * 100 : profile.life * (0.85 + rng() * 0.3);
  p.splitAtMs = 140 + rng() * 80; p.branched = !!parent;
  p.width = profile.width * (parent ? 0.65 : 1); p.glow = profile.glow * (parent ? 0.7 : 1);
  pool.activeCount++;
}

/** Like ink-particles.step, mutates only the caller-owned pool and injected RNG.
 * Reuse seeded(state.seed) from ink-particles for a session, never reseed per frame.
 * Fixed 10ms steps consume at most 250ms/call, discarding a suspension backlog.
 * Parent sparks split once into 2–3 children; children cannot branch recursively. */
export function stepSenkoParticles(pool: SenkoPool, stage: SenkoStage, dtMs: number,
  rng: () => number, reducedMotion = false): SenkoPool {
  pool.tremor = reducedMotion || !burning(stage) ? 0 : Math.sin(pool.elapsedMs * 0.021) * 0.75;
  pool.remainderMs += Math.min(250, elapsed(dtMs));
  while (pool.remainderMs >= 10) {
    pool.remainderMs -= 10;
    pool.elapsedMs += 10;
    const nextIdAtStart = pool.nextId;
    for (const p of pool.particles) {
      if (!p.active || p.id >= nextIdAtStart) continue;
      p.ageMs += 10;
      if (p.ageMs >= p.lifeMs) { p.active = false; pool.activeCount--; continue; }
      p.prevX = p.x; p.prevY = p.y;
      p.x += p.vx * 0.01; p.y += p.vy * 0.01 + 0.5 * p.gravity * 0.01 ** 2;
      p.vy += p.gravity * 0.01;
      if (stage === "matsuba" && p.stage === "matsuba" && !p.branched && p.ageMs >= p.splitAtMs) {
        const free = pool.maxParticles - pool.activeCount;
        if (free >= 2) {
          p.branched = true;
          const count = Math.min(free, 2 + Math.floor(rng() * 2));
          for (let i = 0; i < count; i++) spawn(pool, "matsuba", rng, p);
        }
      }
    }
    if (burning(stage)) {
      pool.emissionRemainder += SPARKS[stage].rate * (reducedMotion ? 0.5 : 1) * 0.01;
      const count = Math.floor(pool.emissionRemainder + 1e-10);
      pool.emissionRemainder = Math.max(0, pool.emissionRemainder - count);
      for (let i = 0; i < count; i++) spawn(pool, stage, rng);
    } else pool.emissionRemainder = 0;
  }
  pool.tremor = reducedMotion || !burning(stage) ? 0 : Math.sin(pool.elapsedMs * 0.021) * 0.75;
  return pool;
}

/** Cue data only; the later client schedules it on the site's shared AudioContext.
 * Non-overlapping triangle ticks keep the combined peak at the stated dB bound. */
export function buildSenkoCrackleCue(stage: SenkoStage, seed = 0x5e4c0): Cue {
  const rng = seeded(seed);
  const db = stage === "matsuba" ? -24 : stage === "chiri-giku" ? -32 : -28;
  return { db, wave: "triangle", notes: burning(stage) ? Array.from({ length: stage === "matsuba" ? 2 : 1 }, (_, i) => ({
    hz: 1100 + rng() * 850, at: i * 0.023, attack: 0.001, decay: 0.008 + rng() * 0.01,
  })) : [] };
}

/** Store the timestamp only after a cue actually plays; null/-Infinity means never. */
export function canPlaySenkoCrackle(lastAtMs: number | null, nowMs: number, soundOn: boolean): boolean {
  return soundOn && Number.isFinite(nowMs) && nowMs >= 0 &&
    (lastAtMs === null || lastAtMs === -Infinity ||
      (Number.isFinite(lastAtMs) && nowMs - lastAtMs >= SENKO_CRACKLE_INTERVAL_MS));
}
