// The board's engine: a design system in eight pots. Pots are values (a dress
// carries a sister project's own hex, which no preset has); knobs are presets
// that set them. Every part draws with every pot, so with the system on any
// knob moves all nine parts; with it off every part keeps its private DRIFT
// values and a knob moves nothing. One count of each thing (POTS, PARTS,
// PATTERNS), read by the board, the figures and the words. All pure: turn()
// returns a new board and the counter's sentence, and never edits its input.
import { dress, dressName } from "./siblings.ts";

export const POTS = ["paper", "ink", "spot", "corner", "gap", "size", "speed", "face"] as const;
export const PARTS = ["card", "bar", "field", "ring", "button", "ghost", "tag", "note", "switch"] as const;
export const PATTERNS = ["form", "list", "dialog"] as const;

export type Pot = (typeof POTS)[number];
export type Part = (typeof PARTS)[number];
export type Pattern = (typeof PATTERNS)[number];

export const CORNERS = ["sharp", "soft", "round"] as const;
export const FACES = ["cursive", "serif", "sans-serif", "monospace"] as const;
export type Corner = (typeof CORNERS)[number];
export type Face = (typeof FACES)[number];

export type Pots = {
  paper: string; // hex
  ink: string; // hex
  spot: string; // hex
  corner: Corner;
  gap: number; // units between parts
  size: number; // label size, units
  speed: number; // ms
  face: Face;
};

// What one part draws with: the same eight values, its own or the pots'.
export type PartValues = Pots;

// Each paper sets its partner ink, so the board stays readable.
export const PAPERS = {
  cream: { paper: "#f6f3ea", ink: "#1d1b17" },
  white: { paper: "#ffffff", ink: "#1d1b17" },
  night: { paper: "#161513", ink: "#ebe5d6" },
} as const;

// Blue first: the default, and the one that gives the rule line 6.2 to 1 on cream.
export const SPOTS = {
  blue: "#2456b3",
  coral: "#ef6a4c",
  mint: "#93d3b0",
  yellow: "#f4b829",
  pink: "#f3a6bb",
  shade: "#3f4e93",
} as const;

export const GAPS = { tight: 8, even: 14, airy: 20 } as const;
export const SIZES = { small: 17, large: 21 } as const;
export const SPEEDS = { still: 0, quick: 150 } as const;

export type Knob = "paper" | "spot" | "corner" | "gap" | "size" | "speed" | "face";

// Every knob's presets, by name, as the pots each one sets.
export const KNOBS: Record<Knob, Record<string, Partial<Pots>>> = {
  paper: Object.fromEntries(Object.entries(PAPERS).map(([name, p]) => [name, { ...p }])),
  spot: Object.fromEntries(Object.entries(SPOTS).map(([name, spot]) => [name, { spot }])),
  corner: Object.fromEntries(CORNERS.map((corner) => [corner, { corner }])),
  gap: Object.fromEntries(Object.entries(GAPS).map(([name, gap]) => [name, { gap }])),
  size: Object.fromEntries(Object.entries(SIZES).map(([name, size]) => [name, { size }])),
  speed: Object.fromEntries(Object.entries(SPEEDS).map(([name, speed]) => [name, { speed }])),
  face: Object.fromEntries(FACES.map((face) => [face, { face }])),
};

// dress: the last sister project the board was dressed as, so the label can
// name the paper or spot it lent until a knob or reset replaces them.
export type Board = { pots: Pots; system: boolean; dress?: string };

export type Turn =
  | { knob: Knob; to: string }
  | { knob: "system"; to: boolean }
  | { knob: "dress"; to: string }
  | { knob: "reset" };

export type Turned = { board: Board; say: string; followed: Part[]; hot: Part[] };

export const DEFAULT: Board = {
  pots: { ...PAPERS.cream, spot: SPOTS.blue, corner: "soft", gap: GAPS.even, size: SIZES.small, speed: SPEEDS.quick, face: "cursive" },
  system: true,
};

// No system: every part chose its own values, so nothing matches. The screen
// paper stays cream; three blues and a stray coral, corners, gaps and sizes
// mixed, two parts in serif.
const own = (spot: string, corner: Corner, gap: number, size: number, face: Face, speed = 150): PartValues => ({
  ...PAPERS.cream,
  spot,
  corner,
  gap,
  size,
  speed,
  face,
});

export const DRIFT: Record<Part, PartValues> = {
  card: own("#2456b3", "sharp", 8, 17, "cursive"),
  bar: own("#3b7bd6", "round", 12, 19, "cursive"),
  field: own("#1a3f8a", "soft", 20, 17, "serif"),
  ring: own("#3b7bd6", "sharp", 12, 21, "cursive", 0),
  button: own("#ef6a4c", "round", 8, 21, "cursive"),
  ghost: own("#2456b3", "soft", 20, 19, "cursive"),
  tag: own("#1a3f8a", "round", 12, 17, "serif", 0),
  note: own("#3b7bd6", "sharp", 20, 19, "cursive"),
  switch: own("#2456b3", "soft", 8, 21, "cursive"),
};

export function values(b: Board): Record<Part, PartValues> {
  return Object.fromEntries(PARTS.map((p) => [p, b.system ? { ...b.pots } : { ...DRIFT[p] }])) as Record<Part, PartValues>;
}

// With the system on every part reads every pot, so all of them follow any
// change; with it off none of them reads the pots at all.
const following = (b: Board): Part[] => (b.system ? [...PARTS] : []);

const n = PARTS.length;
export const SAY = {
  start: "Turn a knob and watch what follows.",
  followed: (count: number) => `1 knob turned. ${count} parts followed.`,
  byHand: `1 knob turned. 0 parts followed. ${n} to fix by hand.`,
  off: "System off: every part keeps its own values.",
  on: `System on: ${n} parts follow the pots again.`,
  dressed: (name: string, count: number) => `Dressed as ${name}: ${count} parts followed.${count === 0 ? ` ${n} to fix by hand.` : ""}`,
  reset: "Back to the start.",
} as const;

function preset(knob: Knob, to: string): Partial<Pots> {
  const set = KNOBS[knob]?.[to];
  if (!set) throw new Error(`no ${knob} preset named ${to}`);
  return set;
}

export function turn(b: Board, t: Turn): Turned {
  let board: Board;
  let say: string;
  if (t.knob === "reset") {
    board = { pots: { ...DEFAULT.pots }, system: DEFAULT.system };
    say = SAY.reset;
  } else if (t.knob === "system") {
    board = { ...b, pots: { ...b.pots }, system: t.to };
    say = t.to ? SAY.on : SAY.off;
  } else if (t.knob === "dress") {
    board = { pots: { ...b.pots, ...dress(t.to) }, system: b.system, dress: t.to };
    const followed = following(board);
    return { board, say: SAY.dressed(dressName(t.to), followed.length), followed, hot: [...followed] };
  } else {
    board = { ...b, pots: { ...b.pots, ...preset(t.knob, t.to) } };
    const followed = following(board);
    return { board, say: b.system ? SAY.followed(followed.length) : SAY.byHand, followed, hot: [...followed] };
  }
  const followed = following(board);
  return { board, say, followed, hot: [...followed] };
}

const named = (table: Record<string, string | number>, value: string | number) => Object.keys(table).find((k) => table[k] === value);

/** The drawing's aria-label: the paper, the spot, the corner and the gap by preset name. */
export function describe(b: Board): string {
  if (!b.system) return `${n} parts with no system: three blues and a coral, mixed corners, gaps that do not match.`;
  const p = b.pots;
  const sister = b.dress ? dressName(b.dress) : undefined;
  const papers = Object.fromEntries(Object.entries(PAPERS).map(([k, v]) => [k, v.paper]));
  const paper = named(papers, p.paper) ?? (sister ?? p.paper);
  const spot = named(SPOTS, p.spot) ?? (sister ?? p.spot);
  const gap = named(GAPS, p.gap) ?? `${p.gap}-unit`;
  return `${n} parts on ${paper} paper, with ${/^[aeiou]/.test(spot) ? "an" : "a"} ${spot} spot, ${p.corner} corners and ${gap} gaps.`;
}
