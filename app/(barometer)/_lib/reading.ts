// One reading from Open-Meteo's forecast answer, and the sentence that says
// it. parseReading is pure: anything unexpected is null, because the drawing
// is one instrument and not five.
import type { City } from "./cities.ts";
import { wordFor } from "./codes.ts";

export type Reading = {
  /** local time at the city, YYYY-MM-DDTHH:MM */
  at: string;
  temperatureC: number;
  pressureHpa: number;
  windKmh: number;
  windFromDeg: number;
  rainMm: number;
  code: number;
  /** the feed's own update interval, seconds */
  interval: number;
};

export const AT_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseReading(json: unknown): Reading | null {
  if (!isObject(json) || json.error === true) return null;
  const cur = json.current;
  if (!isObject(cur)) return null;
  const at = cur.time;
  const temperatureC = num(cur.temperature_2m);
  const pressureHpa = num(cur.pressure_msl);
  const windKmh = num(cur.wind_speed_10m);
  const windFromDeg = num(cur.wind_direction_10m);
  const rainMm = num(cur.precipitation);
  const code = num(cur.weather_code);
  const interval = num(cur.interval);
  if (typeof at !== "string" || !AT_FORMAT.test(at)) return null;
  if (
    temperatureC === null ||
    pressureHpa === null ||
    windKmh === null ||
    windFromDeg === null ||
    rainMm === null ||
    code === null ||
    interval === null
  ) {
    return null;
  }
  return { at, temperatureC, pressureHpa, windKmh, windFromDeg, rainMm, code, interval };
}

/** "Ho Chi Minh City, 17:30 local, 26.9 °C, 1011.2 hPa, drizzle." */
export function describe(city: Pick<City, "name">, r: Reading): string {
  return `${city.name}, ${r.at.slice(11, 16)} local, ${r.temperatureC.toFixed(1)} °C, ${r.pressureHpa.toFixed(1)} hPa, ${wordFor(r.code)}.`;
}
