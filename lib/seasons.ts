// The paper almanac: which season the visitor is in. Meteorological seasons,
// whole months (Mar-May spring, Jun-Aug summer, Sep-Nov autumn, Dec-Feb winter),
// flipped for the southern hemisphere. The hemisphere comes from the visitor's
// Intl time zone alone: no geolocation, no network, nothing to ask permission for.
// A zone this list does not know, or none at all, is north.

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];
export type Hemisphere = "north" | "south";

// Whole areas south of the equator.
export const SOUTHERN_PREFIXES = ["Australia/", "America/Argentina/", "Antarctica/"] as const;

// Single zones south of the equator, legacy aliases included. Zones near the
// equator are left north: they have no season worth tinting the paper for.
export const SOUTHERN_ZONES: readonly string[] = [
  "Pacific/Auckland",
  "Pacific/Chatham",
  "Pacific/Norfolk",
  "Pacific/Fiji",
  "Pacific/Tongatapu",
  "Pacific/Apia",
  "Pacific/Noumea",
  "Pacific/Efate",
  "Pacific/Tahiti",
  "Pacific/Rarotonga",
  "Pacific/Easter",
  "NZ",
  "NZ-CHAT",
  "America/Sao_Paulo",
  "America/Bahia",
  "America/Recife",
  "America/Maceio",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Santiago",
  "America/Punta_Arenas",
  "America/Montevideo",
  "America/Asuncion",
  "America/La_Paz",
  "America/Lima",
  "America/Buenos_Aires",
  "America/Catamarca",
  "America/Cordoba",
  "America/Jujuy",
  "America/Mendoza",
  "America/Rosario",
  "Brazil/East",
  "Chile/Continental",
  "Chile/EasterIsland",
  "Atlantic/Stanley",
  "Atlantic/South_Georgia",
  "Africa/Johannesburg",
  "Africa/Maseru",
  "Africa/Mbabane",
  "Africa/Gaborone",
  "Africa/Windhoek",
  "Africa/Maputo",
  "Africa/Harare",
  "Africa/Lusaka",
  "Africa/Blantyre",
  "Africa/Lubumbashi",
  "Indian/Antananarivo",
  "Indian/Mauritius",
  "Indian/Reunion",
  "Indian/Kerguelen",
];

// Northern season by month, 0 = January.
const NORTH: readonly Season[] = [
  "winter", "winter",
  "spring", "spring", "spring",
  "summer", "summer", "summer",
  "autumn", "autumn", "autumn",
  "winter",
];

const OPPOSITE: Record<Season, Season> = { spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" };

export function isSeason(value: unknown): value is Season {
  return typeof value === "string" && (SEASONS as readonly string[]).includes(value);
}

// The month (0-11) of `date` on the wall clock in `tz`; UTC when the zone is
// missing or not one Intl knows.
export function monthIn(date: Date, tz?: string | null): number {
  const zone = tz?.trim();
  if (zone) {
    try {
      const month = new Intl.DateTimeFormat("en-US", { timeZone: zone, month: "numeric" }).format(date);
      return Number(month) - 1;
    } catch {
      // RangeError: an unknown zone. Fall through to UTC.
    }
  }
  return date.getUTCMonth();
}

export function seasonFor(date: Date, hemisphere: Hemisphere, tz?: string | null): Season {
  const north = NORTH[monthIn(date, tz)];
  return hemisphere === "south" ? OPPOSITE[north] : north;
}

export function hemisphereFromZone(tz: string | null | undefined): Hemisphere {
  const zone = tz?.trim() ?? "";
  if (!zone) return "north";
  if (SOUTHERN_PREFIXES.some((p) => zone.startsWith(p))) return "south";
  return SOUTHERN_ZONES.includes(zone) ? "south" : "north";
}

// A valid manual choice (the dial) wins; otherwise the clock in the visitor's zone.
export function resolveSeason(manual: unknown, date: Date, tz: string | null | undefined): Season {
  if (isSeason(manual)) return manual;
  return seasonFor(date, hemisphereFromZone(tz), tz);
}

// The visitor's zone as the browser (or node) reports it; "" when it cannot say.
export function visitorZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}
