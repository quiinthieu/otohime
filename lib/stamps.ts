// The rubber-stamp board's solver: oriented boxes in a walled tray, in pixels
// and seconds with y pointing down. Pure, no DOM, so components/stamp-board.tsx
// draws what it says and lib/stamps.test.ts proves it. No motion library (README,
// Motion): box-box contacts come from a separating-axis test clipped to one or
// two points (after Box2D-lite), solved by sequential impulses with Coulomb
// friction, then pushed apart by a few position passes. It runs at a fixed
// 120 Hz whatever the frame rate, and a box that stays slow for 30 steps sleeps.

export const STEP = 1 / 120;
export const GRAVITY = 2400;
export const ITERATIONS = 8;
export const RESTITUTION = 0.15;
export const FRICTION = 0.6;
export const SLEEP_STEPS = 30;
// The velocity clamp: nothing moves faster, so a toss cannot leave the tray.
export const MAX_SPEED = 2400;
export const MAX_SPIN = 24;
// A landing at least this fast leaves an ink mark; the board keeps the latest 40.
export const MARK_SPEED = 260;
export const MAX_MARKS = 40;
// The tidy spring's angular frequency: critically damped, home within 0.5 px in 30 steps.
export const TIDY_OMEGA = 48;

// Slower than this, a step counts toward sleep.
const SLEEP_SPEED = 8;
const SLEEP_SPIN = 0.15;
// An awake box this fast wakes a sleeping one it touches.
const WAKE_SPEED = 40;
// Below this approach speed a contact does not bounce, so resting boxes stay put.
const BOUNCE_SPEED = 90;
// Penetration the position passes leave alone, and the most they fix per pass.
const SLOP = 0.25;
// Contacts start this far apart, plus the distance a box can cover in one step, so
// the solver stops it at the surface instead of letting it sink in and pushing it out.
const MARGIN = 2;
const POSITION_PASSES = 3;
const POSITION_BETA = 0.5;
const MAX_CORRECTION = 12;
// Air drag per second, linear and angular.
const DRAG = 0.1;
const SPIN_DRAG = 1.2;
// Steps between two marks of the same box, so one landing leaves one mark.
const MARK_GAP = 12;
// The grab spring: a soft point constraint at 6 Hz, critically damped.
const GRAB_HZ = 6;
const GRAB_DAMPING = 1;
const GRAB_MAX_ACCEL = 30000;
// A held box swings on the grab point but settles fast, like a stamp held loosely.
const HELD_SPIN_DRAG = 12;
// The pointer samples a toss is read from.
const TOSS_WINDOW = 0.08;

export type Pose = { x: number; y: number; a: number };

export type Box = {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  hw: number;
  hh: number;
  // inverse mass and inverse moment of inertia
  im: number;
  ii: number;
  asleep: boolean;
  slow: number;
  markedAt: number;
  home: Pose;
};

export type Grab = { box: number; lx: number; ly: number; tx: number; ty: number };
export type Mark = { box: number; x: number; y: number; a: number; speed: number };

export type World = {
  width: number;
  height: number;
  boxes: Box[];
  grab: Grab | null;
  tidy: boolean;
  marks: Mark[];
  steps: number;
  // unspent time below one step, carried to the next frame
  carry: number;
};

export type Contact = {
  a: Box;
  // null: a wall, the floor or the ceiling
  b: Box | null;
  // from a toward b (for a wall: out of the tray)
  nx: number;
  ny: number;
  px: number;
  py: number;
  sep: number;
};

// A box of w by h px resting at its home pose, or placed elsewhere.
export function makeBox(home: Pose, w: number, h: number, at: Pose = home): Box {
  const mass = (w * h) / 1000;
  return {
    x: at.x,
    y: at.y,
    a: at.a,
    vx: 0,
    vy: 0,
    w: 0,
    hw: w / 2,
    hh: h / 2,
    im: 1 / mass,
    ii: 12 / (mass * (w * w + h * h)),
    asleep: false,
    slow: 0,
    markedAt: -Infinity,
    home: { ...home },
  };
}

export function makeWorld(width: number, height: number, boxes: Box[]): World {
  return { width, height, boxes, grab: null, tidy: false, marks: [], steps: 0, carry: 0 };
}

export function corners(b: Box): [number, number][] {
  const c = Math.cos(b.a);
  const s = Math.sin(b.a);
  return [
    [-b.hw, -b.hh],
    [b.hw, -b.hh],
    [b.hw, b.hh],
    [-b.hw, b.hh],
  ].map(([x, y]) => [b.x + c * x - s * y, b.y + s * x + c * y]);
}

// Kinetic plus potential energy (height above the floor), in mass·px²/s².
export function energy(world: World): number {
  let e = 0;
  for (const b of world.boxes) {
    const m = 1 / b.im;
    e += 0.5 * m * (b.vx * b.vx + b.vy * b.vy) + (0.5 * b.w * b.w) / b.ii + m * GRAVITY * (world.height - b.y);
  }
  return e;
}

export function wakeAll(world: World) {
  for (const b of world.boxes) {
    b.asleep = false;
    b.slow = 0;
  }
}

// True while anything still moves: the board keeps its frame loop running until this is false.
export function awake(world: World): boolean {
  return world.tidy || world.grab !== null || world.boxes.some((b) => !b.asleep);
}

// The tray changed size: keep every box inside and let them settle again.
export function resize(world: World, width: number, height: number) {
  world.width = width;
  world.height = height;
  for (const b of world.boxes) contain(world, b);
  wakeAll(world);
}

// Box-plane contacts: each corner past the floor, a wall or the ceiling.
function walls(world: World, b: Box, out: Contact[], margin: number) {
  for (const [x, y] of corners(b)) {
    if (world.height - y < margin) out.push({ a: b, b: null, nx: 0, ny: 1, px: x, py: world.height, sep: world.height - y });
    if (y < margin) out.push({ a: b, b: null, nx: 0, ny: -1, px: x, py: 0, sep: y });
    if (x < margin) out.push({ a: b, b: null, nx: -1, ny: 0, px: 0, py: y, sep: x });
    if (world.width - x < margin) out.push({ a: b, b: null, nx: 1, ny: 0, px: world.width, py: y, sep: world.width - x });
  }
}

type V = [number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];

// The edge of box (h, pos, angle) whose outward normal is most against n, as two world points.
function incidentEdge(hx: number, hy: number, px: number, py: number, angle: number, n: V): [V, V] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // n in the box's frame, reversed
  const lx = -(c * n[0] + s * n[1]);
  const ly = -(-s * n[0] + c * n[1]);
  let e: [V, V];
  if (Math.abs(lx) > Math.abs(ly)) {
    e = lx > 0 ? [[hx, -hy], [hx, hy]] : [[-hx, hy], [-hx, -hy]];
  } else {
    e = ly > 0 ? [[hx, hy], [-hx, hy]] : [[-hx, -hy], [hx, -hy]];
  }
  return e.map(([x, y]) => [px + c * x - s * y, py + s * x + c * y]) as [V, V];
}

// The part of segment v on the inner side of the line n·p = offset.
function clip(v: V[], n: V, offset: number): V[] {
  const out: V[] = [];
  const d0 = dot(n, v[0]) - offset;
  const d1 = dot(n, v[1]) - offset;
  if (d0 <= 0) out.push(v[0]);
  if (d1 <= 0) out.push(v[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    out.push([v[0][0] + t * (v[1][0] - v[0][0]), v[0][1] + t * (v[1][1] - v[0][1])]);
  }
  return out;
}

// Separating-axis test of two oriented boxes: none, one or two contact points, the normal from a to b.
// Boxes up to `margin` apart already touch (sep > 0), so the solver can stop them short of overlapping.
export function collide(a: Box, b: Box, margin = 0): Contact[] {
  const ca = Math.cos(a.a);
  const sa = Math.sin(a.a);
  const cb = Math.cos(b.a);
  const sb = Math.sin(b.a);
  // the axes of each box in world space
  const a1: V = [ca, sa];
  const a2: V = [-sa, ca];
  const b1: V = [cb, sb];
  const b2: V = [-sb, cb];
  const dp: V = [b.x - a.x, b.y - a.y];
  const dA: V = [dot(a1, dp), dot(a2, dp)];
  const dB: V = [dot(b1, dp), dot(b2, dp)];
  // |rotation from b's frame to a's|
  const c11 = Math.abs(dot(a1, b1));
  const c12 = Math.abs(dot(a1, b2));
  const c21 = Math.abs(dot(a2, b1));
  const c22 = Math.abs(dot(a2, b2));

  const faceAx = Math.abs(dA[0]) - a.hw - (c11 * b.hw + c12 * b.hh);
  const faceAy = Math.abs(dA[1]) - a.hh - (c21 * b.hw + c22 * b.hh);
  if (faceAx > margin || faceAy > margin) return [];
  const faceBx = Math.abs(dB[0]) - (c11 * a.hw + c21 * a.hh) - b.hw;
  const faceBy = Math.abs(dB[1]) - (c12 * a.hw + c22 * a.hh) - b.hh;
  if (faceBx > margin || faceBy > margin) return [];

  // The axis of least penetration, preferring a's faces, then x, so a stack keeps one reference face.
  const flip = (axis: V, d: number): V => (d > 0 ? axis : [-axis[0], -axis[1]]);
  let axis = 0;
  let sep = faceAx;
  let normal = flip(a1, dA[0]);
  const better = (s: number, h: number) => s > 0.95 * sep + 0.01 * h;
  if (better(faceAy, a.hh)) [axis, sep, normal] = [1, faceAy, flip(a2, dA[1])];
  if (better(faceBx, b.hw)) [axis, sep, normal] = [2, faceBx, flip(b1, dB[0])];
  if (better(faceBy, b.hh)) [axis, sep, normal] = [3, faceBy, flip(b2, dB[1])];

  // The reference face of one box, its side planes, and the incident edge of the other.
  let front: V;
  let side: V;
  let frontOffset: number;
  let sideOffset: number;
  let extent: number;
  let edge: [V, V];
  if (axis < 2) {
    front = normal;
    side = axis === 0 ? a2 : a1;
    frontOffset = dot([a.x, a.y], front) + (axis === 0 ? a.hw : a.hh);
    sideOffset = dot([a.x, a.y], side);
    extent = axis === 0 ? a.hh : a.hw;
    edge = incidentEdge(b.hw, b.hh, b.x, b.y, b.a, front);
  } else {
    front = [-normal[0], -normal[1]];
    side = axis === 2 ? b2 : b1;
    frontOffset = dot([b.x, b.y], front) + (axis === 2 ? b.hw : b.hh);
    sideOffset = dot([b.x, b.y], side);
    extent = axis === 2 ? b.hh : b.hw;
    edge = incidentEdge(a.hw, a.hh, a.x, a.y, a.a, front);
  }

  const one = clip(edge, [-side[0], -side[1]], -sideOffset + extent);
  if (one.length < 2) return [];
  const two = clip(one, side, sideOffset + extent);
  if (two.length < 2) return [];

  const out: Contact[] = [];
  for (const p of two) {
    const s = dot(front, p) - frontOffset;
    if (s <= margin) {
      out.push({ a, b, nx: normal[0], ny: normal[1], px: p[0] - s * front[0], py: p[1] - s * front[1], sep: s });
    }
  }
  return out;
}

// Every contact among the awake boxes, waking a sleeper that an awake box runs into.
// How far ahead box b looks for contacts this step (none when speculating is off).
const reach = (b: Box, speculate: boolean) =>
  speculate && !b.asleep ? MARGIN + (Math.hypot(b.vx, b.vy) + Math.abs(b.w) * Math.hypot(b.hw, b.hh)) * STEP : 0;

function contacts(world: World, speculate: boolean): Contact[] {
  const out: Contact[] = [];
  const { boxes } = world;
  for (const b of boxes) if (!b.asleep) walls(world, b, out, reach(b, speculate));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.asleep && b.asleep) continue;
      const found = collide(a, b, reach(a, speculate) + reach(b, speculate));
      if (found.length === 0) continue;
      for (const [still, moving] of [[a, b], [b, a]]) {
        if (still.asleep && Math.hypot(moving.vx, moving.vy) > WAKE_SPEED) {
          still.asleep = false;
          still.slow = 0;
        }
      }
      out.push(...found);
    }
  }
  return out;
}

const invMass = (b: Box | null) => (b && !b.asleep ? b.im : 0);
const invInertia = (b: Box | null) => (b && !b.asleep ? b.ii : 0);

// The velocity of a point of a box (zero for a wall or a sleeper).
function pointVelocity(b: Box | null, px: number, py: number): V {
  if (!b || b.asleep) return [0, 0];
  return [b.vx - b.w * (py - b.y), b.vy + b.w * (px - b.x)];
}

function push(b: Box | null, px: number, py: number, ix: number, iy: number) {
  if (!b || b.asleep) return;
  b.vx += ix * b.im;
  b.vy += iy * b.im;
  b.w += ((px - b.x) * iy - (py - b.y) * ix) * b.ii;
}

function clampVelocity(b: Box) {
  const speed = Math.hypot(b.vx, b.vy);
  if (speed > MAX_SPEED) {
    b.vx *= MAX_SPEED / speed;
    b.vy *= MAX_SPEED / speed;
  }
  b.w = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, b.w));
}

// Keep a box's corners inside the tray: the last word after the solver, so nothing ever leaves it.
function contain(world: World, b: Box) {
  const cs = corners(b);
  const xs = cs.map((c) => c[0]);
  const ys = cs.map((c) => c[1]);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  if (right - left <= world.width) {
    if (left < 0) b.x -= left;
    else if (right > world.width) b.x -= right - world.width;
  } else b.x = world.width / 2;
  if (bottom - top <= world.height) {
    if (top < 0) b.y -= top;
    else if (bottom > world.height) b.y -= bottom - world.height;
  } else b.y = world.height - (bottom - top) / 2;
}

type Row = Contact & { ra: V; rb: V; mn: number; mt: number; target: number; impact: number; pn: number; pt: number };

function prepare(c: Contact): Row {
  const ra: V = [c.px - c.a.x, c.py - c.a.y];
  const rb: V = c.b ? [c.px - c.b.x, c.py - c.b.y] : [0, 0];
  const ma = invMass(c.a) + invMass(c.b);
  const rna = ra[0] * c.ny - ra[1] * c.nx;
  const rnb = rb[0] * c.ny - rb[1] * c.nx;
  const rta = ra[0] * -c.nx - ra[1] * c.ny;
  const rtb = rb[0] * -c.nx - rb[1] * c.ny;
  const kn = ma + invInertia(c.a) * rna * rna + invInertia(c.b) * rnb * rnb;
  const kt = ma + invInertia(c.a) * rta * rta + invInertia(c.b) * rtb * rtb;
  const va = pointVelocity(c.a, c.px, c.py);
  const vb = pointVelocity(c.b, c.px, c.py);
  const vn = (vb[0] - va[0]) * c.nx + (vb[1] - va[1]) * c.ny;
  return {
    ...c,
    ra,
    rb,
    mn: kn > 0 ? 1 / kn : 0,
    mt: kt > 0 ? 1 / kt : 0,
    // a hard landing this step bounces back a little; otherwise a gap may close, no further
    target: -vn > BOUNCE_SPEED && c.sep <= -vn * STEP ? RESTITUTION * -vn : -Math.max(c.sep, 0) / STEP,
    impact: -vn,
    pn: 0,
    pt: 0,
  };
}

const normalVelocity = (r: Row) => {
  const va = pointVelocity(r.a, r.px, r.py);
  const vb = pointVelocity(r.b, r.px, r.py);
  return (vb[0] - va[0]) * r.nx + (vb[1] - va[1]) * r.ny;
};

function pushNormal(r: Row, dn: number) {
  push(r.a, r.px, r.py, -dn * r.nx, -dn * r.ny);
  push(r.b, r.px, r.py, dn * r.nx, dn * r.ny);
}

// One point: the boxes may not close past the target.
function solveNormal(r: Row) {
  const pn = Math.max(r.pn + r.mn * (r.target - normalVelocity(r)), 0);
  pushNormal(r, pn - r.pn);
  r.pn = pn;
}

// Two points of one face, solved together (the 2x2 complementarity problem by cases, after Box2D), so a
// flat landing pushes both corners at once and does not set the box spinning.
function solvePair(r1: Row, r2: Row) {
  const ra1 = r1.ra[0] * r1.ny - r1.ra[1] * r1.nx;
  const rb1 = r1.rb[0] * r1.ny - r1.rb[1] * r1.nx;
  const ra2 = r2.ra[0] * r2.ny - r2.ra[1] * r2.nx;
  const rb2 = r2.rb[0] * r2.ny - r2.rb[1] * r2.nx;
  const m = invMass(r1.a) + invMass(r1.b);
  const ia = invInertia(r1.a);
  const ib = invInertia(r1.b);
  const k11 = m + ia * ra1 * ra1 + ib * rb1 * rb1;
  const k22 = m + ia * ra2 * ra2 + ib * rb2 * rb2;
  const k12 = m + ia * ra1 * ra2 + ib * rb1 * rb2;
  const det = k11 * k22 - k12 * k12;
  if (k11 * k11 >= 1000 * det) {
    // nearly the same point twice: one at a time
    solveNormal(r1);
    solveNormal(r2);
    return;
  }
  const a1 = r1.pn;
  const a2 = r2.pn;
  // the velocity each point would have with no impulse at all, less its target
  const b1 = normalVelocity(r1) - r1.target - (k11 * a1 + k12 * a2);
  const b2 = normalVelocity(r2) - r2.target - (k12 * a1 + k22 * a2);
  let x1 = (-k22 * b1 + k12 * b2) / det;
  let x2 = (k12 * b1 - k11 * b2) / det;
  if (x1 < 0 || x2 < 0) {
    x1 = -b1 / k11;
    x2 = 0;
    if (x1 < 0 || k12 * x1 + b2 < 0) {
      x1 = 0;
      x2 = -b2 / k22;
      if (x2 < 0 || k12 * x2 + b1 < 0) x2 = 0;
    }
  }
  pushNormal(r1, x1 - a1);
  pushNormal(r2, x2 - a2);
  r1.pn = x1;
  r2.pn = x2;
}

// Friction along the tangent, at most FRICTION times the normal impulse.
function solveFriction(r: Row) {
  const tx = r.ny;
  const ty = -r.nx;
  const va = pointVelocity(r.a, r.px, r.py);
  const vb = pointVelocity(r.b, r.px, r.py);
  const vt = (vb[0] - va[0]) * tx + (vb[1] - va[1]) * ty;
  const limit = FRICTION * r.pn;
  const pt = Math.max(-limit, Math.min(limit, r.pt - r.mt * vt));
  const dt = pt - r.pt;
  r.pt = pt;
  push(r.a, r.px, r.py, -dt * tx, -dt * ty);
  push(r.b, r.px, r.py, dt * tx, dt * ty);
}

// The contacts of one pair of surfaces: one box on another, or a box on the floor or a wall.
function manifolds(rows: Row[]): Row[][] {
  const out: Row[][] = [];
  for (const r of rows) {
    const same = out.find(([f]) => f.a === r.a && f.b === r.b && f.nx === r.nx && f.ny === r.ny);
    if (same) same.push(r);
    else out.push([r]);
  }
  return out;
}

function solveManifold(m: Row[]) {
  if (m.length === 2) solvePair(m[0], m[1]);
  else for (const r of m) solveNormal(r);
  for (const r of m) solveFriction(r);
}

// The grab: a soft point constraint pulling the grabbed point of a box toward the pointer.
type Spring = { box: Box; r: V; k: [number, number, number]; bias: V; gamma: number; px: number; py: number; max: number };

function prepareGrab(world: World): Spring | null {
  const g = world.grab;
  if (!g) return null;
  const b = world.boxes[g.box];
  const c = Math.cos(b.a);
  const s = Math.sin(b.a);
  const r: V = [c * g.lx - s * g.ly, s * g.lx + c * g.ly];
  const m = 1 / b.im;
  const omega = 2 * Math.PI * GRAB_HZ;
  const gamma = 1 / (STEP * (2 * m * GRAB_DAMPING * omega + STEP * m * omega * omega));
  const beta = STEP * m * omega * omega * gamma;
  const k11 = b.im + b.ii * r[1] * r[1] + gamma;
  const k12 = -b.ii * r[0] * r[1];
  const k22 = b.im + b.ii * r[0] * r[0] + gamma;
  const det = k11 * k22 - k12 * k12;
  return {
    box: b,
    r,
    k: [k22 / det, -k12 / det, k11 / det],
    bias: [beta * (b.x + r[0] - g.tx), beta * (b.y + r[1] - g.ty)],
    gamma,
    px: 0,
    py: 0,
    max: m * GRAB_MAX_ACCEL * STEP,
  };
}

function solveGrab(sp: Spring) {
  const b = sp.box;
  const vx = b.vx - b.w * sp.r[1];
  const vy = b.vy + b.w * sp.r[0];
  const cx = -(vx + sp.bias[0] + sp.gamma * sp.px);
  const cy = -(vy + sp.bias[1] + sp.gamma * sp.py);
  const old: V = [sp.px, sp.py];
  sp.px += sp.k[0] * cx + sp.k[1] * cy;
  sp.py += sp.k[1] * cx + sp.k[2] * cy;
  const len = Math.hypot(sp.px, sp.py);
  if (len > sp.max) {
    sp.px *= sp.max / len;
    sp.py *= sp.max / len;
  }
  push(b, b.x + sp.r[0], b.y + sp.r[1], sp.px - old[0], sp.py - old[1]);
}

// Positions only: push overlapping boxes apart without adding speed.
function correct(world: World) {
  for (let pass = 0; pass < POSITION_PASSES; pass++) {
    for (const c of contacts(world, false)) {
      const err = Math.max(-MAX_CORRECTION, POSITION_BETA * (c.sep + SLOP));
      if (err >= 0) continue;
      const ra: V = [c.px - c.a.x, c.py - c.a.y];
      const rb: V = c.b ? [c.px - c.b.x, c.py - c.b.y] : [0, 0];
      const rna = ra[0] * c.ny - ra[1] * c.nx;
      const rnb = rb[0] * c.ny - rb[1] * c.nx;
      const k = invMass(c.a) + invMass(c.b) + invInertia(c.a) * rna * rna + invInertia(c.b) * rnb * rnb;
      if (k <= 0) continue;
      const p = -err / k;
      const a = c.a;
      if (!a.asleep) {
        a.x -= p * c.nx * a.im;
        a.y -= p * c.ny * a.im;
        a.a -= rna * p * a.ii;
      }
      const b = c.b;
      if (b && !b.asleep) {
        b.x += p * c.nx * b.im;
        b.y += p * c.ny * b.im;
        b.a += rnb * p * b.ii;
      }
    }
  }
}

// The exact step of a critically damped spring toward 0: x, v after STEP.
function settle(x: number, v: number): [number, number] {
  const k = Math.exp(-TIDY_OMEGA * STEP);
  const j = v + TIDY_OMEGA * x;
  return [(x + j * STEP) * k, (v - TIDY_OMEGA * j * STEP) * k];
}

function tidyStep(world: World) {
  for (const b of world.boxes) {
    let off: number;
    [off, b.vx] = settle(b.x - b.home.x, b.vx);
    b.x = b.home.x + off;
    [off, b.vy] = settle(b.y - b.home.y, b.vy);
    b.y = b.home.y + off;
    [off, b.w] = settle(b.a - b.home.a, b.w);
    b.a = b.home.a + off;
  }
}

// One fixed step of 1/120 s. Returns the marks it left.
export function step(world: World): Mark[] {
  world.steps++;
  if (world.tidy) {
    tidyStep(world);
    return [];
  }
  const held = world.grab ? world.boxes[world.grab.box] : null;
  if (held) held.asleep = false;
  for (const b of world.boxes) {
    if (b.asleep) continue;
    b.vy += GRAVITY * STEP;
    b.vx *= 1 - DRAG * STEP;
    b.vy *= 1 - DRAG * STEP;
    b.w *= 1 - (b === held ? HELD_SPIN_DRAG : SPIN_DRAG) * STEP;
  }

  const rows = contacts(world, true).map(prepare);
  const marks: Mark[] = [];
  for (const r of rows) {
    // a landing is a contact that lands this step, fast
    const speed = r.impact;
    if (speed < MARK_SPEED || r.sep > speed * STEP) continue;
    // the faster of the two boxes made it
    const box = r.b && !r.b.asleep && Math.hypot(r.b.vx, r.b.vy) > Math.hypot(r.a.vx, r.a.vy) ? r.b : r.a;
    if (world.steps - box.markedAt < MARK_GAP) continue;
    box.markedAt = world.steps;
    marks.push({ box: world.boxes.indexOf(box), x: box.x, y: box.y, a: box.a, speed });
  }

  const spring = prepareGrab(world);
  const groups = manifolds(rows);
  for (let i = 0; i < ITERATIONS; i++) {
    if (spring) solveGrab(spring);
    for (const m of groups) solveManifold(m);
  }

  for (const b of world.boxes) {
    if (b.asleep) continue;
    clampVelocity(b);
    b.x += b.vx * STEP;
    b.y += b.vy * STEP;
    b.a += b.w * STEP;
  }
  correct(world);

  for (const b of world.boxes) {
    if (b.asleep) continue;
    contain(world, b);
    const slow = b !== held && Math.hypot(b.vx, b.vy) < SLEEP_SPEED && Math.abs(b.w) < SLEEP_SPIN;
    b.slow = slow ? b.slow + 1 : 0;
    if (b.slow >= SLEEP_STEPS) {
      b.asleep = true;
      b.vx = 0;
      b.vy = 0;
      b.w = 0;
    }
  }

  world.marks.push(...marks);
  if (world.marks.length > MAX_MARKS) world.marks.splice(0, world.marks.length - MAX_MARKS);
  return marks;
}

// Run the fixed steps a frame of `seconds` owes (at most 12, so a stalled tab does not spiral).
export function advance(world: World, seconds: number): Mark[] {
  world.carry = Math.min(world.carry + seconds, 12 * STEP);
  const marks: Mark[] = [];
  while (world.carry >= STEP) {
    world.carry -= STEP;
    marks.push(...step(world));
  }
  return marks;
}

// Pick up box i at the tray point (px, py), which must lie on it.
export function grab(world: World, i: number, px: number, py: number) {
  const b = world.boxes[i];
  const c = Math.cos(b.a);
  const s = Math.sin(b.a);
  const dx = px - b.x;
  const dy = py - b.y;
  world.grab = { box: i, lx: c * dx + s * dy, ly: -s * dx + c * dy, tx: px, ty: py };
  world.tidy = false;
  wakeAll(world);
}

export function drag(world: World, px: number, py: number) {
  if (!world.grab) return;
  world.grab.tx = Math.max(0, Math.min(world.width, px));
  world.grab.ty = Math.max(0, Math.min(world.height, py));
}

// Let go, tossing the box at (vx, vy) px/s, clamped.
export function release(world: World, vx = 0, vy = 0) {
  const g = world.grab;
  if (!g) return;
  world.grab = null;
  const b = world.boxes[g.box];
  b.vx = vx;
  b.vy = vy;
  clampVelocity(b);
  wakeAll(world);
}

// The toss a pointer gives on release: its velocity over the last 80 ms of samples (t in seconds).
export function tossVelocity(samples: { t: number; x: number; y: number }[]): { vx: number; vy: number } {
  if (samples.length < 2) return { vx: 0, vy: 0 };
  const last = samples[samples.length - 1];
  const first = samples.find((p) => last.t - p.t <= TOSS_WINDOW) ?? last;
  const dt = last.t - first.t;
  if (dt < 1 / 240) return { vx: 0, vy: 0 };
  let vx = (last.x - first.x) / dt;
  let vy = (last.y - first.y) / dt;
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx *= MAX_SPEED / speed;
    vy *= MAX_SPEED / speed;
  }
  return { vx, vy };
}

// Send every box home on the tidy spring: collisions and gravity off, the nearest turn of the angle.
export function startTidy(world: World) {
  world.grab = null;
  world.tidy = true;
  for (const b of world.boxes) {
    b.asleep = false;
    b.a = b.home.a + Math.atan2(Math.sin(b.a - b.home.a), Math.cos(b.a - b.home.a));
  }
}

// How far the worst box is from home, in px: its centre, or a corner turned by the angle left.
export function homeError(world: World): number {
  let worst = 0;
  for (const b of world.boxes) {
    const off = Math.hypot(b.x - b.home.x, b.y - b.home.y) + Math.abs(b.a - b.home.a) * Math.hypot(b.hw, b.hh);
    worst = Math.max(worst, off);
  }
  return worst;
}

// Nudge a box by (dx, dy) px as a shove: it moves that far before drag and contacts have their say.
export function nudge(world: World, i: number, dx: number, dy: number) {
  const b = world.boxes[i];
  wakeAll(world);
  b.vx += dx / (STEP * 10);
  b.vy += dy / (STEP * 10);
  clampVelocity(b);
}
