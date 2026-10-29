import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { KANJI, KANJIVG_CREDIT } from "../content/kanji.ts";
import { dailyKanji, resample, scoreSheet } from "./shodo.ts";

test("local calendar dates choose deterministic daily kanji and cycle the bundled subset", () => {
  assert.deepEqual(dailyKanji("2026-10-29"), dailyKanji("2026-10-29"));
  assert.notEqual(dailyKanji("2026-10-29").id, dailyKanji("2026-10-30").id);
  assert.equal(new Set(Array.from({ length: 5 }, (_, i) => dailyKanji(`2026-10-${25 + i}`).id)).size, 5);
});
test("gentle scoring distinguishes exact shape/order, reverse order, reverse direction, far and missing strokes", () => {
  const k = KANJI[0], exact = scoreSheet(k.strokes, k);
  assert.equal(exact.stars, 3); assert.ok(exact.shape > .99); assert.equal(exact.order, 1);
  assert.ok(scoreSheet([...k.strokes].reverse(), k).order < exact.order);
  assert.ok(scoreSheet(k.strokes.map(p => [...p].reverse()), k).order < exact.order);
  assert.ok(scoreSheet(k.strokes.map(p => p.map(v => ({ x: v.x + 200, y: v.y }))), k).shape < .1);
  assert.ok(scoreSheet(k.strokes.slice(0, 1), k).shape < exact.shape);
  assert.equal(scoreSheet([], k).stars, 0);
  assert.equal(resample([{ x: 1, y: 2 }]).length, 40);
});
test("the real KanjiVG source paths, sample directions, and license ship locally", () => {
  assert.ok(KANJIVG_CREDIT.includes("CC BY-SA 3.0"));
  for (const k of KANJI) {
    const svg = readFileSync(new URL(`../public/kanji/${k.id}.svg`, import.meta.url), "utf8");
    assert.ok(svg.includes("Ulrich Apel"));
    for (const d of k.paths) assert.ok(svg.includes(d));
    assert.equal(k.paths.length, k.strokes.length);
    assert.ok(k.strokes.every(p => p.length === 40 && p.every(v => Number.isFinite(v.x) && Number.isFinite(v.y))));
  }
  assert.ok(readFileSync(new URL("../public/kanji/COPYING.txt", import.meta.url), "utf8").includes("Attribution"));
});
