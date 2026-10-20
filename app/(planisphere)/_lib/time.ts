// Time for the star wheel: Julian day, sidereal time (Meeus ch. 12) and the
// zone arithmetic that turns a wall-clock date and hour into an instant.
export const DAY_MS = 86_400_000;
export const J2000 = 2_451_545;

const norm = (x: number, m: number) => ((x % m) + m) % m;

export function julianDay(ms: number): number {
  return ms / DAY_MS + 2_440_587.5;
}

/** Greenwich mean sidereal time in hours, [0, 24). Meeus 12.4. */
export function gmstHours(ms: number): number {
  const d = julianDay(ms) - J2000;
  const t = d / 36525;
  const deg = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38_710_000;
  return norm(deg, 360) / 15;
}

/** Local sidereal time in hours for an east longitude in degrees, [0, 24). */
export function lstHours(ms: number, lon: number): number {
  return norm(gmstHours(ms) + lon / 15, 24);
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(tz, f);
  }
  return f;
}

function wallClock(tz: string, ms: number) {
  const v: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") v[p.type] = Number(p.value);
  }
  return v;
}

/** Minutes east of UTC that the zone keeps at this instant. */
export function offsetMinutes(tz: string, ms: number): number {
  const v = wallClock(tz, ms);
  const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

export function isIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2100) return false;
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The instant at which the wall clock in tz reads this date and (decimal) hour. */
export function localToUtc(date: string, hour: number, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d) + Math.round(hour * 3_600_000);
  const first = wall - offsetMinutes(tz, wall) * 60_000;
  return wall - offsetMinutes(tz, first) * 60_000;
}

/** The local calendar date (YYYY-MM-DD) and decimal hour in tz at this instant. */
export function todayIn(tz: string, ms: number): { date: string; hour: number } {
  const v = wallClock(tz, ms);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return {
    date: `${pad(v.year, 4)}-${pad(v.month)}-${pad(v.day)}`,
    hour: v.hour + v.minute / 60 + v.second / 3600,
  };
}
