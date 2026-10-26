// The palace's ink fish: a small seeded school that cruises the sea and flees a pointer or a fingertip. Pure, so
// the school is the same on the server and the first client frame, and the tests can drive it frame by frame.
// Coordinates are the scene's viewBox units (SEA), y down; speeds are units a second.
export const SEA = { w: 1000, h: 600 } as const;
export const COUNT = 9;
export const CRUISE = 38;
export const MAX_SPEED = 260;
export const FLEE_RADIUS = 170;
export const FLEE_PUSH = 900;
// The edge band in which a fish turns back toward open water, and how hard.
export const MARGIN = 60;
const EDGE_PUSH = 140;
// A frame longer than this (a tab back from the background, a debugger) counts as this long, so nobody teleports.
export const MAX_DT = 0.05;
const DRAG = 1.6;

export type Fish = { x: number; y: number; vx: number; vy: number; size: number; phase: number };
export type Point = { x: number; y: number } | null;

// mulberry32: a tiny seeded generator, enough for placing nine fish.
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSchool(seed = 1559, count = COUNT): Fish[] {
  const r = random(seed);
  return Array.from({ length: count }, () => {
    const angle = r() * Math.PI * 2;
    return {
      x: round(MARGIN + r() * (SEA.w - 2 * MARGIN)),
      // the upper two thirds: the palace sits on the floor
      y: round(MARGIN + r() * (SEA.h * 0.62 - MARGIN)),
      vx: round(Math.cos(angle) * CRUISE),
      vy: round(Math.sin(angle) * CRUISE * 0.4),
      size: round(0.7 + r() * 0.6),
      phase: round(r() * Math.PI * 2),
    };
  });
}

const round = (n: number) => Math.round(n * 100) / 100;

// One frame of dt seconds at time t (seconds since the scene began). Each fish wanders on its own phase, turns
// back from the edges, eases toward cruising speed, and darts away from the pointer inside FLEE_RADIUS, harder the
// closer it is.
export function stepSchool(school: readonly Fish[], dt: number, t: number, pointer: Point): Fish[] {
  const d = Math.min(Math.max(dt, 0), MAX_DT);
  if (d === 0) return school.slice();
  return school.map((f) => {
    let ax = Math.cos(t * 0.5 + f.phase) * 10;
    let ay = Math.sin(t * 0.7 + f.phase * 1.3) * 8;
    if (f.x < MARGIN) ax += EDGE_PUSH;
    else if (f.x > SEA.w - MARGIN) ax -= EDGE_PUSH;
    if (f.y < MARGIN) ay += EDGE_PUSH;
    else if (f.y > SEA.h - MARGIN) ay -= EDGE_PUSH;
    if (pointer) {
      const dx = f.x - pointer.x;
      const dy = f.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < FLEE_RADIUS) {
        // straight on top of the pointer, away along the fish's own heading
        const [ux, uy] = dist > 0.001 ? [dx / dist, dy / dist] : unit(f.vx, f.vy);
        const push = FLEE_PUSH * (1 - dist / FLEE_RADIUS);
        ax += ux * push;
        ay += uy * push;
      }
    }
    let vx = f.vx + ax * d;
    let vy = f.vy + ay * d;
    // ease the speed back toward cruising once the fright passes
    const speed = Math.hypot(vx, vy);
    if (speed > CRUISE) {
      const eased = Math.max(CRUISE, speed - (speed - CRUISE) * DRAG * d);
      const capped = Math.min(eased, MAX_SPEED);
      vx = (vx / speed) * capped;
      vy = (vy / speed) * capped;
    }
    const x = clamp(f.x + vx * d, 0, SEA.w);
    const y = clamp(f.y + vy * d, 0, SEA.h);
    return { ...f, x, y, vx, vy };
  });
}

function unit(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y);
  return l > 0.001 ? [x / l, y / l] : [1, 0];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// The SVG transform that draws a fish where it is, facing the way it swims (the drawing faces +x).
export function fishTransform(f: Fish): string {
  const angle = (Math.atan2(f.vy, f.vx) * 180) / Math.PI;
  return `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${f.size})`;
}

// A pointer at client coordinates, in the scene's units, given the scene's box on screen. The scene is drawn with
// preserveAspectRatio="xMidYMid slice", so the shorter fit is cropped and the scale is the larger one.
export function toSea(clientX: number, clientY: number, box: { left: number; top: number; width: number; height: number }): Point {
  if (box.width <= 0 || box.height <= 0) return null;
  const scale = Math.max(box.width / SEA.w, box.height / SEA.h);
  const ox = (box.width - SEA.w * scale) / 2;
  const oy = (box.height - SEA.h * scale) / 2;
  return { x: (clientX - box.left - ox) / scale, y: (clientY - box.top - oy) / scale };
}
