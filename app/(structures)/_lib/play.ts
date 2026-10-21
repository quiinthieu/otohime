// The clock a move plays on, pure, so the island only feeds it ticks. A move's
// trace plays one beat a picture and a sentence, at 12 frames a second on
// twos: 6 ticks a beat, so a beat holds for half a second. In step mode the
// ticks do nothing and each next() shows one more beat. settle() lands the
// move at once, as under reduced motion.
//
// The machine moves while its sentence plays: the drawing shows the state
// before the move until the beat it lands on (landing()), then the state
// after it, so "Put 9 on top" shows the new plate and "Move 23 from drawer 4
// up to drawer 5" still shows the drawers as they were.
import type { Beat, Move } from "./machine.ts";

export const FPS = 12;
export const TICKS_PER_BEAT = 6;
export const TICK_MS = 1000 / FPS;

export type Mode = "play" | "step";

export type Play<S> = {
  from: S; // the state before the move
  state: S; // the state after it
  trace: readonly Beat[];
  land: number; // the beat from which the drawing shows `state`
  beat: number; // the beat showing
  tick: number; // ticks into it
  mode: Mode;
  done: boolean;
};

/**
 * The beat a move's drawing switches to the state after it: the first beat
 * that lights something the state before it does not have (the new plate, the
 * new word), else its last counted step (the write, the rub-out), else its
 * last beat. `before` is every element id drawn before the move.
 */
export function landing(trace: readonly Beat[], before: ReadonlySet<string>): number {
  const fresh = trace.findIndex((b) => (b.hot ?? []).some((id) => !before.has(id)));
  if (fresh >= 0) return fresh;
  const last = trace.findLastIndex((b) => b.step);
  return last >= 0 ? last : Math.max(0, trace.length - 1);
}

/** A move about to play from its first beat. */
export function start<S>(from: S, move: Move<S>, mode: Mode = "play", land = landing(move.trace, new Set())): Play<S> {
  const one = move.trace.length <= 1;
  return { from, state: move.state, trace: move.trace, land, beat: 0, tick: 0, mode, done: mode === "step" && one };
}

/** A move already played out: the page's first picture, and where Reset goes. */
export function finished<S>(state: S, trace: readonly Beat[], mode: Mode = "play"): Play<S> {
  return { from: state, state, trace, land: 0, beat: Math.max(0, trace.length - 1), tick: 0, mode, done: true };
}

/** One frame. A beat holds TICKS_PER_BEAT ticks; the move is done when the last one has. */
export function tick<S>(p: Play<S>): Play<S> {
  if (p.done || p.mode === "step") return p;
  const t = p.tick + 1;
  if (t < TICKS_PER_BEAT) return { ...p, tick: t };
  if (p.beat + 1 < p.trace.length) return { ...p, beat: p.beat + 1, tick: 0 };
  return { ...p, tick: t, done: true };
}

/** Step mode: show the next beat; the move is done once its last beat shows. */
export function next<S>(p: Play<S>): Play<S> {
  if (p.done) return p;
  const beat = Math.min(p.beat + 1, p.trace.length - 1);
  return { ...p, beat, tick: 0, done: beat === p.trace.length - 1 };
}

/** Land at once on the last beat. */
export function settle<S>(p: Play<S>): Play<S> {
  return { ...p, beat: Math.max(0, p.trace.length - 1), tick: 0, done: true };
}

/** Switch between playing and stepping, keeping the beat showing. */
export function setMode<S>(p: Play<S>, mode: Mode): Play<S> {
  if (p.done || p.mode === mode) return { ...p, mode };
  return { ...p, mode, tick: 0, done: mode === "step" && p.beat === p.trace.length - 1 };
}

/** The state the drawing shows on the beat showing. */
export const shown = <S>(p: Play<S>): S => (p.beat >= p.land ? p.state : p.from);

/** The beats so far, the one showing last. */
export const sofar = <S>(p: Play<S>): readonly Beat[] => p.trace.slice(0, p.beat + 1);

/** The steps counted so far. */
export const stepsSoFar = <S>(p: Play<S>): number => sofar(p).filter((b) => b.step).length;

/** What the narration says now. */
export const saying = <S>(p: Play<S>): string => p.trace[p.beat]?.say ?? "";

/** The ids lit on the beat showing. */
export const lit = <S>(p: Play<S>): ReadonlySet<string> => new Set(p.trace[p.beat]?.hot ?? []);

/** A move plays in play mode until its last beat has held: the move buttons wait for it. */
export const busy = <S>(p: Play<S>): boolean => !p.done && p.mode === "play";
