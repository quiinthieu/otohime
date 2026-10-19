// Wall-clock timing: a backgrounded tab throttles timers, so remaining time is
// always computed from Date.now() values, never counted in ticks.
export type Session = {
  minutes: number;
  startedAt: number; // ms since the epoch, when Begin was pressed
  pausedMs: number; // total time spent paused before pausedAt
  pausedAt: number | null; // set while paused
};

export const begin = (minutes: number, now: number): Session => ({
  minutes,
  startedAt: now,
  pausedMs: 0,
  pausedAt: null,
});

export const pause = (s: Session, now: number): Session =>
  s.pausedAt === null ? { ...s, pausedAt: now } : s;

export const resume = (s: Session, now: number): Session =>
  s.pausedAt === null ? s : { ...s, pausedMs: s.pausedMs + Math.max(0, now - s.pausedAt), pausedAt: null };

// Milliseconds left, in [0, minutes]. A clock that jumped backwards (now before
// startedAt or pausedAt) counts as no time elapsed, never as extra time.
export function remaining(now: number, s: Session): number {
  const total = s.minutes * 60_000;
  const end = s.pausedAt ?? now;
  const elapsed = Math.max(0, end - s.startedAt - s.pausedMs);
  return Math.min(total, Math.max(0, total - elapsed));
}

// mm:ss, rounding up so 0:00 only shows when the session is over.
export function format(ms: number): string {
  const secs = Math.ceil(Math.max(0, ms) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
