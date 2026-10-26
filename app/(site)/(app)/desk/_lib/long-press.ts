// The Ink Desk's long press: hold a press LONG_PRESS_MS without moving it past
// the drag threshold and it fires once (the radial menu opens); moving that far
// first is a drag, and letting go first is a click. The clock is passed in, so
// _lib/long-press.test.ts drives it with fake timers.
import { DRAG_THRESHOLD, pastThreshold } from "./drag.ts";

export const LONG_PRESS_MS = 500;

export type Timers = { set: (fire: () => void, ms: number) => unknown; clear: (id: unknown) => void };

const realTimers: Timers = {
  set: (fire, ms) => setTimeout(fire, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export type LongPress = {
  // A press began here: (re)start the clock.
  start(x: number, y: number): void;
  // The press is here now: past the threshold, the clock stops for good.
  move(x: number, y: number): void;
  // Let go, cancelled or taken over: the clock stops.
  cancel(): void;
  // Whether the current press has fired.
  readonly fired: boolean;
};

export function longPress(
  onFire: () => void,
  timers: Timers = realTimers,
  ms: number = LONG_PRESS_MS,
  threshold: number = DRAG_THRESHOLD,
): LongPress {
  let pending: unknown = null;
  let x0 = 0;
  let y0 = 0;
  let fired = false;
  const cancel = () => {
    if (pending !== null) timers.clear(pending);
    pending = null;
  };
  return {
    start(x, y) {
      cancel();
      x0 = x;
      y0 = y;
      fired = false;
      pending = timers.set(() => {
        pending = null;
        fired = true;
        onFire();
      }, ms);
    },
    move(x, y) {
      if (pending !== null && pastThreshold(x - x0, y - y0, threshold)) cancel();
    },
    cancel,
    get fired() {
      return fired;
    },
  };
}
