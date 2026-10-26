// The Ink Desk's red string: which pinned projects it joins, and the sagging
// curve between two pins. Pure, no DOM, so lib/desk-string.test.ts proves the
// shape and the component only feeds it pin positions on every drag frame.
// Coordinates are SVG user units, y down, so the string sags toward +y.

export type Point = { x: number; y: number };

// The string never hangs lower than this, however far apart the pins are.
export const MAX_SAG = 60;

// How slack the string is: a quarter of the gap between the pins.
export const SAG_RATIO = 0.25;

export function sagFor(a: Point, b: Point, max: number = MAX_SAG): number {
  return Math.min(max, Math.hypot(b.x - a.x, b.y - a.y) * SAG_RATIO);
}

// A quadratic's midpoint is halfway between the chord's midpoint and the
// control point, so the control sits twice the sag below the chord: the
// string's lowest-looking point then drops exactly sagFor(a, b).
export function stringControl(a: Point, b: Point, max: number = MAX_SAG): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 2 * sagFor(a, b, max) };
}

// The point at t (0..1) along the string, for tests and for hanging a tag on it.
export function stringPoint(a: Point, b: Point, t: number, max: number = MAX_SAG): Point {
  const c = stringControl(a, b, max);
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

// Two decimals is finer than a pixel and keeps the d attribute short; -0 prints as 0.
const num = (v: number) => String(Math.round(v * 100) / 100 || 0);

// The path's d attribute: "M ax ay Q cx cy bx by".
export function stringPath(a: Point, b: Point, max: number = MAX_SAG): string {
  const c = stringControl(a, b, max);
  return `M ${num(a.x)} ${num(a.y)} Q ${num(c.x)} ${num(c.y)} ${num(b.x)} ${num(b.y)}`;
}

export type Tagged = { id: string; tags: readonly string[] };

const norm = (tag: string) => tag.trim().toLowerCase();

// The pairs of projects that share at least one tag, each pair once, in the
// order the list gives them (the earlier project first). Tags match ignoring
// case and surrounding space; blank tags join nothing, nor do repeated ids.
export function relatedPairs(items: readonly Tagged[]): [string, string][] {
  const seen = new Set<string>();
  const list = items
    .filter((item) => !seen.has(item.id) && seen.add(item.id))
    .map((item) => ({ id: item.id, tags: new Set(item.tags.map(norm).filter(Boolean)) }));
  const pairs: [string, string][] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if ([...list[i].tags].some((t) => list[j].tags.has(t))) pairs.push([list[i].id, list[j].id]);
    }
  }
  return pairs;
}
