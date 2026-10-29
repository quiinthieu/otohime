import type { Stroke } from "./guestbook.ts";

export const DRAWING_WIDTH = 240;
export const DRAWING_HEIGHT = 160;
export const DRAWING_LIMIT_MS = 60000;

export function brushWidth(pressure: number, speed: number): number {
  const p = pressure > 0 ? Math.min(1, pressure) : 0.5;
  return Math.max(1, Math.min(15, Math.round(2 + 10 * p - Math.min(6, speed / 2))));
}

export function drawingPoint(x: number, y: number): [number, number] {
  return [Math.max(0, Math.min(DRAWING_WIDTH, Math.round(x))), Math.max(0, Math.min(DRAWING_HEIGHT, Math.round(y)))];
}

export function readyStrokes(strokes: readonly Stroke[]): Stroke[] {
  return strokes.filter((stroke) => stroke.w.length >= 2).map((stroke) => ({ ...stroke, p: [...stroke.p], w: [...stroke.w] }));
}
