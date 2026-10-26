// The Ink Desk's drag arithmetic and its cork corner. Pure, no DOM, so
// _lib/drag.test.ts proves it and _components/ink-desk.tsx only feeds it
// pointer deltas and element sizes.
// A committed spot is a centre in fractions of its surface (the desk, or the
// cork for a pin); a motion offset is in px from that spot, and springs to 0.
import { site } from "../../../../../content/site.ts";
import { relatedPairs, type Point } from "../../../../../lib/desk-string.ts";

export type Size = { w: number; h: number };

// A narrow screen or a touch-first one gets the stacked desk: the same items as a list, no drag, no string.
// desk.css lays it out under this very media query, so the server's HTML is already stacked there.
export const STACKED = "(max-width: 40rem), (pointer: coarse)";

// A press that moves less than this is a click on the link; past it, a drag.
export const DRAG_THRESHOLD = 6;

export function pastThreshold(dx: number, dy: number, threshold: number = DRAG_THRESHOLD): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

const unit = (v: number) => Math.min(1, Math.max(0, v));

// Where a drag drops: the start spot moved by the px offset, kept on the surface.
// A surface with no size yet (not laid out) leaves the spot where it was.
export function dropAt(from: Point, dx: number, dy: number, size: Size): Point {
  if (!(size.w > 0) || !(size.h > 0)) return from;
  return { x: unit(from.x + dx / size.w), y: unit(from.y + dy / size.h) };
}

// The offset that keeps a thing drawn where it is once its committed spot
// moves from one place to another, so the spring settles it into the new spot
// instead of it jumping there.
export function rebase(offset: Point, from: Point, to: Point, size: Size): Point {
  return { x: offset.x - (to.x - from.x) * size.w, y: offset.y - (to.y - from.y) * size.h };
}

// The shortest turn from one angle to another, in (-180, 180], for springing a
// rotation home the near way round.
export function turn(from: number, to: number): number {
  const d = (((from - to) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

// The cork corner's own units. The cork keeps this aspect (desk.css), so its
// SVG scales evenly and the string's sag is true.
export const CORK: Size = { w: 400, h: 440 };

// A pin's head in cork units, from its spot and a px offset at the cork's
// current px width.
export function anchor(spot: Point, offset: Point, corkPx: number): Point {
  const k = corkPx > 0 ? CORK.w / corkPx : 0;
  return { x: spot.x * CORK.w + offset.x * k, y: spot.y * CORK.h + offset.y * k };
}

export type Pin = { id: string; title: string; href: string; note: string; tags: readonly string[]; x: number; y: number };

// The pinned projects, their spots on a tidy cork, and the tags the red string
// joins them by. Titles, links and notes come from site.projectList.
const PINNED: readonly { title: string; tags: readonly string[]; x: number; y: number }[] = [
  { title: "Orrery", tags: ["sky"], x: 0.24, y: 0.14 },
  { title: "Planisphere", tags: ["sky", "weather"], x: 0.72, y: 0.2 },
  { title: "Barometer", tags: ["weather"], x: 0.7, y: 0.6 },
  { title: "Elements", tags: ["science"], x: 0.24, y: 0.52 },
  { title: "Gazette", tags: ["science", "paper"], x: 0.42, y: 0.8 },
];

const slug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const PINS: readonly Pin[] = PINNED.flatMap((p) => {
  const project = site.projectList.find((q) => q.title === p.title);
  if (!project?.href) return [];
  return [{ id: slug(p.title), title: project.title, href: project.href, note: project.note, tags: p.tags, x: p.x, y: p.y }];
});

// Which pins the string joins, each pair once.
export const PIN_PAIRS: readonly [string, string][] = relatedPairs(PINS);

export type PinSpots = Record<string, Point>;

// Every pin at its tidy spot.
export function pinHomes(pins: readonly Pin[] = PINS): PinSpots {
  return Object.fromEntries(pins.map((p) => [p.id, { x: p.x, y: p.y }]));
}
