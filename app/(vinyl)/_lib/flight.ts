// Moving a record from the crate to the platter, as numbers: when a pointer
// on a sleeve becomes a drag, whether it was let go over the platter, where
// the dragged disc may be drawn, and the FLIP flight that carries a placed
// record onto the platter. All boxes are viewport boxes (getBoundingClientRect).
//
// The YouTube rule that nothing is ever drawn over the player decides two
// things here: the dragged disc is not drawn while its box meets the
// monitor's, and a flight whose path would cross the monitor is not flown.
// A box moving (and scaling) in a straight line from A to B never leaves the
// box around A and B, so checking that box is enough.

import { intersects, type Box } from "./geometry.ts";

export const MOVE_PX = 6; // a mouse or pen drag starts once it has moved this far
export const LONG_PRESS_MS = 350; // a touch drag starts after holding this long...
export const TOUCH_SLOP_PX = 10; // ...without moving further than this (else it is a scroll)
export const GHOST_PX = 96; // the dragged disc's diameter
export const FLIGHT_MS = 450;
export const FLIGHT_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";

export type Point = { x: number; y: number };
export type DragStep = "wait" | "start" | "cancel";

const finiteBox = (b: Box) => [b.x, b.y, b.w, b.h].every(Number.isFinite) && b.w > 0 && b.h > 0;

// A pointer moved `distance` px from where it went down, `heldMs` after it did.
// Mouse and pen: a drag once it moves far enough. Touch: moving early is a
// scroll (cancel); holding still long enough is a drag.
export function dragStep(pointerType: string, distance: number, heldMs: number): DragStep {
  if (pointerType === "touch") {
    if (heldMs >= LONG_PRESS_MS) return "start";
    return distance > TOUCH_SLOP_PX ? "cancel" : "wait";
  }
  return distance >= MOVE_PX ? "start" : "wait";
}

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

// An element's viewport box (anything with getBoundingClientRect), or null.
export function boxOf(el: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } } | null | undefined): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

// The platter is round: a point counts only inside its circle, not its box's corners.
export function insideDisc(point: Point, disc: Box): boolean {
  if (!finiteBox(disc)) return false;
  const r = Math.min(disc.w, disc.h) / 2;
  return distance(point, { x: disc.x + disc.w / 2, y: disc.y + disc.h / 2 }) <= r;
}

// The dragged disc, centred on the pointer.
export function ghostBox(point: Point, size = GHOST_PX): Box {
  return { x: point.x - size / 2, y: point.y - size / 2, w: size, h: size };
}

// The dragged disc may be drawn only where it covers no part of the monitor.
export function ghostAllowed(ghost: Box, monitor: Box | null): boolean {
  return monitor === null || !finiteBox(monitor) || !intersects(ghost, monitor);
}

export function around(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export type Flight = {
  box: Box; // where the flying disc is laid out: the platter
  keyframes: { transform: string; opacity: number; offset?: number }[];
  duration: number;
  easing: string;
};

// FLIP: lay the disc out on the platter, start it inverted onto the sleeve,
// play it to identity, then fade it so the drawn record shows. Only transform
// and opacity animate. null means don't fly: reduced motion, a box with no
// size, or a path that would cross the monitor.
export function flightPlan(from: Box, to: Box, monitor: Box | null, reduced: boolean): Flight | null {
  if (reduced || !finiteBox(from) || !finiteBox(to)) return null;
  if (monitor && finiteBox(monitor) && intersects(around(from, to), monitor)) return null;
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const scale = Math.min(from.w, from.h) / Math.min(to.w, to.h);
  const first = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(4)})`;
  return {
    box: to,
    keyframes: [
      { transform: first, opacity: 1 },
      { transform: "translate(0px, 0px) scale(1)", opacity: 1, offset: 0.8 },
      { transform: "translate(0px, 0px) scale(1)", opacity: 0 },
    ],
    duration: FLIGHT_MS,
    easing: FLIGHT_EASING,
  };
}
