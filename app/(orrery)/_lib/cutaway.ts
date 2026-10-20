// The cutaway for any body, as inked paths: pure, so a unit test can prove every
// body's drawing (cutaway.test.ts) and a thin server component only maps it to
// SVG. It keeps the Sun poster's look: a quarter cut away (upper right, facing
// the callouts) shows the interior bands, the other three quarters are the
// surface we see, the atmosphere is rings round it, every layer is hatched in
// its own colour at its own angle, and pins 1..n sit on the bands. The bands are
// the data's true fractions except that none is drawn thinner than MIN_BAND of
// R (Earth's crust is 0.5 %); the callouts carry the true thickness. The
// "to scale" mark is drawn at the true ratio to the drawn radius.
import type { Body, BodyLayer } from "./bodies.ts";
import { inkCircle, inkPath, type InkOptions, type InkPath } from "./ink.ts";

export const VIEW = { w: 640, h: 600 };
export const MIN_BAND = 0.06;
export const MARGIN = 16;

const R_MAX = 230;
// The atmosphere is drawn at most this thick (in R), as on the Sun's stage; the
// Sun's corona is 7 R deep and would otherwise shrink the star to a dot.
const ATMOSPHERE_MAX = 0.24;
const GAP = 14; // clear space between the body and its "to scale" mark
const PIN_SPACING = 31; // pins are 15 px in radius on the page

export type CutLayer = {
  id: string;
  n: number;
  shape: string; // the layer's area as plain SVG path data, for a wash under the ink
  paths: InkPath[];
  pin: { x: number; y: number }; // where the number sits
  anchor: { x: number; y: number }; // the point on the band it names (= pin unless slid out)
};
export type Cutaway = {
  centre: { x: number; y: number };
  radius: number; // the drawn R, in viewBox px
  layers: CutLayer[];
  compare: {
    label: string;
    shape: "dot" | "orbit" | "edge"; // edge: a dot too big for the page, shown by its limb
    paths: InkPath[];
    r: number;
    centre: { x: number; y: number };
    at: { x: number; y: number }; // where its label goes, inside VIEW
  };
  outline: InkPath[];
  marks: { id: string; paths: InkPath[] }[];
};

const n = (x: number) => +x.toFixed(2);

// One pen per layer, cycling: a hachure angle and a gap (the Sun's pens).
const PENS = [
  { angle: 0, gap: 5 },
  { angle: 60, gap: 6.5 },
  { angle: -30, gap: 6 },
  { angle: -41, gap: 7.5 },
  { angle: 90, gap: 5 },
  { angle: 20, gap: 8 },
];

// Widths in proportion to the weights, summing to total, none under MIN_BAND:
// pin the thin ones at MIN_BAND and share what is left among the rest.
function fit(weights: readonly number[], total: number): number[] {
  const pinned = new Set<number>();
  for (;;) {
    const free = weights.map((_, i) => i).filter((i) => !pinned.has(i));
    const sum = free.reduce((s, i) => s + weights[i], 0);
    const scale = sum > 0 ? (total - pinned.size * MIN_BAND) / sum : 0;
    const thin = free.filter((i) => weights[i] * scale < MIN_BAND);
    if (thin.length === 0 || thin.length === free.length) {
      return weights.map((w, i) => (pinned.has(i) || thin.includes(i) ? MIN_BAND : w * scale));
    }
    for (const i of thin) pinned.add(i);
  }
}

// Drawn bands in R, in layer order: the interior tiles [0, 1], the atmosphere
// runs outward from 1. radiusKm turns the atmosphere's km into R.
export function drawnBands(layers: readonly BodyLayer[], radiusKm: number): { id: string; r0: number; r1: number }[] {
  const inner = layers.filter((l) => l.region === "interior");
  const outer = layers.filter((l) => l.region === "atmosphere");
  const innerW = fit(
    inner.map((l) => l.to - l.from),
    1,
  );
  const outerTrue = outer.map((l) => (l.to - l.from) / radiusKm);
  const floor = outer.length * MIN_BAND;
  const total = Math.max(floor, Math.min(outerTrue.reduce((s, w) => s + w, 0), ATMOSPHERE_MAX));
  const outerW = fit(outerTrue, total);
  const run = (list: readonly BodyLayer[], widths: number[], start: number) => {
    let r = start;
    return list.map((l, i) => {
      const r0 = r;
      r = i === list.length - 1 && start === 0 ? 1 : r + widths[i];
      return { id: l.id, r0, r1: r };
    });
  };
  return [...run(inner, innerW, 0), ...run(outer, outerW, 1)];
}

export function cutaway(body: Body): Cutaway {
  const bands = drawnBands(body.layers, body.radiusKm);
  const reach = Math.max(1, ...bands.map((b) => b.r1)); // the outermost ring, in R
  const R = n(Math.min(R_MAX, (VIEW.h / 2 - MARGIN) / reach));
  const cx = n(MARGIN + reach * R + 8);
  const cy = VIEW.h / 2;

  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: n(cx + r * Math.sin(a)), y: n(cy - r * Math.cos(a)) };
  };
  const circle = (r: number) =>
    `M${n(cx - r)},${cy}a${n(r)},${n(r)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(r)} 0 1,0 ${n(-2 * r)},0Z`;
  // the cut-away quarter of a shell: from 12 o'clock to 3 o'clock
  const quarter = (ri: number, ro: number) => {
    const back = ri > 0 ? `A${n(ri)},${n(ri)} 0 0,0 ${cx},${n(cy - ri)}` : `L${cx},${cy}`;
    return `M${cx},${n(cy - ro)}A${n(ro)},${n(ro)} 0 0,1 ${n(cx + ro)},${cy}L${n(cx + ri)},${cy}${back}Z`;
  };
  // the other three quarters of the disc: the surface we see
  const surface = `M${cx},${cy}L${cx},${n(cy - R)}A${R},${R} 0 1,0 ${n(cx + R)},${cy}Z`;

  const lastInner = bands.filter((_, i) => body.layers[i].region === "interior").length - 1;
  const pins: { x: number; y: number }[] = [];
  let ring = 0;

  const layers = body.layers.map((layer, i): CutLayer => {
    const { r0, r1 } = bands[i];
    const pen = PENS[i % PENS.length];
    const ink: InkOptions = { fill: layer.colour, fillStyle: "hachure", hachureAngle: pen.angle, hachureGap: pen.gap };
    const seed = `${body.slug}-${layer.id}`;
    let shape: string;
    let paths: InkPath[];
    let pin: { x: number; y: number };
    let anchor: { x: number; y: number };
    if (layer.region === "interior") {
      const cut = quarter(r0 * R, r1 * R);
      shape = cut;
      paths = inkPath(cut, { ...ink, seed });
      if (i === lastInner) {
        shape += surface;
        paths = [...paths, ...inkPath(surface, { ...ink, seed: `${seed}-surface` })];
      }
      // on the cut, mid-band, at the first angle clear of the pins before it;
      // a band too thin to hold one (a star's tiny core) slides it outward, and
      // the page draws a lead from the anchor
      const mid = ((r0 + r1) / 2) * R;
      const angles = [45, 20, 70, 10, 80, 32, 58];
      const clearance = (p: { x: number; y: number }) => Math.min(Infinity, ...pins.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
      const deg = angles.find((a) => clearance(at(a, mid)) >= PIN_SPACING) ?? angles[1];
      anchor = at(deg, mid);
      let out = mid;
      while (clearance(at(deg, out)) < PIN_SPACING && out < R) out += 2;
      pin = at(deg, out);
    } else {
      shape = circle(r1 * R) + circle(r0 * R);
      paths = inkPath(shape, { ...ink, seed });
      // round the uncut side, lower left, one step further each ring
      pin = anchor = at(235 + 25 * ring++, ((r0 + r1) / 2) * R);
    }
    pins.push(pin);
    return { id: layer.id, n: i + 1, shape, paths, pin, anchor };
  });

  const outline = inkCircle(cx, cy, R, { seed: `${body.slug}-outline`, strokeWidth: 2.6 });

  return {
    centre: { x: cx, y: cy },
    radius: R,
    layers,
    compare: compareMark(body, { cx, cy, R, outer: reach * R }),
    outline,
    marks: [],
  };
}

// The "to scale" mark at the true ratio. An orbit is a 270° arc round the
// centre over the uncut side. A dot sits in the bottom-right corner, or, when
// that is too tight, just clear of the body towards it; one too big for the
// page is drawn as the part of its limb that falls inside VIEW (an edge).
function compareMark(body: Body, g: { cx: number; cy: number; R: number; outer: number }): Cutaway["compare"] {
  const { label, radiusKm, shape } = body.compare;
  const r = n((radiusKm / body.radiusKm) * g.R);
  const seed = `${body.slug}-compare`;
  const pen: InkOptions = { seed, strokeWidth: 1.8, roughness: 1 };

  if (shape === "orbit") {
    const d = `M${n(g.cx + r)},${g.cy}A${r},${r} 0 1,1 ${g.cx},${n(g.cy - r)}`;
    return { label, shape, r, centre: { x: g.cx, y: g.cy }, paths: inkPath(d, pen), at: { x: g.cx, y: n(g.cy + r + 22) } };
  }

  const room = Math.max(r, 14);
  const corner = { x: n(VIEW.w - MARGIN - room - 20), y: n(VIEW.h - MARGIN - room - 30) };
  if (Math.hypot(corner.x - g.cx, corner.y - g.cy) >= g.outer + GAP + r) {
    const paths = inkCircle(corner.x, corner.y, r, { ...pen, fill: "#2f6fd0", fillStyle: "solid" });
    // a dot too small to find gets a ring round it, as Earth does on the Sun's stage
    if (r < 6) paths.push(...inkCircle(corner.x, corner.y, r + 9, { ...pen, seed: `${seed}-ring`, strokeWidth: 1.6 }));
    return { label, shape, r, centre: corner, paths, at: { x: n(corner.x + room), y: n(corner.y + room + 26) } };
  }

  // otherwise GAP clear of the body, towards the corner: whole if it fits,
  // else an edge, the part of its limb inside VIEW
  const dx = VIEW.w - MARGIN - g.cx;
  const dy = VIEW.h - MARGIN - g.cy;
  const len = Math.hypot(dx, dy);
  const reach = g.outer + GAP + r;
  const centre = { x: n(g.cx + (dx / len) * reach), y: n(g.cy + (dy / len) * reach) };
  const inside = (x: number, y: number) => x >= 0 && x <= VIEW.w && y >= 0 && y <= VIEW.h;
  if (inside(centre.x - r, centre.y - r) && inside(centre.x + r, centre.y + r)) {
    const paths = inkCircle(centre.x, centre.y, r, { ...pen, fill: "#2f6fd0", fillStyle: "solid" });
    return { label, shape, r, centre, paths, at: { x: n(Math.min(VIEW.w - MARGIN, centre.x + r)), y: n(centre.y - r - 12) } };
  }
  const limb = (t: number) => inside(centre.x + r * Math.cos(t), centre.y + r * Math.sin(t));
  // walk both ways from the near point (facing the body) while the limb is in view
  const near = Math.atan2(-dy, -dx);
  const step = Math.PI / 180;
  let a0 = near;
  let a1 = near;
  while (a1 - a0 < 2 * Math.PI - step && limb(a0 - step)) a0 -= step;
  while (a1 - a0 < 2 * Math.PI - step && limb(a1 + step)) a1 += step;
  const p = (t: number) => `${n(centre.x + r * Math.cos(t))},${n(centre.y + r * Math.sin(t))}`;
  const d = `M${p(a0)}A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${p(a1)}`;
  // the label sits in the page's corner, inside the limb, clear of the body
  const paths = inkPath(d, { ...pen, strokeWidth: 2.2 });
  return { label, shape: "edge", r, centre, paths, at: { x: VIEW.w - MARGIN, y: VIEW.h - MARGIN } };
}
