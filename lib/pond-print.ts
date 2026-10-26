// The Suminagashi Pond's prints (components/pond.tsx): the sheet a print is drawn on, the seed that names it and
// lays its grain, and the page background a print can become. The background is the stored JPEG under a wash of the
// page's own paper (app/(site)/pond.css), so the page text keeps its contrast whatever ink the print holds: the
// wash leaves WASH of the print showing, and lib/pond-print.test.ts holds the worst pigment on every paper, in both
// themes, to 4.5:1 for --ink and --muted. An inline <head> script (app/(site)/layout.tsx) sets --pond-print from
// localStorage before the first paint. Plain TypeScript with no imports, so node's strip-types runs it as it is.

/** The print, in px: a 4:3 sheet laid over the middle of the 3:2 pond. */
export const PRINT_W = 2400;
export const PRINT_H = 1800;
/** The background's JPEG: small enough for localStorage, large enough for a page. */
export const BG_W = 1280;
export const BG_H = 960;
export const BG_QUALITY = 0.8;
/** How much of the print shows through the page's paper, and the most the contrast test allows. */
export const WASH = 0.04;
export const MAX_WASH = 0.06;
export const STORAGE_KEY = "pond:print";
/** Past this a stored value is not one of ours: a 1280x960 JPEG at 0.8 is far below it. */
export const MAX_STORED = 3_000_000;

/** Every colour a print can hold: the water and the inks of components/pond-static.tsx, mixed by nothing. */
export const PIGMENTS = ["#f2efe7", "#231e16", "#3f4e93", "#ef6a4c", "#76a0e2"] as const;

const STORED = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

/** A stored background, or null for anything that is not a JPEG data URL of a sane size. */
export function parseStoredPrint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > MAX_STORED || !STORED.test(value)) return null;
  return value;
}

/** The CSS value --pond-print takes. A base64 data URL holds no quote or backslash, so it needs no escaping. */
export const printUrl = (dataUrl: string) => `url("${dataUrl}")`;

/** Before the first paint: the stored print as --pond-print on <html>, or nothing. The same test as parseStoredPrint. */
export const pondPrintScript =
  `try{var p=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});` +
  `if(typeof p==="string"&&p.length<=${MAX_STORED}&&${STORED}.test(p))` +
  `document.documentElement.style.setProperty("--pond-print",'url("'+p+'")')}catch(e){}`;

// FNV-1a over 32 bits.
function fnv(h: number, n: number): number {
  return Math.imul(h ^ (n & 0xffffffff), 0x01000193) >>> 0;
}

/** A print's seed: a hash of the rings it holds (to the tenth of a model px) and their inks, as 8 hex digits. */
export function printSeed(m: { drops: readonly { ink: string; pts: readonly number[] }[] }): string {
  let h = 0x811c9dc5;
  for (const d of m.drops) {
    for (let i = 0; i < d.ink.length; i++) h = fnv(h, d.ink.charCodeAt(i));
    for (const v of d.pts) h = fnv(h, Math.round(v * 10));
    h = fnv(h, -1);
  }
  return h.toString(16).padStart(8, "0");
}

export const printName = (seed: string) => `suminagashi-${seed}.png`;

/** The model-to-sheet map for a w x h sheet over a pond: px = (x - ox) * s, py = (y - oy) * s. The sheet covers
 * the pond's middle, cropping whichever sides it is narrower than. */
export function printFrame(pondW: number, pondH: number, w: number, h: number): { s: number; ox: number; oy: number } {
  const s = Math.max(w / pondW, h / pondH);
  return { s, ox: (pondW - w / s) / 2, oy: (pondH - h / s) / 2 };
}

/** The n-th draw of the seeded sequence, in [0, 1): mulberry32's mix on a counter. No Math.random. */
export function draw(seed: string, n: number): number {
  let t = (parseInt(seed, 16) ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export type Speck = { x: number; y: number; size: number; light: boolean; alpha: number };

/** The paper's grain on a w x h sheet: one speck per 400 px², placed, sized and toned by the seed. */
export function grain(seed: string, w: number, h: number): Speck[] {
  const n = Math.round((w * h) / 400);
  const scale = w / PRINT_W;
  const out: Speck[] = [];
  for (let i = 0; i < n; i++) {
    const k = i * 5;
    out.push({
      x: draw(seed, k) * w,
      y: draw(seed, k + 1) * h,
      size: Math.max(1, (1 + draw(seed, k + 2) * 2) * scale),
      light: draw(seed, k + 3) < 0.6,
      alpha: 0.05 + draw(seed, k + 4) * 0.1,
    });
  }
  return out;
}

// The WCAG 2 sums.
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  let h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!h) throw new Error(`not a #rgb or #rrggbb colour: ${hex}`);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

const rgbOf = (c: string | Rgb): Rgb => (typeof c === "string" ? parseHex(c) : c);

export function luminance(c: string | Rgb): number {
  const [r, g, b] = rgbOf(c).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string | Rgb, b: string | Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The page under the wash: the paper at (1 - wash) over a pigment, as the browser composites it, in sRGB. */
export function washed(paper: string | Rgb, pigment: string | Rgb, wash: number): Rgb {
  const p = rgbOf(paper);
  const q = rgbOf(pigment);
  return [0, 1, 2].map((i) => p[i] * (1 - wash) + q[i] * wash) as Rgb;
}

/** The lowest contrast a text colour gets over a washed print on this paper, and the pigment that gives it. */
export function worstContrast(text: string | Rgb, paper: string | Rgb, wash: number, pigments: readonly string[] = PIGMENTS): { ratio: number; pigment: string } {
  let worst = { ratio: Infinity, pigment: "" };
  for (const pigment of pigments) {
    const ratio = contrast(text, washed(paper, pigment, wash));
    if (ratio < worst.ratio) worst = { ratio, pigment };
  }
  return worst;
}
