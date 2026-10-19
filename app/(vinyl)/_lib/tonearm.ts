// The tonearm as numbers: where it points, what a drag or a key on it means.
// The arm turns about TONEARM_PIVOT in the turntable's 500 × 400 view; at 0°
// it hangs straight down beside the platter (rest), and clockwise it swings
// over the record. Between LEAD_IN (the stylus on the outermost groove) and
// RUN_OUT (the innermost) the angle *is* the playback position, so the arm
// doubles as the seek bar: it creeps inwards as the record plays, dragging it
// scrubs, and it is a keyboard slider too.
//
// dropAction() and keyAction() return deck actions, every one with
// `user: true`: they only ever run inside a pointer or key event, which is
// the gesture YouTube needs before anything plays.

import { clock, tonearm, type Action, type DeckState, type Phase, type Tonearm } from "./deck.ts";
import { TONEARM_PIVOT, type Box } from "./geometry.ts";

export const ARM_LENGTH = 290; // pivot to stylus, in view units
export const REST_ANGLE = 0;
export const LEAD_IN = 27; // stylus at r ≈ 163: the first groove
export const RUN_OUT = 45; // stylus at r ≈ 77: the last groove
export const ON_RECORD = 25; // from here inwards the stylus is over the record (r ≈ 173 > the disc's 170)
export const REST_ZONE = 12; // released below this, the arm is back on its rest
export const STEP_S = 5; // arrow keys
export const PAGE_S = 30; // PageUp / PageDown

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);

// 0 at the lead-in, 1 at the run-out.
export function angleToProgress(angle: number): number {
  return clamp((finite(angle) - LEAD_IN) / (RUN_OUT - LEAD_IN), 0, 1);
}

export function progressToAngle(progress: number): number {
  return LEAD_IN + clamp(finite(progress), 0, 1) * (RUN_OUT - LEAD_IN);
}

// The angle that points the arm at a point in view units, clamped to the
// arm's travel: a pointer far outside still moves it only rest..run-out.
export function pointerToAngle(pivot: { x: number; y: number }, point: { x: number; y: number }): number {
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return REST_ANGLE;
  // At θ the arm points along (−sin θ, cos θ).
  const deg = (Math.atan2(-dx, dy) * 180) / Math.PI;
  return clamp(deg, REST_ANGLE, RUN_OUT);
}

// Where the stylus is, in view units, at an angle.
export function stylusAt(angle: number): { x: number; y: number } {
  const t = (angle * Math.PI) / 180;
  return { x: TONEARM_PIVOT.x - ARM_LENGTH * Math.sin(t), y: TONEARM_PIVOT.y + ARM_LENGTH * Math.cos(t) };
}

// The arm's drawn extent around the pivot (counterweight to cartridge, and
// the wide invisible grab line), and how far its shadow is thrown.
export const ARM_EXTENT = { left: -14, right: 14, top: -44, bottom: 308 };
export const SHADOW_OFFSET = { x: 14, y: 18 };

// The box the arm and its shadow cover at an angle, in view units.
export function armBox(angle: number): Box {
  const t = (angle * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const { left, right, top, bottom } = ARM_EXTENT;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const lx of [left, right]) {
    for (const ly of [top, bottom]) {
      xs.push(TONEARM_PIVOT.x + lx * c - ly * s);
      ys.push(TONEARM_PIVOT.y + lx * s + ly * c);
    }
  }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) + SHADOW_OFFSET.x - x, h: Math.max(...ys) + SHADOW_OFFSET.y - y };
}

export function progressOf(time: number, duration: number): number {
  return duration > 0 ? clamp(finite(time) / duration, 0, 1) : 0;
}

// The angle the arm is drawn at when nobody is holding it.
export function armAngle(arm: Tonearm, progress: number): number {
  return arm === "rest" ? REST_ANGLE : progressToAngle(progress);
}

// The playback position a held arm stands for, or null when it is off the record.
export function scrubSeconds(angle: number, duration: number): number | null {
  if (angle < ON_RECORD || !(duration > 0)) return null;
  return angleToProgress(angle) * duration;
}

const SOUNDING: readonly Phase[] = ["starting", "buffering", "playing"];
const DROPPABLE: readonly Phase[] = ["loaded", "paused", "tap", "ended"];

// The arm was let go at `angle`.
//   over the record, arm at rest or lifted     → play{user} (a paused record seeks to the spot first)
//   over the record, needle down or hovering   → seek{user} to the spot
//   back in the rest zone while it sounds      → pause{user}
//   anywhere else                              → nothing; the arm springs back
export function dropAction(angle: number, state: DeckState): Action[] {
  if (state.index === null || !Number.isFinite(angle)) return [];
  const { phase, duration } = state;
  if (angle < REST_ZONE) return SOUNDING.includes(phase) ? [{ type: "pause", user: true }] : [];
  if (angle < ON_RECORD) return [];
  const seconds = scrubSeconds(angle, duration);
  if (DROPPABLE.includes(phase)) {
    const play: Action = { type: "play", user: true };
    // seekTo on a cued video starts it outside the deck's starting phase, so
    // only a paused record is moved before the play.
    return phase === "paused" && seconds !== null ? [{ type: "seek", seconds, user: true }, play] : [play];
  }
  if (SOUNDING.includes(phase) && seconds !== null) return [{ type: "seek", seconds, user: true }];
  return [];
}

// A key pressed on the focused arm: null when the arm doesn't use the key
// (it bubbles to the deck), else the actions (possibly none) it stands for.
export function keyAction(key: string, state: DeckState): Action[] | null {
  const { time, duration } = state;
  const seek = (seconds: number): Action[] =>
    state.index !== null && duration > 0 ? [{ type: "seek", seconds: clamp(seconds, 0, duration), user: true }] : [];
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return seek(time + STEP_S);
    case "ArrowLeft":
    case "ArrowDown":
      return seek(time - STEP_S);
    case "PageUp":
      return seek(time + PAGE_S);
    case "PageDown":
      return seek(time - PAGE_S);
    case "Home":
      return seek(0);
    case "End":
      return seek(duration);
    case "Enter":
      // Lift the needle back to its rest, or drop it where the arm already stands.
      if (SOUNDING.includes(state.phase)) return dropAction(REST_ANGLE, state);
      return state.index !== null && DROPPABLE.includes(state.phase) ? [{ type: "play", user: true }] : [];
    default:
      return null;
  }
}

// What the slider tells assistive tech.
export function armAria(state: DeckState): { now: number; max: number; text: string } {
  const max = Math.max(0, Math.floor(state.duration));
  const now = clamp(Math.floor(finite(state.time)), 0, max);
  const where: Record<Tonearm, string> = { rest: "at rest", hover: "hovering", down: "playing", lifted: "lifted" };
  return { now, max, text: `${clock(state.time)} of ${clock(state.duration)}, ${where[tonearm(state)]}` };
}
