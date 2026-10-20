import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeHand, reducer, serializeHand, STORAGE_KEY, type Hand } from "./hand.ts";
import type { Reading } from "./reading.ts";

const HAND: Hand = { city: "tokyo", hpa: 1011.2, at: "2026-10-20T17:30" };
const READING: Reading = { at: "2026-10-20T17:30", temperatureC: 26.9, pressureHpa: 1011.2, windKmh: 5.3, windFromDeg: 336, rainMm: 0.1, code: 51, interval: 900 };

test("the storage key", () => {
  assert.equal(STORAGE_KEY, "barometer.hand");
});

test("a hand round-trips through its string", () => {
  assert.deepEqual(normalizeHand(serializeHand(HAND)), HAND);
  assert.equal(serializeHand(HAND), '{"city":"tokyo","hpa":1011.2,"at":"2026-10-20T17:30"}');
});

test("garbage gives null", () => {
  for (const raw of [null, "", "x", "{", "null", "[]", "7", '"tokyo"', "{}"]) assert.equal(normalizeHand(raw), null, String(raw));
});

test("an unknown city, an out-of-range or non-numeric pressure and a bad time give null", () => {
  const s = (patch: Record<string, unknown>) => JSON.stringify({ ...HAND, ...patch });
  assert.equal(normalizeHand(s({ city: "nope" })), null);
  assert.equal(normalizeHand(s({ city: 7 })), null);
  assert.equal(normalizeHand(s({ hpa: 799.9 })), null);
  assert.equal(normalizeHand(s({ hpa: 1200.1 })), null);
  assert.equal(normalizeHand(s({ hpa: "1011" })), null);
  assert.equal(normalizeHand(s({ hpa: null })), null);
  assert.equal(normalizeHand(s({ at: "yesterday" })), null);
  assert.equal(normalizeHand(s({ at: 5 })), null);
  assert.deepEqual(normalizeHand(s({ hpa: 800 })), { ...HAND, hpa: 800 });
  assert.deepEqual(normalizeHand(s({ hpa: 1200 })), { ...HAND, hpa: 1200 });
});

test("extra keys are dropped", () => {
  assert.deepEqual(normalizeHand(JSON.stringify({ ...HAND, extra: 1 })), HAND);
});

test("set, then recall through the stored string, gives the hand", () => {
  const set = reducer(null, { type: "set", city: "tokyo", reading: READING });
  assert.deepEqual(set, HAND);
  assert.ok(set);
  assert.deepEqual(reducer(null, { type: "recall", raw: serializeHand(set) }), HAND);
});

test("set replaces an older hand, and a pressure off the dial's range leaves it alone", () => {
  const older: Hand = { city: "paris", hpa: 990, at: "2026-10-19T08:00" };
  assert.deepEqual(reducer(older, { type: "set", city: "tokyo", reading: READING }), HAND);
  assert.deepEqual(reducer(older, { type: "set", city: "tokyo", reading: { ...READING, pressureHpa: 500 } }), older);
});

test("recall of garbage clears, clear clears", () => {
  assert.equal(reducer(HAND, { type: "recall", raw: "x" }), null);
  assert.equal(reducer(HAND, { type: "recall", raw: null }), null);
  assert.equal(reducer(HAND, { type: "clear" }), null);
  assert.equal(reducer(null, { type: "clear" }), null);
});
