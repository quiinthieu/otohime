// station.ts is never called here (no network in npm test): these read it as
// text, so the fetch rules cannot drift unnoticed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const text = readFileSync(new URL("./station.ts", import.meta.url), "utf8");
const code = text.replace(/^\s*\/\/.*$/gm, "");

test('readStation is a "use cache" function', () => {
  assert.match(code, /export async function readStation\(slug: CitySlug\)/);
  assert.match(code, /^\s*"use cache";$/m);
});

test("two cacheLife calls: 900 s after a good reading, 60 s after a failure", () => {
  const calls = [...code.matchAll(/cacheLife\(\{[^}]*\}\)/g)].map((m) => m[0]);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /revalidate: 900/);
  assert.match(calls[1], /revalidate: 60\b/);
  assert.match(code, /if \(reading\) cacheLife\(/);
  assert.match(code, /else cacheLife\(/);
});

test("a 4 s timeout, on pressure_msl, as JSON", () => {
  assert.match(code, /AbortSignal\.timeout\(4000\)/);
  assert.match(code, /pressure_msl/);
  assert.doesNotMatch(code, /surface_pressure/);
  assert.match(code, /accept: "application\/json"/);
});

test("exactly one network call, to /v1/forecast", () => {
  assert.equal(code.match(/\bfetch\s*\(/g)?.length, 1);
  assert.match(code, /\/v1\/forecast\?/);
});

test("the host: api.open-meteo.com by default, BAROMETER_HOST when it is http(s)", () => {
  assert.match(code, /https:\/\/api\.open-meteo\.com/);
  assert.match(code, /process\.env\.BAROMETER_HOST/);
  assert.match(code, /http:/);
  assert.match(code, /https:/);
  assert.equal(code.match(/process\.env/g)?.length, 1);
});

test("the city's own lat, lon and tz build the URL, never user text", () => {
  assert.match(code, /findCity\(slug\)/);
  assert.match(code, /latitude=\$\{city\.lat\}&longitude=\$\{city\.lon\}/);
  assert.match(code, /encodeURIComponent\(city\.tz\)/);
});

test("its only import from Next is next/cache", () => {
  const specs = [...text.matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(specs.filter((s) => s.startsWith("next")), ["next/cache"]);
});
