import assert from "node:assert/strict";
import { test } from "node:test";
import { CITIES, cityBySlug } from "./cities.ts";
import {
  altAz,
  dateTickAngle,
  discPoint,
  discRotation,
  framePoint,
  hemisphereOf,
  horizon,
  horizonPoints,
  hourTickAngle,
  upNow,
  visible,
  type Point,
  type StarLike,
} from "./sky.ts";
import { localToUtc, lstHours } from "./time.ts";

// J2000 coordinates as literals, so these tests do not depend on the vendored file.
const POLARIS = { ra: 37.9546, dec: 89.2641 };
const SIRIUS = { ra: 101.2872, dec: -16.7161 };
const VEGA = { ra: 279.2347, dec: 38.7837 };

const TOKYO = { lat: 35.68, lon: 139.69 };
const HCMC = { lat: 10.82, lon: 106.63 };
const TOKYO_MS = Date.UTC(2026, 9, 20, 12);
const HCMC_MS = Date.UTC(2026, 9, 20, 14);

const near = (a: number, b: number, tol: number, what = "") => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const place = (slug: string) => cityBySlug(slug)!;

test("Tokyo, 2026-10-20 12:00 UTC: Polaris alt 36.16, az 0.69; Vega alt 36.0; Sirius alt -27.9", () => {
  const lst = lstHours(TOKYO_MS, TOKYO.lon);
  const polaris = altAz(POLARIS.ra, POLARIS.dec, TOKYO.lat, lst);
  near(polaris.alt, 36.16, 1, "Polaris alt");
  near(wrap(polaris.az), 0.69, 1, "Polaris az");
  near(altAz(VEGA.ra, VEGA.dec, TOKYO.lat, lst).alt, 36.0, 1, "Vega alt");
  near(altAz(SIRIUS.ra, SIRIUS.dec, TOKYO.lat, lst).alt, -27.9, 1, "Sirius alt");
});

test("Ho Chi Minh City, 2026-10-20 14:00 UTC: Sirius alt -27.43 az 103.34; Vega alt 25.06 az 307.93", () => {
  const lst = lstHours(HCMC_MS, HCMC.lon);
  const sirius = altAz(SIRIUS.ra, SIRIUS.dec, HCMC.lat, lst);
  near(sirius.alt, -27.43, 1, "Sirius alt");
  near(sirius.az, 103.34, 1, "Sirius az");
  const vega = altAz(VEGA.ra, VEGA.dec, HCMC.lat, lst);
  near(vega.alt, 25.06, 1, "Vega alt");
  near(vega.az, 307.93, 1, "Vega az");
});

test("an equator star at LST = RA stands at altitude 90 - |lat|, due south or north", () => {
  for (const lat of [-60, -33.87, 0, 10.82, 35.68, 64.15]) {
    for (const ra of [0, 77, 190, 301]) {
      const { alt, az } = altAz(ra, 0, lat, ra / 15);
      near(alt, 90 - Math.abs(lat), 1e-9, `lat ${lat}`);
      if (lat > 0) near(az, 180, 1e-6, "south of the zenith");
      if (lat < 0) near(Math.min(az, 360 - az), 0, 1e-6, "north of the zenith");
    }
  }
});

test("a star six hours east of the meridian on the equator rises due east", () => {
  const { alt, az } = altAz(90, 0, 0, 0);
  near(alt, 0, 1e-9);
  near(az, 90, 1);
  near(altAz(270, 0, 0, 0).az, 270, 1);
});

test("Polaris stands at the latitude within 1 degree, at any hour, from five northern cities", () => {
  for (const slug of ["hcmc", "tokyo", "paris", "new-york", "reykjavik"]) {
    const c = place(slug);
    for (let h = 0; h < 24; h += 4) {
      const ms = Date.UTC(2026, 9, 20, h, 17);
      const { alt } = altAz(POLARIS.ra, POLARIS.dec, c.lat, lstHours(ms, c.lon));
      near(alt, c.lat, 1, `${slug} ${h}h`);
    }
  }
});

test("the hemisphere is north from the equator up", () => {
  assert.equal(hemisphereOf(10.82), "north");
  assert.equal(hemisphereOf(0), "north");
  assert.equal(hemisphereOf(-1.29), "south");
});

// A lattice of stars standing in for the catalogue.
const LATTICE: { ra: number; dec: number }[] = [];
for (let ra = 0; ra < 360; ra += 7.5) for (let dec = -89; dec <= 89; dec += 4) LATTICE.push({ ra, dec });

function inside(poly: Point[], p: Point): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function turned(pt: Point, deg: number): Point {
  const a = (deg * Math.PI) / 180;
  return { x: pt.x * Math.cos(a) - pt.y * Math.sin(a), y: pt.x * Math.sin(a) + pt.y * Math.cos(a) };
}

test("horizon containment: above the horizon is inside the window, below -2 is outside", () => {
  const R = 100;
  for (const slug of ["tokyo", "hcmc", "sydney", "singapore", "reykjavik"]) {
    const c = place(slug);
    const win = horizonPoints(c.lat, R, 720);
    let above = 0;
    let below = 0;
    for (const hours of [0, 3.3, 7, 11.5, 15, 19.1, 22.4]) {
      const lst = hours;
      const rot = discRotation(lst, hemisphereOf(c.lat));
      for (const s of LATTICE) {
        const { alt } = altAz(s.ra, s.dec, c.lat, lst);
        const d = discPoint(s.ra, s.dec, c.lat, R);
        if (!d) {
          assert.ok(alt <= 0, `${slug}: a star with no disc point is below the horizon`);
          continue;
        }
        const p = turned(d, rot);
        if (alt > 0.5) {
          above++;
          assert.ok(inside(win, p), `${slug} lst ${lst}: alt ${alt.toFixed(2)} (${s.ra}, ${s.dec}) should be inside`);
        } else if (alt < -2) {
          below++;
          assert.ok(!inside(win, p), `${slug} lst ${lst}: alt ${alt.toFixed(2)} (${s.ra}, ${s.dec}) should be outside`);
        }
      }
    }
    assert.ok(above > 500 && below > 500, `${slug}: ${above} above, ${below} below`);
  }
});

test("the 72-point window is close to the exact one", () => {
  for (const slug of ["tokyo", "hcmc", "sydney", "reykjavik"]) {
    const c = place(slug);
    const coarse = horizonPoints(c.lat, 100);
    const fine = horizonPoints(c.lat, 100, 720);
    assert.equal(coarse.length, 72);
    for (let i = 0; i < 72; i++) {
      near(coarse[i].x, fine[i * 10].x, 1e-9, "x");
      near(coarse[i].y, fine[i * 10].y, 1e-9, "y");
    }
  }
  assert.match(horizon(10.82, 100), /^M[-\d.]+ [-\d.]+(L[-\d.]+ [-\d.]+){71}Z$/);
});

test("the window: north point near the pole, south point on the rim (Ho Chi Minh City)", () => {
  const w = horizonPoints(10.82, 100);
  near(Math.hypot(w[0].x, w[0].y), (100 * 10.82) / (180 - 10.82), 1e-6, "north point radius");
  assert.ok(w[0].y < 0, "north point is above the centre");
  near(Math.hypot(w[36].x, w[36].y), 100, 1e-6, "south point on the rim");
  assert.ok(w[36].y > 0, "south point is below the centre");
  assert.ok(w[18].x < 0 && w[54].x > 0, "east is left, west is right");
});

test("the south disc is the mirror: Sydney's window opens upward and east stays on the left", () => {
  const w = horizonPoints(-33.87, 100);
  assert.ok(w[0].y < 0, "north point is above the centre, on the rim");
  near(Math.hypot(w[0].x, w[0].y), 100, 1e-6);
  assert.ok(w[36].y > 0, "south point is below the centre, near the pole");
  near(Math.hypot(w[36].x, w[36].y), (100 * 33.87) / (180 - 33.87), 1e-6);
  assert.ok(w[18].x < 0 && w[54].x > 0, "east is left, west is right");
});

test("a star turns into its frame position: the disc and the frame agree", () => {
  for (const lat of [10.82, 35.68, -33.87]) {
    const h = hemisphereOf(lat);
    for (const [ra, dec, lst] of [[37.9, 30, 5], [279.2, 38.8, 21.5], [101.3, -16.7, 23], [200, 10, 1]]) {
      const d = discPoint(ra, dec, lat, 100);
      if (!d) continue;
      const p = turned(d, discRotation(lst, h));
      const hourAngle = lst * 15 - ra;
      const p0 = h === "north" ? 90 - dec : 90 + dec;
      const e = framePoint(hourAngle, (100 * p0) / (180 - Math.abs(lat)), h);
      near(p.x, e.x, 1e-9, "x");
      near(p.y, e.y, 1e-9, "y");
    }
  }
});

test("orientation: in Tokyo a star due south and high sits below the centre, one rising sits left", () => {
  const h = "north" as const;
  const south = framePoint(0, 50, h);
  assert.ok(south.y > 0 && Math.abs(south.x) < 1e-9);
  const east = framePoint(-90, 50, h);
  assert.ok(east.x < 0);
  // Orion in Tokyo, 2026-12-15 22:00: Betelgeuse (88.79, 7.41) sits upper left of Rigel (78.63, -8.20).
  const ms = localToUtc("2026-12-15", 22, "Asia/Tokyo");
  const lst = lstHours(ms, TOKYO.lon);
  const rot = discRotation(lst, h);
  const betelgeuse = turned(discPoint(88.79, 7.41, TOKYO.lat, 100)!, rot);
  const rigel = turned(discPoint(78.63, -8.2, TOKYO.lat, 100)!, rot);
  assert.ok(betelgeuse.x < rigel.x && betelgeuse.y < rigel.y, `${JSON.stringify([betelgeuse, rigel])}`);
  assert.ok(altAz(88.79, 7.41, TOKYO.lat, lst).az > 120 && altAz(88.79, 7.41, TOKYO.lat, lst).az < 240, "Orion is in the south");
});

test("stars that never rise have no disc point; circumpolar stars are near the centre", () => {
  assert.equal(discPoint(0, -80, 10.82), null);
  assert.ok(discPoint(0, -79, 10.82));
  assert.equal(discPoint(0, 80, -34), null);
  const pole = discPoint(10, 89.9, 35.68, 100)!;
  assert.ok(Math.hypot(pole.x, pole.y) < 1);
  const rim = discPoint(10, -(90 - 35.68), 35.68, 100)!;
  near(Math.hypot(rim.x, rim.y), (100 * (90 + 54.32)) / (180 - 35.68), 1e-9);
});

test("discRotation advances 15.04 degrees per clock hour", () => {
  for (const h of ["north", "south"] as const) {
    for (const lon of [106.63, -74.01]) {
      for (let hour = 0; hour < 23; hour += 5) {
        const a = discRotation(lstHours(Date.UTC(2026, 9, 20, hour), lon), h);
        const b = discRotation(lstHours(Date.UTC(2026, 9, 20, hour + 1), lon), h);
        near(Math.abs(wrap(b - a)), 15.04, 0.01, `${h} ${hour}h`);
        assert.ok(a >= 0 && a < 360);
      }
    }
  }
  assert.ok(wrap(discRotation(2, "north") - discRotation(1, "north")) < 0, "the northern sky turns counter-clockwise");
  assert.ok(wrap(discRotation(2, "south") - discRotation(1, "south")) > 0, "the southern sky turns clockwise");
});

test("the date rim meets the hour ring within 4.5 degrees: 24 cities x 12 months at 21:00", () => {
  let worst = 0;
  for (const c of CITIES) {
    for (let month = 1; month <= 12; month++) {
      const date = `2026-${String(month).padStart(2, "0")}-01`;
      const ms = localToUtc(date, 21, c.tz);
      const lst = lstHours(ms, c.lon);
      const h = hemisphereOf(c.lat);
      // the date mark is on the disc at the Sun's RA that day; turn the disc and read its hour angle
      const mark = turned(discPoint(dateTickAngle(date, c.tz), 0, c.lat, 1)!, discRotation(lst, h));
      const markAngle = (Math.atan2(mark.x, h === "north" ? mark.y : -mark.y) * 180) / Math.PI;
      const tick = hourTickAngle(21, c, date);
      worst = Math.max(worst, Math.abs(wrap(markAngle - tick)));
      assert.ok(Math.abs(wrap(markAngle - tick)) <= 4.5, `${c.slug} ${date}: mark ${markAngle.toFixed(2)} tick ${tick.toFixed(2)}`);
    }
  }
  assert.ok(worst > 3, `the equation of time shows up (${worst.toFixed(2)})`);
});

test("hourTickAngle is the mean Sun's hour angle: Greenwich noon is 0, Ho Chi Minh City's 21:00 is 14:00 UTC", () => {
  near(hourTickAngle(12, { lon: 0, tz: "UTC" }, "2026-10-20"), 0, 1e-9);
  near(hourTickAngle(21, { lon: 106.63, tz: "Asia/Ho_Chi_Minh" }, "2026-10-20"), 136.63, 1e-9);
  near(hourTickAngle(21, { lon: 151.21, tz: "Australia/Sydney" }, "2026-10-20"), 135 + 151.21 - 165, 1e-9);
});

const NAMED: StarLike[] = [
  [32349, SIRIUS.ra, SIRIUS.dec, -1.44, "Sirius"],
  [91262, VEGA.ra, VEGA.dec, 0.03, "Vega"],
  [11767, POLARIS.ra, POLARIS.dec, 1.97, "Polaris"],
  [99999, 10, 10, 3.2],
];

test("upNow in Ho Chi Minh City, 2026-10-20 14:00 UTC, has Vega and Polaris but not Sirius", () => {
  const up = upNow(HCMC, HCMC_MS, NAMED);
  assert.ok(up.includes("Vega"));
  assert.ok(!up.includes("Sirius"));
  assert.deepEqual(up, ["Vega", "Polaris"]);
});

test("upNow lists the brightest first and leaves out unnamed stars", () => {
  const all: StarLike[] = [
    [1, 0, 90, 2.5, "Faint"],
    [2, 0, 90, 0.5, "Bright"],
    [3, 0, 90, 1.5],
  ];
  assert.deepEqual(upNow({ lat: 40, lon: 0 }, TOKYO_MS, all), ["Bright", "Faint"]);
});

test("visible is altitude above zero", () => {
  assert.equal(visible([1, VEGA.ra, VEGA.dec, 0, "Vega"], TOKYO, TOKYO_MS), true);
  assert.equal(visible([1, SIRIUS.ra, SIRIUS.dec, 0, "Sirius"], TOKYO, TOKYO_MS), false);
});
