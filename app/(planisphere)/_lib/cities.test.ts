import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES, DEFAULT_CITY, cityBySlug } from "./cities.ts";

const SLUGS = [
  "hcmc", "tokyo", "seoul", "singapore", "bangkok", "mumbai", "dubai", "istanbul", "cairo", "nairobi", "cape-town", "london",
  "paris", "berlin", "madrid", "reykjavik", "new-york", "los-angeles", "mexico-city", "sao-paulo", "buenos-aires", "sydney", "auckland", "honolulu",
];

test("24 cities in the plan's order, Ho Chi Minh City first", () => {
  assert.deepEqual(CITIES.map((c) => c.slug), SLUGS);
  assert.equal(DEFAULT_CITY.slug, "hcmc");
  assert.equal(new Set(SLUGS).size, 24);
});

test("Ho Chi Minh City and Tokyo are pinned", () => {
  const hcmc = cityBySlug("hcmc")!;
  assert.deepEqual([hcmc.lat, hcmc.lon, hcmc.tz], [10.82, 106.63, "Asia/Ho_Chi_Minh"]);
  const tokyo = cityBySlug("tokyo")!;
  assert.deepEqual([tokyo.lat, tokyo.lon, tokyo.tz], [35.68, 139.69, "Asia/Tokyo"]);
  assert.equal(cityBySlug("nope"), undefined);
});

test("coordinates are in range and names are filled in", () => {
  for (const c of CITIES) {
    assert.ok(c.lat >= -90 && c.lat <= 90 && c.lon >= -180 && c.lon <= 180, c.slug);
    assert.ok(c.name.length > 0, c.slug);
    assert.match(c.slug, /^[a-z]+(-[a-z]+)*$/);
  }
});

test("five southern cities, Singapore near the equator, Reykjavik far north", () => {
  assert.equal(CITIES.filter((c) => c.lat < 0).length, 6);
  assert.ok(Math.abs(cityBySlug("singapore")!.lat) < 2);
  assert.ok(cityBySlug("reykjavik")!.lat > 60);
});

test("Intl accepts every tz, and the zone name survives a round trip", () => {
  for (const c of CITIES) {
    const zone = new Intl.DateTimeFormat("en-US", { timeZone: c.tz }).resolvedOptions().timeZone;
    assert.ok(zone.length > 0, c.slug);
  }
});

test("every source is an en.wikipedia.org page", () => {
  for (const c of CITIES) assert.ok(c.source.startsWith("https://en.wikipedia.org/wiki/"), c.slug);
  assert.equal(new Set(CITIES.map((c) => c.source)).size, 24);
});
