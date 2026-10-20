// Printed ink for Capsule's cards, as SVG path data. This is Capsule's own copy
// of app/(orrery)/_lib/ink.ts (a copy, never an import: the two route groups stay
// apart), with a finer, calmer line: one stroke per outline, light wobble. The
// seed is fixed per shape, so the server prerender and the browser draw the
// same bytes and hydration matches. The CJS bundle is imported because plain
// Node (npm test, npm run capsule:sheet) cannot load roughjs/bin/*. This is the
// only Capsule file that imports roughjs.
import rough from "roughjs/bundled/rough.cjs.js";
import type { Drawable, Options } from "roughjs/bin/core";

export const SEED = 196;
export const INK = "#2b2320";

export type InkPath = { d: string; stroke: string; strokeWidth: number; fill?: string };
export type InkOptions = {
  seed?: string | number;
  roughness?: number;
  bowing?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  fillStyle?: "hachure" | "solid" | "zigzag";
  fillWeight?: number;
  hachureAngle?: number;
  hachureGap?: number;
};

const generator = rough.generator();

// FNV-1a over the name, so "totoro:3" always wobbles the same way and a new
// shape never redraws the others. rough.js treats seed 0 as "random", so never 0.
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
    roughness: 0.55,
    bowing: 0.6,
    strokeWidth: 1.9,
    stroke: INK,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
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

// w and h are the full width and height, as rough.js takes them.
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
