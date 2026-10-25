// Pure state for the 404 lost sheet: rubbing strokes smooth the crumpled page.
// Progress grows with stroke length over a fixed distance, clamped to [0, 1]
// and never shrinks. No browser APIs.

// Total rubbed distance, in sheet px, that smooths the sheet flat.
export const SMOOTH_DISTANCE = 1600;

export type LostPoint = { readonly x: number; readonly y: number };
export type LostStroke = readonly LostPoint[];

// Rubbed distance is stored rather than progress: summing many small ratios
// drifts below 1 in floating point, summing px does not for whole-px strokes.
export type LostSheet = { readonly rubbed: number };

export const createLostSheet = (): LostSheet => ({ rubbed: 0 });

// 0 is fully crumpled, 1 is smooth.
export const progress = (state: LostSheet): number => Math.min(1, state.rubbed / SMOOTH_DISTANCE);

// Polyline length; a segment with a non-finite coordinate is skipped.
export const strokeLength = (stroke: LostStroke): number => {
  let length = 0;
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1];
    const b = stroke[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (Number.isFinite(d)) length += d;
  }
  return length;
};

export const applyStroke = (state: LostSheet, stroke: LostStroke): LostSheet => {
  const length = strokeLength(stroke);
  if (length <= 0 || state.rubbed >= SMOOTH_DISTANCE) return state;
  return { rubbed: Math.min(SMOOTH_DISTANCE, state.rubbed + length) };
};

// 1 is fully crumpled, 0 is smooth.
export const crumpleLevel = (state: LostSheet): number => 1 - progress(state);

export const isSmoothed = (state: LostSheet): boolean => progress(state) >= 1;
