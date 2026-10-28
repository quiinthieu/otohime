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
