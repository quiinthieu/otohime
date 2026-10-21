// The sheet every Design system drawing sits on, with no ink in it: the width,
// the lettering sizes, the Label shape and the parts' stamp sizes and corners.
// Copied from Structures' paper.ts, not imported. stamps.ts and kit.ts
// re-export from here; scenes.ts (which the island imports) reads it
// directly, so laying out the board never loads rough.js.
import { CORNERS, PARTS, type Corner, type Part } from "./board.ts";

// Every drawing is 480 wide and rendered at 358 CSS px on a 390 px phone, so a
// label of 17 draws at 12.7 px and 18 at 13.4 px.
export const WIDTH = 480;
export const SIZE = 18;
export const SMALL = 17;
// A generous average glyph width for a hand-lettered face, in ems.
export const EM_PER_CHAR = 0.52;

export type Label = {
  x: number;
  y: number; // the baseline
  text: string;
  size: number;
  anchor?: "start" | "middle" | "end";
  spot?: boolean;
};

export function label(x: number, y: number, text: string, o: Partial<Omit<Label, "x" | "y" | "text">> = {}): Label {
  return { x, y, text, size: o.size ?? SIZE, ...(o.anchor ? { anchor: o.anchor } : {}), ...(o.spot ? { spot: true } : {}) };
}

/** A label's left, top, right and bottom, estimated from its length. */
export function labelBox(l: Label): [number, number, number, number] {
  const w = l.text.length * l.size * EM_PER_CHAR;
  const left = l.anchor === "middle" ? l.x - w / 2 : l.anchor === "end" ? l.x - w : l.x;
  return [left, l.y - l.size * 0.75, left + w, l.y + l.size * 0.25];
}

// Each part is a box drawn about its own origin (its centre), the same size
// whatever its corner, so a corner change swaps the stamp and moves nothing.
export const STAMP_SIZE: Record<Part, { w: number; h: number }> = {
  card: { w: 400, h: 80 },
  bar: { w: 400, h: 36 },
  field: { w: 290, h: 40 },
  ring: { w: 64, h: 40 },
  button: { w: 160, h: 44 },
  ghost: { w: 160, h: 44 },
  tag: { w: 100, h: 32 },
  note: { w: 400, h: 56 },
  switch: { w: 64, h: 32 },
};

// The corner pot as a radius: sharp is square, soft a little round, round as
// round as the part's height allows (a pill for the short ones).
export const CORNER_RADIUS: Record<Corner, number> = { sharp: 0, soft: 6, round: 18 };

export const radiusOf = (part: Part, corner: Corner) => Math.min(CORNER_RADIUS[corner], STAMP_SIZE[part].h / 2);

/** The <symbol> id a stamp is drawn under: part-<part>-<corner>. */
export const stampId = (part: Part, corner: Corner) => `part-${part}-${corner}`;

/** Every stamp id, part by part, corners in CORNERS order. */
export const STAMP_IDS = PARTS.flatMap((p) => CORNERS.map((c) => stampId(p, c)));

/** The box a part's stamp is drawn in, about its origin: [left, top, right, bottom]. */
export function stampBounds(part: Part): [number, number, number, number] {
  const { w, h } = STAMP_SIZE[part];
  return [-w / 2, -h / 2, w / 2, h / 2];
}

// How many numbers each path command takes, and which are x (0) or y (1).
const AXES: Record<string, number[]> = {
  M: [0, 1],
  L: [0, 1],
  T: [0, 1],
  H: [0],
  V: [1],
  C: [0, 1, 0, 1, 0, 1],
  S: [0, 1, 0, 1],
  Q: [0, 1, 0, 1],
  Z: [],
};

/** Every absolute point in path data d as [axis, value]; throws on what it cannot place. */
export function pathCoordinates(d: string): [number, number][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: [number, number][] = [];
  let axes: number[] | null = null;
  let i = 0;
  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      axes = AXES[t] ?? null;
      if (!axes) throw new Error(`command ${t} is not one of M L H V C S Q T Z`);
      i = 0;
      continue;
    }
    if (!axes || axes.length === 0) throw new Error(`stray number ${t}`);
    out.push([axes[i % axes.length], Number(t)]);
    i++;
  }
  return out;
}
