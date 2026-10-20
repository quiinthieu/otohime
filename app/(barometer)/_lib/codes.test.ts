import assert from "node:assert/strict";
import { test } from "node:test";
import { CODE_WORDS, wordFor } from "./codes.ts";

// Open-Meteo's /en/docs table of WMO codes, which includes 97 (heavy thunderstorm).
const CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99,
];

const TWELVE = [
  "clear", "mainly clear", "partly cloudy", "overcast", "fog", "drizzle", "freezing rain", "rain", "showers", "snow",
  "thunder", "thunder with hail",
];

test("all 29 codes are listed, including 97", () => {
  assert.equal(CODES.length, 29);
  assert.equal(new Set(CODES).size, 29);
  assert.ok(CODES.includes(97));
});

test("every code reads one of the twelve words", () => {
  assert.deepEqual([...CODE_WORDS], TWELVE);
  for (const c of CODES) assert.ok(TWELVE.includes(wordFor(c)), String(c));
});

test("each of the twelve words is used", () => {
  const used = new Set(CODES.map(wordFor));
  assert.deepEqual([...used].sort(), [...TWELVE].sort());
});

test("the groups, code by code", () => {
  const groups: Record<string, number[]> = {
    clear: [0],
    "mainly clear": [1],
    "partly cloudy": [2],
    overcast: [3],
    fog: [45, 48],
    drizzle: [51, 53, 55],
    "freezing rain": [56, 57, 66, 67],
    rain: [61, 63, 65],
    showers: [80, 81, 82],
    snow: [71, 73, 75, 77, 85, 86],
    thunder: [95, 97],
    "thunder with hail": [96, 99],
  };
  for (const [word, codes] of Object.entries(groups)) for (const c of codes) assert.equal(wordFor(c), word, String(c));
});

test("anything else reads unsettled", () => {
  for (const c of [4, 98, -1, 100, 1.5, NaN, Infinity]) assert.equal(wordFor(c), "unsettled", String(c));
});
