import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, ORRERY, SUN_RADIUS_KM, bodyBySlug, neighbours, type Body } from "./bodies.ts";
import { BADGES, CALLOUTS, EARTH_LABEL, FOOTER, LIFE, TAGLINE, TITLE } from "./poster.ts";
import { LAYERS, SOURCES } from "./sun.ts";
import { textWords } from "./words.ts";

const SLUGS = [
  "sun",
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "proxima-centauri",
  "sirius",
  "vega",
  "polaris",
  "betelgeuse",
];

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const get = (slug: string): Body => {
  const b = bodyBySlug(slug);
  assert.ok(b, slug);
  return b;
};

test("fourteen bodies in the fixed order, with plain slugs", () => {
  assert.equal(BODIES.length, 14);
  assert.deepEqual(
    BODIES.map((b) => b.slug),
    SLUGS,
  );
  for (const b of BODIES) assert.match(b.slug, /^[a-z-]+$/);
  assert.equal(new Set(BODIES.map((b) => b.name)).size, 14);
});

test("eight planets and six stars, the Sun among the stars", () => {
  assert.equal(BODIES.filter((b) => b.kind === "planet").length, 8);
  assert.deepEqual(
    BODIES.filter((b) => b.kind === "star").map((b) => b.slug),
    ["sun", "proxima-centauri", "sirius", "vega", "polaris", "betelgeuse"],
  );
});

test("every body has 3 to 6 layers, interior first, tiling [0, 1], atmosphere contiguous from 0", () => {
  for (const b of BODIES) {
    assert.ok(b.layers.length >= 3 && b.layers.length <= 6, `${b.slug}: ${b.layers.length} layers`);
    assert.equal(new Set(b.layers.map((l) => l.id)).size, b.layers.length, `${b.slug}: layer ids repeat`);
    const firstAir = b.layers.findIndex((l) => l.region === "atmosphere");
    if (firstAir >= 0) {
      assert.ok(
        b.layers.slice(firstAir).every((l) => l.region === "atmosphere"),
        `${b.slug}: an interior layer after the atmosphere`,
      );
    }
    const inner = b.layers.filter((l) => l.region === "interior");
    const outer = b.layers.filter((l) => l.region === "atmosphere");
    assert.ok(inner.length >= 1, b.slug);
    assert.equal(inner[0].from, 0, `${b.slug}: interior starts at 0`);
    assert.equal(inner.at(-1)?.to, 1, `${b.slug}: interior ends at 1`);
    for (const [i, l] of inner.entries()) {
      assert.ok(l.to > l.from, `${b.slug}.${l.id} is empty`);
      if (i > 0) assert.ok(near(l.from, inner[i - 1].to), `${b.slug}.${l.id} gap or overlap`);
    }
    if (outer.length) assert.equal(outer[0].from, 0, `${b.slug}: atmosphere starts at 0`);
    for (const [i, l] of outer.entries()) {
      assert.ok(l.to > l.from, `${b.slug}.${l.id} is empty`);
      if (i > 0) assert.equal(l.from, outer[i - 1].to, `${b.slug}.${l.id} gap or overlap`);
    }
    for (const l of b.layers) assert.match(l.colour, /^#[0-9a-f]{6}$/, `${b.slug}.${l.id}`);
  }
});

test("one callout per layer, in layer order, numbered 1..k", () => {
  for (const b of BODIES) {
    const { callouts } = b.poster;
    assert.deepEqual(
      callouts.map((c) => c.layer),
      b.layers.map((l) => l.id),
      b.slug,
    );
    assert.deepEqual(
      callouts.map((c) => c.n),
      b.layers.map((_, i) => i + 1),
      b.slug,
    );
    for (const c of callouts) assert.ok(c.text.trim().length > 0, `${b.slug}.${c.layer}`);
  }
});

test("exactly four badges each", () => {
  for (const b of BODIES) {
    assert.equal(b.poster.badges.length, 4, b.slug);
    for (const x of b.poster.badges) assert.ok(x.big.length > 0 && x.small.length > 0, `${b.slug}: ${x.big}`);
  }
});

test("stars have a three-step life strip, planets none", () => {
  for (const b of BODIES) {
    if (b.kind === "star") {
      assert.equal(b.poster.life?.length, 3, b.slug);
      assert.equal(new Set(b.poster.life?.map((s) => s.id)).size, 3, b.slug);
    } else {
      assert.equal(b.poster.life, undefined, b.slug);
    }
  }
});

test("every item names one of its body's sources, all https on nasa.gov or wikipedia.org", () => {
  for (const b of BODIES) {
    const keys = Object.keys(b.sources);
    assert.ok(keys.length > 0, b.slug);
    const items = [...b.poster.callouts, ...b.poster.badges, ...(b.poster.life ?? [])];
    for (const item of items) assert.ok(keys.includes(item.source), `${b.slug}: ${JSON.stringify(item)}`);
    for (const [key, s] of Object.entries(b.sources)) {
      const url = new URL(s.url);
      assert.equal(url.protocol, "https:", `${b.slug}.${key}`);
      assert.ok(/(^|\.)(nasa\.gov|wikipedia\.org)$/.test(url.hostname), `${b.slug}.${key}: ${url.hostname}`);
      assert.ok(s.name.length > 0, `${b.slug}.${key}`);
    }
  }
});

test("the host check refuses look-alikes", () => {
  const ok = (h: string) => /(^|\.)(nasa\.gov|wikipedia\.org)$/.test(h);
  assert.ok(ok("science.nasa.gov") && ok("en.wikipedia.org"));
  assert.ok(!ok("notnasa.gov") && !ok("wikipedia.org.evil.example") && !ok("fakewikipedia.org"));
});

test("each poster's words fit the 170-word data budget", () => {
  for (const b of BODIES) {
    const p = b.poster;
    const text = [
      p.title,
      p.tagline,
      ...p.callouts.map((c) => `${c.n} ${c.text}`),
      ...b.layers.map((l) => l.name), // the page may name each layer beside its callout
      ...p.badges.map((x) => `${x.big} ${x.small}`),
      ...(p.life ?? []).map((s) => `${s.label} ${s.note ?? ""}`),
      p.footer,
      b.compare.label,
    ].join(" ");
    const words = textWords(text);
    assert.ok(words <= 170, `${b.slug}: ${words} words`);
    assert.ok(words >= 30, `${b.slug}: only ${words} words`);
  }
});

test("the Sun's entry is today's Sun poster, untouched", () => {
  const sun = get("sun");
  assert.deepEqual(sun.layers, LAYERS);
  assert.deepEqual(sun.poster.callouts, CALLOUTS);
  assert.deepEqual(sun.poster.badges, BADGES);
  assert.deepEqual(sun.poster.life, LIFE);
  assert.deepEqual(sun.sources, SOURCES);
  assert.equal(sun.layers, LAYERS, "imported, not copied");
  assert.equal(sun.poster.title, TITLE);
  assert.equal(sun.poster.tagline, TAGLINE);
  assert.equal(sun.poster.footer, FOOTER);
  assert.equal(sun.compare.label, EARTH_LABEL);
  assert.equal(sun.radiusKm, SUN_RADIUS_KM);
  assert.equal(Math.round(SUN_RADIUS_KM / get("earth").radiusKm), 109, "109 Earths across");
});

test("radii: Jupiter the largest planet, Mercury the smallest, the stars in size order", () => {
  const planets = BODIES.filter((b) => b.kind === "planet");
  const by = [...planets].sort((a, b) => a.radiusKm - b.radiusKm);
  assert.equal(by[0].slug, "mercury");
  assert.equal(by.at(-1)?.slug, "jupiter");
  const stars = ["proxima-centauri", "sun", "sirius", "vega", "polaris", "betelgeuse"].map(get);
  for (let i = 1; i < stars.length; i++) {
    assert.ok(stars[i].radiusKm > stars[i - 1].radiusKm, `${stars[i - 1].slug} < ${stars[i].slug}`);
  }
  for (const b of BODIES) assert.ok(Number.isFinite(b.radiusKm) && b.radiusKm > 0, b.slug);
});

test("the 'to scale' marks: Betelgeuse holds Earth's orbit, the rest are dots", () => {
  for (const b of BODIES) {
    assert.ok(b.compare.radiusKm > 0 && b.compare.label.endsWith("to scale"), b.slug);
    assert.equal(b.compare.shape, b.slug === "betelgeuse" ? "orbit" : "dot", b.slug);
  }
  const betelgeuse = get("betelgeuse");
  const au = betelgeuse.compare.radiusKm / SUN_RADIUS_KM;
  assert.ok(Math.abs(au - 215) < 1, `1 AU is ${au} R☉`);
  assert.ok(betelgeuse.compare.radiusKm < betelgeuse.radiusKm, "Earth's orbit fits inside Betelgeuse");
});

test("the planets' sunlight badge is the fact sheet's distance over the speed of light", () => {
  assert.equal(get("earth").poster.badges[3].big, "8 min 19 s");
  assert.equal(get("mercury").poster.badges[3].big, "3 min 13 s");
  assert.equal(get("jupiter").poster.badges[3].big, "43 min 17 s");
});

test("neighbours run the fixed order and stop at both ends", () => {
  assert.equal(neighbours("sun").prev, undefined);
  assert.equal(neighbours("sun").next?.slug, "mercury");
  assert.equal(neighbours("betelgeuse").next, undefined);
  assert.equal(neighbours("betelgeuse").prev?.slug, "polaris");
  assert.equal(neighbours("neptune").next?.slug, "proxima-centauri");
  assert.equal(neighbours("proxima-centauri").prev?.slug, "neptune");
  assert.deepEqual(neighbours("nope"), {});
  assert.equal(bodyBySlug("nope"), undefined);
});

test("the Orrery's own words", () => {
  assert.equal(ORRERY.title, "Orrery");
  assert.ok(ORRERY.tagline.length > 0);
  assert.equal(ORRERY.footer, FOOTER);
});
