// "Right here": the twelve other top-level stylesheets on this site (the
// site's, ten projects' and the palace's, not this group's own), pinned from the files.
// Each row holds the sheet's light paper (the first hex of --paper; Vinyl
// has none), its first ink hex, how many distinct custom properties it
// declares (its named decisions), and whether it names a --paper and an
// --ink. Six rows carry a dress: the paper, ink, spot, corner and face the
// board can borrow. Pinned data, not read at run time: siblings.test.ts reads
// the real files and prints the value to re-pin when one changes.
import type { Corner, Face, Pots } from "./board.ts";

export type Dress = {
  name: string; // the button's label
  spot: string; // a hex the project really paints with
  spotFrom: string; // the file that holds it
  radius: number; // the sheet's most-used card corner, px
  face: Face; // the generic family that ends the root font stack
};

export type Sibling = {
  group: string; // the route group, without brackets
  file: string;
  paper: string | null;
  ink: string;
  decisions: number;
  hasPaper: boolean;
  hasInk: boolean;
  dress?: Dress;
};

export const SIBLINGS: readonly Sibling[] = [
  { group: "site", file: "app/(site)/globals.css", paper: "#f2efe7", ink: "#231e16", decisions: 30, hasPaper: true, hasInk: true },
  {
    group: "shore",
    file: "app/(shore)/shore.css",
    paper: "#f4f5f0",
    ink: "#253d36",
    decisions: 7,
    hasPaper: true,
    hasInk: true,
    dress: { name: "Shore", spot: "#839f88", spotFrom: "app/(shore)/shore.css", radius: 8, face: "sans-serif" },
  },
  {
    group: "capsule",
    file: "app/(capsule)/capsule.css",
    paper: "#f3ecdd",
    ink: "#2b2320",
    decisions: 12,
    hasPaper: true,
    hasInk: true,
    dress: { name: "Capsule", spot: "#c9684f", spotFrom: "app/(capsule)/capsule.css", radius: 2, face: "sans-serif" },
  },
  {
    group: "orrery",
    file: "app/(orrery)/orrery.css",
    paper: "#f6f1e7",
    ink: "#3a2a28",
    decisions: 16,
    hasPaper: true,
    hasInk: true,
    dress: { name: "Orrery", spot: "#e0672c", spotFrom: "app/(orrery)/orrery.css", radius: 14, face: "cursive" },
  },
  {
    group: "elements",
    file: "app/(elements)/elements.css",
    paper: "#faf8f3",
    ink: "#1c1d21",
    decisions: 15,
    hasPaper: true,
    hasInk: true,
    dress: { name: "Elements", spot: "#1d4ed8", spotFrom: "app/(elements)/_lib/categories.ts", radius: 12, face: "sans-serif" },
  },
  { group: "vinyl", file: "app/(vinyl)/vinyl.css", paper: null, ink: "#f3ece2", decisions: 13, hasPaper: false, hasInk: true },
  { group: "rotor", file: "app/(rotor)/rotor.css", paper: "#f6f1e7", ink: "#3a2a28", decisions: 14, hasPaper: true, hasInk: true },
  { group: "planisphere", file: "app/(planisphere)/planisphere.css", paper: "#f6f1e7", ink: "#3a2a28", decisions: 16, hasPaper: true, hasInk: true },
  { group: "barometer", file: "app/(barometer)/barometer.css", paper: "#efe3c8", ink: "#3a2a28", decisions: 21, hasPaper: true, hasInk: true },
  {
    group: "articles",
    file: "app/(articles)/articles.css",
    paper: "#f3eee3",
    ink: "#1a1816",
    decisions: 10,
    hasPaper: true,
    hasInk: true,
    dress: { name: "Gazette", spot: "#b23a2f", spotFrom: "app/(articles)/articles.css", radius: 2, face: "serif" },
  },
  {
    group: "structures",
    file: "app/(structures)/structures.css",
    paper: "#f6f3ea",
    ink: "#1d1b17",
    decisions: 10,
    hasPaper: true,
    hasInk: true,
    dress: { name: "Structures", spot: "#2456b3", spotFrom: "app/(structures)/structures.css", radius: 6, face: "cursive" },
  },
  // Ryugu-jo's sea: its --paper is the house paper, floating as the surface above the waterline; its ink is pale,
  // for lines drawn on a dark sea.
  { group: "ryugu", file: "app/(ryugu)/ryugu.css", paper: "#f2efe7", ink: "#e6e1d3", decisions: 8, hasPaper: true, hasInk: true },
];

export const PAPER_COUNT = SIBLINGS.filter((s) => s.hasPaper).length;
export const INK_COUNT = SIBLINGS.filter((s) => s.hasInk).length;
export const CREAMS = new Set(SIBLINGS.flatMap((s) => (s.paper ? [s.paper] : []))).size;

export const DRESSES = SIBLINGS.filter((s): s is Sibling & { paper: string; dress: Dress } => s.dress !== undefined && s.paper !== null);

/** A corner in px drawn as the nearest inked corner: 0-3 sharp, 4-9 soft, 10 and up round. */
export function cornerFor(px: number): Corner {
  return px <= 3 ? "sharp" : px <= 9 ? "soft" : "round";
}

function find(group: string) {
  const s = DRESSES.find((d) => d.group === group);
  if (!s) throw new Error(`no dress for ${group}`);
  return s;
}

/** The pots a dress sets: paper, ink, spot, corner and face, from the sister's own sheet. */
export function dress(group: string): Pick<Pots, "paper" | "ink" | "spot" | "corner" | "face"> {
  const s = find(group);
  return { paper: s.paper, ink: s.ink, spot: s.dress.spot, corner: cornerFor(s.dress.radius), face: s.dress.face };
}

export const dressName = (group: string) => find(group).dress.name;
