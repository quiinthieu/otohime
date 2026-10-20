import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { findCity } from "./cities.ts";
import { describe, parseReading, type Reading } from "./reading.ts";

// fixtures/hcmc.json was captured once, on 2026-10-20, from
//   https://api.open-meteo.com/v1/forecast?latitude=10.82&longitude=106.63&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation,weather_code&timezone=Asia%2FHo_Chi_Minh
// and re-indented. no-pressure.json is the same with pressure_msl: null,
// error.json is the 400 body for a bad parameter, garbage.json is an array.
// Nothing here calls the feed.
const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

const hcmc = findCity("hcmc")!;

const GOOD: Reading = {
  at: "2026-10-20T17:30",
  temperatureC: 26.9,
  pressureHpa: 1011.2,
  windKmh: 5.3,
  windFromDeg: 336,
  rainMm: 0.1,
  code: 51,
  interval: 900,
};

const feed = (patch: Record<string, unknown>) => ({ current: { time: "2026-10-20T17:30", interval: 900, temperature_2m: 26.9, pressure_msl: 1011.2, wind_speed_10m: 5.3, wind_direction_10m: 336, precipitation: 0.1, weather_code: 51, ...patch } });

test("hcmc.json parses, and the pressure is the fixture's pressure_msl", () => {
  const json = fixture("hcmc") as { current: Record<string, number | string> };
  const r = parseReading(json);
  assert.ok(r);
  assert.equal(r.pressureHpa, json.current.pressure_msl);
  assert.equal(r.at, json.current.time);
  assert.equal(r.temperatureC, json.current.temperature_2m);
  assert.equal(r.windKmh, json.current.wind_speed_10m);
  assert.equal(r.windFromDeg, json.current.wind_direction_10m);
  assert.equal(r.rainMm, json.current.precipitation);
  assert.equal(r.code, json.current.weather_code);
  assert.equal(r.interval, 900);
});

test("the other three fixtures give null", () => {
  for (const name of ["no-pressure", "error", "garbage"]) assert.equal(parseReading(fixture(name)), null, name);
});

test("no-pressure.json differs from hcmc.json only in pressure_msl", () => {
  const a = fixture("hcmc") as { current: Record<string, unknown> };
  const b = fixture("no-pressure") as { current: Record<string, unknown> };
  assert.equal(b.current.pressure_msl, null);
  assert.deepEqual({ ...b.current, pressure_msl: a.current.pressure_msl }, a.current);
});

test("not an object, an array or empty gives null", () => {
  for (const v of [{}, "x", null, undefined, 7, true, [], [GOOD], { current: null }, { current: [] }, { current: "x" }]) {
    assert.equal(parseReading(v), null, JSON.stringify(v));
  }
});

test("error: true gives null even beside a good current", () => {
  assert.equal(parseReading({ ...feed({}), error: true }), null);
  assert.deepEqual(parseReading({ ...feed({}), error: false }), GOOD);
});

test("a well-formed answer parses", () => {
  assert.deepEqual(parseReading(feed({})), GOOD);
});

test("any missing, null, string or non-finite field gives null", () => {
  for (const key of ["time", "interval", "temperature_2m", "pressure_msl", "wind_speed_10m", "wind_direction_10m", "precipitation", "weather_code"]) {
    for (const bad of [undefined, null, "12", NaN, Infinity, -Infinity, {}]) {
      assert.equal(parseReading(feed({ [key]: bad })), null, `${key}=${String(bad)}`);
    }
  }
});

test("the time must be YYYY-MM-DDTHH:MM", () => {
  for (const bad of ["2026-10-20", "2026-10-20 17:30", "2026-10-20T17:30:00", "17:30", "", "2026-10-20T17:30Z"]) {
    assert.equal(parseReading(feed({ time: bad })), null, bad);
  }
});

test("describe: the exact sentence", () => {
  assert.equal(describe(hcmc, GOOD), "Ho Chi Minh City, 17:30 local, 26.9 °C, 1011.2 hPa, drizzle.");
});

test("describe rounds to one decimal and names the weather", () => {
  const tokyo = findCity("tokyo")!;
  assert.equal(describe(tokyo, { ...GOOD, at: "2026-10-20T09:05", temperatureC: 12, pressureHpa: 1000.04, code: 97 }), "Tokyo, 09:05 local, 12.0 °C, 1000.0 hPa, thunder.");
  assert.equal(describe(tokyo, { ...GOOD, code: 4 }), "Tokyo, 17:30 local, 26.9 °C, 1011.2 hPa, unsettled.");
});
