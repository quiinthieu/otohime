import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SEASON_ATTR,
  SEASONS,
  SOUTHERN_PREFIXES,
  SOUTHERN_ZONES,
  hemisphereFromZone,
  isSeason,
  monthIn,
  resolveSeason,
  seasonFor,
  seasonScript,
  type Season,
} from "./seasons.ts";

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);

test("every month boundary falls on the 1st, meteorologically", () => {
  const cases: [string, string, Season][] = [
    ["2026-02-28", "2026-03-01", "spring"],
    ["2026-05-31", "2026-06-01", "summer"],
    ["2026-08-31", "2026-09-01", "autumn"],
    ["2026-11-30", "2026-12-01", "winter"],
  ];
  for (const [last, first, season] of cases) {
    assert.notEqual(seasonFor(utc(last), "north"), season, `${last} is still the season before`);
    assert.equal(seasonFor(utc(first), "north"), season, first);
  }
  // Midnight on the dot belongs to the new month.
  assert.equal(seasonFor(new Date("2026-03-01T00:00:00Z"), "north"), "spring");
  assert.equal(seasonFor(new Date("2026-02-28T23:59:59.999Z"), "north"), "winter");
  // Winter runs over the new year.
  assert.equal(seasonFor(utc("2026-12-31"), "north"), "winter");
  assert.equal(seasonFor(utc("2027-01-01"), "north"), "winter");
});

test("all twelve months map north", () => {
  const north: Season[] = [];
  for (let m = 0; m < 12; m++) north.push(seasonFor(new Date(Date.UTC(2026, m, 15)), "north"));
  assert.deepEqual(north, [
    "winter", "winter", "spring", "spring", "spring", "summer",
    "summer", "summer", "autumn", "autumn", "autumn", "winter",
  ]);
});

test("leap-year February is winter to its last day, south summer", () => {
  for (const year of [2024, 2028, 2000]) {
    assert.equal(seasonFor(utc(`${year}-02-29`), "north"), "winter", `${year}-02-29 north`);
    assert.equal(seasonFor(utc(`${year}-02-29`), "south"), "summer", `${year}-02-29 south`);
    assert.equal(seasonFor(utc(`${year}-03-01`), "north"), "spring", `${year}-03-01 north`);
    assert.equal(seasonFor(utc(`${year}-03-01`), "south"), "autumn", `${year}-03-01 south`);
  }
  // 2100 is not a leap year: Feb 29 rolls into March.
  assert.equal(seasonFor(new Date(Date.UTC(2100, 1, 29)), "north"), "spring");
});

test("the south flips every season", () => {
  const flip: Record<Season, Season> = { spring: "autumn", summer: "winter", autumn: "spring", winter: "summer" };
  for (let m = 0; m < 12; m++) {
    const d = new Date(Date.UTC(2026, m, 10));
    assert.equal(seasonFor(d, "south"), flip[seasonFor(d, "north")], `month ${m + 1}`);
  }
  assert.equal(seasonFor(utc("2026-01-15"), "south"), "summer");
  assert.equal(seasonFor(utc("2026-07-15"), "south"), "winter");
});

test("southern zones are south", () => {
  for (const tz of [
    "Australia/Sydney",
    "Australia/Perth",
    "Australia/Hobart",
    "Pacific/Auckland",
    "America/Sao_Paulo",
    "America/Santiago",
    "America/Argentina/Buenos_Aires",
    "America/Argentina/Ushuaia",
    "Africa/Johannesburg",
    "Antarctica/McMurdo",
    " Australia/Melbourne ",
  ]) {
    assert.equal(hemisphereFromZone(tz), "south", tz);
  }
  for (const tz of SOUTHERN_ZONES) assert.equal(hemisphereFromZone(tz), "south", tz);
});

test("northern, unknown and empty zones default north", () => {
  for (const tz of [
    "Europe/London",
    "America/New_York",
    "Asia/Tokyo",
    "UTC",
    "Etc/GMT+3",
    "Africa/Cairo",
    "America/Argentin",
    "australia/sydney",
    "Mars/Olympus_Mons",
    "",
    "   ",
    null,
    undefined,
  ]) {
    assert.equal(hemisphereFromZone(tz), "north", String(tz));
  }
});

test("listed southern zones are known to Intl, accounting for the tzdb 2025b addition", () => {
  const tzdb = process.versions.tz;
  for (const tz of SOUTHERN_ZONES) {
    // Node 22.x includes releases with tzdb 2024b. Coyhaique was added in
    // 2025b: https://data.iana.org/time-zones/tzdb-2025b/NEWS
    // Keep its hemisphere support without requiring a newer host database.
    if (tz === "America/Coyhaique" && tzdb !== undefined && tzdb < "2025b") {
      assert.equal(hemisphereFromZone(tz), "south", tz);
      continue;
    }
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: tz }), tz);
  }
});

test("a host missing Coyhaique uses the UTC month while keeping the southern season", (t) => {
  const DateTimeFormat = Intl.DateTimeFormat;
  t.mock.method(Intl, "DateTimeFormat", function (...args: Parameters<typeof Intl.DateTimeFormat>) {
    if (args[1]?.timeZone === "America/Coyhaique") throw new RangeError("Zone absent from host tzdb");
    return new DateTimeFormat(...args);
  });
  // At this instant UTC has crossed into March, while Chile is still in February.
  const now = new Date("2026-03-01T00:30:00Z");
  assert.equal(monthIn(now, "America/Coyhaique"), 2);
  assert.equal(resolveSeason(null, now, "America/Coyhaique"), "autumn");
  assert.equal(runScript(seasonScript, now, "America/Coyhaique", null), "autumn");
  // Negative controls: other zones still use their own clock and hemisphere.
  assert.equal(monthIn(now, "America/Santiago"), 1);
  assert.equal(resolveSeason(null, now, "America/Santiago"), "summer");
  assert.equal(resolveSeason(null, now, "Mars/Olympus_Mons"), "spring");
});

test("the month is read on the visitor's wall clock", () => {
  // 31 May 14:00 UTC is already 1 June in Sydney (UTC+10).
  const d = new Date("2026-05-31T14:00:00Z");
  assert.equal(monthIn(d, "Australia/Sydney"), 5);
  assert.equal(monthIn(d), 4);
  assert.equal(resolveSeason(null, d, "Australia/Sydney"), "winter");
  // And 1 March 02:00 UTC is still February in New York.
  const ny = new Date("2026-03-01T02:00:00Z");
  assert.equal(resolveSeason(null, ny, "America/New_York"), "winter");
  assert.equal(resolveSeason(null, ny, "Europe/London"), "spring");
  // An unknown zone reads the month in UTC rather than throwing.
  assert.equal(monthIn(d, "Mars/Olympus_Mons"), 4);
  assert.equal(resolveSeason(null, d, "Mars/Olympus_Mons"), "spring");
});

test("a valid manual season wins over the clock", () => {
  const sydneyJanuary = utc("2026-01-15");
  assert.equal(resolveSeason(null, sydneyJanuary, "Australia/Sydney"), "summer");
  for (const s of SEASONS) {
    assert.equal(resolveSeason(s, sydneyJanuary, "Australia/Sydney"), s);
    assert.equal(resolveSeason(s, sydneyJanuary, ""), s);
  }
});

test("an invalid manual value falls back to the clock", () => {
  const d = utc("2026-07-01");
  for (const bad of [null, undefined, "", "Summer", "fall", "auto", " winter", 3, {}, ["spring"]]) {
    assert.equal(resolveSeason(bad, d, "Europe/Berlin"), "summer", JSON.stringify(bad));
    assert.equal(resolveSeason(bad, d, "Australia/Sydney"), "winter", JSON.stringify(bad));
  }
  assert.equal(isSeason("autumn"), true);
  assert.equal(isSeason("fall"), false);
});

// The layouts' inline script, run with a fixed clock, a reported zone and a stored value in place of the
// browser's. It returns the attribute it set on <html>.
function runScript(script: string, now: Date, zone: string | undefined, stored: string | null | Error): string | undefined {
  const attrs: Record<string, string> = {};
  const document = { documentElement: { setAttribute: (k: string, v: string) => void (attrs[k] = v) } };
  const localStorage = {
    getItem: () => {
      if (stored instanceof Error) throw stored;
      return stored;
    },
  };
  const FixedDate = class extends Date {
    constructor() {
      super(now.getTime());
    }
  };
  // Intl.DateTimeFormat() reports the zone; with options it is the real formatter. A function, not an arrow, so
  // the script can call it with new.
  function DateTimeFormat(locale?: string, options?: Intl.DateTimeFormatOptions) {
    return options ? new Intl.DateTimeFormat(locale, options) : { resolvedOptions: () => ({ timeZone: zone }) };
  }
  new Function("document", "localStorage", "Date", "Intl", script)(document, localStorage, FixedDate, { DateTimeFormat });
  return attrs[SEASON_ATTR];
}

const ZONES = [
  ...SOUTHERN_ZONES,
  ...SOUTHERN_PREFIXES.map((p) => `${p}X`),
  "Australia/Sydney",
  "America/Argentina/Ushuaia",
  "Europe/London",
  "America/New_York",
  "Asia/Tokyo",
  "Pacific/Honolulu",
  "Asia/Kolkata",
  "Not/AZone",
  " Australia/Perth ",
  "",
  undefined,
];
// Around each month's turn and the 15th, where the zone's wall clock and UTC can disagree on the month.
const CLOCKS = Array.from({ length: 12 }, (_, m) => [
  new Date(Date.UTC(2026, m, 1, 0, 30)),
  new Date(Date.UTC(2026, m, 15, 12)),
  new Date(Date.UTC(2026, m + 1, 0, 23, 30)),
]).flat();

test("the pre-paint script picks what resolveSeason picks, for every zone, month and stored value", () => {
  let runs = 0;
  for (const now of CLOCKS) {
    for (const zone of ZONES) {
      for (const stored of [null, "", "monsoon", "Summer", ...SEASONS]) {
        assert.equal(runScript(seasonScript, now, zone, stored), resolveSeason(stored, now, zone), `${now.toISOString()} ${zone} ${stored}`);
        runs++;
      }
    }
  }
  assert.ok(runs > 10_000, String(runs));
});

test("storage that throws falls back to the clock", () => {
  const now = new Date("2026-01-15T12:00:00Z");
  assert.equal(runScript(seasonScript, now, "Australia/Sydney", new Error("SecurityError")), "summer");
  assert.equal(runScript(seasonScript, now, "Europe/London", new Error("SecurityError")), "winter");
});

test("the comparison catches a script that forgets the south", () => {
  // Negative control: the same script with the hemisphere flag stuck on north disagrees in Sydney.
  const north = seasonScript.replace(/south=[^;]+;/, "south=false;").replace(/south=true/, "south=false");
  assert.notEqual(north, seasonScript);
  const now = new Date("2026-01-15T12:00:00Z");
  assert.equal(runScript(north, now, "Australia/Sydney", null), "winter");
  assert.notEqual(runScript(north, now, "Australia/Sydney", null), resolveSeason(null, now, "Australia/Sydney"));
});

test("southern time zones and browser aliases use the southern season", () => {
  for (const zone of ["America/Coyhaique", "Pacific/Pitcairn", "Asia/Jakarta", "Brazil/West", "Africa/Luanda"]) {
    assert.equal(hemisphereFromZone(zone), "south", zone);
    assert.equal(resolveSeason("auto", utc("2026-01-15"), zone), "summer", zone);
  }
});
