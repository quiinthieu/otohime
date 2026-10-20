// A draw is a function of the stored seed and the draw count, so a reload can
// only ever give the card it was going to give.
import { CARDS, type CardId, PITY, RATES, TIERS, type Tier } from "./cards.ts";
import { DOME_SIZE, TURN_MAX, TURN_MIN } from "./machine.ts";
import { prng } from "./rng.ts";

const CARD_STREAM = 0x9e3779b9; // picks the card within its tier
const TURN_STREAM = 0x85ebca6b; // how long the crank turns
const DROP_STREAM = 0xc2b2ae35; // which capsule in the dome falls

export function tierFor(u: number): Tier {
  let edge = 0;
  for (const tier of TIERS) {
    edge += RATES[tier];
    if (u < edge) return tier;
  }
  return TIERS[TIERS.length - 1];
}

export function draw(seed: number, n: number, sinceLegend: number): { id: CardId; tier: Tier } {
  const tier = sinceLegend >= PITY - 1 ? "legend" : tierFor(prng(seed, n));
  const pool = CARDS.filter((c) => c.tier === tier);
  const card = pool[Math.floor(prng(seed ^ CARD_STREAM, n) * pool.length)];
  return { id: card.id, tier };
}

// How a round looks is seeded too, on streams of its own, for the same n as
// the draw: neither depends on the tier, so neither can give it away.
export const turnFrames = (seed: number, n: number): number =>
  TURN_MIN + Math.floor(prng(seed ^ TURN_STREAM, n) * (TURN_MAX - TURN_MIN + 1));
export const dropIndex = (seed: number, n: number): number => Math.floor(prng(seed ^ DROP_STREAM, n) * DOME_SIZE);

const percent = (rate: number) => `${Math.round(rate * 100)}%`;
const title = (tier: Tier) => tier[0].toUpperCase() + tier.slice(1);

// "Common 70% · Rare 25% · Legend 5% · a legend at least every 20 draws · ..."
export const ratesLine = (): string =>
  [
    ...TIERS.map((t) => `${title(t)} ${percent(RATES[t])}`),
    `a legend at least every ${PITY} draws`,
    "coins are free and can't be bought",
  ].join(" · ");
