import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BODIES, bodyBySlug, type Body } from "./bodies.ts";
import { MARGIN, MIN_BAND, VIEW, cutaway, drawnBands, type Cutaway } from "./cutaway.ts";

const drawn = new Map<string, Cutaway>(BODIES.map((b) => [b.slug, cutaway(b)]));
const of = (b: Body) => drawn.get(b.slug) as Cutaway;

const allPaths = (c: Cutaway) => [...c.layers.flatMap((l) => l.paths), ...c.compare.paths, ...c.outline, ...c.marks.flatMap((m) => m.paths)];

test("every body's cut has its layers, in order, numbered 1..n, each inked", () => {
  for (const b of BODIES) {
    const c = of(b);
    assert.deepEqual(
      c.layers.map((l) => l.id),
      b.layers.map((l) => l.id),
      b.slug,
    );
    assert.deepEqual(
      c.layers.map((l) => l.n),
      b.layers.map((_, i) => i + 1),
      b.slug,
    );
    for (const l of c.layers) {
      assert.ok(l.paths.length >= 1, `${b.slug}.${l.id} has no ink`);
      assert.match(l.shape, /^M/, `${b.slug}.${l.id}`);
    }
    assert.ok(c.outline.length >= 1, b.slug);
    assert.deepEqual(c.marks, [], b.slug);
  }
});

test("no path has NaN, undefined or Infinity", () => {
  for (const b of BODIES) {
    const c = of(b);
    for (const p of allPaths(c)) {
      assert.match(p.d, /^M/, b.slug);
      assert.doesNotMatch(p.d, /NaN|undefined|Infinity/, b.slug);
      assert.ok(Number.isFinite(p.strokeWidth), b.slug);
    }
    for (const l of c.layers) assert.doesNotMatch(l.shape, /NaN|undefined|Infinity/, `${b.slug}.${l.id}`);
    const nums = [c.centre.x, c.centre.y, c.radius, c.compare.r, c.compare.at.x, c.compare.at.y, c.compare.centre.x, c.compare.centre.y];
    for (const x of nums) assert.ok(Number.isFinite(x), b.slug);
  }
});

test("every pin and label sits inside the viewBox, clear of its edges", () => {
  const inside = (p: { x: number; y: number }, pad: number) => p.x >= pad && p.x <= VIEW.w - pad && p.y >= pad && p.y <= VIEW.h - pad;
  for (const b of BODIES) {
    const c = of(b);
    for (const l of c.layers) assert.ok(inside(l.pin, 15), `${b.slug}.${l.id} pin at ${l.pin.x},${l.pin.y}`);
    assert.ok(inside(c.compare.at, MARGIN), `${b.slug} label at ${c.compare.at.x},${c.compare.at.y}`);
  }
});

test("pins stand apart, and a slid-out pin stays on its band's angle", () => {
  for (const b of BODIES) {
    const c = of(b);
    for (const [i, l] of c.layers.entries()) {
      for (const m of c.layers.slice(0, i)) {
        const d = Math.hypot(l.pin.x - m.pin.x, l.pin.y - m.pin.y);
        assert.ok(d >= 30, `${b.slug}: pins ${m.id} and ${l.id} are ${d.toFixed(1)} px apart`);
      }
      const ra = Math.hypot(l.anchor.x - c.centre.x, l.anchor.y - c.centre.y);
      const rp = Math.hypot(l.pin.x - c.centre.x, l.pin.y - c.centre.y);
      assert.ok(rp >= ra - 0.01, `${b.slug}.${l.id} pin slid inward`);
    }
  }
});

test("the body and its atmosphere fit the viewBox with the margin", () => {
  for (const b of BODIES) {
    const c = of(b);
    const reach = Math.max(...drawnBands(b.layers, b.radiusKm).map((x) => x.r1)) * c.radius;
    assert.ok(c.centre.x - reach >= MARGIN - 0.01, `${b.slug} left`);
    assert.ok(c.centre.x + reach <= VIEW.w - MARGIN + 0.01, `${b.slug} right`);
    assert.ok(c.centre.y - reach >= MARGIN - 0.01, `${b.slug} top`);
    assert.ok(c.centre.y + reach <= VIEW.h - MARGIN + 0.01, `${b.slug} bottom`);
  }
});

test("the same body draws the same ink every time", () => {
  for (const b of BODIES) {
    const again = cutaway(b);
    assert.deepEqual(
      allPaths(again).map((p) => p.d),
      allPaths(of(b)).map((p) => p.d),
      b.slug,
    );
    assert.deepEqual(again, of(b), b.slug);
  }
});

test("bodies draw differently from each other", () => {
  const firsts = BODIES.map((b) => of(b).layers[0].paths[0].d);
  assert.equal(new Set(firsts).size, BODIES.length);
});

test("drawn bands keep the layer order and are never thinner than MIN_BAND", () => {
  for (const b of BODIES) {
    const bands = drawnBands(b.layers, b.radiusKm);
    assert.deepEqual(
      bands.map((x) => x.id),
      b.layers.map((l) => l.id),
      b.slug,
    );
    for (const [i, x] of bands.entries()) {
      assert.ok(x.r1 - x.r0 >= MIN_BAND - 1e-9, `${b.slug}.${x.id}: ${x.r1 - x.r0}`);
      if (i > 0) assert.ok(Math.abs(x.r0 - bands[i - 1].r1) < 1e-9, `${b.slug}.${x.id} does not follow on`);
    }
    const inner = bands.filter((_, i) => b.layers[i].region === "interior");
    assert.equal(inner[0].r0, 0, b.slug);
    assert.equal(inner.at(-1)?.r1, 1, b.slug);
  }
});

test("drawn bands keep true fractions where they are thick enough", () => {
  const earth = bodyBySlug("earth") as Body;
  const bands = drawnBands(earth.layers, earth.radiusKm);
  const width = (id: string) => {
    const x = bands.find((y) => y.id === id);
    assert.ok(x, id);
    return x.r1 - x.r0;
  };
  assert.ok(Math.abs(width("crust") - MIN_BAND) < 1e-9, "the 0.5 % crust is drawn at MIN_BAND");
  assert.ok(Math.abs(width("atmosphere") - MIN_BAND) < 1e-9, "100 km of air is drawn at MIN_BAND");
  // the thick bands shrink together, so their ratio is the true one
  const trueRatio = (0.995 - 0.55) / (0.55 - 0.19);
  assert.ok(Math.abs(width("mantle") / width("outer-core") - trueRatio) < 1e-9);
});

test("the comparison is drawn at the true ratio, at least 2 px", () => {
  for (const b of BODIES) {
    const c = of(b);
    const ratio = b.compare.radiusKm / b.radiusKm;
    assert.ok(c.compare.r >= 2, `${b.slug}: r = ${c.compare.r}`);
    const drawnRatio = c.compare.r / c.radius;
    assert.ok(Math.abs(drawnRatio / ratio - 1) < 0.01, `${b.slug}: ${drawnRatio} vs ${ratio}`);
    assert.ok(c.compare.paths.length >= 1, b.slug);
    assert.equal(c.compare.label, b.compare.label, b.slug);
  }
});

test("Betelgeuse's comparison is Earth's orbit, centred on the star and inside it", () => {
  const c = of(bodyBySlug("betelgeuse") as Body);
  assert.equal(c.compare.shape, "orbit");
  assert.deepEqual(c.compare.centre, c.centre);
  assert.ok(c.compare.r < c.radius);
});

test("a dot sits clear of the body; one too big for the corner shows its limb", () => {
  for (const b of BODIES) {
    const c = of(b);
    if (c.compare.shape === "orbit") continue;
    const reach = Math.max(...drawnBands(b.layers, b.radiusKm).map((x) => x.r1)) * c.radius;
    const gap = Math.hypot(c.compare.centre.x - c.centre.x, c.compare.centre.y - c.centre.y) - reach - c.compare.r;
    assert.ok(gap >= 13.9, `${b.slug}: ${gap} px from the body`);
    if (c.compare.shape === "dot") {
      const { x, y } = c.compare.centre;
      const r = c.compare.r;
      assert.ok(x - r >= 0 && x + r <= VIEW.w && y - r >= 0 && y + r <= VIEW.h, `${b.slug}: dot off the page`);
    }
  }
  const shape = (slug: string) => of(bodyBySlug(slug) as Body).compare.shape;
  assert.equal(shape("mercury"), "edge", "Earth is 2.6 Mercuries across");
  assert.equal(shape("jupiter"), "dot");
  assert.equal(shape("polaris"), "dot");
  assert.equal(shape("sun"), "dot");
});

test("each cutaway stays light enough for the 300 KB poster cap", () => {
  for (const b of BODIES) {
    const bytes = allPaths(of(b)).reduce((s, p) => s + p.d.length, 0);
    assert.ok(bytes < 100_000, `${b.slug}: ${bytes} bytes of path data`);
  }
});

test("cutaway.ts imports ink.ts and bodies.ts only", () => {
  const text = readFileSync(new URL("./cutaway.ts", import.meta.url), "utf8");
  const specs = [...text.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1]).sort();
  assert.deepEqual(specs, ["./bodies.ts", "./ink.ts"]);
});
