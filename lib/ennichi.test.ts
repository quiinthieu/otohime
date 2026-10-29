import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ENNICHI_SCENE_WIDTH, ENNICHI_SCENE_HEIGHT, ENNICHI_STORAGE_KEY, ENNICHI_HINT_COOLDOWN_MS,
  ENNICHI_PLATES, ENNICHI_MOTIFS, getEnnichiPlates, clampEnnichiViewport, panEnnichiViewport,
  zoomEnnichiViewport, hitTestEnnichiMotif, requestEnnichiHint, parseEnnichiProgress,
  serializeEnnichiProgress, isEnnichiStampUnlocked, type EnnichiViewport, type EnnichiDirection,
} from "./ennichi.ts";
import * as routeModel from "../app/(site)/(app)/play/ennichi/_lib/ennichi.ts";

const allIds = new Set(ENNICHI_MOTIFS.map((motif) => motif.id));
const rest = { scale: 1, tx: 0, ty: 0 };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("scene constants and route re-export load in Node without DOM globals", () => {
  assert.equal(ENNICHI_SCENE_WIDTH, 1200);
  assert.equal(ENNICHI_SCENE_HEIGHT, 800);
  assert.equal(ENNICHI_STORAGE_KEY, "ennichi:v1");
  assert.equal(ENNICHI_HINT_COOLDOWN_MS, 4000);
  assert.equal(routeModel.ENNICHI_MOTIFS, ENNICHI_MOTIFS);
  assert.equal(routeModel.requestEnnichiHint, requestEnnichiHint);
  assert.equal(routeModel.zoomEnnichiViewport, zoomEnnichiViewport);
  assert.equal(routeModel.parseEnnichiProgress, parseEnnichiProgress);
});

test("four Showa ink plates zero both resting and hover offsets under reduced motion", () => {
  assert.deepEqual(ENNICHI_PLATES.map((plate) => plate.id), ["cyan", "magenta", "yellow", "key"]);
  const original = JSON.stringify(ENNICHI_PLATES);
  for (const plate of getEnnichiPlates(true)) {
    assert.deepEqual(plate.resting, { dx: 0, dy: 0 });
    assert.deepEqual(plate.hover, { dx: 0, dy: 0 });
  }
  assert.ok(getEnnichiPlates().some((plate) => plate.resting.dx !== 0 && plate.hover.dx !== plate.resting.dx));
  assert.equal(JSON.stringify(ENNICHI_PLATES), original, "preference must not mutate the catalog");
});

test("seven named motifs have disjoint hit discs inside the scene and 44px targets at mobile and desktop fits", () => {
  assert.deepEqual([...allIds], ["kame-turtle", "tamatebako", "coral-crown", "daruma-doll", "hanko-seal", "pocket-console", "urashima-bell"]);
  assert.equal(ENNICHI_MOTIFS.length, 7);
  for (const [index, motif] of ENNICHI_MOTIFS.entries()) {
    assert.ok(motif.hitRadius >= 28 && motif.hitRadius >= motif.r);
    assert.ok(motif.x - motif.hitRadius >= 0 && motif.x + motif.hitRadius <= 1200);
    assert.ok(motif.y - motif.hitRadius >= 0 && motif.y + motif.hitRadius <= 800);
    for (const [width, height] of [[390, 260], [390, 600], [1280, 720], [1280, 900]]) {
      const fit = Math.min(width / 1200, height / 800);
      assert.ok(2 * motif.hitRadius * fit >= 44, `${motif.id} target too small at ${width}×${height}`);
    }
    for (const other of ENNICHI_MOTIFS.slice(index + 1)) {
      assert.ok(Math.hypot(other.x - motif.x, other.y - motif.y) > motif.hitRadius + other.hitRadius,
        `${motif.id} and ${other.id} targets overlap`);
    }
    for (const field of ["title", "japaneseTitle", "stallRegion", "unfoundLabel", "hintClue", "foundStory"] as const) {
      assert.ok(motif[field].trim().length > 0, `${motif.id} missing ${field}`);
    }
    assert.ok(motif.unfoundLabel.includes(motif.stallRegion));
    assert.ok(!motif.unfoundLabel.toLowerCase().includes(motif.title.toLowerCase()));
  }
});

test("hit testing includes the larger transparent target and boundary but misses outside it", () => {
  for (const motif of ENNICHI_MOTIFS) {
    assert.equal(hitTestEnnichiMotif(motif.x, motif.y)?.id, motif.id);
    assert.equal(hitTestEnnichiMotif(motif.x + motif.hitRadius, motif.y)?.id, motif.id);
    assert.equal(hitTestEnnichiMotif(motif.x + motif.hitRadius + 0.01, motif.y), null);
  }
  assert.equal(hitTestEnnichiMotif(0, 0), null);
  assert.equal(hitTestEnnichiMotif(-1000, 1000), null);
  assert.equal(hitTestEnnichiMotif(NaN, 100), null);
  assert.equal(hitTestEnnichiMotif(100, Infinity), null);
  const motif = ENNICHI_MOTIFS[0];
  assert.equal(hitTestEnnichiMotif(motif.x, motif.y, []), null);
  assert.equal(hitTestEnnichiMotif(30, 40, [{ ...motif, x: 30, y: 40 }])?.id, motif.id);
});

function assertBounds(viewport: EnnichiViewport, width: number, height: number) {
  assert.ok(viewport.scale >= 1 && viewport.scale <= 3.5);
  assert.ok(Object.values(viewport).every(Number.isFinite));
  const fit = Math.min(width / 1200, height / 800);
  for (const [translation, size, extent] of [
    [viewport.tx, 1200 * fit * viewport.scale, width],
    [viewport.ty, 800 * fit * viewport.scale, height],
  ]) {
    if (size <= extent) near(translation, (extent - size) / 2);
    else {
      assert.ok(translation <= 1e-8, "near edge must cover viewport");
      assert.ok(translation + size >= extent - 1e-8, "far edge must cover viewport");
    }
  }
  assert.deepEqual(clampEnnichiViewport(viewport, width, height), viewport, "clamp must be idempotent");
}

for (const [width, height] of [[390, 260], [390, 600], [1280, 720], [1280, 900]]) {
  test(`clamp and pan preserve scene bounds and center letterboxing at ${width}×${height}`, () => {
    const start = Object.freeze({ scale: 2, tx: -50, ty: -60 });
    for (const scale of [-100, 1, 2, 3.5, 100, NaN, Infinity]) {
      for (const tx of [-1e6, 0, 1e6, NaN]) {
        const clamped = clampEnnichiViewport({ scale, tx, ty: -tx }, width, height);
        assertBounds(clamped, width, height);
        assertBounds(panEnnichiViewport(clamped, 1e6, -1e6, width, height), width, height);
        assertBounds(panEnnichiViewport(clamped, -1e6, 1e6, width, height), width, height);
      }
    }
    const clamped = clampEnnichiViewport(start, width, height);
    assert.deepEqual(panEnnichiViewport(start, NaN, Infinity, width, height), clamped);
    const pan = panEnnichiViewport({ scale: 3, tx: -100, ty: -100 }, -20, -15, width, height);
    near(pan.tx, -120);
    near(pan.ty, -115);
    assert.deepEqual(start, { scale: 2, tx: -50, ty: -60 });
  });

  test(`zoom preserves a focal scene point, round trips, and clamps extreme factors at ${width}×${height}`, () => {
    const start = clampEnnichiViewport(rest, width, height);
    const focalX = width / 2, focalY = height / 2;
    const zoomed = zoomEnnichiViewport(start, 2, focalX, focalY, width, height);
    assert.equal(zoomed.scale, 2);
    const fit = Math.min(width / 1200, height / 800);
    near((focalX - start.tx) / (fit * start.scale), (focalX - zoomed.tx) / (fit * zoomed.scale));
    near((focalY - start.ty) / (fit * start.scale), (focalY - zoomed.ty) / (fit * zoomed.scale));
    const returned = zoomEnnichiViewport(zoomed, 0.5, focalX, focalY, width, height);
    near(returned.tx, start.tx); near(returned.ty, start.ty); near(returned.scale, 1);
    let current = zoomed;
    for (const factor of [1e100, 2, 0.8, 1e-100, 4, 0.001]) {
      for (const [x, y] of [[0, 0], [width, height], [focalX, focalY], [NaN, Infinity], [-1000, 10000]]) {
        current = zoomEnnichiViewport(current, factor, x, y, width, height);
        assertBounds(current, width, height);
      }
    }
    assert.equal(zoomEnnichiViewport(zoomed, 1e6, focalX, focalY, width, height).scale, 3.5);
    assert.equal(zoomEnnichiViewport(zoomed, 1e-6, focalX, focalY, width, height).scale, 1);
    for (const factor of [0, -1, NaN, Infinity]) {
      assert.deepEqual(zoomEnnichiViewport(zoomed, factor, focalX, focalY, width, height), zoomed);
    }
  });
}

test("off-center zoom keeps its anchor and resize reclamps previous transforms", () => {
  const start = { scale: 2, tx: -100, ty: -100 };
  const zoomed = zoomEnnichiViewport(start, 1.5, 130, 90, 390, 260);
  near(zoomed.tx, -215); near(zoomed.ty, -195);
  assertBounds(clampEnnichiViewport(zoomed, 1280, 720), 1280, 720);
  assertBounds(clampEnnichiViewport({ scale: NaN, tx: Infinity, ty: NaN }, 390, 260), 390, 260);
  for (const bad of [0, -1, NaN, Infinity]) {
    assert.throws(() => clampEnnichiViewport(rest, bad, 260), RangeError);
    assert.throws(() => panEnnichiViewport(rest, 1, 1, 390, bad), RangeError);
    assert.throws(() => zoomEnnichiViewport(rest, 2, 100, 100, bad, 260), RangeError);
  }
});

test("hint chooses the nearest unfound motif deterministically without mutating progress", () => {
  const foundIds = new Set<string>();
  const request = { foundIds, focusX: 181, focusY: 530, nowMs: 0 };
  const hint = requestEnnichiHint(request);
  assert.equal(hint.status, "ready");
  if (hint.status !== "ready") return;
  assert.equal(hint.motifId, "kame-turtle");
  assert.equal(hint.direction, "nearby");
  assert.deepEqual(requestEnnichiHint(request), hint);
  assert.equal(foundIds.size, 0);
  foundIds.add(hint.motifId);
  const next = requestEnnichiHint(request);
  assert.equal(next.status, "ready");
  if (next.status === "ready") assert.equal(next.motifId, "daruma-doll");
  // Equidistant custom focus: catalog order breaks a tie, no randomness.
  const onlyPair = new Set([...allIds].filter((id) => id !== "kame-turtle" && id !== "tamatebako"));
  const tie = requestEnnichiHint({ ...request, foundIds: onlyPair, focusX: 390, focusY: 590 });
  if (tie.status === "ready") assert.equal(tie.motifId, "kame-turtle");
  else assert.fail("tie must yield a ready hint");
});

test("hint results contain only broad directions and stall clues, with no numeric coordinates", () => {
  for (const motif of ENNICHI_MOTIFS) {
    const foundIds = new Set([...allIds].filter((id) => id !== motif.id));
    const offsets: [number, number, EnnichiDirection][] = [
      [0, 200, "north"], [-200, 200, "northeast"], [-200, 0, "east"], [-200, -200, "southeast"],
      [0, -200, "south"], [200, -200, "southwest"], [200, 0, "west"], [200, 200, "northwest"], [0, 0, "nearby"],
    ];
    for (const [dx, dy, direction] of offsets) {
      const hint = requestEnnichiHint({ foundIds, focusX: motif.x + dx, focusY: motif.y + dy, nowMs: 5000 });
      assert.equal(hint.status, "ready");
      if (hint.status !== "ready") continue;
      assert.equal(hint.motifId, motif.id);
      assert.equal(hint.direction, direction);
      assert.equal(hint.stallRegion, motif.stallRegion);
      assert.ok(hint.clue.includes(direction) && hint.clue.includes(motif.stallRegion));
      assert.deepEqual(Object.keys(hint).sort(), ["clue", "direction", "motifId", "stallRegion", "status"]);
      assert.doesNotMatch(JSON.stringify(hint), /\d|\b(?:coordinates?|pixels?|px)\b/i);
      assert.ok(Object.values(hint).every((value) => typeof value === "string"));
    }
  }
});

test("hint cooldown covers timestamp zero, exact expiry, custom durations and clock rollback", () => {
  const request = { foundIds: new Set<string>(), focusX: 600, focusY: 400, nowMs: 0, lastHintAtMs: 0 };
  assert.deepEqual(requestEnnichiHint(request), { status: "cooldown", remainingMs: 4000 });
  assert.deepEqual(requestEnnichiHint({ ...request, nowMs: 3999 }), { status: "cooldown", remainingMs: 1 });
  assert.equal(requestEnnichiHint({ ...request, nowMs: 4000 }).status, "ready");
  assert.deepEqual(requestEnnichiHint({ ...request, nowMs: 30, cooldownMs: 50 }), { status: "cooldown", remainingMs: 20 });
  assert.deepEqual(requestEnnichiHint({ ...request, lastHintAtMs: 9000 }), { status: "cooldown", remainingMs: 4000 });
  for (const lastHintAtMs of [null, undefined, NaN, -1]) {
    assert.equal(requestEnnichiHint({ ...request, lastHintAtMs }).status, "ready");
  }
  assert.equal(requestEnnichiHint({ ...request, cooldownMs: 0 }).status, "ready");
  for (const nowMs of [NaN, Infinity, -1]) assert.throws(() => requestEnnichiHint({ ...request, nowMs }), RangeError);
  const center = requestEnnichiHint({ ...request, lastHintAtMs: null });
  assert.deepEqual(requestEnnichiHint({ ...request, lastHintAtMs: null, focusX: NaN, focusY: Infinity }), center);
  assert.deepEqual(requestEnnichiHint({ ...request, foundIds: allIds }), { status: "complete" });
});

test("progress tolerates absent, corrupted and wrong-schema storage without unlocking anything", () => {
  const malformed = [null, undefined, "", "{", "null", "true", "7", "[]", "{}", JSON.stringify({ version: 2, found: [...allIds] }),
    JSON.stringify({ version: "1", found: [...allIds] }), JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, found: {} }), JSON.stringify({ version: 1, found: "kame-turtle" }),
    JSON.stringify({ version: 1, found: ["kame-turtle", null] }), JSON.stringify({ version: 1, found: [17] }),
    JSON.stringify({ version: 1, found: ["kame-turtle", {}] })];
  for (const raw of malformed) {
    const found = parseEnnichiProgress(raw);
    assert.equal(found.size, 0, String(raw));
    assert.equal(isEnnichiStampUnlocked(found), false);
  }
  assert.notEqual(parseEnnichiProgress(null), parseEnnichiProgress(null), "each caller owns its own set");
});

test("progress filters unknown IDs, deduplicates, serializes canonically and round trips", () => {
  const raw = JSON.stringify({ version: 1, found: ["tamatebako", "unknown", "kame-turtle", "kame-turtle", "__proto__"], extra: true });
  const found = parseEnnichiProgress(raw);
  assert.deepEqual([...found], ["kame-turtle", "tamatebako"]);
  const reversed = new Set(["tamatebako", "unknown", "kame-turtle"]);
  assert.equal(serializeEnnichiProgress(reversed), '{"version":1,"found":["kame-turtle","tamatebako"]}');
  assert.deepEqual([...reversed], ["tamatebako", "unknown", "kame-turtle"]);
  for (const ids of [new Set<string>(), found, allIds]) {
    assert.deepEqual(parseEnnichiProgress(serializeEnnichiProgress(ids)), ids);
  }
  assert.equal(serializeEnnichiProgress(new Set(["unknown"])), '{"version":1,"found":[]}');
});

test("stamp requires all seven real motifs; a same-size set with an unknown ID cannot unlock", () => {
  assert.equal(isEnnichiStampUnlocked(new Set()), false);
  for (const missing of allIds) {
    const partial = new Set<string>([...allIds].filter((id) => id !== missing));
    assert.equal(isEnnichiStampUnlocked(partial), false);
    partial.add("unknown");
    assert.equal(partial.size, 7);
    assert.equal(isEnnichiStampUnlocked(partial), false);
  }
  assert.equal(isEnnichiStampUnlocked(allIds), true);
  assert.equal(isEnnichiStampUnlocked(parseEnnichiProgress(serializeEnnichiProgress(allIds))), true);
  assert.equal(isEnnichiStampUnlocked(new Set([...allIds, "unknown"])), true);
});
