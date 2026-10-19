// What the buttons call. Turn commits the whole draw in one new ledger, so a
// reload mid-animation keeps the card; Insert coin is UI state and spends nothing.
import { CARDS, type Card } from "./cards.ts";
import { draw } from "./gacha.ts";
import { type Ledger, refill } from "./ledger.ts";

export function turn(ledger: Ledger, now: number): { ledger: Ledger; card: Card } | null {
  const l = refill(ledger, now);
  if (l.coins < 1) return null;
  const { id, tier } = draw(l.seed, l.draws, l.sinceLegend);
  const card = CARDS.find((c) => c.id === id)!;
  return {
    card,
    ledger: {
      ...l,
      coins: l.coins - 1,
      draws: l.draws + 1,
      sinceLegend: tier === "legend" ? 0 : l.sinceLegend + 1,
      owned: { ...l.owned, [id]: (l.owned[id] ?? 0) + 1 },
    },
  };
}

// Clears the album only: seed, coins and lastDay stay, so a reset mints nothing.
export const resetAlbum = (ledger: Ledger): Ledger => ({ ...ledger, owned: {}, draws: 0, sinceLegend: 0 });

// "7 of 12 · 23 draws"
export const tally = (ledger: Ledger) => ({
  owned: CARDS.filter((c) => (ledger.owned[c.id] ?? 0) > 0).length,
  total: CARDS.length,
  draws: ledger.draws,
});
