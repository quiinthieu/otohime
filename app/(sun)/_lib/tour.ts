// Pure state for the Sun tour: (state, action) => state, so a reducer drives it
// and a test can play it without a browser. Copied in the style of
// app/(capsule)/_lib/machine.ts, not imported: Sun owes nothing to Capsule.
// "tick" advances one frame; "settle" ends the slide at once, which is what
// reduced motion and the tests use. A manual press always stops Play.

export const CHAPTER_COUNT = 8;
export const ENTER_FRAMES = 10; // the slide between chapters, on twos at 12 fps
export const HOLD_FRAMES = 96; // 8 s at 12 fps before Play advances

export type Tour = {
  chapter: number;
  phase: "settled" | "entering";
  frame: number;
  playing: boolean;
  held: number;
};
export type TourAction = "next" | "back" | "play" | "pause" | "tick" | "settle" | { goto: number };

export const newTour = (): Tour => ({ chapter: 0, phase: "settled", frame: 0, playing: false, held: 0 });

const LAST = CHAPTER_COUNT - 1;

const enter = (chapter: number, playing: boolean): Tour => ({
  chapter,
  phase: "entering",
  frame: 0,
  playing,
  held: 0,
});

function settle<S>(state: S, frame: (s: S) => S, busy: (s: S) => boolean): S {
  // ponytail: a frame cap rather than proving the tour halts
  for (let i = 0; i < 500 && busy(state); i++) state = frame(state);
  return state;
}

const tourBusy = (t: Tour) => t.phase === "entering";

function tourFrame(t: Tour): Tour {
  if (t.phase === "entering") {
    return t.frame + 1 < ENTER_FRAMES ? { ...t, frame: t.frame + 1 } : { ...t, phase: "settled", frame: 0 };
  }
  if (!t.playing) return t;
  if (t.held + 1 < HOLD_FRAMES) return { ...t, held: t.held + 1 };
  // the hold is over: on to the next chapter, still playing, or stop at the end
  return t.chapter < LAST ? enter(t.chapter + 1, true) : { ...t, playing: false, held: 0 };
}

export function step(t: Tour, a: TourAction): Tour {
  if (a === "tick") return tourFrame(t);
  if (a === "settle") return settle(t, tourFrame, tourBusy);
  if (a === "pause") return t.playing ? { ...t, playing: false } : t;
  if (a === "play") {
    // Play at the last chapter means play again from the first
    return t.chapter === LAST ? enter(0, true) : { ...t, playing: true, held: 0 };
  }
  const to =
    a === "next" ? t.chapter + 1 : a === "back" ? t.chapter - 1 : Number.isInteger(a.goto) ? a.goto : t.chapter;
  const chapter = Math.min(LAST, Math.max(0, to));
  // a press that goes nowhere does nothing
  return chapter === t.chapter ? t : enter(chapter, false);
}
