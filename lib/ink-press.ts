// The Ink Poster Press (components/ink-press.tsx, on /play): a typed phrase set as a poster in wet ink that bleeds,
// wobbles and dries. Everything that decides what a poster looks like is here and seeded: one 32-bit seed picks the
// layout (stamp, riso or brush), the tilt, the inks, the riso misregistration and the wobble, so ?s= reproduces the
// poster exactly. The component draws; this lays out. Plain TypeScript with no imports, so node's strip-types runs it.

export const LAYOUTS = ["stamp", "riso", "brush"] as const;
export type Layout = (typeof LAYOUTS)[number];

/** The longest phrase the press sets, in characters (code points). */
export const MAX_CHARS = 24;
export const DEFAULT_PHRASE = "wet ink";

/** The exported PNG, and the poster's shape everywhere: 4:5. */
export const EXPORT_W = 1080;
export const EXPORT_H = 1350;
export const RATIO = EXPORT_H / EXPORT_W;
/** The display canvas never draws past this many device px per CSS px. */
export const MAX_DPR = 2;
/** How long fresh ink takes to dry, in ms; after that the frame holds and no animation frame runs. */
export const DRY_MS = 2600;

/** Unprinted paper: the house paper, fixed whatever the site's theme, so an export looks the same from both. */
export const PAPER = "#f2efe7";
const SUMI = "#231e16";
const STAMP_INKS = ["#c8402c", SUMI, "#3f4e93"] as const;
// riso drums, as pairs: the block's ink first, then the type's
const RISO_PAIRS = [
  ["#ff48b0", "#0078bf"],
  ["#ffe800", "#ff48b0"],
  ["#00a95c", "#3255a4"],
  ["#ff6c2f", "#435060"],
] as const;

/** Mulberry32: a seeded generator of floats in [0, 1). No Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed as it travels in ?s=: 8 lower-case hex digits. */
export const formatSeed = (seed: number) => (seed >>> 0).toString(16).padStart(8, "0");

/** A ?s= value as a seed: 1 to 8 hex digits, or null for anything else. */
export function parseSeed(value: string | null | undefined): number | null {
  if (typeof value !== "string" || !/^[0-9a-f]{1,8}$/i.test(value)) return null;
  return parseInt(value, 16) >>> 0;
}

/** A seed's layout: the seed modulo three, so every layout is a step away from any seed. */
export const layoutOf = (seed: number): Layout => LAYOUTS[(seed >>> 0) % 3];

/** The seed nearest `seed` that sets `layout`: the same group of three, the other member. Stays a u32. */
export function withLayout(seed: number, layout: Layout): number {
  const s = seed >>> 0;
  const next = s - (s % 3) + LAYOUTS.indexOf(layout);
  return next > 0xffffffff ? next - 3 : next;
}

/** Shuffle: a fresh seed from a draw in [0, 1), never the one it replaces. */
export function shuffleSeed(current: number, draw: number): number {
  const next = Math.floor(Math.min(Math.max(draw, 0), 1 - 2 ** -32) * 2 ** 32) >>> 0;
  return next === current >>> 0 ? (next + 1) >>> 0 : next;
}

// C0 and C1 controls, and the bidi overrides and isolates, which would reorder the type.
const CONTROL = /[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g;

/** What the press sets: controls gone, whitespace run into single spaces, trimmed, at most MAX_CHARS code points
 * (a cut never splits a surrogate pair). Empty input stays empty; the component sets DEFAULT_PHRASE in its place. */
export function cleanPhrase(raw: string): string {
  const flat = raw.replace(/\s+/g, " ").replace(CONTROL, "").replace(/ {2,}/g, " ").trim();
  return Array.from(flat).slice(0, MAX_CHARS).join("").trim();
}

/** The type as a layout sets it: stamp and riso in capitals, brush as written. */
export const setCase = (layout: Layout, phrase: string) => (layout === "brush" ? phrase : phrase.toUpperCase());

/** The canvas font for a layout at a size in px. */
export function fontFor(layout: Layout, size: number): string {
  const px = `${Math.round(size * 100) / 100}px`;
  if (layout === "stamp") return `800 ${px} ui-monospace, SFMono-Regular, Menlo, monospace`;
  if (layout === "riso") return `900 ${px} Inter, "Helvetica Neue", Arial, sans-serif`;
  return `italic 700 ${px} Georgia, "Times New Roman", serif`;
}

/** Line height as a multiple of the font size. */
export const LEADING = 1.08;

export type Design = {
  seed: number;
  layout: Layout;
  /** Radians the type block turns. */
  tilt: number;
  /** The type's ink, and riso's second drum (the block); a single-ink layout repeats the first. */
  ink: string;
  ink2: string;
  /** Riso's misregistration, as a fraction of the poster's width and height. */
  shift: [number, number];
  /** How far the wet ink wobbles and bleeds, 0.5 to 1. */
  wobble: number;
  bleed: number;
  /** An offset into the shader's noise, so two seeds never share a grain. */
  grain: number;
  /** Riso's block behind the type: a disc or a bar, centred at (x, y) in fractions of the poster, r of its width. */
  block: { shape: "disc" | "bar"; x: number; y: number; r: number };
};

/** Every look a seed decides, drawn in a fixed order so a design never changes under a seed. */
export function design(seed: number): Design {
  const s = seed >>> 0;
  const r = mulberry32(s);
  const layout = layoutOf(s);
  const spread = layout === "stamp" ? 0.1 : layout === "riso" ? 0.035 : 0.12;
  const lean = layout === "brush" ? -0.06 : 0;
  const tilt = lean + (r() * 2 - 1) * spread;
  const pair = RISO_PAIRS[Math.floor(r() * RISO_PAIRS.length)];
  const stampInk = STAMP_INKS[Math.floor(r() * STAMP_INKS.length)];
  const ink = layout === "stamp" ? stampInk : layout === "riso" ? pair[1] : SUMI;
  const ink2 = layout === "riso" ? pair[0] : ink;
  const sign = () => (r() < 0.5 ? -1 : 1);
  const shift: [number, number] = layout === "riso" ? [sign() * (0.006 + r() * 0.01), sign() * (0.004 + r() * 0.008)] : [0, 0];
  const wobble = 0.5 + r() * 0.5;
  const bleed = 0.5 + r() * 0.5;
  const grain = Math.floor(r() * 1000);
  const block = { shape: r() < 0.5 ? "disc" : "bar", x: 0.35 + r() * 0.3, y: 0.3 + r() * 0.4, r: 0.28 + r() * 0.12 } as const;
  return { seed: s, layout, tilt, ink, ink2, shift, wobble, bleed, grain, block };
}

/** The box the type fits inside, for a W x H poster: the stamp's sits inside its frame. */
export function typeBox(layout: Layout, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const inset = layout === "stamp" ? 0.2 : layout === "riso" ? 0.09 : 0.1;
  const tall = layout === "stamp" ? 0.42 : layout === "riso" ? 0.7 : 0.62;
  const bw = w * (1 - 2 * inset);
  const bh = h * tall;
  return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
}

/** The stamp's frame, for a W x H poster: a rectangle round the type box with room for its double rule. */
export function stampFrame(w: number, h: number): { x: number; y: number; w: number; h: number; rule: number } {
  const box = typeBox("stamp", w, h);
  const pad = w * 0.07;
  return { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad, rule: w * 0.018 };
}

export type Fit = { lines: string[]; size: number };

// Every way to cut `words` into `n` lines, in order, none empty.
function cuts(words: string[], n: number): string[][] {
  if (n === 1) return [[words.join(" ")]];
  const out: string[][] = [];
  for (let i = 1; i <= words.length - n + 1; i++) {
    for (const rest of cuts(words.slice(i), n - 1)) out.push([words.slice(0, i).join(" "), ...rest]);
  }
  return out;
}

/** The largest type that fits a box: the phrase cut on its spaces into one to three lines, whichever cut lets the
 * type grow most. `measure` is a line's width at a font size of 1. The size never passes half the box's height, so
 * one short word does not fill the whole poster. */
export function fitText(phrase: string, measure: (line: string) => number, box: { w: number; h: number }, maxLines = 3): Fit {
  const words = phrase.split(" ").filter(Boolean);
  if (words.length === 0) return { lines: [], size: 0 };
  let best: Fit = { lines: [words.join(" ")], size: 0 };
  for (let n = 1; n <= Math.min(maxLines, words.length); n++) {
    for (const lines of cuts(words, n)) {
      const widest = Math.max(...lines.map((l) => measure(l)));
      const size = Math.min(widest > 0 ? box.w / widest : Infinity, box.h / (n * LEADING), box.h / 2);
      if (size > best.size + 1e-9) best = { lines, size };
    }
  }
  return best;
}

/** The poster's download name: ink-press-<phrase as an ASCII slug, at most 24>-<layout>-<seed>.png. */
export function posterFilename(phrase: string, seed: number): string {
  const slug =
    phrase
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, MAX_CHARS)
      .replace(/^-+|-+$/g, "") || "poster";
  return `ink-press-${slug}-${layoutOf(seed)}-${formatSeed(seed)}.png`;
}

/** The query a poster lives at: ?s=<seed>&t=<phrase>. */
export function posterQuery(phrase: string, seed: number): string {
  const q = new URLSearchParams({ s: formatSeed(seed) });
  if (phrase) q.set("t", phrase);
  return `?${q}`;
}

/** A page's query read back: the seed if ?s= holds one, the phrase cleaned if ?t= holds one. */
export function readQuery(search: string): { seed: number | null; phrase: string | null } {
  const q = new URLSearchParams(search);
  const t = q.get("t");
  const phrase = t === null ? null : cleanPhrase(t);
  return { seed: parseSeed(q.get("s")), phrase: phrase || null };
}

/** How wet the ink still is `ms` after printing: 1 fresh, easing out to 0 at DRY_MS and after. Reduced motion
 * asks only for 0. */
export function wetness(ms: number): number {
  if (!(ms > 0)) return 1;
  if (ms >= DRY_MS) return 0;
  const t = ms / DRY_MS;
  return (1 - t) ** 3;
}

/** The display canvas's buffer for a box `cssW` CSS px wide: 4:5, at the device ratio capped at MAX_DPR. */
export function displaySize(cssW: number, devicePixelRatio: number): { w: number; h: number; dpr: number } {
  const dpr = Math.min(MAX_DPR, Math.max(1, devicePixelRatio || 1));
  const w = Math.max(1, Math.round(cssW * dpr));
  return { w, h: Math.round(w * RATIO), dpr };
}

/** "#rrggbb" as 0..1 RGB. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
