/** Normalized, bounded paper geometry; no DOM, random globals or wall clock. */
export const FOLD_MS = 400;
export const MAX_BALLS = 8;
export type FoldState = 'intact' | 'folding' | 'ball';
export interface FoldPoint { x: number; y: number }
export interface FoldTriangle { points: FoldPoint[]; shade: number }
function validSeed(seed: number) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid fold seed');
}
export function foldMesh(seed: number, elapsed: number): FoldTriangle[] {
  validSeed(seed);
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new RangeError('Invalid fold elapsed');
  let n = seed >>> 0;
  const random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; };
  const t = Math.min(1, elapsed / FOLD_MS), ease = t * t * (3 - 2 * t);
  const points: FoldPoint[] = [];
  for (let y = 0; y <= 6; y++) for (let x = 0; x <= 6; x++) {
    const angle = Math.atan2(y - 3, x - 3) + (random() - .5) * .6;
    const radius = Math.min(1, Math.hypot(x - 3, y - 3) / 3) * (.18 + random() * .07);
    points.push({ x: x / 6 * (1 - ease) + (.5 + Math.cos(angle) * radius) * ease,
      y: y / 6 * (1 - ease) + (.5 + Math.sin(angle) * radius) * ease });
  }
  const triangles: FoldTriangle[] = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const a = y * 7 + x, b = a + 1, c = a + 7, d = c + 1;
    for (const ids of [[a, b, d], [a, d, c]]) triangles.push({ points: ids.map(i => points[i]), shade: random() });
  }
  return triangles;
}
export function createFold({ seed, clock }: { seed: number; clock: () => number }) {
  validSeed(seed);
  let state: FoldState = 'intact', elapsed = 0, started = 0;
  const reset = () => { state = 'intact'; elapsed = 0; };
  const time = () => {
    const now = clock();
    if (!Number.isFinite(now) || now < 0) { reset(); throw new RangeError('Invalid fold clock'); }
    return now;
  };
  return {
    get state() { return state; }, get elapsed() { return elapsed; },
    start(reduced = false) { started = time(); elapsed = reduced ? FOLD_MS : 0; state = reduced ? 'ball' : 'folding'; },
    tick() {
      if (state === 'folding') {
        elapsed = Math.min(FOLD_MS, Math.max(elapsed, time() - started));
        if (elapsed === FOLD_MS) state = 'ball';
      }
      return state;
    }, reset, cancel: reset,
  };
}

/** Viewport pixels, seconds for velocity; caller injects elapsed milliseconds. */
export const BALL_LIMIT_MS = 5000;
export interface BallWorld { width: number; height: number; basket: { left: number; right: number; top: number; bottom: number } }
export interface PaperBall extends FoldPoint { vx: number; vy: number; radius: number; activeMs: number; remainder: number; rimHits: number; state: 'flying' | 'rest' | 'basket' }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), n));
function checkWorld(w: BallWorld) {
  if (![w.width, w.height, ...Object.values(w.basket)].every(Number.isFinite) || w.width < 40 || w.height < 40) throw new RangeError('Invalid ball world');
}
export function launchBall(point: FoldPoint, velocity: FoldPoint, w: BallWorld): PaperBall {
  checkWorld(w);
  if (![point.x, point.y, velocity.x, velocity.y].every(Number.isFinite)) throw new RangeError('Invalid ball');
  return { x: clamp(point.x, 18, w.width - 18), y: clamp(point.y, 18, w.height - 18), vx: clamp(velocity.x, -1200, 1200), vy: clamp(velocity.y, -1200, 1200), radius: 18, activeMs: 0, remainder: 0, rimHits: 0, state: 'flying' };
}
export function placeInBasket(w: BallWorld): PaperBall {
  const b = launchBall({ x: (w.basket.left + w.basket.right) / 2, y: w.basket.bottom - 20 }, { x: 0, y: 0 }, w);
  return { ...b, x: (w.basket.left + w.basket.right) / 2, y: w.basket.bottom - 20, state: 'basket' };
}
export function stepBall(input: PaperBall, deltaMs: number, w: BallWorld): PaperBall {
  checkWorld(w);
  if (input.state !== 'flying' || !Number.isFinite(deltaMs) || deltaMs <= 0) return input;
  const b = { ...input }, dt = Math.min(250, deltaMs, BALL_LIMIT_MS - b.activeMs), h = 1 / 120, r = b.radius;
  b.activeMs += dt; b.remainder += dt / 1000;
  b.x = clamp(b.x, r, w.width - r); b.y = clamp(b.y, r, w.height - r);
  while (b.remainder + 1e-10 >= h && b.state === 'flying') {
    b.remainder -= h;
    const oldY = b.y;
    b.vy = Math.min(1200, b.vy + 980 * h); b.vx *= .998;
    b.x += b.vx * h; b.y += b.vy * h;
    const k = w.basket;
    const visible = k.top >= r && k.bottom <= w.height && k.left >= 0 && k.right <= w.width;
    if (visible) {
      // Circle versus each rim segment. Small fixed steps and bounded speed prevent tunnelling.
      for (const [left, right] of [[k.left - 14, k.left + 6], [k.right - 6, k.right + 14]]) {
        const px = clamp(b.x, left, right), dx = b.x - px, dy = b.y - k.top, distance = Math.hypot(dx, dy);
        if (distance < r) {
          const nx = distance > .001 ? dx / distance : (b.x < (k.left + k.right) / 2 ? -1 : 1), ny = distance > .001 ? dy / distance : -1;
          b.x = px + nx * (r + .1); b.y = k.top + ny * (r + .1);
          const dot = b.vx * nx + b.vy * ny;
          if (dot < 0) { b.vx -= 1.45 * dot * nx; b.vy -= 1.45 * dot * ny; b.rimHits++; }
        }
      }
      if (b.vy > 0 && oldY < k.top && b.y >= k.top && b.x > k.left + r + 6 && b.x < k.right - r - 6) {
        b.state = 'basket'; b.x = (k.left + k.right) / 2; b.y = k.bottom - r;
      }
    }
    if (b.x < r || b.x > w.width - r) { b.x = clamp(b.x, r, w.width - r); b.vx *= -.45; }
    if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * .45; }
    if (b.y >= w.height - r) {
      b.y = w.height - r; b.vy = -Math.abs(b.vy) * .35; b.vx *= .72;
      if (Math.abs(b.vy) < 24 && Math.abs(b.vx) < 12) b.state = 'rest';
    }
  }
  if (b.activeMs >= BALL_LIMIT_MS) b.state = b.state === 'basket' ? 'basket' : 'rest';
  b.x = clamp(b.x, r, w.width - r); b.y = clamp(b.y, r, w.height - r);
  if (b.state !== 'flying') { b.vx = b.vy = b.remainder = 0; }
  return b;
}
