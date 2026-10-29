import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSealName, readSeal, sealModel, sealSvg } from "./hanko.ts";

test("normalized name and shape reproducibly determine a carved seal", () => {
  for (const shape of ["round", "square"] as const) {
    const a = { name: "Billie", shape };
    assert.equal(sealSvg(a), sealSvg({ name: " Ｂillie\u0000 ", shape }));
    assert.notEqual(sealSvg(a), sealSvg({ name: "Otohime", shape }));
    const m = sealModel(a);
    assert.equal(m.chips.length, 48);
    assert.ok(m.chips.every(c => c.x > 9 && c.x < 191 && c.y > 9 && c.y < 191));
    assert.ok(m.glyphs.every(g => g.x > 20 && g.x < 180 && g.y > 20 && g.y < 180));
  }
  assert.notEqual(sealSvg({ name: "Billie", shape: "square" }), sealSvg({ name: "Billie", shape: "round" }));
});
test("Unicode normalization, controls and length stay bounded", () => {
  assert.equal(normalizeSealName("  乙姫\u202e\u0001  "), "乙姫");
  assert.equal(normalizeSealName("e\u0301"), "é");
  assert.equal(Array.from(normalizeSealName("🌸".repeat(20))).length, 12);
  assert.equal(normalizeSealName("a    b"), "a b");
  for (const name of ["乙姫", "Billie", "ABCDEFGHIJKL", "🌸".repeat(12)]) {
    assert.equal(sealModel({ name, shape: "round" }).glyphs.length, Array.from(name).length);
  }
});
test("download XML escapes names and is standalone without active content", () => {
  const svg = sealSvg({ name: '<&"\' onload=', shape: "square" });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(svg.includes("&lt;") && svg.includes("&amp;") && svg.includes("&quot;"));
  assert.doesNotMatch(svg, /<script|<image|<foreignObject|\sonload="/);
});
test("invalid or old local storage falls back without throwing", () => {
  for (const value of [null, "", "{}", "oops", '{"name":"","shape":"round"}', '{"name":3,"shape":"round"}', '{"name":"A","shape":"evil"}']) assert.equal(readSeal(value), null);
  assert.deepEqual(readSeal('{"name":"  乙姫  ","shape":"round"}'), { name: "乙姫", shape: "round" });
});
