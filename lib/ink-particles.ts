// The ink hero's specks, with no DOM: a struct-of-arrays field of N particles, each sprung to a target on the
// wordmark. A pointer blows them away with a (1 - d/R)^2 falloff scaled by its speed; while displaced they drift
// on a curl-noise flow, like ink bleeding on paper, then spring back. components/ink-hero.tsx steps it at SIM_HZ
// and draws at INK_FPS; lib/ink-particles.test.ts drives it directly.

/** Frames drawn per second: a stop-motion cadence, like ink stamped frame by frame. */
export const INK_FPS = 24;
/** Fixed simulation steps per second, whatever the display's refresh rate. */
export const SIM_HZ = 60;
/** Particle counts: WebGL2 on a roomy screen, WebGL2 on a small or weak one, and the Canvas2D fallback. */
export const INK_TIERS = [2400, 1200, 600] as const;
export type InkTier = (typeof INK_TIERS)[number];

/** Settled once every speck has been within this many px of its target for SETTLE_STEPS steps in a row. */
export const SETTLE_PX = 0.3;
export const SETTLE_STEPS = 6;

const DT = 1 / SIM_HZ;
const SPRING = 36; // per s^2: omega = 6 rad/s
const DAMPING = 9; // per s: a little under critical, so the ink overshoots a touch and stops
const DRIFT = 220; // px/s^2 of curl-noise flow at full displacement
const DRIFT_FULL = 20; // px of displacement at which the drift reaches full strength
const MAX_SPEED = 2400; // px/s, keeps a wild flick from tunnelling off the page
const BLOW = 700; // px/s handed to a speck right under the pointer, at gain 1

export type InkField = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  tx: Float32Array;
  ty: Float32Array;
  /** Seconds of simulated time, which moves the curl-noise field. */
  t: number;
  /** Consecutive steps with every speck under SETTLE_PX of its target. */
  calm: number;
};

/** mulberry32: a small seeded PRNG giving floats in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The tier for a device: the Canvas2D fallback gets 600; WebGL2 gets 2400, or 1200 on a narrow or weak one. */
export function inkTier({ webgl2, width, cores }: { webgl2: boolean; width: number; cores: number }): InkTier {
  if (!webgl2) return 600;
  return width >= 768 && cores >= 4 ? 2400 : 1200;
}

/**
 * N targets drawn (seeded) from a flat [x0, y0, x1, y1, ...] point list, each nudged up to `jitter` source units
 * across the stroke and then multiplied by `scale`. The same seed always gives the same targets.
 */
export function sampleTargets(points: ArrayLike<number>, n: number, seed: number, scale = 1, jitter = 0): Float32Array {
  const count = Math.floor(points.length / 2);
  if (count === 0) throw new Error("sampleTargets: empty point list");
  const rand = seeded(seed);
  const out = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rand() * count) * 2;
    // a disc, denser at the middle of the stroke, the way a nib lays ink
    const r = jitter * Math.sqrt(rand()) * (0.5 + 0.5 * rand());
    const a = rand() * Math.PI * 2;
    out[i * 2] = (points[k] + Math.cos(a) * r) * scale;
    out[i * 2 + 1] = (points[k + 1] + Math.sin(a) * r) * scale;
  }
  return out;
}

/**
 * A field at rest on `targets`, or, with `spread`, each speck starting up to that many px off its target in a
 * seeded direction, so the mark bleeds into shape.
 */
export function createField(targets: Float32Array, seed = 1, spread = 0): InkField {
  const n = targets.length / 2;
  const field: InkField = {
    n,
    x: new Float32Array(n),
    y: new Float32Array(n),
    vx: new Float32Array(n),
    vy: new Float32Array(n),
    tx: new Float32Array(n),
    ty: new Float32Array(n),
    t: 0,
    calm: 0,
  };
  const rand = seeded(seed ^ 0x9e3779b9);
  for (let i = 0; i < n; i++) {
    const tx = targets[i * 2];
    const ty = targets[i * 2 + 1];
    field.tx[i] = tx;
    field.ty[i] = ty;
    const r = spread * rand();
    const a = rand() * Math.PI * 2;
    field.x[i] = tx + Math.cos(a) * r;
    field.y[i] = ty + Math.sin(a) * r;
  }
  if (spread === 0) field.calm = SETTLE_STEPS;
  return field;
}

/** The gain a pointer moving at `speed` px/s applies: a still pointer or a tap still blows, a fast one twice as hard. */
export function pointerGain(speed: number): number {
  return Math.min(2, 0.35 + Math.max(0, speed) / 800);
}

/**
 * Blow the specks within `radius` of (px, py) straight away from it: a kick of BLOW * gain * (1 - d/R)^2 px/s.
 * Returns how many specks it touched.
 */
export function blow(field: InkField, px: number, py: number, speed: number, radius: number): number {
  const kick = BLOW * pointerGain(speed);
  const r2 = radius * radius;
  let touched = 0;
  const { x, y, vx, vy } = field;
  for (let i = 0; i < field.n; i++) {
    let dx = x[i] - px;
    let dy = y[i] - py;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r2) continue;
    let d = Math.sqrt(d2);
    if (d < 1e-3) {
      // right under the pointer: push along a direction fixed by the index, not a random one
      const a = i * 2.399963;
      dx = Math.cos(a);
      dy = Math.sin(a);
      d = 1;
    }
    const f = 1 - Math.sqrt(d2) / radius;
    const dv = kick * f * f;
    vx[i] += (dx / d) * dv;
    vy[i] += (dy / d) * dv;
    touched++;
  }
  if (touched > 0) field.calm = 0;
  return touched;
}

// A smooth scalar potential psi(x, y, t); the curl (dpsi/dy, -dpsi/dx) is a divergence-free swirl.
const F1 = 0.021;
const F2 = 0.047;
function curl(px: number, py: number, t: number): [number, number] {
  const a = px * F1 + t * 0.9;
  const b = py * F1 * 1.3 - t * 0.6;
  const c = (px + py) * F2 + t * 1.7;
  const d = (px - py) * F2 * 0.8 - t * 1.1;
  // psi = sin(a) cos(b) + 0.5 sin(c) sin(d)
  const dpdx = F1 * Math.cos(a) * Math.cos(b) + 0.5 * (F2 * Math.cos(c) * Math.sin(d) + F2 * 0.8 * Math.sin(c) * Math.cos(d));
  const dpdy = -F1 * 1.3 * Math.sin(a) * Math.sin(b) + 0.5 * (F2 * Math.cos(c) * Math.sin(d) - F2 * 0.8 * Math.sin(c) * Math.cos(d));
  const scale = 1 / Math.hypot(F1, F2);
  return [dpdy * scale, -dpdx * scale];
}

/** One fixed 1/SIM_HZ step: spring to target, damping, curl drift while displaced. Returns settled(field). */
export function step(field: InkField): boolean {
  if (settled(field)) return true;
  const { x, y, vx, vy, tx, ty } = field;
  let worst = 0;
  for (let i = 0; i < field.n; i++) {
    const ex = tx[i] - x[i];
    const ey = ty[i] - y[i];
    const e = Math.sqrt(ex * ex + ey * ey);
    let ax = SPRING * ex - DAMPING * vx[i];
    let ay = SPRING * ey - DAMPING * vy[i];
    if (e > SETTLE_PX) {
      const [cx, cy] = curl(x[i], y[i], field.t);
      const w = DRIFT * Math.min(1, e / DRIFT_FULL);
      ax += cx * w;
      ay += cy * w;
    }
    let nvx = vx[i] + ax * DT;
    let nvy = vy[i] + ay * DT;
    const v = Math.sqrt(nvx * nvx + nvy * nvy);
    if (v > MAX_SPEED) {
      nvx *= MAX_SPEED / v;
      nvy *= MAX_SPEED / v;
    }
    vx[i] = nvx;
    vy[i] = nvy;
    x[i] += nvx * DT;
    y[i] += nvy * DT;
    const fx = tx[i] - x[i];
    const fy = ty[i] - y[i];
    const f = fx * fx + fy * fy;
    if (f > worst) worst = f;
  }
  field.t += DT;
  field.calm = Math.sqrt(worst) < SETTLE_PX ? field.calm + 1 : 0;
  if (field.calm >= SETTLE_STEPS) {
    // land exactly, so a settled field draws the same mark every time
    x.set(tx);
    y.set(ty);
    vx.fill(0);
    vy.fill(0);
  }
  return settled(field);
}

/** True once every speck has stayed within SETTLE_PX of its target for SETTLE_STEPS steps running. */
export function settled(field: InkField): boolean {
  return field.calm >= SETTLE_STEPS;
}

/** The farthest any speck sits from its target, in px. */
export function maxDisplacement(field: InkField): number {
  let worst = 0;
  for (let i = 0; i < field.n; i++) {
    const d = Math.hypot(field.tx[i] - field.x[i], field.ty[i] - field.y[i]);
    if (d > worst) worst = d;
  }
  return worst;
}
