// The index's two size rows, as plain numbers: pure, so rows.test.ts can prove
// the scale and the page only inks it. Each row keeps one true scale of its own.
// The planets are drawn with Jupiter at r = 110 beside the Sun's edge, an arc of
// the Sun's true radius at that scale coming in from the left. The stars are drawn
// with Vega at r = 70. Polaris and Betelgeuse would not fit, so each is the edge
// of its disc at the same scale: Betelgeuse's from the left, Polaris's from the
// right. Discs sit on one centre line, in the fixed order, each name under its
// disc, and a slot is wide enough for the disc or its name, whichever is wider.
import { BODIES, SUN_RADIUS_KM, bodyBySlug, type Body } from "./bodies.ts";

export const ROW_VIEW = { w: 1000, h: 260 };
export const LABEL_SIZE = 18; // SVG units; the row is never drawn under 760 px wide, so 13.7 px or more
const CHAR_W = 10; // a generous width per letter of the hand lettering at LABEL_SIZE
const LABEL_DROP = 22; // a name's baseline below its disc
const EDGE_X = 48; // where a left edge crosses the centre line
const SLOT_FROM = 76; // the first slot starts here, clear of the left edge and its wobble
const SLOT_END = ROW_VIEW.w - 16;
const RIGHT_EDGE_X = 920; // where Polaris's edge crosses the centre line
const EDGE_LABEL_Y = 26;

export const JUPITER_R = 110;
export const VEGA_R = 70;

export type Disc = { slug: string; name: string; cx: number; cy: number; r: number; label: { x: number; y: number } };
export type Edge = {
  slug: string;
  side: "left" | "right"; // the side the disc's centre lies off
  cx: number;
  cy: number;
  r: number;
  label: string;
  labelAt: { x: number; y: number; anchor: "start" | "end" };
};
export type Row = { id: "planets" | "stars"; title: string; kmPerUnit: number; discs: Disc[]; edges: Edge[] };

export const labelWidth = (text: string) => text.length * CHAR_W;

const body = (slug: string): Body => {
  const b = bodyBySlug(slug);
  if (!b) throw new Error(`no body ${slug}`);
  return b;
};

// Lay the bodies out left to right between x0 and x1: equal gaps between slots,
// the first slot flush with x0 and the last with x1.
function lay(bodies: readonly Body[], scale: number, cy: number, x0: number, x1: number): Disc[] {
  const rs = bodies.map((b) => b.radiusKm * scale);
  const slots = bodies.map((b, i) => Math.max(2 * rs[i], labelWidth(b.name)));
  const gap = (x1 - x0 - slots.reduce((a, s) => a + s, 0)) / Math.max(1, bodies.length - 1);
  let x = x0;
  return bodies.map((b, i) => {
    const cx = x + slots[i] / 2;
    x += slots[i] + gap;
    return { slug: b.slug, name: b.name, cx, cy, r: rs[i], label: { x: cx, y: cy + rs[i] + LABEL_DROP } };
  });
}

// An edge crossing the centre line at x, its centre off the page on that side.
function edge(slug: string, r: number, side: Edge["side"], x: number, cy: number, label: string): Edge {
  return {
    slug,
    side,
    cx: side === "left" ? x - r : x + r,
    cy,
    r,
    label,
    labelAt: side === "left" ? { x: x + 12, y: EDGE_LABEL_Y, anchor: "start" } : { x: x - 12, y: EDGE_LABEL_Y, anchor: "end" },
  };
}

export function planetRow(): Row {
  const jupiter = body("jupiter");
  const scale = JUPITER_R / jupiter.radiusKm;
  const cy = 120;
  const planets = BODIES.filter((b) => b.kind === "planet");
  return {
    id: "planets",
    title: "The planets, to scale",
    kmPerUnit: 1 / scale,
    discs: lay(planets, scale, cy, SLOT_FROM, SLOT_END),
    edges: [edge("sun", (JUPITER_R * SUN_RADIUS_KM) / jupiter.radiusKm, "left", EDGE_X, cy, "the Sun's edge, to scale")],
  };
}

export function starRow(): Row {
  const scale = VEGA_R / body("vega").radiusKm;
  const cy = 130;
  const stars = ["sun", "proxima-centauri", "sirius", "vega"].map(body);
  const rightEdge = RIGHT_EDGE_X;
  return {
    id: "stars",
    title: "The stars, to scale",
    kmPerUnit: 1 / scale,
    discs: lay(stars, scale, cy, SLOT_FROM, rightEdge - 16),
    edges: [
      edge("betelgeuse", body("betelgeuse").radiusKm * scale, "left", EDGE_X, cy, "Betelgeuse would fill the page"),
      edge("polaris", body("polaris").radiusKm * scale, "right", rightEdge, cy, "Polaris would reach here"),
    ],
  };
}

const n = (v: number) => String(Number(v.toFixed(2)));

// Where an edge's circle crosses the top and the bottom of the row.
function crossings(e: Edge): { top: number; bottom: number } {
  const at = (y: number) => {
    const dx = Math.sqrt(Math.max(0, e.r * e.r - (y - e.cy) ** 2));
    return e.side === "left" ? e.cx + dx : e.cx - dx;
  };
  return { top: at(0), bottom: at(ROW_VIEW.h) };
}

// The edge's limb, top to bottom, as SVG path data.
export function edgeArc(e: Edge): string {
  const { top, bottom } = crossings(e);
  const sweep = e.side === "left" ? 1 : 0;
  return `M ${n(top)} 0 A ${n(e.r)} ${n(e.r)} 0 0 ${sweep} ${n(bottom)} ${ROW_VIEW.h}`;
}

// The part of the disc that is on the page, for its wash.
export function edgeArea(e: Edge): string {
  const side = e.side === "left" ? 0 : ROW_VIEW.w;
  return `${edgeArc(e)} L ${side} ${ROW_VIEW.h} L ${side} 0 Z`;
}
