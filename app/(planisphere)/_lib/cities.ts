// The 24 places on the star wheel, in the order the form lists them. Latitudes
// and longitudes are rounded to two decimals; tz is an IANA name.
export type City = { slug: string; name: string; lat: number; lon: number; tz: string; source: string };

const wiki = (page: string) => `https://en.wikipedia.org/wiki/${page}`;

export const CITIES: readonly City[] = [
  { slug: "hcmc", name: "Ho Chi Minh City", lat: 10.82, lon: 106.63, tz: "Asia/Ho_Chi_Minh", source: wiki("Ho_Chi_Minh_City") },
  { slug: "tokyo", name: "Tokyo", lat: 35.68, lon: 139.69, tz: "Asia/Tokyo", source: wiki("Tokyo") },
  { slug: "seoul", name: "Seoul", lat: 37.57, lon: 126.98, tz: "Asia/Seoul", source: wiki("Seoul") },
  { slug: "singapore", name: "Singapore", lat: 1.35, lon: 103.82, tz: "Asia/Singapore", source: wiki("Singapore") },
  { slug: "bangkok", name: "Bangkok", lat: 13.76, lon: 100.5, tz: "Asia/Bangkok", source: wiki("Bangkok") },
  { slug: "mumbai", name: "Mumbai", lat: 19.08, lon: 72.88, tz: "Asia/Kolkata", source: wiki("Mumbai") },
  { slug: "dubai", name: "Dubai", lat: 25.2, lon: 55.27, tz: "Asia/Dubai", source: wiki("Dubai") },
  { slug: "istanbul", name: "Istanbul", lat: 41.01, lon: 28.98, tz: "Europe/Istanbul", source: wiki("Istanbul") },
  { slug: "cairo", name: "Cairo", lat: 30.04, lon: 31.24, tz: "Africa/Cairo", source: wiki("Cairo") },
  { slug: "nairobi", name: "Nairobi", lat: -1.29, lon: 36.82, tz: "Africa/Nairobi", source: wiki("Nairobi") },
  { slug: "cape-town", name: "Cape Town", lat: -33.92, lon: 18.42, tz: "Africa/Johannesburg", source: wiki("Cape_Town") },
  { slug: "london", name: "London", lat: 51.51, lon: -0.13, tz: "Europe/London", source: wiki("London") },
  { slug: "paris", name: "Paris", lat: 48.86, lon: 2.35, tz: "Europe/Paris", source: wiki("Paris") },
  { slug: "berlin", name: "Berlin", lat: 52.52, lon: 13.4, tz: "Europe/Berlin", source: wiki("Berlin") },
  { slug: "madrid", name: "Madrid", lat: 40.42, lon: -3.7, tz: "Europe/Madrid", source: wiki("Madrid") },
  { slug: "reykjavik", name: "Reykjavík", lat: 64.15, lon: -21.94, tz: "Atlantic/Reykjavik", source: wiki("Reykjav%C3%ADk") },
  { slug: "new-york", name: "New York", lat: 40.71, lon: -74.01, tz: "America/New_York", source: wiki("New_York_City") },
  { slug: "los-angeles", name: "Los Angeles", lat: 34.05, lon: -118.24, tz: "America/Los_Angeles", source: wiki("Los_Angeles") },
  { slug: "mexico-city", name: "Mexico City", lat: 19.43, lon: -99.13, tz: "America/Mexico_City", source: wiki("Mexico_City") },
  { slug: "sao-paulo", name: "São Paulo", lat: -23.55, lon: -46.63, tz: "America/Sao_Paulo", source: wiki("S%C3%A3o_Paulo") },
  { slug: "buenos-aires", name: "Buenos Aires", lat: -34.6, lon: -58.38, tz: "America/Argentina/Buenos_Aires", source: wiki("Buenos_Aires") },
  { slug: "sydney", name: "Sydney", lat: -33.87, lon: 151.21, tz: "Australia/Sydney", source: wiki("Sydney") },
  { slug: "auckland", name: "Auckland", lat: -36.85, lon: 174.76, tz: "Pacific/Auckland", source: wiki("Auckland") },
  { slug: "honolulu", name: "Honolulu", lat: 21.31, lon: -157.86, tz: "Pacific/Honolulu", source: wiki("Honolulu") },
];

export const DEFAULT_CITY = CITIES[0];

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
