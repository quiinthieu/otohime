import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, SUN_RADIUS_KM, bodyBySlug, type Body } from "./bodies.ts";
import { JUPITER_R, LABEL_SIZE, ROW_VIEW, VEGA_R, edgeArc, edgeArea, labelWidth, planetRow, starRow, type Row } from "./rows.ts";

const rows: Row[] = [planetRow(), starRow()];
const of = (slug: string) => bodyBySlug(slug) as Body;
const within1 = (got: number, want: number, what: string) =>
  assert.ok(Math.abs(got - want) <= 0.01 * want, `${what}: ${got}, want ${want} within 1 %`);

test("the rows' titles and edge labels are the plan's words", () => {
  const [planets, stars] = rows;
  assert.equal(planets.title, "The planets, to scale");
  assert.equal(stars.title, "The stars, to scale");
  assert.deepEqual(
    planets.edges.map((e) => [e.slug, e.label]),
    [["sun", "the Sun's edge, to scale"]],
  );
  assert.deepEqual(
    stars.edges.map((e) => [e.slug, e.label]).sort(),
    [
      ["betelgeuse", "Betelgeuse would fill the page"],
      ["polaris", "Polaris would reach here"],
    ],
  );
});

test("the planets row is the eight planets in orbit order, Jupiter at r = 110", () => {
  const row = planetRow();
  assert.deepEqual(
    row.discs.map((d) => d.slug),
    ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"],
  );
  assert.deepEqual(
    row.discs.map((d) => d.slug),
    BODIES.filter((b) => b.kind === "planet").map((b) => b.slug),
  );
  const xs = row.discs.map((d) => d.cx);
  assert.deepEqual(
    xs,
    [...xs].sort((a, b) => a - b),
    "left to right",
  );
  assert.equal(row.discs.find((d) => d.slug === "jupiter")?.r, JUPITER_R);
});

test("the stars row has the Sun, Proxima, Sirius and Vega as discs, Vega at r <= 70", () => {
  const row = starRow();
  assert.deepEqual(
    row.discs.map((d) => d.slug),
    ["sun", "proxima-centauri", "sirius", "vega"],
  );
  const vega = row.discs.find((d) => d.slug === "vega");
  assert.ok(vega && vega.r <= VEGA_R, `Vega r ${vega?.r}`);
});

test("every disc's r is proportional to its radius, within 1 %, and at least 2", () => {
  for (const row of rows) {
    for (const d of row.discs) {
      within1(d.r, of(d.slug).radiusKm / row.kmPerUnit, `${row.id} ${d.slug}`);
      assert.ok(d.r >= 2, `${row.id} ${d.slug} r ${d.r}`);
    }
  }
});

test("the edge arcs' radii are true to the row's scale, within 1 %", () => {
  const planets = planetRow();
  const jupiter = of("jupiter");
  within1(planets.edges[0].r, (JUPITER_R * SUN_RADIUS_KM) / jupiter.radiusKm, "the Sun's edge");
  within1(planets.edges[0].r, SUN_RADIUS_KM / planets.kmPerUnit, "the Sun's edge");
  const stars = starRow();
  for (const e of stars.edges) within1(e.r, of(e.slug).radiusKm / stars.kmPerUnit, `${e.slug}'s edge`);
  // and they really do not fit: each is taller than the row
  for (const row of rows) for (const e of row.edges) assert.ok(2 * e.r > ROW_VIEW.h, `${e.slug} would fit`);
});

test("no two discs overlap, no disc overlaps an edge, and no names collide", () => {
  for (const row of rows) {
    const ds = row.discs;
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        const dist = Math.hypot(ds[i].cx - ds[j].cx, ds[i].cy - ds[j].cy);
        assert.ok(dist >= ds[i].r + ds[j].r, `${ds[i].slug} overlaps ${ds[j].slug}`);
        const apart = Math.abs(ds[i].label.x - ds[j].label.x);
        const sameLine = Math.abs(ds[i].label.y - ds[j].label.y) < LABEL_SIZE;
        assert.ok(!sameLine || apart >= (labelWidth(ds[i].name) + labelWidth(ds[j].name)) / 2, `${ds[i].name} and ${ds[j].name} labels`);
      }
      for (const e of row.edges) {
        const dist = Math.hypot(ds[i].cx - e.cx, ds[i].cy - e.cy);
        assert.ok(dist >= e.r + ds[i].r, `${ds[i].slug} overlaps ${e.slug}'s edge`);
      }
    }
  }
});

test("both rows fit the 1000 x 260 viewBox", () => {
  const { w, h } = ROW_VIEW;
  for (const row of rows) {
    for (const d of row.discs) {
      assert.ok(d.cx - d.r >= 0 && d.cx + d.r <= w && d.cy - d.r >= 0 && d.cy + d.r <= h, `${d.slug} disc`);
      const half = labelWidth(d.name) / 2;
      assert.ok(d.label.x - half >= 0 && d.label.x + half <= w && d.label.y <= h - 4 && d.label.y >= LABEL_SIZE, `${d.slug} label`);
    }
    for (const e of row.edges) {
      // the limb crosses the page, and its label sits on the page
      const reach = e.side === "left" ? e.cx + e.r : e.cx - e.r;
      assert.ok(reach > 0 && reach < w, `${e.slug} edge at ${reach}`);
      const { x, anchor } = e.labelAt;
      const [x0, x1] = anchor === "start" ? [x, x + labelWidth(e.label)] : [x - labelWidth(e.label), x];
      assert.ok(x0 >= 0 && x1 <= w && e.labelAt.y >= LABEL_SIZE && e.labelAt.y <= h, `${e.slug} label`);
    }
  }
});

test("the edge paths are finite, deterministic and span the row top to bottom", () => {
  for (const row of rows) {
    for (const e of row.edges) {
      const arc = edgeArc(e);
      const area = edgeArea(e);
      for (const d of [arc, area]) assert.doesNotMatch(d, /NaN|undefined|Infinity/, `${e.slug}: ${d}`);
      assert.match(arc, new RegExp(`^M [\\d.]+ 0 A [\\d.]+ [\\d.]+ 0 0 [01] [\\d.]+ ${ROW_VIEW.h}$`), arc);
      assert.equal(edgeArc(e), arc);
    }
  }
  assert.deepEqual(planetRow(), planetRow());
  assert.deepEqual(starRow(), starRow());
});
