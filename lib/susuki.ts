// Pure Susuki field model. Coordinates are field fractions and times are seconds;
// the canvas adapter owns events, frame timing, storage, and rendering.
import { seeded } from "./ink-particles.ts";
import type { Season } from "./seasons.ts";

export const SUSUKI_MIN_BLADES = 2400;
export const SUSUKI_MAX_BLADES = 8000;
export const SUSUKI_BLADE_STRIDE = 6;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const seconds = (dt: number) => Number.isFinite(dt) && dt > 0;

/**
 * Baseline ramps linearly from 2400 at 360 CSS px to 8000 at 1920 px.
 * slowFrames is the count of observed frames taking >20ms, supplied by the
 * adapter. Any positive count halves the baseline once, down to 1200 on mobile.
 */
export function susukiBladeCount(width: number, slowFrames = 0): number {
  const fraction = clamp(((Number.isFinite(width) ? width : 360) - 360) / 1560, 0, 1);
  const baseline = Math.round(SUSUKI_MIN_BLADES + fraction * (SUSUKI_MAX_BLADES - SUSUKI_MIN_BLADES));
  return slowFrames > 0 ? Math.floor(baseline / 2) : baseline;
}

/**
 * Interleaved rootX [0,1], depth [0,1], height [.25,1], lean [-.25,.25],
 * phase [0,2π] radians, plume [.125,.375] (fraction of blade height).
 * Count is floored and capped at 8000; nonfinite or negative counts are empty.
 * Prefixes are stable so reducing the draw count does not reshuffle the field.
 */
export function createSusukiBlades(count: number, seed: number): Float32Array {
  const n = Number.isFinite(count) ? clamp(Math.floor(count), 0, SUSUKI_MAX_BLADES) : 0;
  const blades = new Float32Array(n * SUSUKI_BLADE_STRIDE);
  const random = seeded(seed);
  for (let i = 0; i < n; i++) {
    const offset = i * SUSUKI_BLADE_STRIDE;
    blades[offset] = random();
    blades[offset + 1] = random();
    blades[offset + 2] = 0.25 + random() * 0.75;
    blades[offset + 3] = (random() - 0.5) * 0.5;
    blades[offset + 4] = random() * Math.PI * 2;
    blades[offset + 5] = 0.125 + random() * 0.25;
  }
  return blades;
}

export type SusukiPoint = Readonly<{ x: number; y: number }>;
export type PointerSpring = Readonly<{ x: number; y: number; vx: number; vy: number }>;
export const POINTER_OMEGA = 12;

/** Exact critical damping (k=ω², c=2ω, unit mass), with a fixed target per step. */
export function stepPointerSpring(state: PointerSpring, target: SusukiPoint, dt: number): PointerSpring {
  if (!seconds(dt)) return state;
  // Beyond this the exponential is negligible; avoid huge dt * velocity overflow.
  if (dt >= 60) return { ...target, vx: 0, vy: 0 };
  const decay = Math.exp(-POINTER_OMEGA * dt);
  const dx = state.x - target.x;
  const dy = state.y - target.y;
  const cx = state.vx + POINTER_OMEGA * dx;
  const cy = state.vy + POINTER_OMEGA * dy;
  return {
    x: target.x + (dx + cx * dt) * decay,
    y: target.y + (dy + cy * dt) * decay,
    vx: (state.vx - POINTER_OMEGA * cx * dt) * decay,
    vy: (state.vy - POINTER_OMEGA * cy * dt) * decay,
  };
}

export const SCROLL_GUST_MAX = 3;
export const SCROLL_GUST_SPEED = 1200; // px/s for one unit of wind boost
export const SCROLL_GUST_TAU = 0.18;

/** Delta is accumulated CSS pixels since the last step, either direction. Zero decays to calm. */
export function stepScrollGust(current: number, scrollDeltaPx: number, dt: number): number {
  const from = Number.isFinite(current) ? clamp(current, 0, SCROLL_GUST_MAX) : 0;
  if (!seconds(dt)) return from;
  const delta = Number.isFinite(scrollDeltaPx) ? Math.abs(scrollDeltaPx) : 0;
  const target = clamp(delta / dt / SCROLL_GUST_SPEED, 0, SCROLL_GUST_MAX);
  return clamp(from + (target - from) * -Math.expm1(-dt / SCROLL_GUST_TAU), 0, SCROLL_GUST_MAX);
}

export type SusukiScheme = "light" | "dark";
export type SusukiRGB = readonly [number, number, number];
export type SusukiTint = Readonly<{ paper: SusukiRGB; ink: SusukiRGB; plume: SusukiRGB }>;

const rgb = (r: number, g: number, b: number): SusukiRGB => Object.freeze([r / 255, g / 255, b / 255]);
const tint = (paper: SusukiRGB, ink: SusukiRGB, plume: SusukiRGB): SusukiTint => Object.freeze({ paper, ink, plume });
const TINTS: Record<SusukiScheme, Record<Season, SusukiTint>> = {
  light: {
    spring: tint(rgb(246, 241, 232), rgb(65, 76, 62), rgb(176, 166, 145)),
    summer: tint(rgb(242, 241, 226), rgb(49, 72, 59), rgb(153, 168, 129)),
    autumn: tint(rgb(246, 236, 219), rgb(85, 63, 47), rgb(191, 155, 103)),
    winter: tint(rgb(239, 242, 243), rgb(55, 65, 77), rgb(159, 176, 187)),
  },
  dark: {
    spring: tint(rgb(28, 31, 29), rgb(156, 171, 147), rgb(204, 191, 168)),
    summer: tint(rgb(24, 32, 29), rgb(135, 165, 143), rgb(187, 197, 153)),
    autumn: tint(rgb(34, 28, 24), rgb(178, 151, 119), rgb(219, 183, 128)),
    winter: tint(rgb(25, 29, 35), rgb(146, 162, 184), rgb(196, 208, 219)),
  },
};

/** Frozen normalized RGB tuples, safe to share between callers. */
export function susukiSeasonTint(season: Season, scheme: SusukiScheme): SusukiTint {
  return TINTS[scheme][season];
}

export const SUSUKI_GUST_RADIUS = 0.18;
export const SUSUKI_GUST_STRENGTH = 0.08;

/**
 * Shared cursor/fox displacement: radial push with (1-distance/radius)² falloff,
 * strengthened by source speed. At the exact centre, push along its velocity
 * (rightwards for a stationary source). No displacement outside the local disc.
 */
export function susukiDisplacement(
  point: SusukiPoint,
  source: PointerSpring,
  radius = SUSUKI_GUST_RADIUS,
  strength = SUSUKI_GUST_STRENGTH,
): SusukiPoint {
  if (!(radius > 0) || !Number.isFinite(radius) || !Number.isFinite(strength)) return { x: 0, y: 0 };
  const dx = point.x - source.x;
  const dy = point.y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return { x: 0, y: 0 };
  const speed = Math.hypot(source.vx, source.vy);
  const directionX = distance > 0 ? dx / distance : speed > 0 ? source.vx / speed : 1;
  const directionY = distance > 0 ? dy / distance : speed > 0 ? source.vy / speed : 0;
  const push = strength * (0.35 + Math.min(1.65, speed)) * (1 - distance / radius) ** 2;
  return { x: directionX * push, y: directionY * push };
}

export const FOX_IDLE_SECONDS = 14;
export const FOX_TROT_SECONDS = 6;
export const FOX_DEPTH = 0.7;
export type FoxState = Readonly<{
  phase: "waiting" | "trotting" | "done";
  idleSeconds: number;
  idleThreshold: number;
  trotDuration: number;
  x: number;
  /** Persist as soon as trotting starts; cancelling still consumes the session. */
  hasRun: boolean;
  gust: PointerSpring | null;
}>;
export type FoxEvent = Readonly<{ type: "pointer" | "scroll" | "key" | "trigger" }>;

/** The adapter restores hasRun from session storage; no hidden module/session state. */
export function createFoxState({
  hasRun = false,
  idleThreshold = FOX_IDLE_SECONDS,
  trotDuration = FOX_TROT_SECONDS,
}: { hasRun?: boolean; idleThreshold?: number; trotDuration?: number } = {}): FoxState {
  return {
    phase: hasRun ? "done" : "waiting",
    idleSeconds: 0,
    idleThreshold: seconds(idleThreshold) ? idleThreshold : FOX_IDLE_SECONDS,
    trotDuration: seconds(trotDuration) ? trotDuration : FOX_TROT_SECONDS,
    x: 0,
    hasRun,
    gust: null,
  };
}

function trot(state: FoxState, elapsed: number): FoxState {
  const x = clamp(state.x + elapsed / state.trotDuration, 0, 1);
  return {
    ...state,
    phase: x >= 1 ? "done" : "trotting",
    x,
    hasRun: true,
    gust: x >= 1 ? null : { x, y: FOX_DEPTH, vx: 1 / state.trotDuration, vy: 0 },
  };
}

/**
 * Input resets waiting time or immediately ends an active trot. A trigger starts
 * immediately. Excess time crossing the idle threshold advances the trot in the
 * same step; a done state is terminal even for subsequent explicit triggers.
 */
export function stepFoxState(state: FoxState, eventOrDt: FoxEvent | number): FoxState {
  if (state.phase === "done") return state;
  if (typeof eventOrDt !== "number") {
    if (eventOrDt.type === "trigger") return state.phase === "waiting" ? trot(state, 0) : state;
    return state.phase === "trotting"
      ? { ...state, phase: "done", gust: null }
      : { ...state, idleSeconds: 0 };
  }
  if (!seconds(eventOrDt)) return state;
  if (state.phase === "trotting") return trot(state, eventOrDt);
  const idleSeconds = state.idleSeconds + eventOrDt;
  if (idleSeconds < state.idleThreshold) return { ...state, idleSeconds };
  return trot({ ...state, idleSeconds: state.idleThreshold }, idleSeconds - state.idleThreshold);
}

/** Sample the fox with exactly the same displacement model used by the cursor. */
export function foxGustAt(state: FoxState, point: SusukiPoint): SusukiPoint {
  return state.gust ? susukiDisplacement(point, state.gust) : { x: 0, y: 0 };
}

export function chooseSusukiMode({
  webgl2, reducedMotion, saveData, contextLost = false,
}: { webgl2: boolean; reducedMotion: boolean; saveData: boolean; contextLost?: boolean }): "live" | "static" {
  return webgl2 && !reducedMotion && !saveData && !contextLost ? "live" : "static";
}
