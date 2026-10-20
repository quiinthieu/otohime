import assert from "node:assert/strict";
import { test } from "node:test";
import { eclipticPoints, sunAltitude, sunPosition, toEquatorial } from "./sun.ts";
import { localToUtc } from "./time.ts";

const near = (a: number, b: number, tol: number, what = "") => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test("Sun, 2026-10-20 14:00 UTC: RA 205.24, Dec -10.47", () => {
  const s = sunPosition(Date.UTC(2026, 9, 20, 14));
  near(s.ra, 205.24, 0.5, "RA");
  near(s.dec, -10.47, 0.5, "Dec");
});

test("Sun at the 2026 equinox, 2026-03-20 14:46 UTC: RA 0.005, Dec 0.002", () => {
  const s = sunPosition(Date.UTC(2026, 2, 20, 14, 46));
  near(Math.min(s.ra, 360 - s.ra), 0.005, 0.5, "RA");
  near(s.dec, 0.002, 0.5, "Dec");
});

test("Sun at the solstices: Dec +-23.44", () => {
  near(sunPosition(Date.UTC(2026, 5, 21, 8, 24)).dec, 23.44, 0.1);
  near(sunPosition(Date.UTC(2026, 11, 21, 20, 50)).dec, -23.44, 0.1);
  near(sunPosition(Date.UTC(2026, 5, 21, 8, 24)).ra, 90, 0.5);
});

test("Sun altitude: Ho Chi Minh City at 21:00 is -51.1, at noon it is high", () => {
  const hcmc = { lat: 10.82, lon: 106.63 };
  near(sunAltitude(hcmc, Date.UTC(2026, 9, 20, 14)), -51.1, 0.5, "21:00");
  const noon = sunAltitude(hcmc, localToUtc("2026-10-20", 12, "Asia/Ho_Chi_Minh"));
  assert.ok(noon > 65 && noon < 90, `${noon}`);
});

test("the ecliptic is 24 points that cross the equator at RA 0 and 180", () => {
  const pts = eclipticPoints();
  assert.equal(pts.length, 24);
  near(pts[0].dec, 0, 1e-9);
  near(pts[0].ra, 0, 1e-9);
  near(pts[12].ra, 180, 1e-9);
  near(pts[6].dec, 23.44, 0.01);
  near(pts[18].dec, -23.44, 0.01);
  for (const p of pts) assert.ok(p.ra >= 0 && p.ra < 360 && Math.abs(p.dec) <= 23.45);
});

test("toEquatorial of longitude 90 on the ecliptic is RA 90", () => {
  const e = toEquatorial(90, 0, 0);
  near(e.ra, 90, 1e-9);
  near(e.dec, 23.439, 1e-9);
});
