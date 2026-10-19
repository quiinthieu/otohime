// The Bohr-style atom as plain numbers, shared by the 3D viewer and the SVG
// diagram. No three import: positions are {x, y, z} in scene units.
// rings() lays out one orbit per electron shell; nucleus() packs a
// representative cluster of at most `cap` nucleons.

import type { Element } from "./elements.ts";

export type Vec3 = { x: number; y: number; z: number };

export const RING_BASE = 1.2;
export const RING_STEP = 0.55;
export const NUCLEON_RADIUS = 0.16;
export const NUCLEUS_CAP = 64;

const DEG = Math.PI / 180;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export interface Ring {
  index: number;
  radius: number;
  /** radians per second; alternating sign so neighbouring shells counter-rotate */
  speed: number;
  tiltX: number;
  tiltZ: number;
  /** electron angles in the ring's own plane, radians */
  angles: number[];
  electrons: Vec3[];
}

/** Rotate a point in the ring's plane (x-z) by tiltX about x, then tiltZ about z. */
function tilt(p: Vec3, tx: number, tz: number): Vec3 {
  const y1 = p.y * Math.cos(tx) - p.z * Math.sin(tx);
  const z1 = p.y * Math.sin(tx) + p.z * Math.cos(tx);
  return { x: p.x * Math.cos(tz) - y1 * Math.sin(tz), y: p.x * Math.sin(tz) + y1 * Math.cos(tz), z: z1 };
}

/** One ring per entry in `shells`, its electrons evenly spaced and advanced to time `t` seconds. */
export function rings(shells: readonly number[], t = 0): Ring[] {
  return shells.map((count, i) => {
    const radius = RING_BASE + i * RING_STEP;
    const speed = (0.9 / (1 + 0.35 * i)) * (i % 2 === 0 ? 1 : -1);
    const tiltX = i * 9 * DEG;
    const tiltZ = i * 13 * DEG;
    const phase = i * 0.5 + speed * t;
    const angles = Array.from({ length: count }, (_, k) => phase + (2 * Math.PI * k) / count);
    const electrons = angles.map((a) => tilt({ x: radius * Math.cos(a), y: 0, z: radius * Math.sin(a) }, tiltX, tiltZ));
    return { index: i, radius, speed, tiltX, tiltZ, angles, electrons };
  });
}

export type Nucleon = Vec3 & { kind: "proton" | "neutron" };

export interface Nucleus {
  points: Nucleon[];
  /** every point lies within this distance of the centre */
  radius: number;
  protons: number;
  neutrons: number;
  /** the real nucleon count, p + n */
  total: number;
  capped: boolean;
  /** "showing 64 of 294 nucleons" when capped, else null */
  label: string | null;
}

/**
 * A ball of min(cap, p + n) nucleons. When capped, protons and neutrons keep
 * their share (at least one of each when both exist). Points follow a
 * Fibonacci spiral with distance ∝ ∛(i / count), so density is even and the
 * first point is the centre; protons are spread through the ball, not layered.
 */
export function nucleus(protons: number, neutrons: number, cap = NUCLEUS_CAP): Nucleus {
  const total = protons + neutrons;
  const count = Math.min(cap, total);
  let p = total === 0 ? 0 : Math.round((count * protons) / total);
  if (protons > 0 && p === 0) p = 1;
  if (neutrons > 0 && p === count && count > 1) p = count - 1;
  const n = count - p;
  const radius = count === 0 ? 0 : NUCLEON_RADIUS * Math.cbrt(count) * 1.2;
  const points: Nucleon[] = Array.from({ length: count }, (_, i) => {
    const r = radius * Math.cbrt(i / count);
    const y = count === 1 ? 0 : 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const a = i * GOLDEN;
    // Bresenham split: the i-th point is a proton when it crosses the next proton step
    const kind = Math.floor(((i + 1) * p) / count) > Math.floor((i * p) / count) ? "proton" : "neutron";
    return { x: r * ring * Math.cos(a), y: r * y, z: r * ring * Math.sin(a), kind };
  });
  const capped = total > count;
  return {
    points,
    radius,
    protons: p,
    neutrons: n,
    total,
    capped,
    label: capped ? `showing ${count} of ${total} nucleons` : null,
  };
}

/** Neutrons of the most common isotope, near enough: the rounded mass minus the protons. */
export function neutronsOf(el: Pick<Element, "atomic_mass" | "number">): number {
  return Math.round(el.atomic_mass) - el.number;
}

export interface Diagram {
  size: number;
  centre: number;
  rings: { radius: number; electrons: { x: number; y: number }[] }[];
  /** back to front, so later points paint over earlier ones */
  nucleus: { x: number; y: number; r: number; kind: Nucleon["kind"] }[];
}

/**
 * The flat Bohr diagram for an SVG of `size` × `size`: each shell a circle in
 * the screen plane with its electrons at their ring angles, and the nucleus
 * seen from the front. Scaled so the outermost shell fits with a margin.
 */
export function project2d(rs: readonly Ring[], nuc: Nucleus, size: number): Diagram {
  const centre = size / 2;
  const outer = rs.length ? rs[rs.length - 1].radius : RING_BASE;
  const scale = (centre - size * 0.06) / outer;
  return {
    size,
    centre,
    rings: rs.map((ring) => ({
      radius: ring.radius * scale,
      electrons: ring.angles.map((a) => ({
        x: centre + ring.radius * scale * Math.cos(a),
        y: centre - ring.radius * scale * Math.sin(a),
      })),
    })),
    nucleus: [...nuc.points]
      .sort((a, b) => a.z - b.z)
      .map((pt) => ({ x: centre + pt.x * scale, y: centre - pt.y * scale, r: NUCLEON_RADIUS * scale, kind: pt.kind })),
  };
}
