import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DAILY_COINS,
  MAX_COINS,
  START_COINS,
  STORAGE_KEY,
  dayNumber,
  freshLedger,
  normalizeLedger,
  refill,
  serialize,
} from "./ledger.ts";

const NOW = new Date(2026, 9, 19, 12).getTime();
const DAY = 86_400_000;
const later = (days: number) => new Date(2026, 9, 19 + days, 12).getTime();
const noMint = () => {
  throw new Error("a good seed must not be re-minted");
};

test("the economy is 5 to start, 3 a day, 9 at most, under capsule-v1", () => {
  assert.equal(STORAGE_KEY, "capsule-v1");
  assert.deepEqual([START_COINS, DAILY_COINS, MAX_COINS], [5, 3, 9]);
});

test("a fresh ledger has 5 coins and nothing owned", () => {
  assert.deepEqual(freshLedger(42, NOW), {
    v: 1,
    seed: 42,
    draws: 0,
    coins: 5,
    lastDay: dayNumber(NOW),
    sinceLegend: 0,
    owned: {},
  });
});

test("dayNumber counts local days", () => {
  assert.equal(dayNumber(new Date(2026, 9, 19, 0, 0).getTime()), dayNumber(new Date(2026, 9, 19, 23, 59).getTime()));
  assert.equal(dayNumber(later(1)) - dayNumber(NOW), 1);
});

test("the next day adds 3, and the cap of 9 holds five days later", () => {
  const l = { ...freshLedger(42, NOW), coins: 2 };
  assert.equal(refill(l, later(1)).coins, 5);
  assert.equal(refill(l, later(1)).lastDay, dayNumber(NOW) + 1);
  assert.equal(refill(freshLedger(42, NOW), later(1)).coins, 8);
  assert.equal(refill(freshLedger(42, NOW), later(5)).coins, 9);
  assert.equal(refill({ ...l, coins: 0 }, later(5)).coins, 9);
  assert.equal(refill(refill(l, later(1)), later(2)).coins, 8);
});

test("the same day adds nothing", () => {
  const l = { ...freshLedger(42, NOW), coins: 0 };
  assert.equal(refill(l, NOW), l);
  assert.equal(refill(l, NOW + 11 * 3_600_000), l);
});

test("a clock moved back adds nothing, and lastDay does not move back", () => {
  const l = { ...freshLedger(42, NOW), coins: 1 };
  const back = refill(l, NOW - 3 * DAY);
  assert.equal(back, l);
  // and coming forward again to the same day mints nothing either
  assert.equal(refill(back, NOW).coins, 1);
});

test("a good ledger round-trips without touching the seed", () => {
  const l = { ...freshLedger(42, NOW), draws: 3, coins: 2, sinceLegend: 3, owned: { jiji: 2, totoro: 1 } };
  assert.deepEqual(normalizeLedger(serialize(l), NOW, noMint), l);
});

test("missing storage, bad JSON or a wrong version gives a fresh ledger", () => {
  for (const raw of [null, undefined, "", "{not json", "42", "[]", '"x"', JSON.stringify({ ...freshLedger(1, NOW), v: 2 })]) {
    assert.deepEqual(normalizeLedger(raw, NOW, () => 7), freshLedger(7, NOW), String(raw));
  }
});

test("junk fields normalize as specified", () => {
  const raw = JSON.stringify({
    v: 1,
    seed: "abc",
    draws: -4,
    coins: 99,
    lastDay: dayNumber(NOW),
    sinceLegend: 2.7,
    owned: { jiji: 2, nope: 3, totoro: -1, kiki: 1.5, catbus: 0, ponyo: "2", "no-face": 1 },
  });
  assert.deepEqual(normalizeLedger(raw, NOW, () => 7), {
    v: 1,
    seed: 7,
    draws: 0,
    coins: 9,
    lastDay: dayNumber(NOW),
    sinceLegend: 2,
    owned: { jiji: 2, "no-face": 1 },
  });
});

test("more junk: negative or missing coins never mint, a non-integer seed is replaced", () => {
  const base = freshLedger(42, NOW);
  const norm = (patch: object) => normalizeLedger(JSON.stringify({ ...base, ...patch }), NOW, () => 7);
  assert.equal(norm({ coins: -1 }).coins, 0);
  assert.equal(norm({ coins: "9" }).coins, 0);
  assert.equal(norm({ coins: 1.5 }).coins, 1);
  assert.equal(norm({ seed: 1.5 }).seed, 7);
  assert.equal(norm({ seed: null }).seed, 7);
  assert.equal(norm({ draws: "many" }).draws, 0);
  assert.equal(norm({ draws: 3.9 }).draws, 3);
  assert.deepEqual(norm({ owned: [1, 2] }).owned, {});
  assert.deepEqual(norm({ owned: "jiji" }).owned, {});
  assert.equal(norm({ lastDay: "today" }).lastDay, dayNumber(NOW));
});

test("normalizing applies the refill after clamping", () => {
  const stale = { ...freshLedger(42, NOW), coins: 99, lastDay: dayNumber(NOW) - 2 };
  const l = normalizeLedger(JSON.stringify(stale), NOW, noMint);
  assert.equal(l.coins, 9);
  assert.equal(l.lastDay, dayNumber(NOW));
  const low = { ...freshLedger(42, NOW), coins: 1, lastDay: dayNumber(NOW) - 1 };
  assert.equal(normalizeLedger(JSON.stringify(low), NOW, noMint).coins, 4);
});
