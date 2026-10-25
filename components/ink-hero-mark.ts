// The ink hero's wordmark: "otohime" as a monoline signature with an underline swash, in a fixed 300 x 120
// viewBox. The strokes are plain polylines, so one source gives both the static SVG path (the reduced-motion and
// no-WebGL face, and what shows before the canvas loads) and the dense point list the specks are sampled from.
// The margins around the letters leave the specks room to fly without leaving the box.

export const INK_MARK_WIDTH = 300;
export const INK_MARK_HEIGHT = 120;
export const INK_MARK_VIEWBOX = `0 0 ${INK_MARK_WIDTH} ${INK_MARK_HEIGHT}`;
export const INK_MARK_STROKE = 4.5;

type Pt = [number, number];

// An elliptical arc from angle a0 to a1 (radians, y down, so -PI/2 is the top).
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

const PI = Math.PI;
const BASE = 82; // baseline
const XH = 52; // x-height
const MID = (BASE + XH) / 2;
const ASC = 26; // ascender

// a stem, then an arch over to the next stem: the shoulders of h and m
const arch = (left: number, right: number): Pt[] => [
  ...arc((left + right) / 2, MID - 2, (right - left) / 2, MID - 2 - XH, PI, 2 * PI, 16),
  [right, BASE],
];

const ROUND = [
  // o
  arc(40, MID, 13, 15, -PI / 2, (3 * PI) / 2, 32),
  // t: stem with a hook, then the bar
  [[66, ASC + 8], ...arc(74, BASE - 8, 8, 8, PI, PI / 2, 10), [81, BASE - 3]],
  [[58, XH], [80, XH]],
  // o
  arc(100, MID, 13, 15, -PI / 2, (3 * PI) / 2, 32),
  // h
  [[124, ASC], [124, BASE]],
  [[124, MID], ...arch(124, 150)],
  // i, and its dot
  [[166, XH], [166, BASE]],
  arc(166, XH - 13, 1.4, 1.4, 0, 2 * PI, 8),
  // m
  [[182, XH], [182, BASE]],
  [[182, MID], ...arch(182, 204)],
  [[204, MID], ...arch(204, 226)],
  // e: the bar, then round from its right end over the top and under to an open tail
  [[242, MID], [270, MID], ...arc(256, MID, 14, 15, 0, -PI * 1.75, 28).slice(1)],
  // the underline swash, a little wave under the whole name
  Array.from({ length: 41 }, (_, i): Pt => {
    const x = 26 + (i / 40) * 252;
    return [x, 100 + Math.sin((i / 40) * PI * 2.2) * 3 - (i / 40) * 4];
  }),
] satisfies Pt[][];

const round = (v: number) => Math.round(v * 100) / 100;

/** The strokes, each a flat [x0, y0, x1, y1, ...] list in viewBox units. */
export const INK_MARK_STROKES: number[][] = ROUND.map((s) => s.flatMap(([x, y]) => [round(x), round(y)]));

/** The strokes as one SVG path, drawn with a round cap and join at INK_MARK_STROKE. */
export const INK_MARK_PATH = INK_MARK_STROKES.map((s) => {
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += 2) parts.push(`${i === 0 ? "M" : "L"}${s[i]} ${s[i + 1]}`);
  return parts.join("");
}).join("");

/** Points every `spacing` viewBox units along every stroke, flat [x0, y0, ...], for the specks to land on. */
export function inkMarkPoints(spacing = 0.75): Float32Array {
  const out: number[] = [];
  for (const s of INK_MARK_STROKES) {
    out.push(s[0], s[1]);
    for (let i = 2; i < s.length; i += 2) {
      const x0 = s[i - 2];
      const y0 = s[i - 1];
      const len = Math.hypot(s[i] - x0, s[i + 1] - y0);
      const k = Math.max(1, Math.round(len / spacing));
      for (let j = 1; j <= k; j++) out.push(x0 + ((s[i] - x0) * j) / k, y0 + ((s[i + 1] - y0) * j) / k);
    }
  }
  return Float32Array.from(out);
}
