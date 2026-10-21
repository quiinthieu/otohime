// What every In life drawing and costs card is made of, copied from the
// Gazette's figures/kit.ts. A figure is data: ink paths in --ink, spot paths
// in --spot (the thing the rule is about), and <text> labels.
import { inkLine, type InkOptions, type InkPath } from "./ink.ts";
import { labelBox, pathCoordinates, SMALL, WIDTH, type Label } from "./paper.ts";

export { label, SIZE, SMALL, WIDTH, type Label } from "./paper.ts";

export type Figure = {
  viewBox: [number, number];
  paths: InkPath[];
  spot: InkPath[];
  labels: Label[];
};

// The light spot blue. The page recolours spot paths with var(--spot), so the
// dark scheme gets its own; this is what the raw data carries.
export const SPOT = "#2456b3";

// A straight arrow: the shaft and two short strokes for the head.
export function arrow(x1: number, y1: number, x2: number, y2: number, o: InkOptions = {}, head = 9): InkPath[] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const seed = String(o.seed ?? "arrow");
  const tip = (turn: number, s: string) =>
    inkLine(x2, y2, x2 - head * Math.cos(a + turn), y2 - head * Math.sin(a + turn), { ...o, seed: `${seed}:${s}` });
  return [...inkLine(x1, y1, x2, y2, o), ...tip(0.45, "l"), ...tip(-0.45, "r")];
}

/** The line from a to b, cut back `ra` at a's end and `rb` at b's, as x1 y1 x2 y2. */
export function between(ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): [number, number, number, number] {
  const a = Math.atan2(by - ay, bx - ax);
  const r = (n: number) => Math.round(n * 10) / 10;
  return [r(ax + ra * Math.cos(a)), r(ay + ra * Math.sin(a)), r(bx - rb * Math.cos(a)), r(by - rb * Math.sin(a))];
}

// What every drawing owes a phone: 480 wide, every ink point and label inside
// the frame with a 2-unit margin, every label 17 or more (12 px or more at 358
// CSS px), at most `maxLabels` of them, and at least one thing in spot.
const MARGIN = 2;

/** Everything wrong with a figure, as sentences; [] when it is fit to print. */
export function figureProblems(fig: Figure, maxLabels: number): string[] {
  const [w, h] = fig.viewBox;
  const out: string[] = [];
  if (w !== WIDTH) out.push(`${w} wide, not ${WIDTH}`);
  if (fig.paths.length + fig.spot.length === 0) out.push("no ink");
  if (fig.spot.length === 0 && !fig.labels.some((l) => l.spot)) out.push("nothing in spot");
  for (const [kind, paths] of [["ink", fig.paths], ["spot", fig.spot]] as const) {
    paths.forEach((p, n) => {
      for (const [axis, v] of pathCoordinates(p.d)) {
        const max = axis === 0 ? w : h;
        if (!(v >= MARGIN && v <= max - MARGIN)) out.push(`${kind} path ${n}: ${axis === 0 ? "x" : "y"}=${v}`);
      }
    });
  }
  if (fig.labels.length === 0 || fig.labels.length > maxLabels) out.push(`${fig.labels.length} labels`);
  for (const l of fig.labels) {
    const [left, top, right, bottom] = labelBox(l);
    if (!(left >= MARGIN && top >= MARGIN && right <= w - MARGIN && bottom <= h - MARGIN)) {
      out.push(`label ${l.text} runs ${left.toFixed(0)},${top.toFixed(0)} to ${right.toFixed(0)},${bottom.toFixed(0)}`);
    }
    if (l.size < SMALL) out.push(`label ${l.text} is size ${l.size}`);
    if (!l.text.trim()) out.push("an empty label");
  }
  return out;
}
