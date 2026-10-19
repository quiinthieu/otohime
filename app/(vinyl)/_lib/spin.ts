// The platter's inertia, one animation frame at a time. The angle is carried
// from frame to frame (a restarting CSS animation would snap it back), the
// speed eases towards deck.targetRpm(), and only the angle reaches the DOM, as
// a transform.
//
// Spinning up is a plain exponential approach (τ = 300 ms). Spinning down is
// the same with τ = 450 ms plus a little constant bearing friction, so the
// platter actually stops (within 2 s from 45 rpm) instead of creeping for
// seconds at a speed nobody can see.

export type Spin = { angle: number; rpm: number }; // degrees in [0, 360), revolutions per minute

export const MAX_DT_MS = 100; // a background tab or a long frame moves the platter at most this much
export const TAU_UP_MS = 300;
export const TAU_DOWN_MS = 450;
export const FRICTION_RPM = 1; // the friction term, as the rpm it would hold back at steady state
export const SNAP_RPM = 0.05;

export const REST: Spin = { angle: 0, rpm: 0 };

export function advance(spin: Spin, dtMs: number, targetRpm: number, reduced: boolean): Spin {
  const target = Math.max(0, targetRpm);
  // Reduced motion: no turning at all; the speed is only bookkeeping.
  if (reduced) return { angle: spin.angle, rpm: target };

  const dt = Math.min(MAX_DT_MS, Math.max(0, Number.isFinite(dtMs) ? dtMs : 0));
  let rpm: number;
  if (target >= spin.rpm) {
    rpm = target + (spin.rpm - target) * Math.exp(-dt / TAU_UP_MS);
  } else {
    // Exact solution of rpm' = -(rpm - target) / τ - friction over dt.
    const f = FRICTION_RPM;
    rpm = Math.max(target, target + (spin.rpm - target + f) * Math.exp(-dt / TAU_DOWN_MS) - f);
  }
  if (Math.abs(rpm - target) < SNAP_RPM) rpm = target;

  // Degrees per millisecond is rpm × 360 / 60000 = rpm × 6 / 1000.
  const mean = (spin.rpm + rpm) / 2;
  const angle = (((spin.angle + (mean * 6 * dt) / 1000) % 360) + 360) % 360;
  return { angle, rpm };
}

// The loop can sleep once the platter is still and should stay still.
export const settled = (spin: Spin, targetRpm: number) => spin.rpm === 0 && targetRpm <= 0;
