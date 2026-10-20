// The cutaway for any body, as inked paths: pure, so a unit test can prove every
// body's drawing (cutaway.test.ts) and a thin server component only maps it to
// SVG. It keeps the Sun poster's look: a quarter cut away (upper right, facing
// the callouts) shows the interior bands, the other three quarters are the
// surface we see, the atmosphere is rings round it, every layer is hatched in
// its own colour at its own angle, and pins 1..n sit on the bands. The bands are
// the data's true fractions except that none is drawn thinner than MIN_BAND of
// R (Earth's crust is 0.5 %); the callouts carry the true thickness. The
// "to scale" mark is drawn at the true ratio to the drawn radius. Then the
// marks that make a body itself (Body.marks): Saturn's rings, Jupiter's bands and
// Great Red Spot, Sirius B, Vega spun flat, and so on. A ringed or flattened body
// is drawn smaller so that its marks fit the page at their true size.
import { SIRIUS_B_RADIUS_KM, type Body, type BodyLayer } from "./bodies.ts";
import { inkCircle, inkLine, inkPath, type InkOptions, type InkPath } from "./ink.ts";

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
  marks: Mark[];
};
export type Mark = {
  id: string;
  paths: InkPath[];
  wash?: { d: string; colour: string }; // plain SVG path data under the ink, even-odd
  dashed?: boolean; // Polaris's still pulse rings
  labels?: { text: string; x: number; y: number }[]; // end-anchored lines
  scale?: { r: number; trueR: number }; // a body drawn beside this one (Sirius B), in px
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
  // k squashes the drawing top to bottom: a body spun flat is an ellipse
  const k = body.polarRadiusKm ? body.polarRadiusKm / body.radiusKm : 1;
  const marks = body.marks ?? [];
  for (const id of marks) if (!MARKS[id]) throw new Error(`${body.slug}: no mark ${id}`);
  // how far the drawing runs from the centre, in R: the bands (squashed by k
  // top to bottom) or a mark, whichever is further
  const ext = { x: reach, y: k * reach };
  let round = reach; // the furthest a mark runs all the way round (Betelgeuse's limb)
  for (const id of marks) {
    const e = MARKS[id].reach?.(body, reach, k);
    if (!e) continue;
    ext.x = Math.max(ext.x, e.x);
    ext.y = Math.max(ext.y, e.y);
    if (MARKS[id].round) round = Math.max(round, e.x, e.y);
  }
  const R = n(Math.min(R_MAX, (VIEW.h / 2 - MARGIN) / ext.y, (VIEW.w - 2 * MARGIN - 8) / (2 * ext.x)));
  const cx = n(MARGIN + ext.x * R + 8);
  const cy = VIEW.h / 2;

  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: n(cx + r * Math.sin(a)), y: n(cy - k * r * Math.cos(a)) };
  };
  const circle = (r: number) =>
    `M${n(cx - r)},${cy}a${n(r)},${n(k * r)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(k * r)} 0 1,0 ${n(-2 * r)},0Z`;
  // the cut-away quarter of a shell: from 12 o'clock to 3 o'clock
  const quarter = (ri: number, ro: number) => {
    const back = ri > 0 ? `A${n(ri)},${n(k * ri)} 0 0,0 ${cx},${n(cy - k * ri)}` : `L${cx},${cy}`;
    return `M${cx},${n(cy - k * ro)}A${n(ro)},${n(k * ro)} 0 0,1 ${n(cx + ro)},${cy}L${n(cx + ri)},${cy}${back}Z`;
  };
  // the other three quarters of the disc: the surface we see
  const surface = `M${cx},${cy}L${cx},${n(cy - k * R)}A${R},${n(k * R)} 0 1,0 ${n(cx + R)},${cy}Z`;

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

  const outlinePen = { seed: `${body.slug}-outline`, strokeWidth: 2.6 };
  const outline = k === 1 ? inkCircle(cx, cy, R, outlinePen) : inkPath(circle(R), outlinePen);
  const g: Geometry = { body, cx, cy, R, k, reach, outer: reach * R };

  return {
    centre: { x: cx, y: cy },
    radius: R,
    layers,
    // the "to scale" mark keeps clear of the body and of any mark all round it;
    // rings and axes run along their own lines, clear of the corner it sits in
    compare: compareMark(body, { cx, cy, R, outer: round * R }),
    outline,
    marks: marks.map((id) => ({ id, ...MARKS[id].draw(g) })),
  };
}

// ---- Marks ------------------------------------------------------------------

type Geometry = { body: Body; cx: number; cy: number; R: number; k: number; reach: number; outer: number };
type MarkDrawer = {
  // how far the mark runs from the centre, in R, when it runs past the body
  reach?: (body: Body, reach: number, k: number) => { x: number; y: number };
  round?: boolean; // the mark runs all the way round the body, as far in every direction
  draw: (g: Geometry) => Omit<Mark, "id">;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (p: { x: number; y: number }) => `${n(p.x)},${n(p.y)}`;

// Rings, in km from the planet's centre (Wikipedia): Saturn's B ring's inner
// edge, the Cassini division and the A ring's outer edge; Uranus's ring 6 and
// its epsilon ring. open is how far the ellipse opens (minor / major axis) and
// tilt turns it on the page; Uranus's stand near-vertical, as the planet lies
// on its side.
export const RINGS: Record<string, { km: readonly number[]; open: number; tilt: number; wash?: string }> = {
  saturn: { km: [92_000, 117_580, 136_775], open: 0.3, tilt: -12, wash: "#d9c08f" },
  uranus: { km: [41_837, 51_149], open: 0.22, tilt: 80 },
};

// Half the width and half the height of an ellipse of semi-major axis a.
function ellipseExtent(a: number, open: number, tilt: number): { x: number; y: number } {
  const c = Math.cos(rad(tilt));
  const s = Math.sin(rad(tilt));
  return { x: a * Math.sqrt(c * c + open * open * s * s), y: a * Math.sqrt(s * s + open * open * c * c) };
}

// A point on a ring of semi-major axis a at parameter t: t in [0, π] is the
// near half (below the centre before the tilt), t in [π, 2π] the far half.
function ringPoint(cx: number, cy: number, a: number, open: number, tilt: number, t: number): { x: number; y: number } {
  const x = a * Math.cos(t);
  const y = a * open * Math.sin(t);
  const c = Math.cos(rad(tilt));
  const s = Math.sin(rad(tilt));
  return { x: cx + x * c - y * s, y: cy + x * s + y * c };
}

// How far round from each end the far half shows before a disc of radius occ
// hides it: 0 when it hides all of it, π/2 when it hides none.
function farShows(a: number, open: number, occ: number): number {
  const b = a * open;
  if (occ <= b) return Math.PI / 2;
  if (occ >= a) return 0;
  return Math.acos(Math.sqrt((occ * occ - b * b) / (a * a - b * b)));
}

// A ring round a disc of radius occ, as SVG path data for its visible arcs: the
// near half crosses in front of the disc, the far half goes behind it, so only
// its two ends show. Used by the posters and by the index's Saturn.
export function ringArcs(cx: number, cy: number, a: number, open: number, tilt: number, occ: number): string[] {
  const p = (t: number) => pt(ringPoint(cx, cy, a, open, tilt, t));
  const arc = (t: number) => `A${n(a)},${n(a * open)} ${tilt} 0,1 ${p(t)}`;
  const out = [`M${p(0)}${arc(Math.PI / 2)}${arc(Math.PI)}`];
  const shows = farShows(a, open, occ);
  if (shows > 0) out.unshift(`M${p(Math.PI)}${arc(Math.PI + shows)}`, `M${p(2 * Math.PI - shows)}${arc(2 * Math.PI)}`);
  return out;
}

// The band between two rings, minus what the disc hides, as polygons: the near
// half whole, the far half's two ends cut along the disc's limb.
function ringBand(cx: number, cy: number, a0: number, a1: number, open: number, tilt: number, occ: number): string {
  const STEPS = 24;
  const run = (from: number, to: number, f: (t: number) => { x: number; y: number }) =>
    Array.from({ length: STEPS + 1 }, (_, i) => f(from + ((to - from) * i) / STEPS));
  const ring = (a: number) => (t: number) => ringPoint(cx, cy, a, open, tilt, t);
  // the limb, by angle in the ring's own frame (before the tilt)
  const limb = (th: number) => ringPoint(cx, cy, occ, 1, tilt, th);
  const angle = (a: number, t: number) => Math.atan2(a * open * Math.sin(t), a * Math.cos(t));
  const poly = (ps: { x: number; y: number }[]) => `M${ps.map(pt).join("L")}Z`;

  const near = poly([...run(0, Math.PI, ring(a1)), ...run(Math.PI, 0, ring(a0))]);
  const s1 = farShows(a1, open, occ);
  if (s1 === 0) return near;
  const s0 = farShows(a0, open, occ);
  // left end: out along the outer ring, back along the limb, in along the inner
  const leftIn = s0 > 0 ? angle(a0, Math.PI + s0) : -Math.PI;
  const left = [
    ...run(Math.PI, Math.PI + s1, ring(a1)),
    ...run(angle(a1, Math.PI + s1), leftIn, limb),
    ...(s0 > 0 ? run(Math.PI + s0, Math.PI, ring(a0)) : []),
  ];
  const rightIn = s0 > 0 ? angle(a0, 2 * Math.PI - s0) : 0;
  const right = [
    ...run(2 * Math.PI - s1, 2 * Math.PI, ring(a1)),
    ...(s0 > 0 ? run(2 * Math.PI, 2 * Math.PI - s0, ring(a0)) : []),
    ...run(rightIn, angle(a1, 2 * Math.PI - s1), limb),
  ];
  return near + poly(left) + poly(right);
}

const rings: MarkDrawer = {
  reach: (body) => {
    const r = RINGS[body.slug];
    return ellipseExtent(Math.max(...r.km) / body.radiusKm, r.open, r.tilt);
  },
  draw: ({ body, cx, cy, R, outer }) => {
    const r = RINGS[body.slug];
    const radii = r.km.map((km) => (km / body.radiusKm) * R);
    const paths = radii.flatMap((a, i) => {
      const edge = i === 0 || i === radii.length - 1;
      return ringArcs(cx, cy, a, r.open, r.tilt, outer).flatMap((d, j) =>
        inkPath(d, { seed: `${body.slug}-ring-${i}-${j}`, strokeWidth: edge ? 2 : 1.2, roughness: 0.9 }),
      );
    });
    const wash = r.wash ? { d: ringBand(cx, cy, radii[0], radii.at(-1) as number, r.open, r.tilt, outer), colour: r.wash } : undefined;
    return wash ? { paths, wash } : { paths };
  },
};

// Uranus's axis, square to its rings: it pokes out of both poles.
const AXIS = 1.32; // in R
const tiltAxis = (body: Body) => {
  const t = rad(RINGS[body.slug].tilt);
  return { x: -Math.sin(t), y: Math.cos(t) };
};
const tilt: MarkDrawer = {
  reach: (body) => {
    const u = tiltAxis(body);
    return { x: AXIS * Math.abs(u.x), y: AXIS * Math.abs(u.y) };
  },
  draw: ({ body, cx, cy, R, outer }) => {
    const u = tiltAxis(body);
    const paths = [1, -1].flatMap((side) =>
      inkLine(n(cx + side * u.x * outer), n(cy + side * u.y * outer), n(cx + side * u.x * AXIS * R), n(cy + side * u.y * AXIS * R), {
        seed: `${body.slug}-axis-${side}`,
        strokeWidth: 2.4,
        roughness: 0.8,
      }),
    );
    return { paths };
  },
};

// Jupiter's dark belts on the surface we see (the cut quarter has none) and
// the Great Red Spot, south of the equator.
const BELTS: readonly [number, number][] = [
  [-0.62, -0.5],
  [-0.3, -0.16],
  [0.1, 0.24],
  [0.44, 0.54],
];
const bands: MarkDrawer = {
  draw: ({ body, cx, cy, R }) => {
    const w = (y: number) => R * Math.sqrt(1 - y * y);
    const paths = BELTS.flatMap(([f0, f1], i) => {
      const y0 = n(cy + f0 * R);
      const y1 = n(cy + f1 * R);
      const arc = (x: number, y: number) => `A${R},${R} 0 0,1 ${n(x)},${y}`;
      // above the equator a belt stops at the cut; below it crosses the disc
      const d =
        f1 <= 0
          ? `M${n(cx - w(f0))},${y0}L${cx},${y0}L${cx},${y1}L${n(cx - w(f1))},${y1}${arc(cx - w(f0), y0)}Z`
          : `M${n(cx - w(f0))},${y0}L${n(cx + w(f0))},${y0}${arc(cx + w(f1), y1)}L${n(cx - w(f1))},${y1}${arc(cx - w(f0), y0)}Z`;
      return inkPath(d, { seed: `${body.slug}-belt-${i}`, fill: "#a8673f99", fillStyle: "solid", stroke: "#7a4a2c", strokeWidth: 1.2, roughness: 0.8 });
    });
    return { paths };
  },
};

const oval = (x: number, y: number, rx: number, ry: number) =>
  `M${n(x - rx)},${n(y)}a${n(rx)},${n(ry)} 0 1,0 ${n(2 * rx)},0a${n(rx)},${n(ry)} 0 1,0 ${n(-2 * rx)},0Z`;

const greatRedSpot: MarkDrawer = {
  draw: ({ body, cx, cy, R }) => {
    const x = cx - 0.32 * R;
    const y = cy + 0.36 * R;
    return {
      paths: [
        ...inkPath(oval(x, y, 0.17 * R, 0.09 * R), { seed: `${body.slug}-spot`, fill: "#c4553a", fillStyle: "solid", strokeWidth: 1.8, roughness: 1 }),
        ...inkPath(oval(x + 0.01 * R, y, 0.09 * R, 0.045 * R), { seed: `${body.slug}-spot-eye`, stroke: "#7a2e22", strokeWidth: 1.2, roughness: 1 }),
      ],
    };
  },
};

// A white streak of cloud: two waves, in R from the centre.
const streak = (cx: number, cy: number, R: number, [x, y, len]: readonly [number, number, number], h = 0.035) => {
  const x0 = cx + (x - len / 2) * R;
  const y0 = cy + y * R;
  const L = len * R;
  return `M${n(x0)},${n(y0)}Q${n(x0 + L / 4)},${n(y0 - h * R)} ${n(x0 + L / 2)},${n(y0)}Q${n(x0 + (3 * L) / 4)},${n(y0 + h * R)} ${n(x0 + L)},${n(y0)}`;
};
const CLOUDS: readonly [number, number, number][] = [
  [-0.6, -0.42, 0.36],
  [-0.42, -0.14, 0.3],
  [-0.66, 0.18, 0.3],
  [-0.2, 0.44, 0.42],
  [0.28, 0.62, 0.34],
  [0.45, 0.26, 0.3],
];
const clouds: MarkDrawer = {
  draw: ({ body, cx, cy, R }) => ({
    paths: CLOUDS.flatMap((c, i) => inkPath(streak(cx, cy, R, c), { seed: `${body.slug}-cloud-${i}`, stroke: "#ffffff", strokeWidth: 5, roughness: 1 })),
  }),
};

// Mars's south polar cap (the north pole sits on the cut): the disc below a
// wavy line at CAP of R.
const CAP = 0.78;
const polarCap: MarkDrawer = {
  draw: ({ body, cx, cy, R }) => {
    const y = cy + CAP * R;
    const w = R * Math.sqrt(1 - CAP * CAP);
    const d = `M${n(cx - w)},${n(y)}Q${n(cx - w / 2)},${n(y - 0.05 * R)} ${cx},${n(y)}Q${n(cx + w / 2)},${n(y + 0.03 * R)} ${n(cx + w)},${n(y)}A${R},${R} 0 0,1 ${n(cx - w)},${n(y)}Z`;
    return { paths: inkPath(d, { seed: `${body.slug}-cap`, fill: "#fbf8f1", fillStyle: "solid", strokeWidth: 1.6, roughness: 1 }) };
  },
};

// Neptune's Great Dark Spot, with the white cloud that rode beside it.
const darkSpot: MarkDrawer = {
  draw: ({ body, cx, cy, R }) => {
    const x = cx - 0.38 * R;
    const y = cy + 0.3 * R;
    return {
      paths: [
        ...inkPath(oval(x, y, 0.19 * R, 0.1 * R), { seed: `${body.slug}-spot`, fill: "#1f2d6b", fillStyle: "solid", strokeWidth: 1.8, roughness: 1 }),
        ...inkPath(streak(cx, cy, R, [-0.36, 0.47, 0.26], 0.02), { seed: `${body.slug}-scooter`, stroke: "#ffffff", strokeWidth: 4, roughness: 1 }),
      ],
    };
  },
};

// Sirius B in the top-right corner: to scale if that is 2 px or more, else at
// 2 px and labelled so. It is far smaller than Earth beside a star 1.7 Suns across.
const companion: MarkDrawer = {
  draw: ({ body, R }) => {
    const trueR = (SIRIUS_B_RADIUS_KM / body.radiusKm) * R;
    const r = Math.max(2, n(trueR));
    const toScale = Math.abs(r / trueR - 1) < 0.01;
    const x = VIEW.w - MARGIN - 26;
    const y = MARGIN + 82;
    const pen: InkOptions = { seed: `${body.slug}-companion`, strokeWidth: 1.6, roughness: 1 };
    return {
      paths: [
        ...inkCircle(x, y, r, { ...pen, fill: "#9cc3ec", fillStyle: "solid" }),
        ...inkCircle(x, y, r + 9, { ...pen, seed: `${body.slug}-companion-ring` }),
      ],
      labels: toScale
        ? [{ text: "Sirius B, a white dwarf", x: VIEW.w - MARGIN, y: MARGIN + 22 }]
        : [
            { text: "Sirius B, a white dwarf,", x: VIEW.w - MARGIN, y: MARGIN + 22 },
            { text: "not to scale", x: VIEW.w - MARGIN, y: MARGIN + 48 },
          ],
      scale: { r, trueR: n(trueR) },
    };
  },
};

// Vega spins so fast it is flattened (the whole cut is squashed by k): its spin
// axis pokes out of both poles, with an arrow round the top one.
const SPIN = 0.16; // how far the axis runs past the poles, in R
const flattened: MarkDrawer = {
  reach: (_, reach, k) => ({ x: reach, y: k * reach + SPIN }),
  draw: ({ body, cx, cy, R, k, outer }) => {
    const pole = k * outer;
    const end = pole + SPIN * R;
    const pen: InkOptions = { seed: `${body.slug}-axis`, strokeWidth: 2.4, roughness: 0.8 };
    const axis = [
      ...inkLine(cx, n(cy - pole), cx, n(cy - end), pen),
      ...inkLine(cx, n(cy + pole), cx, n(cy + end), { ...pen, seed: `${body.slug}-axis-s` }),
    ];
    // three quarters round the top of the axis, then an arrowhead
    const ey = cy - pole - 0.09 * R;
    const rx = 0.1 * R;
    const ry = 0.03 * R;
    const around = Array.from({ length: 13 }, (_, i) => {
      const t = Math.PI * (0.15 + (1.6 * i) / 12);
      return { x: cx + rx * Math.cos(t), y: ey + ry * Math.sin(t) };
    });
    const tip = around.at(-1) as { x: number; y: number };
    const t = Math.PI * 1.75;
    const back = Math.atan2(-ry * Math.cos(t), rx * Math.sin(t)); // pointing back along the arc
    const head = [-0.5, 0.5].map((da) => ({ x: tip.x + 9 * Math.cos(back + da), y: tip.y + 9 * Math.sin(back + da) }));
    const spin = `M${around.map(pt).join("L")}M${pt(head[0])}L${pt(tip)}L${pt(head[1])}`;
    return { paths: [...axis, ...inkPath(spin, { seed: `${body.slug}-spin`, strokeWidth: 1.8, roughness: 0.6 })] };
  },
};

// Betelgeuse's uneven limb: the edge of a star whose convection cells are as big
// as the star, a smooth closed curve through 36 points at a wobbling radius.
const LUMP = 0.085; // the furthest the limb strays past the photosphere, in its radius
const lumpR = (th: number) => 1 + 0.035 * Math.sin(3 * th + 0.5) + 0.028 * Math.sin(7 * th + 1.3) + 0.02 * Math.cos(5 * th + 2.1);
const lumpy: MarkDrawer = {
  reach: (_, reach) => ({ x: reach * (1 + LUMP), y: reach * (1 + LUMP) }),
  round: true,
  draw: ({ body, cx, cy, outer }) => {
    const N = 36;
    const ps = Array.from({ length: N }, (_, i) => {
      const th = (2 * Math.PI * i) / N;
      return { x: cx + outer * lumpR(th) * Math.cos(th), y: cy + outer * lumpR(th) * Math.sin(th) };
    });
    // closed Catmull-Rom through the points, as cubic Béziers
    const at = (i: number) => ps[(i + N) % N];
    let d = `M${pt(ps[0])}`;
    for (let i = 0; i < N; i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
    }
    d += "Z";
    const photosphere = body.layers.find((l) => l.id === "photosphere")?.colour ?? "#e0672c";
    const disc = `M${n(cx - outer)},${cy}a${n(outer)},${n(outer)} 0 1,0 ${n(2 * outer)},0a${n(outer)},${n(outer)} 0 1,0 ${n(-2 * outer)},0Z`;
    return {
      paths: inkPath(d, { seed: `${body.slug}-limb`, strokeWidth: 2.6, roughness: 0.9 }),
      wash: { d: d + disc, colour: photosphere },
    };
  },
};

// Polaris pulses (a Cepheid), so two dashed outlines stand round it, still.
const PULSE = [0.06, 0.12]; // past the photosphere, in R
const pulseRings: MarkDrawer = {
  reach: (_, reach) => ({ x: reach + 0.13, y: reach + 0.13 }),
  round: true,
  draw: ({ body, cx, cy, R, outer }) => ({
    paths: PULSE.flatMap((f, i) => inkCircle(cx, cy, n(outer + f * R), { seed: `${body.slug}-pulse-${i}`, strokeWidth: 1.6, roughness: 0.8 })),
    dashed: true,
  }),
};

export const MARKS: Record<string, MarkDrawer> = {
  rings,
  tilt,
  bands,
  "great-red-spot": greatRedSpot,
  clouds,
  "polar-cap": polarCap,
  "dark-spot": darkSpot,
  companion,
  flattened,
  lumpy,
  "pulse-rings": pulseRings,
};

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
