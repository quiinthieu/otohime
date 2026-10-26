// The pond's marbling engine, driven by hand: drops keep older ink's area, every map is exact (inverse, tine falloff,
// comb as tines), a seed replays the same print without Math.random, the caps refuse cleanly, refinement keeps
// on-screen edges short, and the SVG stays small and finite.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CUTOFF_PX,
  MAX_DROPS,
  MAX_EDGE,
  MAX_VERTS,
  SVG_TOLERANCE,
  applyOp,
  createMarble,
  mapPoint,
  recipe,
  refine,
  replay,
  ringArea,
  simplifyRing,
  toSvgPaths,
  uForHalf,
  unmapDrop,
  type Marble,
  type Op,
} from "./marble.ts";

const W = 960;
const H = 720;

function run(m: Marble, ...ops: Op[]): Marble {
  for (const op of ops) {
    const r = applyOp(m, op);
    assert.ok(r.ok, `op refused: ${JSON.stringify(op)} (${r.ok ? "" : r.reason})`);
    m = r.marble;
  }
  return m;
}

const near = (a: number, b: number, eps: number, what: string) =>
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b} (eps ${eps})`);

/** Seeded points for property checks, so the tests never depend on Math.random either. */
function points(n: number, seed: number): [number, number][] {
  let a = seed >>> 0;
  const rand = () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
  return Array.from({ length: n }, () => [rand() * W, rand() * H]);
}

test("a drop preserves every older polygon's area within 0.5% (shoelace)", () => {
  let m = run(createMarble(W, H), { kind: "drop", x: 300, y: 360, r: 80, ink: "sumi" });
  const before = ringArea(m.drops[0].pts);
  near(before, Math.PI * 80 * 80, Math.PI * 80 * 80 * 0.005, "the drop's own ring");
  const first = m.drops[0].pts.slice(0, 2);
  m = run(m, { kind: "drop", x: 460, y: 360, r: 70, ink: "clear" }, { kind: "drop", x: 300, y: 220, r: 50, ink: "coral" });
  const blue = ringArea(m.drops[1].pts);
  m = run(m, { kind: "drop", x: 330, y: 470, r: 60, ink: "blue" }, { kind: "drop", x: 400, y: 360, r: 45, ink: "sumi" });
  // The ring really moved, so this is not an identity check.
  assert.ok(Math.hypot(m.drops[0].pts[0] - first[0], m.drops[0].pts[1] - first[1]) > 10);
  near(ringArea(m.drops[0].pts), before, before * 0.005, "first ring after four drops");
  near(ringArea(m.drops[1].pts), blue, blue * 0.005, "second ring after two drops");
});

test("without refinement the same drops lose more than 0.5% of area (negative control)", () => {
  const m = run(createMarble(W, H), { kind: "drop", x: 300, y: 360, r: 80, ink: "sumi" });
  const before = ringArea(m.drops[0].pts);
  const rect = { x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9 };
  let pts = m.drops[0].pts;
  for (const op of [
    { kind: "drop", x: 385, y: 360, r: 70, ink: "clear" },
    { kind: "drop", x: 300, y: 446, r: 60, ink: "clear" },
    { kind: "drop", x: 214, y: 360, r: 60, ink: "clear" },
  ] as const) {
    const f = (x: number, y: number, out: number[]) => ([out[0], out[1]] = mapPoint(op, x, y));
    pts = refine(pts, f, rect, MAX_VERTS, Infinity)!;
  }
  assert.ok(Math.abs(ringArea(pts) - before) / before > 0.005, `unrefined area error ${Math.abs(ringArea(pts) - before) / before}`);
});

test("a drop followed by its inverse returns every point outside the rim within 1e-9", () => {
  const op = { kind: "drop", x: 480, y: 360, r: 90, ink: "sumi" } as const;
  // Points much nearer the centre than 0.5px are ill-conditioned (the image hugs the rim, and rounding there grows by
  // rho_out / rho_in on the way back), so the exactness check stops there.
  for (const [x, y] of [...points(500, 7), [480 + 0.5, 360], [480, 360 - 0.5], [10_000, -4_000]] as [number, number][]) {
    const [fx, fy] = mapPoint(op, x, y);
    assert.ok(Math.hypot(fx - 480, fy - 360) >= 90 - 1e-9, "forward lands outside the rim");
    const [bx, by] = unmapDrop(op, fx, fy);
    near(bx, x, 1e-9, "x");
    near(by, y, 1e-9, "y");
  }
  // The centre itself has no direction: it goes onto the rim, not to NaN.
  const [cx, cy] = mapPoint(op, 480, 360);
  near(Math.hypot(cx - 480, cy - 360), 90, 1e-9, "centre to rim");
});

test("a line tine moves the line by z and a point at distance d by z * u^d, along the tine only", () => {
  const z = 40;
  const u = uForHalf(20);
  const angle = 0.6;
  const op = { kind: "tine", x: 400, y: 300, angle, z, u } as const;
  const [mx, my] = [Math.cos(angle), Math.sin(angle)];
  const [nx, ny] = [-my, mx];
  for (const d of [0, 1, 7.5, 20, 40, 100]) {
    for (const side of [1, -1]) {
      for (const along of [-250, 0, 130]) {
        const x = 400 + along * mx + side * d * nx;
        const y = 300 + along * my + side * d * ny;
        const [fx, fy] = mapPoint(op, x, y);
        near((fx - x) * mx + (fy - y) * my, z * Math.pow(u, d), 1e-9, `displacement at d=${d}`);
        near((fx - x) * nx + (fy - y) * ny, 0, 1e-9, "no motion across the tine");
      }
    }
  }
  near(z * Math.pow(u, 20), z / 2, 1e-9, "u halves the displacement every half-distance");
  // Past the cut-off a point is left exactly where it was, and only sub-CUTOFF_PX motion was given up.
  const dCut = Math.log(CUTOFF_PX / z) / Math.log(u);
  const far = [400 + (dCut + 1) * nx, 300 + (dCut + 1) * ny];
  assert.deepEqual(mapPoint(op, far[0], far[1]), far);
  assert.ok(z * Math.pow(u, dCut + 1) < CUTOFF_PX);
});

test("a comb equals its n tines applied one after another", () => {
  const comb = { kind: "comb", x: 120, y: 80, angle: -0.35, z: -32, u: uForHalf(14), n: 7, spacing: 70 } as const;
  const [nx, ny] = [-Math.sin(comb.angle), Math.cos(comb.angle)];
  const tines = Array.from({ length: comb.n }, (_, i) => ({
    kind: "tine" as const,
    x: comb.x + i * comb.spacing * nx,
    y: comb.y + i * comb.spacing * ny,
    angle: comb.angle,
    z: comb.z,
    u: comb.u,
  }));
  let moved = 0;
  for (const [x, y] of points(800, 11)) {
    const [cx, cy] = mapPoint(comb, x, y);
    let p: [number, number] = [x, y];
    for (const t of tines) p = mapPoint(t, p[0], p[1]);
    near(cx, p[0], 1e-9, "x");
    near(cy, p[1], 1e-9, "y");
    if (Math.hypot(cx - x, cy - y) > 1) moved++;
  }
  assert.ok(moved > 100, `the comb moved ${moved} points`);
});

test("a circular tine and a vortex turn points about their centre by the stated angle", () => {
  const circle = { kind: "circle", x: 480, y: 360, r: 150, z: 60, u: uForHalf(25) } as const;
  const vortex = { kind: "vortex", x: 480, y: 360, z: 2, u: uForHalf(120) } as const;
  for (const [x, y] of points(300, 3)) {
    const rho = Math.hypot(x - 480, y - 360);
    const a0 = Math.atan2(y - 360, x - 480);
    for (const [op, theta] of [
      [circle, (circle.z / circle.r) * Math.pow(circle.u, Math.abs(rho - circle.r))],
      [vortex, vortex.z * Math.pow(vortex.u, rho)],
    ] as const) {
      const [fx, fy] = mapPoint(op, x, y);
      near(Math.hypot(fx - 480, fy - 360), rho, 1e-9, `${op.kind} keeps the radius`);
      const turned = Math.atan2(fy - 360, fx - 480) - a0;
      const wrapped = Math.atan2(Math.sin(turned - theta), Math.cos(turned - theta));
      assert.ok(Math.abs(wrapped) * rho <= CUTOFF_PX + 1e-9, `${op.kind} turns by its angle`);
    }
  }
  // On the circle, a circular tine moves a point exactly z px of arc.
  const [fx, fy] = mapPoint(circle, 480 + 150, 360);
  near(Math.atan2(fy - 360, fx - 480) * 150, 60, 1e-9, "arc on the circle");
});

test("tines, combs, circular tines and vortices also keep every polygon's area within 0.5%", () => {
  let m = run(
    createMarble(W, H),
    { kind: "drop", x: 420, y: 340, r: 110, ink: "sumi" },
    { kind: "drop", x: 420, y: 340, r: 70, ink: "clear" },
    { kind: "drop", x: 560, y: 420, r: 60, ink: "shade" },
  );
  const areas = m.drops.map((d) => ringArea(d.pts));
  m = run(
    m,
    { kind: "tine", x: 0, y: 360, angle: 0, z: 70, u: uForHalf(30) },
    { kind: "comb", x: 300, y: 0, angle: Math.PI / 2, z: 45, u: uForHalf(18), n: 6, spacing: 60 },
    { kind: "circle", x: 450, y: 360, r: 120, z: 90, u: uForHalf(30) },
    { kind: "vortex", x: 470, y: 350, z: -2.5, u: uForHalf(90) },
  );
  m.drops.forEach((d, i) => near(ringArea(d.pts), areas[i], areas[i] * 0.005, `ring ${i}`));
});

test("a seeded recipe replays identically, with Math.random stubbed to throw", (t) => {
  t.mock.method(Math, "random", () => {
    throw new Error("Math.random must not be used");
  });
  const ops = recipe(42, W, H);
  const drops = ops.filter((o) => o.kind === "drop");
  assert.equal(drops.length, 24);
  assert.ok(drops.every((d, i) => d.ink === (i % 2 === 0 ? "sumi" : "clear")), "alternating sumi and clear");
  assert.deepEqual(
    ops.slice(drops.length).map((o) => o.kind),
    ["comb", "comb", "vortex"],
  );
  assert.deepEqual(recipe(42, W, H), ops);
  const a = replay(ops, W, H);
  const b = replay(recipe(42, W, H), W, H);
  assert.equal(a.refused, 0);
  assert.deepEqual(a.marble, b.marble);
  assert.notDeepEqual(replay(recipe(43, W, H), W, H).marble, a.marble);
});

test("MAX_DROPS refuses the next drop cleanly", () => {
  let m = createMarble(W, H);
  for (let i = 0; i < MAX_DROPS; i++) m = run(m, { kind: "drop", x: 20 + (i % 12) * 80, y: 30 + Math.floor(i / 12) * 70, r: 3, ink: "sumi" });
  assert.equal(m.drops.length, MAX_DROPS);
  const r = applyOp(m, { kind: "drop", x: 480, y: 360, r: 3, ink: "clear" });
  assert.deepEqual([r.ok, !r.ok && r.reason], [false, "max_drops"]);
  assert.equal(r.marble, m, "the pond is handed back untouched");
  // Combing still works at the drop cap: only drops are capped.
  assert.ok(applyOp(m, { kind: "tine", x: 0, y: 360, angle: 0, z: 20, u: uForHalf(10) }).ok);
});

test("MAX_VERTS refuses cleanly and the pond never passes it", () => {
  const huge = applyOp(createMarble(W, H), { kind: "drop", x: 480, y: 360, r: 100_000, ink: "sumi" });
  assert.deepEqual([huge.ok, !huge.ok && huge.reason], [false, "max_verts"]);

  let m = replay(recipe(7, W, H), W, H).marble;
  const snapshot = structuredClone(m);
  let refusal: string | undefined;
  for (let i = 0; i < 400 && !refusal; i++) {
    const r = applyOp(m, { kind: "vortex", x: 480, y: 360, z: 3, u: uForHalf(400) });
    if (!r.ok) {
      refusal = r.reason;
      assert.equal(r.marble, m);
    } else {
      assert.ok(r.marble.verts <= MAX_VERTS, `${r.marble.verts} verts`);
      assert.equal(r.marble.verts, r.marble.drops.reduce((s, d) => s + d.pts.length / 2, 0));
      m = r.marble;
    }
  }
  assert.equal(refusal, "max_verts");
  // Ops never mutate the pond they are given.
  assert.deepEqual(replay(recipe(7, W, H), W, H).marble, snapshot);
});

test("malformed ops are refused, not turned into NaN", () => {
  const m = run(createMarble(W, H), { kind: "drop", x: 480, y: 360, r: 40, ink: "sumi" });
  for (const op of [
    { kind: "drop", x: Number.NaN, y: 0, r: 10, ink: "sumi" },
    { kind: "drop", x: 0, y: 0, r: 0, ink: "sumi" },
    { kind: "drop", x: 0, y: 0, r: 5, ink: "gold" },
    { kind: "tine", x: 0, y: 0, angle: 0, z: 10, u: 1 },
    { kind: "comb", x: 0, y: 0, angle: 0, z: 10, u: 0.9, n: 0, spacing: 10 },
    { kind: "vortex", x: 0, y: 0, z: Infinity, u: 0.9 },
    { kind: "circle", x: 0, y: 0, r: -1, z: 10, u: 0.9 },
  ] as unknown as Op[]) {
    const r = applyOp(m, op);
    assert.deepEqual([r.ok, !r.ok && r.reason, r.marble], [false, "invalid", m], JSON.stringify(op));
  }
});

test("refinement keeps every on-screen edge at most MAX_EDGE, and leaves far off-screen edges alone", () => {
  for (const seed of [1, 2, 3]) {
    const { marble } = replay(recipe(seed, W, H), W, H);
    let checked = 0;
    for (const { pts } of marble.drops) {
      for (let i = 0; i < pts.length; i += 2) {
        const j = (i + 2) % pts.length;
        const [ax, ay, bx, by] = [pts[i], pts[i + 1], pts[j], pts[j + 1]];
        if (Math.max(ax, bx) < 0 || Math.min(ax, bx) > W || Math.max(ay, by) < 0 || Math.min(ay, by) > H) continue;
        assert.ok(Math.hypot(bx - ax, by - ay) <= MAX_EDGE + 1e-9, `edge ${Math.hypot(bx - ax, by - ay)}`);
        checked++;
      }
    }
    assert.ok(checked > 1000);
  }
  const identity = (x: number, y: number, out: number[]) => ((out[0] = x), (out[1] = y));
  const rect = { x0: 0, y0: 0, x1: 100, y1: 100 };
  // A square straddling the edge of the pond: its on-screen sides get split, its far side does not.
  const square = refine([50, 50, 2050, 50, 2050, 2050, 50, 2050], identity, rect, MAX_VERTS)!;
  assert.ok(square.length / 2 < 1000, `${square.length / 2} verts`);
  assert.ok(square.includes(2050));
  const onScreen = square.filter((_, i) => i % 2 === 0).filter((x) => x <= 100).length;
  assert.ok(onScreen >= 16, `${onScreen} on-screen verts`);
  assert.equal(refine([0, 0, 600, 0, 600, 600], identity, rect, 10), null, "over budget");
  // The budget is exact, down to a split on the closing edge.
  assert.equal(refine([0, 0, 5, 0, 5, 5], identity, rect, 4)?.length, 8);
  assert.equal(refine([0, 0, 5, 0, 5, 5], identity, rect, 3), null);
  assert.equal(refine([0, 0, 2, 0, 2, 2, 0, 2], identity, rect, 3), null, "the ring's own vertices count too");
});

test("Douglas-Peucker keeps every dropped vertex within 0.75px of the simplified ring", () => {
  const { marble } = replay(recipe(5, W, H), W, H);
  for (const { pts } of marble.drops.slice(-6)) {
    const s = simplifyRing(pts);
    assert.ok(s.length < pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      let best = Infinity;
      for (let k = 0; k < s.length; k += 2) {
        const l = (k + 2) % s.length;
        const [ax, ay, ex, ey] = [s[k], s[k + 1], s[l] - s[k], s[l + 1] - s[k + 1]];
        const len2 = ex * ex + ey * ey;
        const t = len2 ? Math.max(0, Math.min(1, ((pts[i] - ax) * ex + (pts[i + 1] - ay) * ey) / len2)) : 0;
        best = Math.min(best, Math.hypot(pts[i] - ax - t * ex, pts[i + 1] - ay - t * ey));
      }
      assert.ok(best <= SVG_TOLERANCE + 1e-9, `vertex ${best}px off`);
    }
  }
});

test("the SVG of a replayed print is at most 60 KB, 1-decimal, and has no NaN or Infinity", () => {
  for (const [w, h] of [
    [W, H],
    [1600, 900],
    [390, 700],
  ]) {
    for (const seed of [1, 2, 3, 42]) {
      const { marble } = replay(recipe(seed, w, h), w, h);
      const paths = toSvgPaths(marble);
      assert.ok(paths.length >= 20, `${paths.length} paths`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${paths
        .map((p) => `<path class="ink-${p.ink}" d="${p.d}"/>`)
        .join("")}</svg>`;
      assert.ok(Buffer.byteLength(svg) <= 60 * 1024, `${Buffer.byteLength(svg)} bytes`);
      assert.doesNotMatch(svg, /NaN|Infinity/);
      for (const { d } of paths) {
        assert.match(d, /^M-?\d+(\.\d)? -?\d+(\.\d)?L(-?\d+(\.\d)? -?\d+(\.\d)? ?)+Z$/);
      }
    }
  }
});
