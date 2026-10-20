// The one place Barometer talks to the network, and the template for the
// site's live-data pages: a "use cache" function with a cache life matched to
// the feed's 900 s interval (60 s after a failure, so an outage costs one call
// a minute, not one per view), a 4 s timeout, and null for anything that is
// not a good reading. The page draws the quiet face for null.
import { cacheLife } from "next/cache";
import { findCity, type CitySlug } from "./cities.ts";
import { parseReading, type Reading } from "./reading.ts";

const DEFAULT_HOST = "https://api.open-meteo.com";

// BAROMETER_HOST is read once, at module load, and only used if it is an
// http(s) origin: the on-demand proofs point it at a dead port and a slow fake.
function hostFromEnv(raw: string | undefined): string {
  if (!raw) return DEFAULT_HOST;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : DEFAULT_HOST;
  } catch {
    return DEFAULT_HOST;
  }
}

const HOST = hostFromEnv(process.env.BAROMETER_HOST);
const FIELDS = "temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation,weather_code";

export async function readStation(slug: CitySlug): Promise<Reading | null> {
  "use cache";
  const city = findCity(slug);
  let reading: Reading | null = null;
  if (city) {
    const url = `${HOST}/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=${FIELDS}&timezone=${encodeURIComponent(city.tz)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
      reading = res.ok ? parseReading(await res.json()) : null;
    } catch {
      reading = null;
    }
  }
  if (reading) cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  else cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  return reading;
}
