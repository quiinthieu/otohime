/** Pure cosmetic fetch policy. Points are viewport centers; originals never move. */
export type FetchPoint = { x: number; y: number };
export type FetchRect = FetchPoint & { width: number; height: number };
export type FetchPhase = 'toss' | 'seeking' | 'returning' | 'returned' | 'cancelled';
export interface FetchFlight {
  phase: FetchPhase; source: FetchPoint; point: FetchPoint; velocity: FetchPoint;
  viewport: FetchPoint; elapsed: number;
}
export const FETCH_LIMIT_MS = 5000;
export const FETCH_SPEED = 2200;
export const ARRIVAL_PX = 3;
const finite = (p: FetchPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
const speedLimit = (v: FetchPoint): FetchPoint => {
  if (!finite(v)) return { x: 0, y: 0 };
  const scale = Math.min(1, 700 / (Math.hypot(v.x, v.y) || 1));
  return { x: v.x * scale, y: v.y * scale };
};
export function boundFetchPoint(p: FetchPoint, viewport: FetchPoint): FetchPoint {
  return { x: Math.max(36, Math.min(viewport.x - 36, p.x)), y: Math.max(32, Math.min(viewport.y - 32, p.y)) };
}
export function releaseVelocity(a: FetchPoint & { time: number }, b: FetchPoint & { time: number }): FetchPoint {
  const dt = b.time - a.time;
  return dt > 0 && dt < 150 ? speedLimit({ x: (b.x - a.x) * 1000 / dt, y: (b.y - a.y) * 1000 / dt }) : { x: 0, y: 0 };
}
export function beginFetch(source: FetchRect, release: FetchPoint, velocity: FetchPoint, viewport: FetchPoint): FetchFlight {
  if (!finite(source) || !finite(release) || !finite(viewport) || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0 || source.height <= 0 || viewport.x < 72 || viewport.y < 152) throw Error('invalid_fetch_geometry');
  return { phase: 'toss', source: boundFetchPoint({ x: source.x + source.width / 2, y: source.y + source.height / 2 }, viewport), point: boundFetchPoint(release, viewport), velocity: speedLimit(velocity), viewport: { ...viewport }, elapsed: 0 };
}
export function cancelFetch(s: FetchFlight): FetchFlight { return { ...s, phase: 'cancelled', point: { ...s.source } }; }
export function stepFetch(s: FetchFlight, delta: number): FetchFlight {
  if (s.phase === 'returned' || s.phase === 'cancelled') return s;
  const dt = Number.isFinite(delta) ? Math.max(0, delta) : 0;
  const elapsed = s.elapsed + dt;
  if (elapsed >= FETCH_LIMIT_MS) return cancelFetch({ ...s, elapsed });
  if (s.phase !== 'toss') return { ...s, elapsed };
  const moving = Math.min(dt, 180 - s.elapsed);
  const decay = Math.exp(-moving / 80);
  const point = boundFetchPoint({ x: s.point.x + s.velocity.x * .08 * (1 - decay), y: s.point.y + s.velocity.y * .08 * (1 - decay) }, s.viewport);
  return { ...s, elapsed, point, velocity: { x: s.velocity.x * decay, y: s.velocity.y * decay }, phase: elapsed >= 180 ? 'seeking' : 'toss' };
}
export function carryFetch(s: FetchFlight, actual: FetchPoint): FetchFlight {
  return s.phase === 'returning' && finite(actual) ? { ...s, point: { ...actual } } : s;
}
export function arriveFetch(s: FetchFlight, actual: FetchPoint): FetchFlight {
  if (!finite(actual)) return s;
  const target = s.phase === 'seeking' ? s.point : s.source;
  if (Math.hypot(actual.x - target.x, actual.y - target.y) > ARRIVAL_PX) return s;
  if (s.phase === 'seeking') return { ...s, phase: 'returning', point: { ...actual } };
  if (s.phase === 'returning') return { ...s, phase: 'returned', point: { ...s.source } };
  return s;
}
export type DragClickToken = { pointer: number; at: number; target: string };
export function consumeDragClick(token: DragClickToken | null, click: DragClickToken & { detail: number; modified: boolean }) {
  return { suppress: !!token && click.detail > 0 && !click.modified && token.pointer === click.pointer && token.target === click.target && click.at >= token.at && click.at - token.at < 500, token: null };
}
