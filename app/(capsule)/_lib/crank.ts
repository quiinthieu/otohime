// The crank by hand, as pure maths: where the pointer is round the crank's
// hub, and how far the handle has been pulled clockwise since it was grabbed.
// machine.tsx feeds it pointer positions; once the pull first reaches a
// quarter turn it fires the same turn as the Turn button.

/** Degrees the handle must be pulled clockwise before the turn starts. */
export const CRANK_FIRE = 90;

export type CrankDrag = { last: number; total: number };

/**
 * The angle of (x, y) round the hub (cx, cy), in screen coordinates (y down):
 * degrees clockwise from 12 o'clock, in [0, 360).
 */
export function angleAt(cx: number, cy: number, x: number, y: number): number {
  const deg = (Math.atan2(x - cx, cy - y) * 180) / Math.PI;
  const a = (deg + 360) % 360;
  return a === 360 ? 0 : a + 0; // + 0 turns -0 into 0
}

/** A fresh drag, grabbed at `angle`. */
export const crankStart = (angle: number): CrankDrag => ({ last: angle, total: 0 });

/**
 * One pointer move. The step is the shorter way round from the last angle (so
 * 350 → 20 is +30, across 12 o'clock), and it adds to the total pulled. A
 * counter-clockwise pull never takes the total below zero, and once it has
 * reached CRANK_FIRE it never drops back under it, so `fire` is true exactly
 * once per drag, on the move that first reaches a quarter turn.
 */
export function crankDrag(s: CrankDrag, angle: number): CrankDrag & { fire: boolean } {
  const step = ((((angle - s.last) % 360) + 540) % 360) - 180;
  const floor = s.total >= CRANK_FIRE ? CRANK_FIRE : 0;
  const total = Math.max(floor, s.total + step);
  return { last: angle, total, fire: s.total < CRANK_FIRE && total >= CRANK_FIRE };
}
