import assert from "node:assert/strict";
import { test } from "node:test";
import { risoCharacters, risoPlateCount } from "./riso-heading.ts";

test("Unicode graphemes stay whole, including combining accents, flags and ZWJ emoji", () => {
  const chars = risoCharacters("墨 e\u0301 👩🏽‍🎨 🇻🇳");
  assert.deepEqual(chars.map(c => c.text), ["墨", " ", "e\u0301", " ", "👩🏽‍🎨", " ", "🇻🇳"]);
});
test("empty and whitespace titles preserve their exact source", () => {
  assert.deepEqual(risoCharacters(""), []);
  for (const text of [" \t\n  ", "Two  words\nnext line", "a\u00a0b"]) {
    assert.equal(risoCharacters(text).map(c => c.text).join(""), text);
  }
});
test("long and wrapped titles have bounded stagger and stable indices", () => {
  const chars = risoCharacters("A long wrapped title 墨 ".repeat(100));
  assert.ok(chars.length > 1000);
  chars.forEach((c, i) => { assert.equal(c.index, i); assert.ok(c.delay >= 0 && c.delay <= 240); });
});
test("SSR and client calls settle to the same signed 1–2px ghost offsets", () => {
  assert.deepEqual(risoCharacters("墨A").map(c => c.offsets), [[[-2, -1], [1, 2]], [[-1, -1], [1, 1]]]);
  const text = "Riso 墨 👩🏽‍🎨 repeated repeated";
  assert.deepEqual(risoCharacters(text), risoCharacters(text));
  for (const char of risoCharacters(text)) {
    assert.equal(char.offsets.length, 2);
    char.offsets.flat().forEach(n => assert.ok(Math.abs(n) === 1 || Math.abs(n) === 2));
    assert.notDeepEqual(char.offsets[0], char.offsets[1]);
  }
  assert.ok(new Set(risoCharacters(text).map(c => JSON.stringify(c.offsets))).size > 1);
});
test("plate count can only resolve to two or three", () => {
  assert.equal(risoPlateCount(2), 2);
  for (const n of [undefined, 0, 1, 3, 4, Infinity, NaN, -1, 2.1]) assert.equal(risoPlateCount(n), 3);
});
