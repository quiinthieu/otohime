// The click path, played through the same pure functions the buttons call,
// with serialize + normalizeLedger standing in for a reload.
import assert from "node:assert/strict";
import { test } from "node:test";
import { resetAlbum, tally, turn } from "./actions.ts";
import { CARDS } from "./cards.ts";
import { type Ledger, freshLedger, normalizeLedger, serialize } from "./ledger.ts";
import { type Machine, newMachine, step } from "./machine.ts";

const NOW = new Date(2026, 9, 19, 12).getTime();
const reload = (l: Ledger) =>
  normalizeLedger(serialize(l), NOW, () => {
    throw new Error("a reload must not mint a new seed");
  });

test("Insert, Turn, Open, reload: the card is kept, one coin is spent", () => {
  let ledger = freshLedger(42, NOW);
  let m: Machine = newMachine();

  m = step(m, "insert");
  assert.equal(m.phase, "loaded");
  // a reload after Insert gives the coin back: nothing was spent
  assert.equal(reload(ledger).coins, 5);

  const r = turn(ledger, NOW);
  assert.ok(r);
  ledger = r.ledger;
  m = step(m, "turn");
  assert.equal(m.phase, "turning");
  // a reload mid-crank already has the card
  assert.equal(reload(ledger).owned[r.card.id], 1);

  for (let i = 0; i < 100 && m.phase === "turning"; i++) m = step(m, "tick");
  assert.equal(m.phase, "ready");
  m = step(m, "open");
  assert.equal(m.phase, "opening");
  m = step(m, "settle");
  assert.equal(m.phase, "revealed");

  const after = reload(ledger);
  assert.equal(after.owned[r.card.id], 1);
  assert.equal(after.coins, 4);
  assert.equal(after.draws, 1);
  assert.deepEqual(tally(after), { owned: 1, total: 12, draws: 1 });
});

test("a reload never re-rolls the next draw", () => {
  let ledger = freshLedger(42, NOW);
  for (let i = 0; i < 30; i++) {
    const kept = turn({ ...ledger, coins: 9 }, NOW);
    const reloaded = turn(reload({ ...ledger, coins: 9 }), NOW);
    assert.ok(kept && reloaded);
    assert.equal(reloaded.card.id, kept.card.id);
    assert.deepEqual(reloaded.ledger, kept.ledger);
    ledger = kept.ledger;
  }
});

test("zero coins returns null and spends nothing", () => {
  const broke = { ...freshLedger(42, NOW), coins: 0 };
  assert.equal(turn(broke, NOW), null);
  assert.equal(broke.coins, 0);
  assert.equal(broke.draws, 0);
});

test("a new day tops up before the turn", () => {
  const broke = { ...freshLedger(42, NOW), coins: 0 };
  const r = turn(broke, new Date(2026, 9, 20, 9).getTime());
  assert.ok(r);
  assert.equal(r.ledger.coins, 2);
});

test("a duplicate counts up and the tally counts distinct cards", () => {
  let ledger = freshLedger(1, NOW);
  for (let i = 0; i < 40; i++) ledger = turn({ ...ledger, coins: 9 }, NOW)!.ledger;
  const counts = Object.values(ledger.owned);
  assert.equal(
    counts.reduce((a, b) => a + (b ?? 0), 0),
    40,
  );
  assert.ok(counts.some((c) => (c ?? 0) > 1));
  assert.equal(tally(ledger).owned, Object.keys(ledger.owned).length);
  assert.equal(tally(ledger).total, CARDS.length);
});

test("resetAlbum keeps seed, coins and lastDay", () => {
  const r = turn(freshLedger(42, NOW), NOW)!;
  const reset = resetAlbum(r.ledger);
  assert.equal(reset.seed, 42);
  assert.equal(reset.coins, 4);
  assert.equal(reset.lastDay, r.ledger.lastDay);
  assert.deepEqual(reset.owned, {});
  assert.equal(reset.draws, 0);
  assert.equal(reset.sinceLegend, 0);
  assert.deepEqual(reload(reset), reset);
});

test("Reset album, then reload: coins and seed kept, nothing owned, the next turn spends one coin", () => {
  let ledger = freshLedger(42, NOW);
  for (let i = 0; i < 3; i++) ledger = turn(ledger, NOW)!.ledger;
  assert.equal(ledger.coins, 2);
  assert.equal(tally(ledger).draws, 3);

  const after = reload(resetAlbum(ledger));
  assert.equal(after.seed, 42);
  assert.equal(after.coins, 2);
  assert.equal(after.lastDay, ledger.lastDay);
  assert.deepEqual(after.owned, {});
  assert.deepEqual(tally(after), { owned: 0, total: 12, draws: 0 });

  const next = turn(after, NOW);
  assert.ok(next);
  assert.equal(next.ledger.coins, 1);
  assert.equal(next.ledger.draws, 1);
  assert.equal(next.ledger.owned[next.card.id], 1);
  assert.equal(tally(next.ledger).owned, 1);
});
