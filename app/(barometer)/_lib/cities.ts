// The 24 cities Barometer can read, in the order the picker lists them. The
// page validates ?city= against this list, so user text never reaches the
// feed's URL: only a city's own lat, lon and tz do. Mexico City is on purpose,
// the altitude case for pressure_msl.

export const CITIES = [
  { slug: "hcmc", name: "Ho Chi Minh City", lat: 10.82, lon: 106.63, tz: "Asia/Ho_Chi_Minh" },
  { slug: "hanoi", name: "Hanoi", lat: 21.03, lon: 105.85, tz: "Asia/Ho_Chi_Minh" },
  { slug: "bangkok", name: "Bangkok", lat: 13.76, lon: 100.5, tz: "Asia/Bangkok" },
  { slug: "singapore", name: "Singapore", lat: 1.35, lon: 103.82, tz: "Asia/Singapore" },
  { slug: "tokyo", name: "Tokyo", lat: 35.68, lon: 139.69, tz: "Asia/Tokyo" },
  { slug: "seoul", name: "Seoul", lat: 37.57, lon: 126.98, tz: "Asia/Seoul" },
  { slug: "mumbai", name: "Mumbai", lat: 19.08, lon: 72.88, tz: "Asia/Kolkata" },
  { slug: "dubai", name: "Dubai", lat: 25.2, lon: 55.27, tz: "Asia/Dubai" },
  { slug: "istanbul", name: "Istanbul", lat: 41.01, lon: 28.98, tz: "Europe/Istanbul" },
  { slug: "moscow", name: "Moscow", lat: 55.76, lon: 37.62, tz: "Europe/Moscow" },
  { slug: "berlin", name: "Berlin", lat: 52.52, lon: 13.41, tz: "Europe/Berlin" },
  { slug: "paris", name: "Paris", lat: 48.86, lon: 2.35, tz: "Europe/Paris" },
  { slug: "london", name: "London", lat: 51.51, lon: -0.13, tz: "Europe/London" },
  { slug: "reykjavik", name: "Reykjavik", lat: 64.15, lon: -21.94, tz: "Atlantic/Reykjavik" },
  { slug: "cairo", name: "Cairo", lat: 30.04, lon: 31.24, tz: "Africa/Cairo" },
  { slug: "lagos", name: "Lagos", lat: 6.52, lon: 3.38, tz: "Africa/Lagos" },
  { slug: "nairobi", name: "Nairobi", lat: -1.29, lon: 36.82, tz: "Africa/Nairobi" },
  { slug: "cape-town", name: "Cape Town", lat: -33.93, lon: 18.42, tz: "Africa/Johannesburg" },
  { slug: "new-york", name: "New York", lat: 40.71, lon: -74.01, tz: "America/New_York" },
  { slug: "mexico-city", name: "Mexico City", lat: 19.43, lon: -99.13, tz: "America/Mexico_City" },
  { slug: "los-angeles", name: "Los Angeles", lat: 34.05, lon: -118.24, tz: "America/Los_Angeles" },
  { slug: "sao-paulo", name: "São Paulo", lat: -23.55, lon: -46.63, tz: "America/Sao_Paulo" },
  { slug: "buenos-aires", name: "Buenos Aires", lat: -34.6, lon: -58.38, tz: "America/Argentina/Buenos_Aires" },
  { slug: "sydney", name: "Sydney", lat: -33.87, lon: 151.21, tz: "Australia/Sydney" },
] as const;

export type City = (typeof CITIES)[number];
export type CitySlug = City["slug"];

/** The city for a slug, or undefined: callers fall back to CITIES[0]. */
export function findCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
