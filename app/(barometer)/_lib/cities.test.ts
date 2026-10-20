import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES, findCity } from "./cities.ts";

const SLUGS = [
  "hcmc", "hanoi", "bangkok", "singapore", "tokyo", "seoul", "mumbai", "dubai", "istanbul", "moscow", "berlin", "paris",
  "london", "reykjavik", "cairo", "lagos", "nairobi", "cape-town", "new-york", "mexico-city", "los-angeles", "sao-paulo",
  "buenos-aires", "sydney",
];

test("24 cities, in the plan's order, Ho Chi Minh City first", () => {
  assert.equal(CITIES.length, 24);
  assert.deepEqual(CITIES.map((c) => c.slug), SLUGS);
  assert.equal(CITIES[0].name, "Ho Chi Minh City");
});

test("slugs are unique and spelled [a-z-]", () => {
  const slugs = CITIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z-]+$/);
});

test("coordinates are in range and names are unique", () => {
  for (const c of CITIES) {
    assert.ok(Number.isFinite(c.lat) && Math.abs(c.lat) <= 90, c.slug);
    assert.ok(Number.isFinite(c.lon) && Math.abs(c.lon) <= 180, c.slug);
    assert.ok(c.name.length > 0, c.slug);
  }
  assert.equal(new Set(CITIES.map((c) => c.name)).size, 24);
});

test("every tz is accepted by Intl.DateTimeFormat", () => {
  for (const c of CITIES) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en-US", { timeZone: c.tz }), c.slug);
    assert.equal(new Intl.DateTimeFormat("en-US", { timeZone: c.tz }).resolvedOptions().timeZone.length > 0, true);
  }
});

test("the zones the plan names", () => {
  assert.equal(findCity("hanoi")?.tz, "Asia/Ho_Chi_Minh");
  assert.equal(findCity("buenos-aires")?.tz, "America/Argentina/Buenos_Aires");
  assert.equal(findCity("cape-town")?.tz, "Africa/Johannesburg");
});

test("Mexico City is the altitude case", () => {
  assert.deepEqual(findCity("mexico-city"), CITIES[19]);
});

test("findCity validates: unknown, empty and look-alike slugs are undefined", () => {
  assert.equal(findCity("tokyo")?.name, "Tokyo");
  assert.equal(findCity("nope"), undefined);
  assert.equal(findCity(""), undefined);
  assert.equal(findCity("Tokyo"), undefined);
  assert.equal(findCity("tokyo "), undefined);
  assert.equal(findCity("__proto__"), undefined);
  assert.equal(findCity("constructor"), undefined);
});
