// The wheel's state: a place, a date and an hour, the actions that change it
// and the URL query that round-trips it. The clock is always passed in.
import { CITIES, DEFAULT_CITY, cityBySlug } from "./cities.ts";
import { addDays, isIsoDate, todayIn } from "./time.ts";

export type Place = { lat: number; lon: number; tz: string };
export type State = {
  /** the city's slug, or null when the place came from "Use my location" */
  city: string | null;
  place: Place;
  /** YYYY-MM-DD, the local calendar date in place.tz */
  date: string;
  /** local decimal hour in quarters, 0 to 23.75 */
  hour: number;
};

export type Action =
  | { type: "city"; slug: string }
  | { type: "date"; date: string }
  | { type: "hour"; hour: number }
  | { type: "turn"; delta: number }
  | { type: "now"; ms: number }
  | { type: "locate"; lat: number; lon: number; tz: string };

export type Query = Record<string, string | string[] | undefined>;

const MAX_HOUR = 23.75;
const quarter = (h: number) => Math.round(h * 4) / 4;
const clampHour = (h: number) => Math.min(MAX_HOUR, Math.max(0, quarter(h)));
const cents = (n: number) => Math.round(n * 100) / 100 + 0;

export function cityPlace(slug: string): Place | null {
  const c = cityBySlug(slug);
  return c ? { lat: c.lat, lon: c.lon, tz: c.tz } : null;
}

const ZONE_NAME = /^[A-Za-z0-9_+\-:/]{1,64}$/;

/** True when Intl takes the zone name; the spelling is kept as given. */
export function isZone(tz: string): boolean {
  if (!ZONE_NAME.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function validPlace(lat: number, lon: number, tz: string): Place | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return isZone(tz) ? { lat: cents(lat), lon: cents(lon), tz } : null;
}

export function placeName(state: State): string {
  return (state.city && cityBySlug(state.city)?.name) || "Your location";
}

export function nowIn(place: Place, ms: number): { date: string; hour: number } {
  const t = todayIn(place.tz, ms);
  return { date: t.date, hour: Math.min(MAX_HOUR, Math.floor(t.hour * 4) / 4) };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "city": {
      const place = cityPlace(action.slug);
      return place ? { ...state, city: action.slug, place } : state;
    }
    case "date":
      return isIsoDate(action.date) ? { ...state, date: action.date } : state;
    case "hour":
      return Number.isFinite(action.hour) ? { ...state, hour: clampHour(action.hour) } : state;
    case "turn": {
      if (!Number.isFinite(action.delta)) return state;
      const total = quarter(state.hour + action.delta);
      const days = Math.floor(total / 24);
      const date = addDays(state.date, days);
      if (!isIsoDate(date)) return state;
      return { ...state, date, hour: total - days * 24 };
    }
    case "now":
      return { ...state, ...nowIn(state.place, action.ms) };
    case "locate": {
      const place = validPlace(action.lat, action.lon, action.tz);
      return place ? { ...state, city: null, place } : state;
    }
  }
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const NUMBER = /^-?\d+(?:\.\d+)?$/;
const num = (v: string | undefined) => (v !== undefined && NUMBER.test(v) ? Number(v) : NaN);

/** Each field falls back to its default on its own; nothing here throws. */
export function parseQuery(query: Query, nowMs: number): State {
  let city: string | null = null;
  let place: Place | null = null;

  const lat = first(query.lat);
  const lon = first(query.lon);
  const tz = first(query.tz);
  if (lat !== undefined && lon !== undefined && tz !== undefined) place = validPlace(num(lat), num(lon), tz);

  if (!place) {
    const slug = first(query.city);
    const known = slug !== undefined ? cityPlace(slug) : null;
    city = known ? slug! : DEFAULT_CITY.slug;
    place = known ?? cityPlace(DEFAULT_CITY.slug)!;
  }

  const now = nowIn(place, nowMs);
  const date = first(query.date);
  const hourText = first(query.hour);
  const hour = num(hourText);
  return {
    city,
    place,
    date: date !== undefined && isIsoDate(date) ? date : now.date,
    hour: hour >= 0 && hour <= MAX_HOUR ? quarter(hour) : now.hour,
  };
}

const zoneParam = (tz: string) => encodeURIComponent(tz).replace(/%2F/g, "/");

/** The canonical query string, without the leading "?". */
export function toQuery(state: State): string {
  const where = state.city
    ? `city=${state.city}`
    : `lat=${state.place.lat}&lon=${state.place.lon}&tz=${zoneParam(state.place.tz)}`;
  return `${where}&date=${state.date}&hour=${state.hour}`;
}

export const CITY_SLUGS: readonly string[] = CITIES.map((c) => c.slug);
