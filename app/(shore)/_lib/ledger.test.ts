import assert from "node:assert/strict";
import { test } from "node:test";
import { KEEP_DAYS, normalizeLedger, serialize, today } from "./ledger.ts";
import { mint } from "./pebbles.ts";

const NOW = new Date(2026, 9, 19, 12).getTime();
const DAY = 86_400_000;
const empty = { scene: "light", pebbles: [] };

test("missing or malformed storage gives an empty ledger", () => {
  assert.deepEqual(normalizeLedger(null, NOW), empty);
  assert.deepEqual(normalizeLedger(undefined, NOW), empty);
  assert.deepEqual(normalizeLedger("", NOW), empty);
  assert.deepEqual(normalizeLedger("{not json", NOW), empty);
  assert.deepEqual(normalizeLedger("42", NOW), empty);
  assert.deepEqual(normalizeLedger('{"pebbles":"nope"}', NOW), empty);
});

test("a good ledger round-trips", () => {
  const ledger = { scene: "dark" as const, pebbles: [mint(NOW - 1000, 25, 0), mint(NOW, 45, 1)] };
  assert.deepEqual(normalizeLedger(serialize(ledger), NOW), ledger);
});

test("junk entries are dropped, good ones kept", () => {
  const raw = JSON.stringify({
    pebbles: [null, 7, "x", [], {}, { startedAt: "soon", minutes: 25 }, { startedAt: NOW }, { startedAt: NOW, minutes: 25 }],
  });
  const { pebbles } = normalizeLedger(raw, NOW);
  assert.equal(pebbles.length, 1);
  assert.equal(pebbles[0].minutes, 25);
});

test("minutes clamp to 15, 25 or 45 and the palette follows", () => {
  const raw = JSON.stringify({
    pebbles: [
      { startedAt: NOW - 3, minutes: 1 },
      { startedAt: NOW - 2, minutes: 24 },
      { startedAt: NOW - 1, minutes: 9999 },
    ],
  });
  const { pebbles } = normalizeLedger(raw, NOW);
  assert.deepEqual(
    pebbles.map((p) => [p.minutes, p.palette]),
    [[15, "amber"], [25, "mint"], [45, "lilac"]],
  );
});

test("an unusable seed is rebuilt from the day and position", () => {
  const raw = JSON.stringify({
    pebbles: [
      { startedAt: NOW - 2, minutes: 25, seed: "x" },
      { startedAt: NOW - 1, minutes: 25, seed: -4 },
    ],
  });
  const seeds = normalizeLedger(raw, NOW).pebbles.map((p) => p.seed);
  assert.deepEqual(seeds, [mint(NOW, 25, 0).seed, mint(NOW, 25, 1).seed]);
});

test(`pebbles older than ${KEEP_DAYS} days are cut`, () => {
  const raw = JSON.stringify({
    pebbles: [
      { startedAt: NOW - (KEEP_DAYS + 1) * DAY, minutes: 25 },
      { startedAt: NOW - (KEEP_DAYS - 1) * DAY, minutes: 25 },
    ],
  });
  assert.equal(normalizeLedger(raw, NOW).pebbles.length, 1);
});

test("an unknown scene falls back to light", () => {
  assert.equal(normalizeLedger('{"scene":"purple"}', NOW).scene, "light");
  assert.equal(normalizeLedger('{"scene":"dark"}', NOW).scene, "dark");
});

test("today() keeps only today's pebbles", () => {
  const yesterday = mint(NOW - DAY, 25, 0);
  const now = mint(NOW, 25, 0);
  assert.deepEqual(today({ scene: "light", pebbles: [yesterday, now] }, NOW), [now]);
});
