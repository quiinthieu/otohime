// The Sun, Meeus ch. 25 low precision (about 0.01 degree), and the ecliptic.
import { J2000, julianDay, lstHours } from "./time.ts";

const RAD = Math.PI / 180;
const norm = (x: number) => ((x % 360) + 360) % 360;

export type Equatorial = { ra: number; dec: number };

/** Obliquity of the ecliptic in degrees for n days from J2000. */
const obliquity = (n: number) => 23.439 - 0.0000004 * n;

export function toEquatorial(lambdaDeg: number, betaDeg: number, n: number): Equatorial {
  const eps = obliquity(n) * RAD;
  const l = lambdaDeg * RAD;
  const b = betaDeg * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(eps) * Math.cos(b) - Math.sin(b) * Math.sin(eps), Math.cos(l) * Math.cos(b));
  const dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l));
  return { ra: norm(ra / RAD), dec: dec / RAD };
}

/** Apparent geocentric RA, Dec and ecliptic longitude of the Sun, degrees. */
export function sunPosition(ms: number): Equatorial & { lambda: number } {
  const n = julianDay(ms) - J2000;
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const lambda = norm(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  return { ...toEquatorial(lambda, 0, n), lambda };
}

export function sunAltitude(place: { lat: number; lon: number }, ms: number): number {
  const { ra, dec } = sunPosition(ms);
  const h = (lstHours(ms, place.lon) * 15 - ra) * RAD;
  const lat = place.lat * RAD;
  const d = dec * RAD;
  return Math.asin(Math.sin(d) * Math.sin(lat) + Math.cos(d) * Math.cos(lat) * Math.cos(h)) / RAD;
}

/** The ecliptic as n points of RA and Dec, evenly spaced in longitude. */
export function eclipticPoints(n = 24, ms = Date.UTC(2000, 0, 1, 12)): Equatorial[] {
  const days = julianDay(ms) - J2000;
  return Array.from({ length: n }, (_, i) => toEquatorial((i * 360) / n, 0, days));
}
