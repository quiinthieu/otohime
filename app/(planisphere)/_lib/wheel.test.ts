import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES } from "./cities.ts";
import { localToUtc } from "./time.ts";
import { parseQuery, placeName, reducer, toQuery, type State } from "./wheel.ts";

const NOW = Date.UTC(2026, 9, 20, 14, 7); // 21:07 in Ho Chi Minh City
const HCMC: State = {
  city: "hcmc",
  place: { lat: 10.82, lon: 106.63, tz: "Asia/Ho_Chi_Minh" },
  date: "2026-10-20",
  hour: 21,
};

test("the default state is Ho Chi Minh City, today and now in its zone", () => {
  assert.deepEqual(parseQuery({}, NOW), HCMC);
});

test("city: a known slug switches the place, an unknown one changes nothing", () => {
  const tokyo = reducer(HCMC, { type: "city", slug: "tokyo" });
  assert.equal(tokyo.city, "tokyo");
  assert.deepEqual(tokyo.place, { lat: 35.68, lon: 139.69, tz: "Asia/Tokyo" });
  assert.equal(tokyo.date, HCMC.date);
  assert.equal(tokyo.hour, HCMC.hour);
  assert.equal(reducer(HCMC, { type: "city", slug: "nope" }), HCMC);
});

test("date: a real calendar date is taken, anything else is ignored", () => {
  assert.equal(reducer(HCMC, { type: "date", date: "2026-12-15" }).date, "2026-12-15");
  for (const bad of ["x", "2026-02-30", "1899-01-01", "2101-01-01", ""]) assert.equal(reducer(HCMC, { type: "date", date: bad }), HCMC, bad);
});

test("hour: clamped to 0-23.75 and rounded to a quarter", () => {
  assert.equal(reducer(HCMC, { type: "hour", hour: 99 }).hour, 23.75);
  assert.equal(reducer(HCMC, { type: "hour", hour: -3 }).hour, 0);
  assert.equal(reducer(HCMC, { type: "hour", hour: 6.1 }).hour, 6);
  assert.equal(reducer(HCMC, { type: "hour", hour: 6.2 }).hour, 6.25);
  assert.equal(reducer(HCMC, { type: "hour", hour: 23.9 }).hour, 23.75);
  assert.equal(reducer(HCMC, { type: "hour", hour: Number.NaN }), HCMC);
});

test("turn(+3) from 22:00 lands on 01:00 the next day", () => {
  const s = reducer({ ...HCMC, hour: 22 }, { type: "turn", delta: 3 });
  assert.equal(s.hour, 1);
  assert.equal(s.date, "2026-10-21");
});

test("turn crosses midnight both ways and by quarters", () => {
  assert.deepEqual(
    (({ date, hour }) => ({ date, hour }))(reducer({ ...HCMC, hour: 23.75 }, { type: "turn", delta: 0.25 })),
    { date: "2026-10-21", hour: 0 },
  );
  assert.deepEqual(
    (({ date, hour }) => ({ date, hour }))(reducer({ ...HCMC, hour: 0 }, { type: "turn", delta: -0.25 })),
    { date: "2026-10-19", hour: 23.75 },
  );
  assert.equal(reducer({ ...HCMC, hour: 5 }, { type: "turn", delta: 1.5 }).hour, 6.5);
  const far = reducer({ ...HCMC, hour: 5 }, { type: "turn", delta: 50 });
  assert.deepEqual([far.date, far.hour], ["2026-10-22", 7]);
  assert.equal(reducer({ ...HCMC, date: "2100-12-31", hour: 23.75 }, { type: "turn", delta: 0.25 }).date, "2100-12-31");
});

test("now(ms) takes the date and hour in the place's zone, floored to a quarter", () => {
  const tokyo = reducer(HCMC, { type: "city", slug: "tokyo" });
  const s = reducer(tokyo, { type: "now", ms: Date.UTC(2026, 9, 20, 16, 7) });
  assert.deepEqual([s.date, s.hour], ["2026-10-21", 1]);
  const late = reducer(HCMC, { type: "now", ms: Date.UTC(2026, 9, 20, 16, 59) });
  assert.deepEqual([late.date, late.hour], ["2026-10-20", 23.75]);
  assert.equal(late.city, "hcmc");
});

test("locate(lat, lon, tz) sets a place of its own, to two decimals", () => {
  const s = reducer(HCMC, { type: "locate", lat: -33.8688, lon: 151.2093, tz: "Australia/Sydney" });
  assert.equal(s.city, null);
  assert.deepEqual(s.place, { lat: -33.87, lon: 151.21, tz: "Australia/Sydney" });
  assert.equal(placeName(s), "Your location");
  assert.equal(placeName(HCMC), "Ho Chi Minh City");
  for (const bad of [
    { lat: 91, lon: 0, tz: "UTC" },
    { lat: 0, lon: 181, tz: "UTC" },
    { lat: Number.NaN, lon: 0, tz: "UTC" },
    { lat: 0, lon: 0, tz: "Not/AZone" },
  ]) assert.equal(reducer(HCMC, { type: "locate", ...bad }), HCMC);
});

test("toQuery is canonical", () => {
  assert.equal(toQuery(HCMC), "city=hcmc&date=2026-10-20&hour=21");
  const here = reducer(HCMC, { type: "locate", lat: 10.82, lon: 106.63, tz: "Asia/Ho_Chi_Minh" });
  assert.equal(toQuery(here), "lat=10.82&lon=106.63&tz=Asia/Ho_Chi_Minh&date=2026-10-20&hour=21");
});

test("each field falls back on its own", () => {
  const tokyo = parseQuery({ city: "tokyo", date: "x", hour: "99" }, NOW);
  assert.equal(tokyo.city, "tokyo");
  assert.deepEqual([tokyo.date, tokyo.hour], ["2026-10-20", 23]);
  assert.equal(parseQuery({ city: "nope", date: "2026-12-15", hour: "6.5" }, NOW).city, "hcmc");
  assert.deepEqual(
    (({ city, date, hour }) => ({ city, date, hour }))(parseQuery({ city: "nope", date: "2026-12-15", hour: "6.5" }, NOW)),
    { city: "hcmc", date: "2026-12-15", hour: 6.5 },
  );
  assert.equal(parseQuery({ city: "sydney", date: "2026-02-30", hour: "9" }, NOW).hour, 9);
  assert.equal(parseQuery({ city: "sydney", hour: "abc" }, NOW).hour, 1);
  assert.equal(parseQuery({ hour: "6.1" }, NOW).hour, 6);
  assert.equal(parseQuery({ hour: "" }, NOW).hour, 21);
  assert.equal(parseQuery({ hour: "-1" }, NOW).hour, 21);
  assert.equal(parseQuery({ hour: "23.75" }, NOW).hour, 23.75);
  assert.equal(parseQuery({ hour: "23.9" }, NOW).hour, 21);
});

test("?city=nope&date=x&hour=99 gives hcmc with today and now", () => {
  assert.deepEqual(parseQuery({ city: "nope", date: "x", hour: "99" }, NOW), HCMC);
});

test("arrays take their first value; missing values are fine", () => {
  assert.equal(parseQuery({ city: ["tokyo", "paris"] }, NOW).city, "tokyo");
  assert.equal(parseQuery({ city: undefined, date: undefined }, NOW).city, "hcmc");
});

test("lat, lon and tz override the city only when all three are valid", () => {
  const ok = parseQuery({ city: "tokyo", lat: "-33.87", lon: "151.21", tz: "Australia/Sydney", date: "2026-10-20", hour: "21" }, NOW);
  assert.equal(ok.city, null);
  assert.deepEqual(ok.place, { lat: -33.87, lon: 151.21, tz: "Australia/Sydney" });
  for (const q of [
    { lat: "-33.87", lon: "151.21" },
    { lat: "-33.87", lon: "151.21", tz: "Mars/Olympus" },
    { lat: "91", lon: "151.21", tz: "Australia/Sydney" },
    { lat: "x", lon: "151.21", tz: "Australia/Sydney" },
    { lat: "-33.87", lon: "181", tz: "Australia/Sydney" },
  ]) {
    const s = parseQuery({ city: "tokyo", ...q }, NOW);
    assert.equal(s.city, "tokyo", JSON.stringify(q));
    assert.equal(s.place.tz, "Asia/Tokyo");
  }
  assert.equal(parseQuery({ lat: "1", lon: "2", tz: "bogus" }, NOW).city, "hcmc");
});

test("the default date and hour follow the chosen place's zone", () => {
  const sydney = parseQuery({ city: "sydney" }, NOW);
  assert.deepEqual([sydney.date, sydney.hour], ["2026-10-21", 1]);
});

// A small seeded generator, so the round trip is the same every run.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("parseQuery(toQuery(s)) round-trips for 500 seeded states", () => {
  const rnd = mulberry32(203);
  const zones = ["Asia/Tokyo", "America/Argentina/Buenos_Aires", "UTC", "Pacific/Auckland", "Asia/Kolkata", "Etc/GMT+5"];
  let state = HCMC;
  let located = 0;
  for (let i = 0; i < 500; i++) {
    const pick = rnd();
    if (pick < 0.3) state = reducer(state, { type: "city", slug: CITIES[Math.floor(rnd() * CITIES.length)].slug });
    else if (pick < 0.45) {
      state = reducer(state, { type: "locate", lat: rnd() * 180 - 90, lon: rnd() * 360 - 180, tz: zones[Math.floor(rnd() * zones.length)] });
      located++;
    } else if (pick < 0.6) state = reducer(state, { type: "date", date: new Date(Date.UTC(1900, 0, 1) + rnd() * 73_000 * 86_400_000).toISOString().slice(0, 10) });
    else if (pick < 0.8) state = reducer(state, { type: "hour", hour: rnd() * 30 - 3 });
    else state = reducer(state, { type: "turn", delta: rnd() * 60 - 30 });
    const q = toQuery(state);
    assert.deepEqual(parseQuery(Object.fromEntries(new URLSearchParams(q)), NOW), state, q);
    assert.equal(toQuery(parseQuery(Object.fromEntries(new URLSearchParams(q)), NOW)), q);
  }
  assert.ok(located > 30);
});

test("zero is never negative zero in a located place", () => {
  const s = reducer(HCMC, { type: "locate", lat: -0.001, lon: -0.004, tz: "UTC" });
  assert.ok(Object.is(s.place.lat, 0) && Object.is(s.place.lon, 0));
  assert.equal(toQuery(s), "lat=0&lon=0&tz=UTC&date=2026-10-20&hour=21");
});

test("a state's date and hour name an instant in its own zone", () => {
  const ms = localToUtc(HCMC.date, HCMC.hour, HCMC.place.tz);
  assert.equal(ms, Date.UTC(2026, 9, 20, 14));
});
