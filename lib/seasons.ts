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

// Single zones south of the equator, legacy aliases included. Hemisphere
// follows the representative latitude in the IANA zone.tab table.
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
  "Africa/Luanda",
  "Pacific/Pago_Pago",
  "Africa/Bujumbura",
  "America/Noronha",
  "America/Belem",
  "America/Fortaleza",
  "America/Araguaina",
  "America/Santarem",
  "America/Porto_Velho",
  "America/Manaus",
  "America/Eirunepe",
  "America/Rio_Branco",
  "Indian/Cocos",
  "Africa/Kinshasa",
  "Africa/Brazzaville",
  "America/Coyhaique",
  "Indian/Christmas",
  "America/Guayaquil",
  "Pacific/Galapagos",
  "Asia/Jakarta",
  "Asia/Pontianak",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Indian/Chagos",
  "Africa/Nairobi",
  "Pacific/Kanton",
  "Indian/Comoro",
  "Pacific/Nauru",
  "Pacific/Niue",
  "Pacific/Marquesas",
  "Pacific/Gambier",
  "Pacific/Port_Moresby",
  "Pacific/Bougainville",
  "Pacific/Pitcairn",
  "Africa/Kigali",
  "Pacific/Guadalcanal",
  "Indian/Mahe",
  "Atlantic/St_Helena",
  "Pacific/Fakaofo",
  "Asia/Dili",
  "Pacific/Funafuti",
  "Africa/Dar_es_Salaam",
  "Pacific/Wallis",
  "Indian/Mayotte",
  "Brazil/West",
  "Brazil/DeNoronha",
  "US/Samoa",
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

// localStorage key for a manual choice (the dial), and the attribute on <html>
// that app/(site)/seasons.css keys its tints on.
export const SEASON_KEY = "season";
export const SEASON_ATTR = "data-season";

// The season of each month, 0 = January, for one hemisphere.
const byMonth = (hemisphere: Hemisphere) =>
  Array.from({ length: 12 }, (_, m) => seasonFor(new Date(Date.UTC(2000, m, 15, 12)), hemisphere));

// resolveSeason as an inline script, for the root layouts' <head>: it pins
// data-season before first paint, so the tints never flash. Built from the
// lists above, so it cannot drift from them; scripts/probe-seasons.mjs and
// lib/seasons.test.ts run it against resolveSeason. Storage that throws
// (blocked, private mode) falls back to the clock.
export const seasonScript =
  `(function(){var s;try{s=localStorage.getItem(${JSON.stringify(SEASON_KEY)})}catch(e){}` +
  `if(${JSON.stringify(SEASONS)}.indexOf(s)<0){var z="",d=new Date(),m=d.getUTCMonth(),i,south;` +
  `try{z=(Intl.DateTimeFormat().resolvedOptions().timeZone||"").trim()}catch(e){}` +
  `if(z)try{m=new Intl.DateTimeFormat("en-US",{timeZone:z,month:"numeric"}).format(d)-1}catch(e){}` +
  `south=${JSON.stringify(SOUTHERN_ZONES)}.indexOf(z)>=0;` +
  `for(i=0;i<${SOUTHERN_PREFIXES.length};i++)if(z.indexOf(${JSON.stringify(SOUTHERN_PREFIXES)}[i])===0)south=true;` +
  `s=(south?${JSON.stringify(byMonth("south"))}:${JSON.stringify(byMonth("north"))})[m]}` +
  `document.documentElement.setAttribute(${JSON.stringify(SEASON_ATTR)},s)})()`;
