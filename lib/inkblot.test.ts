import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeBlot, appendUserDrop, curatedWardNotes, dailyBlotKey, dailyBlotSeed,
  describeBlotAlt, formatBlotSeed, generateInkblotReading, generateSeededDrops,
  hashBlotString, INKBLOT_DISCLAIMER, INKBLOT_READING_FRAGMENTS, INKBLOT_READING_TEMPLATES,
  MAX_INKBLOT_DROPS, mirrorDropsForFold, mulberry32, parseBlotSeed, validateBlotKey,
  type BlotFeatures, type InkDrop, type InkEllipse,
} from "./inkblot.ts";
import * as routeModel from "../app/(site)/(app)/play/inkblot/_lib/blot.ts";

const drop = (values: Partial<InkDrop> = {}): InkDrop => ({ x: 0.3, y: 0.5, r: 0.05, elongation: 1, angle: 0, satellites: [], ...values });
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const bounded = (value: number, min: number, max: number) => assert.ok(Number.isFinite(value) && value >= min && value <= max, `${value} outside [${min}, ${max}]`);

test("PRNG and UTF-16 hash are reproducible with stable known vectors", () => {
  const random = mulberry32(1);
  assert.deepEqual([random(), random(), random()], [0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  assert.equal(hashBlotString(""), 2166136261);
  assert.equal(hashBlotString("hello"), 1335831723);
  assert.notEqual(hashBlotString("紙🐛"), hashBlotString("紙🐞"));
  const first = mulberry32(0), second = mulberry32(0), different = mulberry32(1);
  let differs = false;
  for (let i = 0; i < 10_000; i++) {
    const value = first();
    assert.equal(value, second());
    assert.ok(value >= 0 && value < 1);
    differs ||= value !== different();
  }
  assert.equal(differs, true);
});

test("base36 round-trips uint32 seeds and maps all ten-character keys safely", () => {
  for (const seed of [0, 1, 35, 36, 2024, 0x7fffffff, 0xffffffff]) {
    assert.equal(parseBlotSeed(formatBlotSeed(seed)), seed);
  }
  assert.equal(formatBlotSeed(-1), "1z141z3");
  assert.equal(parseBlotSeed("00000"), 0);
  assert.equal(parseBlotSeed("zzzzzzzzzz"), 3104833535);
  for (const key of ["", "A", "abc ", " abc", "abc\n", "a\r", "a\t", "12345678901", "-1", "1.2", "1_2", "é", "ａｂｃ", null, 123]) {
    assert.equal(parseBlotSeed(key), null, JSON.stringify(key));
  }
});

test("UTC dates cross local midnight and UTC midnight independently", () => {
  assert.equal(dailyBlotKey(new Date("2024-02-29T00:01:00+07:00")), "daily:2024-02-28");
  assert.equal(dailyBlotKey(new Date("2024-02-29T23:59:59.999Z")), "daily:2024-02-29");
  assert.equal(dailyBlotKey(new Date("2024-03-01T00:00:00.000Z")), "daily:2024-03-01");
  assert.equal(dailyBlotKey(new Date("2024-02-29T23:59:00-07:00")), "daily:2024-03-01");
  assert.equal(dailyBlotSeed("2024-02-29"), 2999790945);
  assert.equal(dailyBlotSeed("2024-02-29"), hashBlotString("inkblot:2024-02-29"));
  assert.notDeepEqual(generateSeededDrops(dailyBlotSeed("2024-02-29")), generateSeededDrops(dailyBlotSeed("2024-03-01")));
  for (const value of ["2023-02-29", "2026-02-30", "2024-13-01", "2024-00-01", "2024-01-00", "1900-02-29", "2024-2-29", "2024-02-29Z", "not-a-date"]) {
    assert.throws(() => dailyBlotSeed(value), RangeError, value);
  }
  assert.doesNotThrow(() => dailyBlotSeed("2000-02-29"));
  assert.doesNotThrow(() => dailyBlotSeed("0000-02-29"));
});

test("key validation accepts exactly base36 or adjacent valid UTC calendar days", () => {
  for (const time of ["2024-02-29T00:00:00.000Z", "2024-02-29T23:59:59.999Z"]) {
    const now = new Date(time);
    for (const key of ["0", "a", "abcdef1234", "zzzzzzzzzz", "0000000000", "daily:2024-02-28", "daily:2024-02-29", "daily:2024-03-01"]) {
      assert.equal(validateBlotKey(key, now), true, `${key} at ${time}`);
    }
    for (const key of ["", "ABC", "aaaaaaaaaaa", "a-b", "a_b", "a b", "a\n", "abc/def", "daily:2024-02-27", "daily:2024-03-02", "daily:2024-02-30", "daily:2026-02-30", "daily:2023-02-29", "daily:2024-2-29", "daily:2024-00-29", "daily:2024-02-00", "daily:2024-13-29", "daily:2024-02-29T00:00:00Z", "daily:2024-02-29\n", "DAILY:2024-02-29", "daily:2024-02-29/", null, undefined, {}, 0]) {
      assert.equal(validateBlotKey(key, now), false, `${JSON.stringify(key)} at ${time}`);
    }
  }
  const newYear = new Date("2027-01-01T18:00:00Z");
  assert.equal(validateBlotKey("daily:2026-12-31", newYear), true);
  assert.equal(validateBlotKey("daily:2027-01-02", newYear), true);
  assert.equal(validateBlotKey("daily:2026-12-30", newYear), false);
  assert.equal(validateBlotKey("daily:2024-02-29", new Date(NaN)), false);
});

test("seeded plates have 8–20 left-half bodies and 1–4 satellite splatters each", () => {
  const counts = new Set<number>();
  for (let seed = 0; seed < 256; seed++) {
    const drops = generateSeededDrops(seed);
    assert.deepEqual(drops, generateSeededDrops(seed));
    bounded(drops.length, 8, 20);
    counts.add(drops.length);
    for (const body of drops) {
      bounded(body.x, 0.12, 0.49);
      bounded(body.y, 0.12, 0.88);
      bounded(body.r, 0.025, 0.11);
      bounded(body.elongation, 1, 2.4);
      bounded(body.angle, 0, Math.PI);
      bounded(body.satellites.length, 1, 4);
      for (const satellite of body.satellites) {
        bounded(satellite.x, 0, 0.49);
        bounded(satellite.y, 0, 1);
        bounded(satellite.r, 0.002, 0.025);
      }
    }
  }
  assert.equal(counts.size, 13);
  assert.notDeepEqual(generateSeededDrops(1), generateSeededDrops(2));
  const modified = generateSeededDrops(1);
  modified[0].x = 0;
  assert.notEqual(generateSeededDrops(1)[0].x, 0);
});

test("user drips clamp geometry, reject nonfinite coordinates and never mutate inputs", () => {
  const existing = Object.freeze([Object.freeze(drop())]);
  const input = Object.freeze({ x: 2, y: -5, r: 100, elongation: 100, angle: -Math.PI / 2,
    satellites: Object.freeze(Array.from({ length: 9 }, () => Object.freeze({ x: 2, y: -1, r: 3, elongation: 1, angle: 0 }))),
  });
  const result = appendUserDrop(existing, input);
  assert.equal(existing.length, 1);
  assert.equal(input.x, 2);
  assert.equal(result.length, 2);
  assert.equal(result[1].x, 0.49);
  assert.equal(result[1].y, 0.015);
  assert.equal(result[1].r, 0.11);
  assert.equal(result[1].elongation, 2.4);
  bounded(result[1].angle, 0, Math.PI * 2);
  assert.equal(result[1].satellites.length, 4);
  for (const satellite of result[1].satellites) {
    bounded(satellite.x, 0, 0.49);
    bounded(satellite.y, 0, 1);
    bounded(satellite.r, 0.002, 0.025);
  }
  const nonfinite = appendUserDrop([], { x: NaN, y: Infinity, r: -Infinity, angle: NaN, elongation: Infinity })[0];
  assert.deepEqual(nonfinite, drop({ x: 0.25 }));
  assert.equal(appendUserDrop([], { x: 0, y: 0, r: -1 })[0].r, 0.025);
});

test("the 48-drop cap preserves the oldest drips without mutating a full plate", () => {
  let drops: InkDrop[] = [];
  for (let i = 0; i < 80; i++) drops = appendUserDrop(drops, { x: 0.2, y: 0.1 + i / 100 });
  assert.equal(drops.length, MAX_INKBLOT_DROPS);
  near(drops[47].y, 0.57);
  assert.deepEqual(appendUserDrop(Object.freeze(drops), { x: 0.4, y: 0.9 }), drops);
  assert.equal(appendUserDrop(Array(60).fill(drop()), { x: 0.3, y: 0.3 }).length, 48);
});

test("fold pairs mirror every ellipse exactly, including satellites and nonzero angles", () => {
  function assertMirror(left: InkEllipse, right: InkEllipse) {
    assert.equal(right.x, 1 - left.x);
    assert.equal(right.y, left.y);
    assert.equal(right.r, left.r);
    assert.equal(right.elongation, left.elongation);
    assert.equal(right.angle, -left.angle);
    // A point on the rotated major axis must also reflect across the crease.
    near(right.x - Math.cos(right.angle) * right.r * right.elongation,
      1 - (left.x + Math.cos(left.angle) * left.r * left.elongation));
    near(right.y - Math.sin(right.angle) * right.r * right.elongation,
      left.y + Math.sin(left.angle) * left.r * left.elongation);
  }
  for (let seed = 0; seed < 64; seed++) {
    const drops = generateSeededDrops(seed);
    const before = structuredClone(drops);
    const folded = mirrorDropsForFold(drops);
    assert.deepEqual(folded, mirrorDropsForFold(drops));
    assert.deepEqual(drops, before);
    for (let i = 0; i < drops.length; i++) {
      const left = folded[i * 2], right = folded[i * 2 + 1];
      assert.equal(left.side, "left");
      assert.equal(right.side, "right");
      assertMirror(left, right);
      assert.deepEqual(left.satellites, drops[i].satellites);
      for (let j = 0; j < left.satellites.length; j++) assertMirror(left.satellites[j], right.satellites[j]);
    }
    const bridges = folded.slice(drops.length * 2);
    assert.equal(bridges.length, drops.filter((body) => body.x >= 0.42).length);
    for (const bridge of bridges) {
      assert.equal(bridge.side, "crease");
      assert.equal(bridge.kind, "bridge");
      assert.equal(bridge.x, 0.5);
      assert.equal(bridge.angle, 0);
      assert.deepEqual(bridge.satellites, []);
    }
    folded[0].x = 0;
    assert.deepEqual(drops, before);
  }
  assert.deepEqual(mirrorDropsForFold([]), []);
});

test("crease bridge threshold is inclusive and bridges join both sides", () => {
  assert.equal(mirrorDropsForFold([drop({ x: 0.419999 })]).length, 2);
  for (const x of [0.42, 0.45, 0.49]) {
    const [left, right, bridge] = mirrorDropsForFold([drop({ x, r: 0.025 })]);
    assert.ok(bridge.x - bridge.r * bridge.elongation <= left.x + left.r);
    assert.ok(bridge.x + bridge.r * bridge.elongation >= right.x - right.r);
  }
});

test("analysis counts folded lobes/splatters and measures known bounds and zones", () => {
  const fixture = [drop({ x: 0.25, y: 0.5, r: 0.1 })];
  const features = analyzeBlot(fixture);
  assert.equal(features.lobeCount, 2);
  assert.equal(features.splatterCount, 0);
  near(features.verticalSpread, 0.2);
  near(features.horizontalReach, 0.7);
  assert.equal(features.dominantZone, "middle");
  assert.equal(features.symmetryScore, 1);
  assert.ok(Math.abs(features.density - 2 * Math.PI * 0.1 ** 2) < 0.01);
  // Overlapping ellipses must not double-count density.
  assert.equal(analyzeBlot([...fixture, ...fixture]).density, features.density);
  assert.equal(analyzeBlot([drop({ y: 0.2 })]).dominantZone, "upper");
  assert.equal(analyzeBlot([drop({ y: 0.8 })]).dominantZone, "lower");
  const rotated = analyzeBlot([drop({ x: 0.25, y: 0.5, r: 0.05, elongation: 2, angle: Math.PI / 2 })]);
  near(rotated.verticalSpread, 0.2);
  near(rotated.horizontalReach, 0.6);
  near(analyzeBlot([drop({ y: 0.02, r: 0.1 })]).verticalSpread, 0.12);
  const withBridge = analyzeBlot([drop({ x: 0.45, satellites: [{ x: 0.2, y: 0.1, r: 0.01, elongation: 1, angle: 0 }] })]);
  assert.equal(withBridge.lobeCount, 3);
  assert.equal(withBridge.splatterCount, 2);
  assert.deepEqual(analyzeBlot([]), { lobeCount: 0, splatterCount: 0, density: 0, verticalSpread: 0, horizontalReach: 0, dominantZone: "middle", symmetryScore: 1 });
  for (let seed = 0; seed < 32; seed++) {
    const analyzed = analyzeBlot(generateSeededDrops(seed));
    for (const value of [analyzed.density, analyzed.verticalSpread, analyzed.horizontalReach]) bounded(value, 0, 1);
  }
});

test("alt text describes the seed, geometry, daily plate and blank paper", () => {
  const features = analyzeBlot([drop()]);
  assert.equal(describeBlotAlt(features, "abc"), "Symmetric sumi inkblot (seed abc): 2 lobes mirrored about the central crease, 0 satellite splatters, middle-weighted spread, light ink density, 10% paper height and 50% paper width.");
  assert.match(describeBlotAlt({ ...features, density: 0.2 }, "a"), /moderate ink density/);
  assert.match(describeBlotAlt({ ...features, density: 0.5 }, "a"), /high ink density/);
  assert.match(describeBlotAlt(features, "daily:2024-02-29"), /daily plate 2024-02-29/);
  assert.match(describeBlotAlt(analyzeBlot([]), "0"), /Blank paper.*seed 0.*central fold/);
});

test("all 40 reading templates and 24 fragments are reachable, complete and deterministic", () => {
  assert.ok(INKBLOT_READING_TEMPLATES.length >= 40);
  assert.ok(INKBLOT_READING_FRAGMENTS.length >= 20);
  assert.equal(new Set(INKBLOT_READING_TEMPLATES).size, INKBLOT_READING_TEMPLATES.length);
  assert.equal(new Set(INKBLOT_READING_FRAGMENTS).size, INKBLOT_READING_FRAGMENTS.length);
  const features = analyzeBlot(generateSeededDrops(2024));
  const seenTemplates = new Set<number>(), seenFragments = new Set<number>();
  for (let seed = 0; seed < 2048; seed++) {
    const key = formatBlotSeed(seed);
    const reading = generateInkblotReading(key, features, "a friendly moth");
    assert.deepEqual(reading, generateInkblotReading(key, features, "a friendly moth"));
    assert.equal(reading.disclaimer, "A paper-and-ink toy — not medical or psychological advice.");
    assert.match(reading.plateCode, /^INK-[0-9A-Z]{7}$/);
    for (const value of Object.values(reading)) {
      assert.ok(value.trim().length > 0);
      assert.doesNotMatch(value, /[{}]|undefined|null|NaN|\[object Object\]/);
    }
    assert.match(reading.observation, /a friendly moth/);
    const fragmentIndex = INKBLOT_READING_FRAGMENTS.findIndex((fragment) => reading.interpretation.includes(fragment));
    assert.ok(fragmentIndex >= 0);
    seenFragments.add(fragmentIndex);
    const slotValues: Record<string, string> = {
      image: "a friendly moth", zone: features.dominantZone, lobes: String(features.lobeCount),
      density: features.density < 0.12 ? "light" : features.density < 0.3 ? "moderate" : "high",
      spread: features.verticalSpread > 0.6 ? "tall" : "compact",
      fragment: INKBLOT_READING_FRAGMENTS[fragmentIndex],
    };
    INKBLOT_READING_TEMPLATES.forEach((template, index) => {
      const expected = template.replace(/\{(\w+)\}/g, (_, slot: string) => slotValues[slot]);
      if (expected === reading.interpretation) seenTemplates.add(index);
    });
  }
  assert.equal(seenTemplates.size, INKBLOT_READING_TEMPLATES.length);
  assert.equal(seenFragments.size, INKBLOT_READING_FRAGMENTS.length);
});

test("readings sanitize and bound visitor words, including empty and non-Latin inputs", () => {
  const features = analyzeBlot([]);
  for (const note of ["", "  \u0000\u200b ", "{image} {{fragment}}", "<script>alert</script> https://evil.test email@evil.test", "🐛✨", "紙の蝶々", "đám mây nhỏ", "Ａ Ｂ", "word ".repeat(1000), "a".repeat(10_000)]) {
    const reading = generateInkblotReading("daily:2024-02-29", features, note);
    assert.deepEqual(reading, generateInkblotReading("daily:2024-02-29", features, note));
    assert.doesNotMatch(Object.values(reading).join(" "), /[{}<>]|https?:|@|undefined|NaN/);
    assert.ok(reading.observation.length < 250);
    assert.equal(reading.disclaimer, INKBLOT_DISCLAIMER);
  }
  assert.match(generateInkblotReading("0", features, "").observation, /unnamed paper creature/);
  assert.match(generateInkblotReading("0", features, "紙の蝶々").observation, /紙の蝶々/);
  assert.deepEqual(generateInkblotReading("0", features, "Ａ Ｂ"), generateInkblotReading("0", features, "A B"));
  const changed: BlotFeatures = { ...features, dominantZone: "lower", lobeCount: 4 };
  assert.notDeepEqual(generateInkblotReading("0", features, "moth"), generateInkblotReading("0", changed, "moth"));
  assert.notDeepEqual(generateInkblotReading("0", features, "moth"), generateInkblotReading("0", features, "boat"));
});

test("ward specimens have three unique deterministic notes, bounded hands and nonzero tilt", () => {
  const features = analyzeBlot(generateSeededDrops(7));
  const notes = curatedWardNotes("7", features);
  assert.deepEqual(notes, curatedWardNotes("7", features));
  assert.notDeepEqual(notes, curatedWardNotes("8", features));
  assert.notDeepEqual(notes, curatedWardNotes("7", { ...features, lobeCount: 2 }));
  assert.equal(notes.length, 3);
  assert.equal(new Set(notes.map((note) => note.id)).size, 3);
  assert.equal(new Set(notes.map((note) => note.note)).size, 3);
  for (const note of notes) {
    assert.equal(note.specimen, true);
    assert.ok(note.name.length > 0 && note.note.length > 0);
    assert.equal(Number.isInteger(note.tilt), true);
    assert.notEqual(note.tilt, 0);
    bounded(note.tilt, -4, 4);
    assert.ok([0, 1, 2].includes(note.hand));
    assert.doesNotMatch(note.note, /[{}]/);
  }
  notes[0].note = "changed";
  assert.notEqual(curatedWardNotes("7", features)[0].note, "changed");
});

test("route-local module re-exports the real core without browser or server dependencies", () => {
  assert.equal(routeModel.generateSeededDrops, generateSeededDrops);
  assert.equal(routeModel.validateBlotKey, validateBlotKey);
  assert.equal(routeModel.generateInkblotReading, generateInkblotReading);
  assert.deepEqual(routeModel.analyzeBlot(routeModel.generateSeededDrops(12)), analyzeBlot(generateSeededDrops(12)));
});
