// The Ink Desk's spring: a damped mass on a spring, one axis at a time, with
// no animation library. Pure, no DOM, so lib/spring.test.ts proves it settles.
// Unit mass, stiffness 170 and damping 14 give a damping ratio of about 0.54:
// underdamped, so a dropped item overshoots its spot by about an eighth and
// rocks back, which reads as springy without ringing for long.
// Times are in seconds; position and velocity are in whatever unit the caller
// uses (px, or desk fractions), the spring does not care.

export type Spring = { x: number; v: number };

export type SpringConfig = { k: number; c: number };

export const SPRING: SpringConfig = { k: 170, c: 14 };

// One substep is at most this long, so a 30 fps frame or a stuttered one runs
// the same small steps a 120 fps frame does and never blows up.
export const MAX_SUBSTEP = 1 / 120;

// A frame longer than this (a tab coming back from the background) is cut to
// it: the item carries on from where it was rather than teleporting.
export const MAX_FRAME = 0.1;

// Close enough to call it still: within this of the target, slower than SETTLE_V.
export const SETTLE_X = 0.01;
export const SETTLE_V = 0.01;

// Advance the spring toward target by dt seconds. Semi-implicit Euler (the new
// velocity moves the position) in equal substeps of at most MAX_SUBSTEP.
// A bad dt (negative, NaN) is a frame that did not happen.
export function step(state: Spring, target: number, dt: number, config: SpringConfig = SPRING): Spring {
  if (!(dt > 0)) return state;
  const total = Math.min(dt, MAX_FRAME);
  const n = Math.ceil(total / MAX_SUBSTEP);
  const h = total / n;
  let { x, v } = state;
  for (let i = 0; i < n; i++) {
    v += (-config.k * (x - target) - config.c * v) * h;
    x += v * h;
  }
  return { x, v };
}

export function settled(state: Spring, target: number, eps: number = SETTLE_X, epsV: number = SETTLE_V): boolean {
  return Math.abs(state.x - target) <= eps && Math.abs(state.v) <= epsV;
}

// step, then snap to rest once settled, so a loop can stop asking for frames.
export function advance(
  state: Spring,
  target: number,
  dt: number,
  config: SpringConfig = SPRING,
  eps: number = SETTLE_X,
  epsV: number = SETTLE_V,
): { state: Spring; done: boolean } {
  const next = step(state, target, dt, config);
  if (settled(next, target, eps, epsV)) return { state: { x: target, v: 0 }, done: true };
  return { state: next, done: false };
}

// How far an item leans while it moves: degrees per unit of velocity, capped
// either way, so a flung polaroid tilts into the throw and rights itself as
// the spring slows it down.
export const WOBBLE_GAIN = 0.012;
export const MAX_WOBBLE = 8;

export function wobble(v: number, gain: number = WOBBLE_GAIN, max: number = MAX_WOBBLE): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-max, Math.min(max, v * gain)) || 0;
}
