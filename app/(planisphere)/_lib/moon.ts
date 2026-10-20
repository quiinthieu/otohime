// The Moon: the Astronomical Almanac's low-precision longitude and latitude
// series (seven and four terms), its phase against the Sun, and the lit part
// of its disc as SVG path data.
import { sunPosition, toEquatorial, type Equatorial } from "./sun.ts";
import { J2000, julianDay } from "./time.ts";

const RAD = Math.PI / 180;
const SYNODIC_DAYS = 29.530588853;
const norm = (x: number) => ((x % 360) + 360) % 360;
const sin = (deg: number) => Math.sin(deg * RAD);

export type MoonPosition = Equatorial & { lambda: number; beta: number };

export function moonPosition(ms: number): MoonPosition {
  const n = julianDay(ms) - J2000;
  const t = n / 36525;
  const lambda = norm(
    218.32 +
      481267.881 * t +
      6.29 * sin(135.0 + 477198.87 * t) -
      1.27 * sin(259.3 - 413335.36 * t) +
      0.66 * sin(235.7 + 890534.22 * t) +
      0.21 * sin(269.9 + 954397.7 * t) -
      0.19 * sin(357.5 + 35999.05 * t) -
      0.11 * sin(186.5 + 966404.03 * t),
  );
  const beta =
    5.13 * sin(93.3 + 483202.02 * t) +
    0.28 * sin(228.2 + 960400.89 * t) -
    0.28 * sin(318.3 + 6003.15 * t) -
    0.17 * sin(217.6 - 407332.21 * t);
  return { lambda, beta, ...toEquatorial(lambda, beta, n) };
}

/** Moon minus Sun in ecliptic longitude, degrees [0, 360): 0 new, 90 first quarter, 180 full, 270 last quarter. */
export function phase(ms: number): number {
  return norm(moonPosition(ms).lambda - sunPosition(ms).lambda);
}

export function illuminated(phaseDeg: number): number {
  return (1 - Math.cos(phaseDeg * RAD)) / 2;
}

/** Days since the new moon, on the mean month. */
export function age(phaseDeg: number): number {
  return (norm(phaseDeg) / 360) * SYNODIC_DAYS;
}

const KEY_PHASES = [
  { at: 0, name: "new moon" },
  { at: 90, name: "first quarter" },
  { at: 180, name: "full moon" },
  { at: 270, name: "last quarter" },
  { at: 360, name: "new moon" },
] as const;
const COUNT_WORDS = ["zero", "one", "two", "three", "four"];

/** "about two days past first quarter": the nearest of the four key phases. */
export function phaseWords(phaseDeg: number): string {
  const p = norm(phaseDeg);
  const key = KEY_PHASES.reduce((best, k) => (Math.abs(p - k.at) < Math.abs(p - best.at) ? k : best));
  const delta = p - key.at;
  const days = Math.round((Math.abs(delta) / 360) * SYNODIC_DAYS);
  if (days === 0) return `at ${key.name}`;
  return `about ${COUNT_WORDS[days]} ${days === 1 ? "day" : "days"} ${delta > 0 ? "past" : "before"} ${key.name}`;
}

const f2 = (n: number) => String(Number(n.toFixed(2)));

/**
 * The lit part of a disc of radius r centred on the origin, as an SVG path:
 * waxing phases are lit on the right, waning on the left. "" at new moon.
 */
export function litPath(phaseDeg: number, r: number): string {
  const p = norm(phaseDeg);
  const lit = illuminated(p);
  if (lit < 0.005) return "";
  if (lit > 0.995) return `M0 ${f2(-r)}A${f2(r)} ${f2(r)} 0 1 1 0 ${f2(r)}A${f2(r)} ${f2(r)} 0 1 1 0 ${f2(-r)}Z`;
  const waxing = p < 180;
  const crescent = Math.cos(p * RAD) > 0;
  const rx = Math.abs(Math.cos(p * RAD)) * r;
  const limb = waxing ? 1 : 0;
  // The terminator bulges toward the lit side in a crescent and away from it in a gibbous phase.
  const terminator = waxing === crescent ? 0 : 1;
  return `M0 ${f2(-r)}A${f2(r)} ${f2(r)} 0 0 ${limb} 0 ${f2(r)}A${f2(rx)} ${f2(r)} 0 0 ${terminator} 0 ${f2(-r)}Z`;
}
