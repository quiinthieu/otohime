import assert from "node:assert/strict";
import { test } from "node:test";
import { NUCLEUS_CAP, neutronsOf, nucleus, project2d, RING_BASE, rings, type Vec3 } from "./atom.ts";
import { ELEMENTS } from "./elements.ts";

const finite = (p: Vec3) => [p.x, p.y, p.z].every(Number.isFinite);
const len = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
const TAU = 2 * Math.PI;

test("one ring per shell, electrons per ring equal the shell, the sum is the atomic number", () => {
  for (const el of ELEMENTS) {
    const rs = rings(el.shells, 0);
    assert.equal(rs.length, el.shells.length, el.symbol);
    rs.forEach((r, i) => assert.equal(r.electrons.length, el.shells[i], `${el.symbol} ring ${i}`));
    assert.equal(
      rs.reduce((n, r) => n + r.electrons.length, 0),
      el.number,
      el.symbol,
    );
  }
});

test("radii strictly increase and start outside the biggest nucleus", () => {
  const rs = rings([2, 8, 18, 32, 32, 18, 8], 0);
  for (let i = 1; i < rs.length; i++) assert.ok(rs[i].radius > rs[i - 1].radius);
  assert.equal(rs[0].radius, RING_BASE);
  assert.ok(nucleus(118, 176).radius < RING_BASE);
});

test("electrons are evenly spaced on their ring at any time", () => {
  for (const t of [0, 1.7, 100]) {
    for (const r of rings([2, 8, 18, 32, 32, 18, 8], t)) {
      const n = r.angles.length;
      for (let k = 1; k < n; k++) assert.ok(Math.abs(r.angles[k] - r.angles[k - 1] - TAU / n) < 1e-9);
      for (const e of r.electrons) assert.ok(Math.abs(len(e) - r.radius) < 1e-9, "electron on the ring");
    }
  }
});

test("t = 0 is deterministic and time moves electrons at different speeds", () => {
  assert.deepEqual(rings([2, 8, 1], 0), rings([2, 8, 1], 0));
  const a = rings([2, 8, 1], 0);
  const b = rings([2, 8, 1], 1);
  assert.notDeepEqual(a[0].electrons, b[0].electrons);
  const speeds = rings([2, 8, 18, 32, 32, 18, 8]).map((r) => r.speed);
  assert.equal(new Set(speeds.map(Math.abs)).size, 7, "each shell its own speed");
  assert.ok(speeds[0] > 0 && speeds[1] < 0, "neighbours counter-rotate");
  const tilts = rings([2, 8, 18]).map((r) => [r.tiltX, r.tiltZ].join());
  assert.equal(new Set(tilts).size, 3, "each shell its own tilt");
});

test("nucleus count is min(cap, p + n) for every element, with no NaN", () => {
  for (const el of ELEMENTS) {
    const p = el.number;
    const n = neutronsOf(el);
    const nuc = nucleus(p, n);
    assert.equal(nuc.points.length, Math.min(NUCLEUS_CAP, p + n), el.symbol);
    assert.equal(nuc.protons + nuc.neutrons, nuc.points.length, el.symbol);
    assert.equal(nuc.points.filter((q) => q.kind === "proton").length, nuc.protons, el.symbol);
    assert.ok(nuc.points.every(finite), `${el.symbol} NaN`);
    assert.ok(Number.isFinite(nuc.radius), el.symbol);
    for (const q of nuc.points) assert.ok(len(q) <= nuc.radius + 1e-9, `${el.symbol} point outside`);
    // proton share preserved within one, at least one of each kind when both exist
    assert.ok(Math.abs(nuc.protons - (nuc.points.length * p) / (p + n)) <= 1, el.symbol);
    assert.ok(nuc.protons >= 1, el.symbol);
    if (n > 0) assert.ok(nuc.neutrons >= 1, el.symbol);
  }
});

test("small nuclei are shown whole, big ones capped with a label", () => {
  const h = nucleus(1, 0);
  assert.deepEqual([h.points.length, h.capped, h.label], [1, false, null]);
  assert.deepEqual([h.points[0].x, h.points[0].y, h.points[0].z], [0, 0, 0]);
  const c = nucleus(6, 6);
  assert.deepEqual([c.points.length, c.protons, c.neutrons, c.capped], [12, 6, 6, false]);
  const og = ELEMENTS[117];
  const big = nucleus(og.number, neutronsOf(og));
  assert.equal(big.total, 294);
  assert.equal(big.capped, true);
  assert.equal(big.label, "showing 64 of 294 nucleons");
  const lopsided = nucleus(10, 1000);
  assert.deepEqual([lopsided.protons, lopsided.neutrons], [1, 63]);
  assert.equal(nucleus(0, 0).points.length, 0);
});

test("neutronsOf rounds the mass: H 0, C 6, Fe 30, U 146, Og 176", () => {
  const n = (z: number) => neutronsOf(ELEMENTS[z - 1]);
  assert.deepEqual([n(1), n(6), n(26), n(92), n(118)], [0, 6, 30, 146, 176]);
  assert.ok(ELEMENTS.every((el) => neutronsOf(el) >= 0));
});

test("project2d puts every shell inside the box and every electron on its circle", () => {
  const SIZE = 200;
  for (const el of ELEMENTS) {
    const rs = rings(el.shells, 0);
    const d = project2d(rs, nucleus(el.number, neutronsOf(el)), SIZE);
    assert.equal(d.rings.length, el.shells.length);
    for (const r of d.rings) {
      assert.ok(r.radius > 0 && r.radius <= SIZE / 2, el.symbol);
      for (const e of r.electrons) {
        assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `${el.symbol} NaN`);
        assert.ok(Math.abs(Math.hypot(e.x - d.centre, e.y - d.centre) - r.radius) < 1e-9);
      }
    }
    for (const q of d.nucleus) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && q.r > 0, el.symbol);
  }
  const fe = project2d(rings(ELEMENTS[25].shells), nucleus(26, 30), SIZE);
  assert.ok(Math.abs(fe.rings[3].radius - SIZE * 0.44) < 1e-9, "outer shell fills the box less a margin");
});
