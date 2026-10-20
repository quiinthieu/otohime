import assert from "node:assert/strict";
import { test } from "node:test";
import { age, illuminated, litPath, moonPosition, phase, phaseWords } from "./moon.ts";

const near = (a: number, b: number, tol: number, what = "") => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const gap = (a: number, b: number) => Math.abs((((a - b + 180) % 360) + 360) % 360 - 180);

test("the Moon at first quarter, 2026-10-18 16:13 UTC: phase 90.06, 0.501 lit", () => {
  const p = phase(Date.UTC(2026, 9, 18, 16, 13));
  assert.ok(gap(p, 90.06) <= 0.5, `${p}`);
  near(illuminated(p), 0.501, 0.01);
});

test("the Moon at full, 2026-10-26 04:12 UTC: phase 179.87", () => {
  assert.ok(gap(phase(Date.UTC(2026, 9, 26, 4, 12)), 179.87) <= 0.5);
});

test("the Moon at new, 2026-10-10 15:50 UTC: phase 359.94", () => {
  assert.ok(gap(phase(Date.UTC(2026, 9, 10, 15, 50)), 359.94) <= 0.5);
});

test("the other almanac phases land within half a degree", () => {
  const rows: [number, number, number, number, number, number][] = [
    [2000, 0, 6, 18, 14, 0],
    [2000, 0, 21, 4, 40, 180],
    [2026, 10, 1, 20, 28, 270],
    [2026, 10, 9, 7, 2, 0],
  ];
  for (const [y, mo, d, h, mi, want] of rows) {
    const p = phase(Date.UTC(y, mo, d, h, mi));
    assert.ok(gap(p, want) <= 0.5, `${y}-${mo + 1}-${d}: ${p}`);
  }
});

test("the Moon, 2026-10-20 14:00 UTC: lambda 318.28, beta -0.87, RA 321.00, Dec -16.18, phase 111.1", () => {
  const ms = Date.UTC(2026, 9, 20, 14);
  const m = moonPosition(ms);
  near(m.lambda, 318.28, 0.1, "lambda");
  near(m.beta, -0.87, 0.1, "beta");
  near(m.ra, 321.0, 0.1, "RA");
  near(m.dec, -16.18, 0.1, "Dec");
  near(phase(ms), 111.1, 0.5, "phase");
});

test("illuminated fraction and age follow the phase", () => {
  near(illuminated(0), 0, 1e-12);
  near(illuminated(90), 0.5, 1e-12);
  near(illuminated(180), 1, 1e-12);
  near(illuminated(270), 0.5, 1e-12);
  near(age(0), 0, 1e-12);
  near(age(180), 29.530588853 / 2, 1e-9);
  near(age(111.1), 9.11, 0.01);
});

test("phaseWords names the nearest key phase", () => {
  assert.equal(phaseWords(111.1), "about two days past first quarter");
  assert.equal(phaseWords(90), "at first quarter");
  assert.equal(phaseWords(0), "at new moon");
  assert.equal(phaseWords(359.9), "at new moon");
  assert.equal(phaseWords(180), "at full moon");
  assert.equal(phaseWords(270), "at last quarter");
  assert.equal(phaseWords(97), "about one day past first quarter");
  assert.equal(phaseWords(150), "about two days before full moon");
  assert.equal(phaseWords(300), "about two days past last quarter");
  assert.equal(phaseWords(340), "about two days before new moon");
  assert.equal(phaseWords(20), "about two days past new moon");
  for (let p = 0; p < 360; p += 0.5) assert.match(phaseWords(p), /^(at |about (one|two|three|four) days? (past|before) )(new moon|first quarter|full moon|last quarter)$/, `${p}`);
});

test("litPath: nothing at new moon, a full disc at full moon, the right side when waxing", () => {
  assert.equal(litPath(0, 20), "");
  assert.equal(litPath(359.9, 20), "");
  assert.match(litPath(180, 20), /^M0 -20A20 20 0 1 1 0 20A20 20 0 1 1 0 -20Z$/);
  assert.equal(litPath(90, 20), "M0 -20A20 20 0 0 1 0 20A0 20 0 0 0 0 -20Z");
  assert.match(litPath(270, 20), /^M0 -20A20 20 0 0 0 0 20A0 20 0 0 [01] 0 -20Z$/);
});

test("litPath: crescents and gibbous phases bulge the terminator the right way", () => {
  // waxing crescent: limb on the right, terminator on the right too (sweep 0)
  assert.equal(litPath(60, 20), "M0 -20A20 20 0 0 1 0 20A10 20 0 0 0 0 -20Z");
  // waxing gibbous: terminator bulges left (sweep 1)
  assert.equal(litPath(120, 20), "M0 -20A20 20 0 0 1 0 20A10 20 0 0 1 0 -20Z");
  // waning gibbous: limb on the left, terminator bulges right (sweep 0)
  assert.equal(litPath(240, 20), "M0 -20A20 20 0 0 0 0 20A10 20 0 0 0 0 -20Z");
  // waning crescent: limb on the left, terminator bulges left (sweep 1)
  assert.equal(litPath(300, 20), "M0 -20A20 20 0 0 0 0 20A10 20 0 0 1 0 -20Z");
});

test("litPath never emits NaN", () => {
  for (let p = 0; p < 360; p += 3.7) assert.doesNotMatch(litPath(p, 24.5), /NaN|undefined|Infinity/);
});
