// The instruments' geometry: pressure to needle angle, temperature to mercury
// height, wind direction to vane angle, rain to cup level. Angles are degrees
// clockwise from straight up; the dial runs 950 to 1050 hPa over -135 to 135.

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const DIAL_MIN_HPA = 950;
export const DIAL_MAX_HPA = 1050;

export function needleAngle(hpa: number): number {
  return clamp((hpa - 1000) * 2.7, -135, 135);
}

/** The words printed on the dial, each at the pressure where it sits. */
export const DIAL_WORDS = [
  { hpa: 955, word: "Stormy" },
  { hpa: 975, word: "Rain" },
  { hpa: 1000, word: "Change" },
  { hpa: 1025, word: "Fair" },
  { hpa: 1045, word: "Very Dry" },
] as const;

/** The column's height as a fraction of the tube, for -20 to 45 °C. */
export function mercuryHeight(c: number): number {
  return clamp((c + 20) / 65, 0, 1);
}

export function vaneAngle(fromDeg: number): number {
  return ((fromDeg % 360) + 360) % 360;
}

/** The water line as a fraction of the cup, full at 5 mm. */
export function cupLevel(mm: number): number {
  return clamp(mm / 5, 0, 1);
}

/** The station at rest, drawn when the feed has no reading. */
export const QUIET = { needle: -135, mercury: 0, vane: 0, cup: 0 } as const;
