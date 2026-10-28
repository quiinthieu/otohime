import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { site } from "../../../../../content/site.ts";
import { buildSky, SKY_SCALE, type SkyChart, type SkyNote } from "./sky.ts";

const REFERENCE = "2026-10-28";
const note = (slug: string, fields: Partial<SkyNote> = {}): SkyNote => ({
  slug, title: slug, body: "A paper note.", date: REFERENCE, tags: [], ...fields,
});

function assertGeometry(chart: SkyChart) {
  assert.ok(Number.isFinite(chart.width) && chart.width >= 960);
  assert.ok(Number.isFinite(chart.height) && chart.height >= 640);
  for (const star of chart.stars) {
    assert.ok(Number.isFinite(star.x) && Number.isFinite(star.y));
    assert.ok(star.x - star.radius >= 0 && star.x + star.radius <= chart.width);
    assert.ok(star.y - star.radius >= 0 && star.y + star.radius <= chart.height);
    assert.ok(star.radius >= SKY_SCALE.minRadius && star.radius <= SKY_SCALE.maxRadius);
    assert.ok(star.brightness >= SKY_SCALE.minBrightness && star.brightness <= 1);
  }
  for (let i = 0; i < chart.stars.length; i++) {
    for (let j = i + 1; j < chart.stars.length; j++) {
      const a = chart.stars[i];
      const b = chart.stars[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(distance >= 48, `${a.slug} and ${b.slug} must leave room for focus targets`);
      assert.ok(distance > a.radius + b.radius);
    }
  }
}

test("sky is repeatable, order independent and safe for frozen published notes", () => {
  const notes = Object.freeze(site.notes.map((entry) => Object.freeze({
    ...entry, tags: Object.freeze([...entry.tags]),
  })));
  const expected = buildSky(notes, REFERENCE);
  assert.deepEqual(buildSky(notes, REFERENCE), expected);
  assert.deepEqual(buildSky([...notes].reverse(), REFERENCE), expected);
  assert.deepEqual(buildSky([notes[1], notes[2], notes[0]], REFERENCE), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(expected)), expected, "plain serializable server/client data");
  assert.equal(expected.stars.length, 3);
  assert.equal(expected.edges.length, 1);
  assert.equal(expected.edges[0].tag, "data-engineering");
  assertGeometry(expected);
});

test("empty and single-note skies retain valid bounds without invented constellations", () => {
  const empty = buildSky([], REFERENCE);
  assertGeometry(empty);
  assert.deepEqual(empty.stars, []);
  assert.deepEqual(empty.edges, []);
  assert.deepEqual(empty.constellations, []);
  const single = buildSky([{ slug: "alone" }], REFERENCE);
  assertGeometry(single);
  assert.equal(single.stars.length, 1);
  assert.equal(single.stars[0].title, "alone");
  assert.equal(single.stars[0].radius, SKY_SCALE.minRadius);
  assert.equal(single.stars[0].brightness, SKY_SCALE.minBrightness);
  assert.deepEqual(single.edges, []);
  assert.deepEqual(single.constellations, []);
});

test("dense skies expand their finite bounds and keep maximum-sized stars spaced", () => {
  const notes = Array.from({ length: 1000 }, (_, index) => note(`note-${index}`, {
    body: "x".repeat(5000), tags: ["paper"],
  }));
  const chart = buildSky(notes, REFERENCE);
  assert.equal(chart.stars.length, notes.length);
  assert.equal(chart.edges.length, notes.length - 1);
  assert.ok(chart.width > 960 && chart.height > 640);
  assertGeometry(chart);
  assert.deepEqual(buildSky(notes.reverse(), REFERENCE), chart);
});

test("slug seeds affect placement while edits and reference dates leave positions alone", () => {
  const notes = [note("a"), note("b"), note("c")];
  const positions = (chart: SkyChart) => chart.stars.map(({ slug, x, y }) => ({ slug, x, y }));
  const original = positions(buildSky(notes, REFERENCE));
  assert.deepEqual(positions(buildSky(notes.map((entry) => ({
    ...entry, body: "x".repeat(9000), title: "Changed", date: "2000-01-01", tags: ["new"],
  })), "2030-01-01")), original);
  const renamed = positions(buildSky([note("d"), note("e"), note("f")], REFERENCE));
  assert.notDeepEqual(renamed.map(({ x, y }) => ({ x, y })), original.map(({ x, y }) => ({ x, y })));
});

test("body length controls a clamped absolute size scale, independent of the collection", () => {
  const lengths = [0, 100, 1000, 2000, 10000];
  const stars = buildSky(lengths.map((length, i) => note(`n-${i}`, { body: "x".repeat(length) })), REFERENCE).stars;
  assert.equal(stars[0].radius, SKY_SCALE.minRadius);
  assert.ok(stars[0].radius < stars[1].radius && stars[1].radius < stars[2].radius && stars[2].radius < stars[3].radius);
  assert.equal(stars[3].radius, SKY_SCALE.maxRadius);
  assert.equal(stars[4].radius, SKY_SCALE.maxRadius);
  assert.equal(buildSky([note("n-2", { body: "x".repeat(1000) })], REFERENCE).stars[0].radius, stars[2].radius);
});

test("UTC age dims monotonically to a visible floor, with future dates capped", () => {
  const brightness = (date: string, reference = REFERENCE) => buildSky([note("a", { date })], reference).stars[0].brightness;
  assert.equal(brightness(REFERENCE), 1);
  assert.equal(brightness("2099-01-01"), 1);
  assert.ok(brightness("2026-10-27") < 1);
  assert.ok(brightness("2026-10-27") > brightness("2026-01-01"));
  assert.ok(brightness("2026-01-01") > brightness("2025-01-01"));
  assert.equal(brightness("2000-01-01"), SKY_SCALE.minBrightness);
  assert.ok(brightness("2026-01-01", "2027-10-28") < brightness("2026-01-01"));
  assert.equal(brightness("2024-02-29", "2024-02-29"), 1);
  for (const invalid of ["", "nonsense", "2026-02-29", "2026-04-31", "2026-13-01", "2026-1-1", "2026-10-28T00:00:00Z"]) {
    assert.equal(brightness(invalid), SKY_SCALE.minBrightness, invalid);
    assert.throws(() => buildSky([], invalid), RangeError, invalid);
  }
});

test("shared tags alone create named, deduplicated constellation chains", () => {
  const notes = [
    note("a", { tags: ["paper", "ink", "paper", " "] }),
    note("b", { tags: ["paper", "ink"] }),
    note("c", { tags: ["paper", "solo"] }),
    note("d", { tags: [] }),
    note("e", { tags: ["elsewhere"] }),
  ];
  const chart = buildSky(notes, REFERENCE);
  assert.deepEqual(chart.edges, [
    { from: "a", to: "b", tag: "ink" },
    { from: "a", to: "b", tag: "paper" },
    { from: "b", to: "c", tag: "paper" },
  ]);
  assert.deepEqual(chart.constellations.map(({ tag, slugs }) => ({ tag, slugs })), [
    { tag: "ink", slugs: ["a", "b"] },
    { tag: "paper", slugs: ["a", "b", "c"] },
  ]);
  for (const edge of chart.edges) {
    const from = chart.stars.find(({ slug }) => slug === edge.from)!;
    const to = chart.stars.find(({ slug }) => slug === edge.to)!;
    assert.notEqual(from.slug, to.slug);
    assert.ok(from.tags.includes(edge.tag) && to.tags.includes(edge.tag));
  }
  assert.deepEqual(buildSky([note("a", { tags: ["ink"] }), note("b", { tags: ["paper"] })], REFERENCE).edges, [], "negative control: unrelated pair");
  assert.deepEqual(buildSky([note("a"), note("b")], REFERENCE).constellations, [], "negative control: untagged pair");
  assert.deepEqual(buildSky(notes.reverse().map((entry) => ({ ...entry, tags: [...entry.tags!].reverse() })), REFERENCE), chart);
});

test("playful names depend only on the tag, not membership, order or the date", () => {
  const names = (chart: SkyChart) => chart.constellations.map(({ tag, name }) => ({ tag, name }));
  const pair = [note("a", { tags: ["paper", "ink"] }), note("b", { tags: ["paper", "ink"] })];
  const expected = names(buildSky(pair, REFERENCE));
  for (const { name } of expected) assert.match(name, /^The [A-Z][a-z]+ [A-Z][a-z]+$/);
  assert.equal(new Set(expected.map(({ name }) => name)).size, 2);
  assert.deepEqual(names(buildSky([note("z", { tags: ["ink", "paper"] }), ...pair.reverse()], "2030-01-01")), expected);
});

test("malformed entries and duplicate identities cannot produce NaN, false edges or order drift", () => {
  const malformed = [
    null, undefined, 12, {}, { slug: "" }, { slug: "bad/path" }, { slug: " spaced " },
    { slug: "a", title: null, body: 3000, date: {}, tags: [null, {}, 1, "", " ink ", "ink"] },
    { slug: "b", tags: "ink" }, { slug: "c", body: null },
    { slug: "a", title: "Other duplicate", body: "longer", tags: ["different"] },
  ] as unknown as SkyNote[];
  const chart = buildSky(malformed, REFERENCE);
  assertGeometry(chart);
  assert.deepEqual(chart.stars.map(({ slug }) => slug), ["a", "b", "c"]);
  assert.deepEqual(chart.edges, []);
  assert.deepEqual(buildSky([...malformed].reverse(), REFERENCE), chart);
  const sparse: SkyNote[] = new Array(3);
  sparse[1] = { slug: "only" };
  assert.deepEqual(buildSky(sparse, REFERENCE), buildSky([{ slug: "only" }], REFERENCE));
  const defaults = buildSky([malformed[7]], REFERENCE).stars[0];
  assert.equal(defaults.title, "a");
  assert.equal(defaults.radius, SKY_SCALE.minRadius);
  assert.equal(defaults.brightness, SKY_SCALE.minBrightness);
  assert.deepEqual(defaults.tags, ["ink"]);
});

test("server and client environments produce identical geometry across timezones", () => {
  const moduleUrl = new URL("./sky.ts", import.meta.url).href;
  const source = `import { buildSky } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(buildSky(${JSON.stringify(site.notes)}, ${JSON.stringify(REFERENCE)})));`;
  const results = ["Pacific/Honolulu", "Asia/Ho_Chi_Minh"].map((TZ) => {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--input-type=module", "-e", source], {
      env: { ...process.env, TZ }, encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], buildSky(site.notes, REFERENCE));
});
