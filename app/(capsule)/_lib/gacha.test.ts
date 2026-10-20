import assert from "node:assert/strict";
import { test } from "node:test";
import { turn } from "./actions.ts";
import { CARDS, PITY, RATES, TIERS, type Tier } from "./cards.ts";
import { draw, dropIndex, ratesLine, tierFor, turnFrames } from "./gacha.ts";
import { MAX_COINS, freshLedger } from "./ledger.ts";
import { DOME_SIZE, TURN_MAX, TURN_MIN } from "./machine.ts";
import { prng } from "./rng.ts";

const NOW = new Date(2026, 9, 19, 12).getTime();

test("the card set is the plan's twelve with a 70/25/5 table", () => {
  assert.equal(CARDS.length, 12);
  assert.equal(new Set(CARDS.map((c) => c.id)).size, 12);
  assert.deepEqual(RATES, { common: 0.7, rare: 0.25, legend: 0.05 });
  assert.equal(PITY, 20);
  const count = (t: Tier) => CARDS.filter((c) => c.tier === t).length;
  assert.deepEqual(TIERS.map(count), [6, 4, 2]);
  for (const c of CARDS) assert.ok(c.note.length > 10 && c.name && c.film && c.year > 1900, c.id);
});

test("tierFor follows the cumulative rates", () => {
  assert.equal(tierFor(0), "common");
  assert.equal(tierFor(0.6999), "common");
  assert.equal(tierFor(0.7), "rare");
  assert.equal(tierFor(0.9499), "rare");
  assert.equal(tierFor(0.95), "legend");
  assert.equal(tierFor(0.999999), "legend");
});

test("over 10 000 draws for each of 3 seeds the shares are within 2 points of 70/25/5", () => {
  for (const seed of [1, 42, 3735928559]) {
    const n = 10_000;
    const hits: Record<Tier, number> = { common: 0, rare: 0, legend: 0 };
    for (let i = 0; i < n; i++) hits[tierFor(prng(seed, i))]++;
    for (const t of TIERS) {
      const share = (hits[t] / n) * 100;
      assert.ok(Math.abs(share - RATES[t] * 100) <= 2, `seed ${seed}: ${t} ${share.toFixed(2)}%`);
    }
  }
});

test("19 misses in a row force a legend", () => {
  for (const seed of [1, 42, 3735928559]) {
    for (let n = 0; n < 500; n++) {
      assert.equal(draw(seed, n, PITY - 1).tier, "legend");
      assert.equal(draw(seed, n, 40).tier, "legend");
    }
  }
});

test("2 000 draws through turn never go 20 without a legend, and reach every card", () => {
  for (const seed of [1, 42, 3735928559]) {
    let ledger = freshLedger(seed, NOW);
    let dry = 0;
    let longest = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const r = turn({ ...ledger, coins: MAX_COINS }, NOW);
      assert.ok(r);
      ledger = r.ledger;
      seen.add(r.card.id);
      dry = r.card.tier === "legend" ? 0 : dry + 1;
      longest = Math.max(longest, dry);
      assert.equal(ledger.sinceLegend, dry);
    }
    assert.ok(longest < PITY, `seed ${seed}: ${longest} draws without a legend`);
    assert.equal(ledger.draws, 2000);
    assert.equal(seen.size, CARDS.length, `seed ${seed} reached ${[...seen]}`);
  }
});

test("every id drawn is a card of the drawn tier", () => {
  const byId = new Map(CARDS.map((c) => [c.id, c]));
  for (let n = 0; n < 3000; n++) {
    const d = draw(7, n, n % PITY);
    assert.equal(byId.get(d.id)?.tier, d.tier);
  }
});

test("the rates line is built from RATES and PITY", () => {
  const line = ratesLine();
  for (const part of ["70%", "25%", "5%", "20"]) assert.ok(line.includes(part), part);
  assert.equal(
    line,
    "Common 70% · Rare 25% · Legend 5% · a legend at least every 20 draws · coins are free and can't be bought",
  );
});

test("turnFrames stays in 16..28 and takes at least 8 lengths over 200 draws", () => {
  assert.equal(TURN_MIN, 16);
  assert.equal(TURN_MAX, 28);
  for (const seed of [1, 42, 3735928559]) {
    const seen = new Set<number>();
    for (let n = 0; n < 200; n++) {
      const f = turnFrames(seed, n);
      assert.ok(Number.isInteger(f) && f >= TURN_MIN && f <= TURN_MAX, `seed ${seed} n ${n}: ${f}`);
      seen.add(f);
    }
    assert.ok(seen.size >= 8, `seed ${seed}: ${seen.size} distinct lengths`);
  }
});

test("dropIndex picks one of the 8 capsules in the dome", () => {
  assert.equal(DOME_SIZE, 8);
  const seen = new Set<number>();
  for (let n = 0; n < 200; n++) {
    const d = dropIndex(42, n);
    assert.ok(Number.isInteger(d) && d >= 0 && d < DOME_SIZE, `${d}`);
    seen.add(d);
  }
  assert.equal(seen.size, DOME_SIZE);
});

test("the turn's length and drop do not depend on sinceLegend, so they cannot encode the tier", () => {
  for (const seed of [1, 42, 3735928559]) {
    for (let draws = 0; draws < 60; draws++) {
      const base = { ...freshLedger(seed, NOW), coins: MAX_COINS, draws };
      const plain = turn({ ...base, sinceLegend: 0 }, NOW)!;
      // a pity legend, for the same seed and draw index
      const pity = turn({ ...base, sinceLegend: PITY - 1 }, NOW)!;
      assert.equal(pity.card.tier, "legend");
      assert.equal(plain.frames, pity.frames);
      assert.equal(plain.drop, pity.drop);
      assert.equal(plain.frames, turnFrames(seed, draws));
      assert.equal(plain.drop, dropIndex(seed, draws));
    }
  }
});
