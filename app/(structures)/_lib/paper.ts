// The sheet every Structures drawing sits on, with no ink in it: the width, the
// lettering sizes, the Label shape and the stamp kit's sizes. stamps.ts and
// kit.ts re-export from here; scenes.ts (which the island imports) reads it
// directly, so laying out a machine never loads rough.js.

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

export const STAMP_KINDS = ["box", "plate", "node", "bucket", "tile", "station", "arrow", "hand"] as const;
export type StampKind = (typeof STAMP_KINDS)[number];
export const STAMP_SEEDS = [0, 1, 2] as const;
export type StampSeed = (typeof STAMP_SEEDS)[number];

// Each stamp is drawn about its own origin: the shapes centred on it, the unit
// arrow from it along +x (its shaft first, its head after), and the hand with
// its tip on it, pointing along +x like a clock hand.
export const STAMP_SIZE = {
  box: { w: 44, h: 44 },
  plate: { w: 64, h: 14 },
  node: { r: 20 },
  bucket: { w: 44, h: 30 },
  tile: { w: 36, h: 36 },
  station: { r: 14 },
  arrow: { length: 100, head: 9 },
  hand: { length: 28, width: 10 },
} as const;

/** The <symbol>/<path> id a stamp is drawn under. */
export const stampId = (kind: StampKind, seed: StampSeed) => `${kind}-${seed}`;

/** The box a stamp is drawn in, about its origin: [left, top, right, bottom]. */
export function stampBounds(kind: StampKind): [number, number, number, number] {
  switch (kind) {
    case "node":
    case "station": {
      const { r } = STAMP_SIZE[kind];
      return [-r, -r, r, r];
    }
    case "arrow": {
      const { length, head } = STAMP_SIZE.arrow;
      const spread = Math.ceil(head * Math.sin(0.45));
      return [0, -spread, length, spread];
    }
    case "hand": {
      const { length, width } = STAMP_SIZE.hand;
      return [-length, -width / 2, 0, width / 2];
    }
    default: {
      const { w, h } = STAMP_SIZE[kind];
      return [-w / 2, -h / 2, w / 2, h / 2];
    }
  }
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
