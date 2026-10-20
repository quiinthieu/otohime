import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, gmstHours, isIsoDate, julianDay, localToUtc, lstHours, offsetMinutes, todayIn } from "./time.ts";

const J2000_MS = Date.UTC(2000, 0, 1, 12);
const near = (a: number, b: number, tol: number, what = "") => assert.ok(Math.abs(a - b) <= tol, `${what} ${a} vs ${b}`);

test("the Julian day of J2000 is 2451545.0", () => {
  assert.equal(julianDay(J2000_MS), 2451545.0);
  assert.equal(julianDay(Date.UTC(1970, 0, 1)), 2440587.5);
});

test("GMST at J2000 is 18.697374558 h", () => {
  near(gmstHours(J2000_MS), 18.697374558, 1e-6, "J2000");
});

test("GMST at 1987-04-10 00:00 UTC is 13.1795463 h (Meeus 12.a)", () => {
  near(gmstHours(Date.UTC(1987, 3, 10)), 13.1795463, 1e-6, "Meeus 12.a");
});

test("LST adds the longitude and stays in [0, 24)", () => {
  near(lstHours(Date.UTC(2026, 9, 20, 12), 139.69), 23.2435, 1e-3, "Tokyo");
  near(lstHours(Date.UTC(2026, 9, 20, 14), 106.63), 23.045, 1e-3, "Ho Chi Minh City");
  for (let i = 0; i < 200; i++) {
    const ms = J2000_MS + i * 7_654_321_000;
    for (const lon of [-180, -75.5, 0, 106.63, 180]) {
      const l = lstHours(ms, lon);
      assert.ok(l >= 0 && l < 24, `${l}`);
    }
  }
});

test("sidereal time runs 3 m 56.6 s fast per day", () => {
  const day = gmstHours(J2000_MS + 86_400_000) - gmstHours(J2000_MS);
  near((day + 24) % 24, 0.0657098, 1e-6, "daily gain");
});

test("local to UTC: 2026-10-20 21:00 Asia/Ho_Chi_Minh is 14:00 UTC", () => {
  assert.equal(localToUtc("2026-10-20", 21, "Asia/Ho_Chi_Minh"), Date.UTC(2026, 9, 20, 14));
  assert.equal(offsetMinutes("Asia/Ho_Chi_Minh", Date.UTC(2026, 9, 20, 14)), 420);
});

test("Sydney is UTC+11 on 2026-10-20, and the offset follows daylight saving", () => {
  assert.equal(offsetMinutes("Australia/Sydney", Date.UTC(2026, 9, 20)), 660);
  assert.equal(offsetMinutes("Australia/Sydney", Date.UTC(2026, 5, 20)), 600);
  assert.equal(offsetMinutes("America/New_York", Date.UTC(2026, 6, 1)), -240);
  assert.equal(offsetMinutes("America/New_York", Date.UTC(2026, 0, 1)), -300);
  assert.equal(localToUtc("2026-10-20", 21, "Australia/Sydney"), Date.UTC(2026, 9, 20, 10));
});

test("localToUtc corrects once across a daylight-saving change", () => {
  // New York springs forward at 02:00 on 2026-03-08; 12:00 that day is EDT (UTC-4).
  assert.equal(localToUtc("2026-03-08", 12, "America/New_York"), Date.UTC(2026, 2, 8, 16));
  assert.equal(localToUtc("2026-03-07", 12, "America/New_York"), Date.UTC(2026, 2, 7, 17));
  assert.equal(localToUtc("2026-11-01", 12, "America/New_York"), Date.UTC(2026, 10, 1, 17));
});

test("half-hour zones and quarter hours", () => {
  assert.equal(offsetMinutes("Asia/Kolkata", Date.UTC(2026, 0, 1)), 330);
  assert.equal(localToUtc("2026-10-20", 21.25, "Asia/Kolkata"), Date.UTC(2026, 9, 20, 15, 45));
});

test("todayIn reads the calendar date and decimal hour in the zone", () => {
  const t = todayIn("Asia/Ho_Chi_Minh", Date.UTC(2026, 9, 20, 14, 30));
  assert.equal(t.date, "2026-10-20");
  near(t.hour, 21.5, 1e-9);
  const next = todayIn("Asia/Tokyo", Date.UTC(2026, 9, 20, 16, 0));
  assert.deepEqual(next, { date: "2026-10-21", hour: 1 });
  assert.equal(todayIn("Pacific/Honolulu", Date.UTC(2026, 0, 1, 5)).date, "2025-12-31");
  assert.equal(todayIn("UTC", Date.UTC(2026, 9, 20, 0, 0)).hour, 0);
});

test("isIsoDate accepts real dates from 1900 to 2100 only", () => {
  for (const ok of ["1900-01-01", "2026-10-20", "2100-12-31", "2024-02-29"]) assert.ok(isIsoDate(ok), ok);
  for (const bad of ["x", "", "2026-13-01", "2026-02-29", "1899-12-31", "2101-01-01", "2026-1-1", "2026-10-20T00:00", "2026-04-31"]) {
    assert.ok(!isIsoDate(bad), bad);
  }
});

test("addDays crosses months and years", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2024-02-28", 2), "2024-03-01");
});
