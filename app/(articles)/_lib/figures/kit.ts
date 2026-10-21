// What every figure is made of, and the few helpers they share. A figure is
// data: ink paths in --ink, spot paths in --spot (the thing the article is
// about), and <text> labels whose numbers come from the article's facts by id,
// so the picture cannot say something the text does not.
import type { Article } from "../articles.ts";
import { inkLine, type InkOptions, type InkPath } from "../ink.ts";

export type Label = {
  x: number;
  y: number;
  text: string;
  size: number;
  anchor?: "start" | "middle" | "end";
  spot?: boolean;
};

export type Figure = {
  viewBox: [number, number];
  paths: InkPath[];
  spot: InkPath[];
  labels: Label[];
};

// Every figure is 480 wide and rendered at 358 CSS px on a 390 px phone, so a
// label of 17 draws at 12.7 px and 18 at 13.4 px.
export const WIDTH = 480;
export const SIZE = 18;
export const SMALL = 17;

// The light spot red. The page recolours spot paths with var(--spot), so the
// dark scheme gets its own red; this is what the raw data carries.
export const SPOT = "#b23a2f";

export function label(x: number, y: number, text: string, o: Partial<Omit<Label, "x" | "y" | "text">> = {}): Label {
  return { x, y, text, size: o.size ?? SIZE, ...(o.anchor ? { anchor: o.anchor } : {}), ...(o.spot ? { spot: true } : {}) };
}

// A fact's value by id. A figure that asks for a fact its article lacks is a
// bug, so it throws rather than drawing an empty label.
export function fact(a: Article, id: string): string {
  const f = a.facts.find((x) => x.id === id);
  if (!f) throw new Error(`${a.slug} has no fact ${id}`);
  return f.value;
}

// A straight arrow: the shaft and two short strokes for the head.
export function arrow(x1: number, y1: number, x2: number, y2: number, o: InkOptions = {}, head = 9): InkPath[] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const seed = String(o.seed ?? "arrow");
  const tip = (turn: number, s: string) =>
    inkLine(x2, y2, x2 - head * Math.cos(a + turn), y2 - head * Math.sin(a + turn), { ...o, seed: `${seed}:${s}` });
  return [...inkLine(x1, y1, x2, y2, o), ...tip(0.45, "l"), ...tip(-0.45, "r")];
}
