// The wheel's geometry. The disc is centred on the pole you can see and turns
// under a frame whose window is the horizon. Frame coordinates have +y down,
// north at the top and east on the left, as when the chart is held overhead.
// In the north a star at hour angle H and polar distance p sits at
// r(sin H, cos H); in the south it is mirrored to r(sin H, -cos H). The disc
// holds the same stars by right ascension, and one rotate() turns it.
import { sunPosition } from "./sun.ts";
import { lstHours, localToUtc, offsetMinutes } from "./time.ts";

const RAD = Math.PI / 180;
const norm = (x: number) => ((x % 360) + 360) % 360;
const r1 = (n: number) => String(Number(n.toFixed(1)));

export type Hemisphere = "north" | "south";
export type Place = { lat: number; lon: number };
export type StarLike = readonly [hip: number, ra: number, dec: number, mag: number, name?: string];
export type Point = { x: number; y: number };

export const hemisphereOf = (lat: number): Hemisphere => (lat >= 0 ? "north" : "south");

/** Altitude and azimuth (from north through east) in degrees. RA and dec in degrees, LST in hours. */
export function altAz(ra: number, dec: number, lat: number, lst: number): { alt: number; az: number } {
  const h = (lst * 15 - ra) * RAD;
  const d = dec * RAD;
  const f = lat * RAD;
  const sinAlt = Math.sin(d) * Math.sin(f) + Math.cos(d) * Math.cos(f) * Math.cos(h);
  const az = Math.atan2(-Math.cos(d) * Math.sin(h), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(h));
  return { alt: Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD, az: norm(az / RAD) };
}

/** Polar distance (degrees) of the farthest star that ever rises. */
const polarLimit = (lat: number) => 180 - Math.abs(lat);

function polarDistance(dec: number, lat: number): number {
  return hemisphereOf(lat) === "north" ? 90 - dec : 90 + dec;
}

/** A point in frame coordinates from an hour angle (degrees) and a radius. */
export function framePoint(hourAngle: number, radius: number, hemisphere: Hemisphere): Point {
  const h = hourAngle * RAD;
  return { x: radius * Math.sin(h), y: (hemisphere === "north" ? 1 : -1) * radius * Math.cos(h) };
}

/** Where a star sits on the unturned disc, radius R at the rim; null when it never rises here. */
export function discPoint(ra: number, dec: number, lat: number, R = 1): Point | null {
  const p = polarDistance(dec, lat);
  if (p > polarLimit(lat)) return null;
  const r = (R * p) / polarLimit(lat);
  const a = ra * RAD;
  return { x: -r * Math.sin(a), y: (hemisphereOf(lat) === "north" ? 1 : -1) * r * Math.cos(a) };
}

/**
 * The angle for the disc's rotate(), degrees in [0, 360): right ascension equal
 * to the LST lies on the meridian. The sky turns counter-clockwise round the
 * north pole (angle falls with time) and clockwise round the south pole.
 */
export function discRotation(lst: number, hemisphere: Hemisphere): number {
  return norm((hemisphere === "north" ? -1 : 1) * lst * 15);
}

/** The altitude-0 circle in frame coordinates, n points starting at azimuth 0. */
export function horizonPoints(lat: number, R = 1, n = 72): Point[] {
  const f = lat * RAD;
  const hemisphere = hemisphereOf(lat);
  return Array.from({ length: n }, (_, i) => {
    const a = ((i * 360) / n) * RAD;
    const dec = Math.asin(Math.cos(f) * Math.cos(a)) / RAD;
    const hourAngle = Math.atan2(-Math.sin(a), -Math.sin(f) * Math.cos(a)) / RAD;
    return framePoint(hourAngle, (R * polarDistance(dec, lat)) / polarLimit(lat), hemisphere);
  });
}

/** The window's rim as a closed SVG path, one decimal. */
export function horizon(lat: number, R = 1): string {
  const pts = horizonPoints(lat, R);
  return pts.map((p, i) => `${i ? "L" : "M"}${r1(p.x)} ${r1(p.y)}`).join("") + "Z";
}

/**
 * The hour angle in degrees, on the frame, where the clock reads `hour` in the
 * city's zone that day: the mean Sun's hour angle then.
 */
export function hourTickAngle(hour: number, city: { lon: number; tz: string }, date: string): number {
  const off = offsetMinutes(city.tz, localToUtc(date, hour, city.tz));
  return (hour - 12) * 15 + city.lon - off / 4;
}

/** The right ascension in degrees of the Sun at local noon on this date: where the date sits on the disc's rim. */
export function dateTickAngle(date: string, tz: string): number {
  return sunPosition(localToUtc(date, 12, tz)).ra;
}

export function visible(star: StarLike, place: Place, ms: number): boolean {
  return altAz(star[1], star[2], place.lat, lstHours(ms, place.lon)).alt > 0;
}

/** Names of the named stars above the horizon, brightest first. */
export function upNow(place: Place, ms: number, stars: readonly StarLike[]): string[] {
  const lst = lstHours(ms, place.lon);
  return stars
    .filter((s) => s[4] && altAz(s[1], s[2], place.lat, lst).alt > 0)
    .sort((a, b) => a[3] - b[3] || a[0] - b[0])
    .map((s) => s[4] as string);
}
