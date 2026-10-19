import assert from "node:assert/strict";
import { test } from "node:test";
import { dayNumber, mint, paletteFor, seedFor, tally } from "./pebbles.ts";

test("seedFor is day * 101 + index", () => {
  assert.equal(seedFor(20000, 0), 2_020_000);
  assert.equal(seedFor(20000, 7), 2_020_007);
});

test("paletteFor maps each length to a colour", () => {
  assert.equal(paletteFor(15), "amber");
  assert.equal(paletteFor(25), "mint");
  assert.equal(paletteFor(45), "lilac");
});

test("dayNumber is stable within a local day and steps at midnight", () => {
  const noon = new Date(2026, 9, 19, 12).getTime();
  assert.equal(dayNumber(noon), dayNumber(new Date(2026, 9, 19, 0, 0, 1).getTime()));
  assert.equal(dayNumber(noon), dayNumber(new Date(2026, 9, 19, 23, 59, 59).getTime()));
  assert.equal(dayNumber(noon) + 1, dayNumber(new Date(2026, 9, 20, 0, 0, 1).getTime()));
});

test("mint builds the same pebble for the same day and index", () => {
  const at = new Date(2026, 9, 19, 9).getTime();
  const p = mint(at, 25, 2);
  assert.deepEqual(p, mint(at, 25, 2));
  assert.equal(mint(at + 3_600_000, 25, 2).seed, p.seed);
  assert.equal(p.palette, "mint");
  assert.equal(p.seed, seedFor(dayNumber(at), 2));
  assert.notEqual(mint(at, 25, 3).seed, p.seed);
});

test("tally counts pieces and total time", () => {
  const at = Date.now();
  assert.equal(tally([]), "0 pieces · 0 min");
  assert.equal(tally([mint(at, 25, 0)]), "1 piece · 25 min");
  assert.equal(tally([mint(at, 25, 0), mint(at, 45, 1), mint(at, 15, 2)]), "3 pieces · 1 h 25 min");
  assert.equal(tally([mint(at, 45, 0), mint(at, 15, 1)]), "2 pieces · 1 h");
});
