// Hand-drawn ink for Design system's stamps and figures, as SVG path data.
// Copied from Structures' ink.ts (itself the Gazette's), not imported (a group
// owes nothing to another): roughness 0.9, a fixed seed, so every render draws
// the same wobble. rough.js runs on the server only; the island gets finished
// path strings. The CJS bundle is imported because plain Node (npm test)
// cannot load roughjs/bin/*. Only this file and stamps.ts may import roughjs.
import rough from "roughjs/bundled/rough.cjs.js";
import type { Drawable, Options } from "roughjs/bin/core";

export const SEED = 216;
export const INK = "#1d1b17";

export type InkPath = { d: string; stroke: string; strokeWidth: number; fill?: string };
export type InkOptions = {
  seed?: string | number;
  roughness?: number;
  bowing?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fillStyle?: "hachure" | "solid" | "zigzag";
  hachureAngle?: number;
  hachureGap?: number;
};

const generator = rough.generator();

// FNV-1a over the name, so "plate:1" always wobbles the same way and a new shape
// never redraws the others. rough.js treats seed 0 as "random", so never 0.
function seedOf(seed: string | number | undefined): number {
  if (seed === undefined) return SEED;
  if (typeof seed === "number") return Math.max(1, Math.floor(Math.abs(seed)));
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 0x7ffffffe) + 1;
}

function options(o: InkOptions = {}): Options {
  const { seed, ...rest } = o;
  return {
    roughness: 0.9,
    bowing: 1,
    strokeWidth: 2.2,
    stroke: INK,
    ...rest,
    seed: seedOf(seed),
  };
}

// Two decimals keep the served path data short; the wobble is far coarser than
// 0.01. (toPaths ignores rough.js's fixedDecimalPlaceDigits, so round here.)
const round = (d: string) => d.replace(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi, (n) => String(Number(Number(n).toFixed(2))));

function paths(drawable: Drawable): InkPath[] {
  return generator.toPaths(drawable).map((p) => ({
    d: round(p.d),
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    ...(p.fill && p.fill !== "none" ? { fill: p.fill } : {}),
  }));
}

export function inkCircle(cx: number, cy: number, r: number, o?: InkOptions): InkPath[] {
  return paths(generator.circle(cx, cy, r * 2, options(o)));
}

// w and h are the full width and height, as rough.js takes them
export function inkEllipse(cx: number, cy: number, w: number, h: number, o?: InkOptions): InkPath[] {
  return paths(generator.ellipse(cx, cy, w, h, options(o)));
}

// any SVG path string
export function inkPath(svgPath: string, o?: InkOptions): InkPath[] {
  return paths(generator.path(svgPath, options(o)));
}

export function inkRect(x: number, y: number, w: number, h: number, o?: InkOptions): InkPath[] {
  return paths(generator.rectangle(x, y, w, h, options(o)));
}

export function inkLine(x1: number, y1: number, x2: number, y2: number, o?: InkOptions): InkPath[] {
  return paths(generator.line(x1, y1, x2, y2, options(o)));
}
