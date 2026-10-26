// The Suminagashi Pond's marbling engine, with no DOM: Jaffer's closed-form marbling on vector polygons, not a
// fluid grid. The pond is a stack of closed ink polygons, newest on top. Every tool is an exact area-preserving map
// of the plane (a drop pushes older ink out radially; a tine, comb, circular tine and vortex shear or turn it), so
// rings stay crisp at any resolution and a recipe replays identically. Each map is applied with refinement: an edge
// whose image is longer than MAX_EDGE is split at its pre-image midpoint, so new vertices land on the true deformed
// curve. Edges far off-screen are not refined, and an op that would pass MAX_VERTS or MAX_DROPS is refused, leaving
// the pond as it was. lib/marble.test.ts drives it directly.

/** Inks on the pond: four pigments from the site palette, and the clear surfactant drop that spreads rings apart. */
export const INKS = ["sumi", "shade", "coral", "blue", "clear"] as const;
export type Ink = (typeof INKS)[number];

/** Image edges longer than this many px are split while a map is applied. */
export const MAX_EDGE = 6;
/** Vertex budget for the whole pond; an op that would pass it is refused. */
export const MAX_VERTS = 60_000;
/** Ink drops on the pond; the next drop is refused. */
export const MAX_DROPS = 120;
/** A tine, comb, circular tine or vortex leaves a point alone once it would move it less than this many px. */
export const CUTOFF_PX = 0.01;
/** Edges whose image lies wholly further than this outside the pond are left unrefined. */
export const OFFSCREEN_MARGIN = 48;
/** Halvings per edge per op at most, so a near-singular stretch cannot run away. */
export const MAX_SPLIT_DEPTH = 14;
/** Douglas-Peucker tolerance for the SVG, in px. */
export const SVG_TOLERANCE = 0.75;

/** One ink polygon: a closed ring of flat [x0, y0, x1, y1, ...] coordinates. */
export type Drop = { ink: Ink; pts: number[] };
export type Marble = { width: number; height: number; drops: Drop[]; verts: number };

/** A drop of radius r at (x, y). */
export type DropOp = { kind: "drop"; x: number; y: number; r: number; ink: Ink };
/** A straight tine through (x, y) heading `angle` rad: a point at distance d from the line moves z * u^d along it. */
export type TineOp = { kind: "tine"; x: number; y: number; angle: number; z: number; u: number };
/** n parallel tines `spacing` px apart, the first through (x, y), the rest stepping along the left normal. */
export type CombOp = { kind: "comb"; x: number; y: number; angle: number; z: number; u: number; n: number; spacing: number };
/** A circular tine of radius r round (x, y): a point at distance d from the circle turns by (z / r) * u^d rad. */
export type CircleOp = { kind: "circle"; x: number; y: number; r: number; z: number; u: number };
/** A vortex round (x, y): a point at radius rho turns by z * u^rho rad. */
export type VortexOp = { kind: "vortex"; x: number; y: number; z: number; u: number };
export type Op = DropOp | TineOp | CombOp | CircleOp | VortexOp;

export type Refusal = "max_drops" | "max_verts" | "invalid";
export type Result = { ok: true; marble: Marble } | { ok: false; reason: Refusal; marble: Marble };

/** The u that halves a tine's displacement every `half` px: 2^(-1/half). */
export function uForHalf(half: number): number {
  return Math.pow(2, -1 / half);
}

/** An empty pond. */
export function createMarble(width: number, height: number): Marble {
  return { width, height, drops: [], verts: 0 };
}

/** Shoelace area of a closed flat ring (positive for counter-clockwise in y-up, i.e. clockwise on screen). */
export function ringArea(pts: number[]): number {
  let s = 0;
  const n = pts.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    s += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return Math.abs(s) / 2;
}

type PointMap = (x: number, y: number, out: number[]) => void;

const finite = (...v: number[]) => v.every(Number.isFinite);

function validOp(op: Op): boolean {
  if (!finite(op.x, op.y)) return false;
  switch (op.kind) {
    case "drop":
      return finite(op.r) && op.r > 0 && (INKS as readonly string[]).includes(op.ink);
    case "tine":
    case "vortex":
      return finite(op.z, op.u) && op.u > 0 && op.u < 1 && (op.kind === "vortex" || finite(op.angle));
    case "comb":
      return finite(op.z, op.u, op.angle, op.spacing) && op.u > 0 && op.u < 1 && Number.isInteger(op.n) && op.n >= 1 && op.n <= 64 && op.spacing > 0;
    case "circle":
      return finite(op.z, op.u, op.r) && op.u > 0 && op.u < 1 && op.r > 0;
  }
}

/**
 * The distance past which (a + b * d) * |z| * u^d stays under CUTOFF_PX: the reach of a tine-like op. The amplitude
 * rises to a peak at d = -1/ln u - a/b and decays after it, so step out from the peak and then bisect.
 */
function reach(a: number, b: number, z: number, lnU: number): number {
  const amp = (d: number) => (a + b * d) * Math.abs(z) * Math.exp(d * lnU);
  let lo = b > 0 ? Math.max(0, -1 / lnU - a / b) : 0;
  if (amp(lo) < CUTOFF_PX) return lo;
  let hi = lo + 1;
  while (amp(hi) >= CUTOFF_PX) {
    lo = hi;
    hi *= 2;
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (amp(mid) >= CUTOFF_PX) lo = mid;
    else hi = mid;
  }
  return hi;
}

function dropMap({ x: cx, y: cy, r }: DropOp): PointMap {
  const r2 = r * r;
  return (x, y, out) => {
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1e-18) {
      // The one point with no direction: put it on the drop's rim.
      out[0] = cx + r;
      out[1] = cy;
      return;
    }
    const s = Math.sqrt(1 + r2 / d2);
    out[0] = cx + dx * s;
    out[1] = cy + dy * s;
  };
}

function tineMap({ x: x0, y: y0, angle, z, u }: TineOp): PointMap {
  const mx = Math.cos(angle);
  const my = Math.sin(angle);
  const lnU = Math.log(u);
  const cut = reach(1, 0, z, lnU);
  return (x, y, out) => {
    const d = Math.abs(-(x - x0) * my + (y - y0) * mx);
    out[0] = x;
    out[1] = y;
    if (d > cut) return;
    const k = z * Math.exp(d * lnU);
    out[0] += k * mx;
    out[1] += k * my;
  };
}

function combMap({ x: x0, y: y0, angle, z, u, n, spacing }: CombOp): PointMap {
  const mx = Math.cos(angle);
  const my = Math.sin(angle);
  const lnU = Math.log(u);
  const cut = reach(1, 0, z, lnU);
  return (x, y, out) => {
    // Every tine shears along the same direction, so none moves a point's normal offset t: the comb is the sum.
    const t = -(x - x0) * my + (y - y0) * mx;
    const first = Math.max(0, Math.ceil((t - cut) / spacing));
    const last = Math.min(n - 1, Math.floor((t + cut) / spacing));
    let k = 0;
    for (let i = first; i <= last; i++) k += z * Math.exp(Math.abs(t - i * spacing) * lnU);
    out[0] = x + k * mx;
    out[1] = y + k * my;
  };
}

function turn(cx: number, cy: number, x: number, y: number, theta: number, out: number[]) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const dx = x - cx;
  const dy = y - cy;
  out[0] = cx + dx * c - dy * s;
  out[1] = cy + dx * s + dy * c;
}

function circleMap({ x: cx, y: cy, r, z, u }: CircleOp): PointMap {
  const lnU = Math.log(u);
  // Arc moved at distance d from the circle is at most (r + d) * (z / r) * u^d.
  const cut = reach(1, 1 / r, z, lnU);
  const w = z / r;
  return (x, y, out) => {
    const d = Math.abs(Math.hypot(x - cx, y - cy) - r);
    if (d > cut) {
      out[0] = x;
      out[1] = y;
      return;
    }
    turn(cx, cy, x, y, w * Math.exp(d * lnU), out);
  };
}

function vortexMap({ x: cx, y: cy, z, u }: VortexOp): PointMap {
  const lnU = Math.log(u);
  // Arc moved at radius rho is rho * z * u^rho.
  const cut = reach(0, 1, z, lnU);
  return (x, y, out) => {
    const rho = Math.hypot(x - cx, y - cy);
    if (rho > cut) {
      out[0] = x;
      out[1] = y;
      return;
    }
    turn(cx, cy, x, y, z * Math.exp(rho * lnU), out);
  };
}

function pointMap(op: Op): PointMap {
  switch (op.kind) {
    case "drop":
      return dropMap(op);
    case "tine":
      return tineMap(op);
    case "comb":
      return combMap(op);
    case "circle":
      return circleMap(op);
    case "vortex":
      return vortexMap(op);
  }
}

/** Where op sends the point (x, y). */
export function mapPoint(op: Op, x: number, y: number): [number, number] {
  const out = [0, 0];
  pointMap(op)(x, y, out);
  return [out[0], out[1]];
}

/** The inverse of a drop: where a point outside the drop's rim was before it fell. The rim and inside go to the centre. */
export function unmapDrop({ x: cx, y: cy, r }: DropOp, x: number, y: number): [number, number] {
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 <= r * r) return [cx, cy];
  const s = Math.sqrt(1 - (r * r) / d2);
  return [cx + dx * s, cy + dy * s];
}

type Rect = { x0: number; y0: number; x1: number; y1: number };

const offscreen = (r: Rect, ax: number, ay: number, bx: number, by: number) =>
  Math.max(ax, bx) < r.x0 || Math.min(ax, bx) > r.x1 || Math.max(ay, by) < r.y0 || Math.min(ay, by) > r.y1;

/**
 * Refine a closed ring under f: map every vertex and, where an image edge is longer than maxEdge and not wholly off
 * `rect`, split it at its pre-image midpoint (so the new vertex sits on the true image curve), up to MAX_SPLIT_DEPTH
 * halvings. With the identity map this is plain refinement. Returns null once the ring would pass `budget` vertices.
 */
export function refine(
  pts: number[],
  f: PointMap,
  rect: Rect,
  budget: number,
  maxEdge = MAX_EDGE,
): number[] | null {
  const n = pts.length;
  const img = new Array<number>(n);
  const p = [0, 0];
  for (let i = 0; i < n; i += 2) {
    f(pts[i], pts[i + 1], p);
    img[i] = p[0];
    img[i + 1] = p[1];
  }
  const out: number[] = [];
  const max2 = maxEdge * maxEdge;
  let over = false;
  const split = (ax: number, ay: number, aX: number, aY: number, bx: number, by: number, bX: number, bY: number, depth: number) => {
    if (over) return;
    const ex = bX - aX;
    const ey = bY - aY;
    if (ex * ex + ey * ey <= max2 || depth >= MAX_SPLIT_DEPTH || offscreen(rect, aX, aY, bX, bY)) return;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    f(mx, my, p);
    const mX = p[0];
    const mY = p[1];
    split(ax, ay, aX, aY, mx, my, mX, mY, depth + 1);
    if (out.length / 2 >= budget) {
      over = true;
      return;
    }
    out.push(mX, mY);
    split(mx, my, mX, mY, bx, by, bX, bY, depth + 1);
  };
  for (let i = 0; i < n && !over; i += 2) {
    const j = (i + 2) % n;
    out.push(img[i], img[i + 1]);
    split(pts[i], pts[i + 1], img[i], img[i + 1], pts[j], pts[j + 1], img[j], img[j + 1], 0);
  }
  return over || out.length / 2 > budget ? null : out;
}

/** A drop's own ring: a regular polygon whose edges stay under MAX_EDGE. */
export function dropRing({ x, y, r }: DropOp): number[] {
  const n = Math.max(16, Math.ceil((2 * Math.PI * r) / (MAX_EDGE * 0.95)));
  const pts = new Array<number>(2 * n);
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts[2 * i] = x + r * Math.cos(a);
    pts[2 * i + 1] = y + r * Math.sin(a);
  }
  return pts;
}

/** Apply one op. A refused op (cap reached, or a malformed op) leaves the pond exactly as it was. */
export function applyOp(m: Marble, op: Op): Result {
  if (!validOp(op)) return { ok: false, reason: "invalid", marble: m };
  if (op.kind === "drop" && m.drops.length >= MAX_DROPS) return { ok: false, reason: "max_drops", marble: m };
  const ring = op.kind === "drop" ? dropRing(op) : null;
  let budget = MAX_VERTS - (ring ? ring.length / 2 : 0);
  if (budget < 0) return { ok: false, reason: "max_verts", marble: m };
  const f = pointMap(op);
  const rect = { x0: -OFFSCREEN_MARGIN, y0: -OFFSCREEN_MARGIN, x1: m.width + OFFSCREEN_MARGIN, y1: m.height + OFFSCREEN_MARGIN };
  const drops: Drop[] = [];
  for (const d of m.drops) {
    const pts = refine(d.pts, f, rect, budget);
    if (!pts) return { ok: false, reason: "max_verts", marble: m };
    budget -= pts.length / 2;
    drops.push({ ink: d.ink, pts });
  }
  if (ring && op.kind === "drop") drops.push({ ink: op.ink, pts: ring });
  return { ok: true, marble: { width: m.width, height: m.height, drops, verts: MAX_VERTS - budget } };
}

/** Replay ops onto an empty pond, skipping (and counting) any that are refused. */
export function replay(ops: readonly Op[], width: number, height: number): { marble: Marble; refused: number } {
  let marble = createMarble(width, height);
  let refused = 0;
  for (const op of ops) {
    const r = applyOp(marble, op);
    if (r.ok) marble = r.marble;
    else refused++;
  }
  return { marble, refused };
}

/** mulberry32: a small seeded PRNG giving floats in [0, 1). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Drops in a recipe: alternating sumi and clear, so the sumi spreads into rings. */
export const RECIPE_DROPS = 24;

/**
 * A classic suminagashi print from a seed: RECIPE_DROPS alternating sumi and clear drops near one spot, two combs
 * across each other, then one vortex. The same seed always gives the same ops; nothing here touches Math.random.
 */
export function recipe(seed: number, width: number, height: number): Op[] {
  const rand = seeded(seed);
  const span = (lo: number, hi: number) => lo + (hi - lo) * rand();
  const side = Math.min(width, height);
  const cx = width / 2 + span(-0.1, 0.1) * width;
  const cy = height / 2 + span(-0.1, 0.1) * height;
  const ops: Op[] = [];
  for (let i = 0; i < RECIPE_DROPS; i++) {
    const a = span(0, 2 * Math.PI);
    const j = span(0, side * 0.012);
    ops.push({
      kind: "drop",
      x: cx + j * Math.cos(a),
      y: cy + j * Math.sin(a),
      r: span(0.05, 0.075) * side,
      ink: i % 2 === 0 ? "sumi" : "clear",
    });
  }
  let angle = span(-0.3, 0.3);
  for (let c = 0; c < 2; c++) {
    const spacing = span(0.1, 0.15) * side;
    const n = Math.min(64, Math.ceil(Math.hypot(width, height) / spacing) + 1);
    const back = (spacing * (n - 1)) / 2;
    ops.push({
      kind: "comb",
      x: width / 2 + Math.sin(angle) * back,
      y: height / 2 - Math.cos(angle) * back,
      angle,
      z: span(0.05, 0.08) * side * (rand() < 0.5 ? -1 : 1),
      u: uForHalf(span(0.025, 0.04) * side),
      n,
      spacing,
    });
    angle += Math.PI / 2 + span(-0.25, 0.25);
  }
  ops.push({ kind: "vortex", x: cx, y: cy, z: span(1.2, 2.4) * (rand() < 0.5 ? -1 : 1), u: uForHalf(span(0.12, 0.2) * side) });
  return ops;
}

/** Douglas-Peucker on a closed flat ring: the kept vertices, in order. */
export function simplifyRing(pts: number[], tolerance = SVG_TOLERANCE): number[] {
  const n = pts.length / 2;
  if (n <= 3) return pts.slice();
  // Split at vertex 0 and the vertex farthest from it, then simplify both open halves.
  let far = 0;
  let best = -1;
  for (let i = 1; i < n; i++) {
    const d = (pts[2 * i] - pts[0]) ** 2 + (pts[2 * i + 1] - pts[1]) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const keep = new Uint8Array(n + 1);
  keep[0] = keep[far] = keep[n] = 1;
  const x = (i: number) => pts[2 * (i % n)];
  const y = (i: number) => pts[2 * (i % n) + 1];
  const tol2 = tolerance * tolerance;
  const stack: number[] = [0, far, far, n];
  while (stack.length) {
    const b = stack.pop()!;
    const a = stack.pop()!;
    const ax = x(a);
    const ay = y(a);
    const ex = x(b) - ax;
    const ey = y(b) - ay;
    const len2 = ex * ex + ey * ey;
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const px = x(i) - ax;
      const py = y(i) - ay;
      const t = len2 > 0 ? Math.max(0, Math.min(1, (px * ex + py * ey) / len2)) : 0;
      const d = (px - t * ex) ** 2 + (py - t * ey) ** 2;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > tol2) {
      keep[at] = 1;
      stack.push(a, at, at, b);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]);
  return out;
}

const fmt = (v: number) => String(Math.round(v * 10) / 10);

/**
 * SVG path data for the pond, bottom drop first: each ring Douglas-Peucker simplified to SVG_TOLERANCE px with
 * 1-decimal coordinates. Rings wholly outside the pond are left out.
 */
export function toSvgPaths(m: Marble): { ink: Ink; d: string }[] {
  const rect = { x0: 0, y0: 0, x1: m.width, y1: m.height };
  const paths: { ink: Ink; d: string }[] = [];
  for (const drop of m.drops) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < drop.pts.length; i += 2) {
      x0 = Math.min(x0, drop.pts[i]);
      x1 = Math.max(x1, drop.pts[i]);
      y0 = Math.min(y0, drop.pts[i + 1]);
      y1 = Math.max(y1, drop.pts[i + 1]);
    }
    if (x1 < rect.x0 || x0 > rect.x1 || y1 < rect.y0 || y0 > rect.y1) continue;
    const pts = simplifyRing(drop.pts);
    const parts: string[] = [];
    let last = "";
    for (let i = 0; i < pts.length; i += 2) {
      const pair = `${fmt(pts[i])} ${fmt(pts[i + 1])}`;
      if (pair !== last) parts.push(pair);
      last = pair;
    }
    if (parts.length > 1 && parts[parts.length - 1] === parts[0]) parts.pop();
    if (parts.length < 3) continue;
    paths.push({ ink: drop.ink, d: `M${parts[0]}L${parts.slice(1).join(" ")}Z` });
  }
  return paths;
}
