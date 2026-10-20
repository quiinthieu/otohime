import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BODIES, bodyBySlug, type Body } from "./bodies.ts";
import { MARGIN, MARKS, MIN_BAND, VIEW, cutaway, drawnBands, ringArcs, type Cutaway } from "./cutaway.ts";

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
    for (const m of c.marks) {
      if (m.wash) assert.doesNotMatch(m.wash.d, /NaN|undefined|Infinity/, `${b.slug}.${m.id} wash`);
      for (const l of m.labels ?? []) assert.ok(Number.isFinite(l.x) && Number.isFinite(l.y), `${b.slug}.${m.id} label`);
    }
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

// The box round inked path data (rough.js writes absolute M, L and C), with
// each curve sampled: its control points overshoot the line it draws.
function inkBox(ds: string[]): { x0: number; y0: number; x1: number; y1: number } {
  const ps = inkPoints(ds);
  const xs = ps.map((p) => p.x);
  const ys = ps.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Points along inked path data: every end point, and 19 more on each curve.
function inkPoints(ds: string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const add = (x: number, y: number) => out.push({ x, y });
  for (const d of ds) {
    let cur = [0, 0];
    for (const [, cmd, args] of d.matchAll(/([MLC])([^MLCZ]*)/g)) {
      const v = (args.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? []).map(Number);
      const step = cmd === "C" ? 6 : 2;
      for (let i = 0; i + step - 1 < v.length; i += step) {
        const end = [v[i + step - 2], v[i + step - 1]];
        if (cmd === "C") {
          for (let k = 1; k < 20; k++) {
            const t = k / 20;
            const u = 1 - t;
            const at = (j: number) => u * u * u * cur[j] + 3 * u * u * t * v[i + j] + 3 * u * t * t * v[i + 2 + j] + t * t * t * end[j];
            add(at(0), at(1));
          }
        }
        add(end[0], end[1]);
        cur = end;
      }
    }
  }
  return out;
}

// The marks the plan names, body by body; the Sun and the rest have none.
const MARK_IDS: Record<string, string[]> = {
  earth: ["clouds"],
  mars: ["polar-cap"],
  jupiter: ["bands", "great-red-spot"],
  saturn: ["rings"],
  uranus: ["rings", "tilt"],
  neptune: ["dark-spot"],
  sirius: ["companion"],
  vega: ["flattened"],
  polaris: ["pulse-rings"],
  betelgeuse: ["lumpy"],
};

test("each body draws exactly the marks its data names, each inked", () => {
  for (const b of BODIES) {
    assert.deepEqual([...(b.marks ?? [])], MARK_IDS[b.slug] ?? [], `${b.slug}'s data`);
    const c = of(b);
    assert.deepEqual(
      c.marks.map((m) => m.id),
      [...(b.marks ?? [])],
      b.slug,
    );
    for (const m of c.marks) {
      assert.ok(MARKS[m.id], `${b.slug}: ${m.id} has a drawer`);
      assert.ok(m.paths.length >= 1, `${b.slug}.${m.id} has no ink`);
    }
  }
  assert.throws(() => cutaway({ ...(bodyBySlug("mars") as Body), marks: ["moustache"] }), /no mark moustache/);
});

test("Saturn and Uranus have rings; the near half crosses the disc, the far half goes behind it", () => {
  for (const slug of ["saturn", "uranus"]) {
    const c = of(bodyBySlug(slug) as Body);
    const rings = c.marks.find((m) => m.id === "rings");
    assert.ok(rings, `${slug} has no rings`);
    const box = inkBox(rings.paths.map((p) => p.d));
    // rings at their true radius reach well past the disc
    const span = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2;
    assert.ok(span > 1.6 * c.radius, `${slug}: rings span ${span} for R ${c.radius}`);
  }
  // the far half's visible arcs run from the ring's ends to the limb: the left
  // one ends on it, the right one starts on it
  const arcs = ringArcs(300, 300, 200, 0.3, -12, 100);
  assert.equal(arcs.length, 3, "two far ends and the near half");
  const nums = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const onLimb = ([x, y]: number[]) => Math.abs(Math.hypot(x - 300, y - 300) - 100) < 0.05;
  assert.ok(onLimb(nums(arcs[0]).slice(-2)), `the left far arc ends at ${nums(arcs[0]).slice(-2)}`);
  assert.ok(onLimb(nums(arcs[1]).slice(0, 2)), `the right far arc starts at ${nums(arcs[1]).slice(0, 2)}`);
  assert.equal(ringArcs(300, 300, 90, 0.3, 0, 100).length, 1, "a ring inside the disc shows only its near half");
});

test("Vega is drawn flattened: its outline's box is 2.42 / 2.73 tall to wide", () => {
  const vega = bodyBySlug("vega") as Body;
  const c = of(vega);
  assert.deepEqual(
    c.marks.map((m) => m.id),
    ["flattened"],
  );
  const box = inkBox(c.outline.map((p) => p.d));
  const ratio = (box.y1 - box.y0) / (box.x1 - box.x0);
  assert.ok(Math.abs(ratio - 2.42 / 2.73) <= 0.02, `Vega's outline is ${ratio.toFixed(4)} tall to wide`);
  // its layers are squashed with it, so none pokes past the outline at a pole
  const top = Math.min(...c.layers.map((l) => inkBox(l.paths.map((p) => p.d)).y0));
  assert.ok(c.centre.y - top < 1.1 * (c.centre.y - box.y0) + 2, "a layer runs past the flattened pole");
});

test("Sirius B is at least 2 px, and true to scale or labelled not to scale", () => {
  const c = of(bodyBySlug("sirius") as Body);
  const mark = c.marks.find((m) => m.id === "companion");
  assert.ok(mark?.scale, "Sirius has no companion");
  const { r, trueR } = mark.scale;
  assert.ok(r >= 2, `Sirius B r = ${r}`);
  const text = (mark.labels ?? []).map((l) => l.text).join(" ");
  assert.match(text, /^Sirius B, a white dwarf/);
  const toScale = Math.abs(r / trueR - 1) < 0.01;
  assert.ok(toScale || /not to scale/.test(text), `r ${r} vs true ${trueR}, labelled "${text}"`);
  // and it sits off the star, inside the page
  const box = inkBox(mark.paths.map((p) => p.d));
  const outer = Math.max(...drawnBands((bodyBySlug("sirius") as Body).layers, 1).map((x) => x.r1)) * c.radius;
  const gap = Math.hypot((box.x0 + box.x1) / 2 - c.centre.x, (box.y0 + box.y1) / 2 - c.centre.y) - outer;
  assert.ok(gap > 40, `Sirius B is ${gap} px off the star`);
  for (const l of mark.labels ?? []) assert.ok(l.x <= VIEW.w - MARGIN && l.y >= MARGIN, `label at ${l.x},${l.y}`);
});

test("every mark's ink stays on the page", () => {
  for (const b of BODIES) {
    for (const m of of(b).marks) {
      const box = inkBox(m.paths.map((p) => p.d));
      assert.ok(box.x0 >= 0 && box.y0 >= 0 && box.x1 <= VIEW.w && box.y1 <= VIEW.h, `${b.slug}.${m.id}: ${JSON.stringify(box)}`);
    }
  }
});

test("the 'to scale' mark keeps clear of every mark", () => {
  for (const b of BODIES) {
    const c = of(b);
    if (c.compare.shape === "orbit") continue; // Earth's orbit sits inside Betelgeuse
    const { centre, r } = c.compare;
    for (const m of c.marks) {
      const near = Math.min(...inkPoints(m.paths.map((p) => p.d)).map((p) => Math.hypot(p.x - centre.x, p.y - centre.y)));
      assert.ok(near > r + 4, `${b.slug}: ${m.id} comes within ${near.toFixed(1)} px of ${c.compare.label} (r ${r})`);
    }
  }
  // Vega's spin axis does not push the Sun off the page: it is a whole dot
  assert.equal(of(bodyBySlug("vega") as Body).compare.shape, "dot");
});
