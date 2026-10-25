import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SEASONS,
  SOUTHERN_ZONES,
  hemisphereFromZone,
  isSeason,
  monthIn,
  resolveSeason,
  seasonFor,
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

test("every listed southern zone is one Intl knows", () => {
  for (const tz of SOUTHERN_ZONES) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: tz }), tz);
  }
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
