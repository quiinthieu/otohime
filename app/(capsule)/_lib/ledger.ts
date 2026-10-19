// The ledger is what localStorage["capsule-v1"] holds. Whatever is in there
// came from a browser, so it is read through normalizeLedger and never trusted.
import { CARDS, type CardId } from "./cards.ts";

export const STORAGE_KEY = "capsule-v1";
export const START_COINS = 5;
export const DAILY_COINS = 3;
export const MAX_COINS = 9;

export type Ledger = {
  v: 1;
  seed: number;
  draws: number;
  coins: number;
  lastDay: number; // the local day coins were last topped up
  sinceLegend: number;
  owned: Partial<Record<CardId, number>>;
};

// Days since the epoch, counted by the local calendar (like Shore's).
export function dayNumber(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export const freshLedger = (seed: number, now: number): Ledger => ({
  v: 1,
  seed,
  draws: 0,
  coins: START_COINS,
  lastDay: dayNumber(now),
  sinceLegend: 0,
  owned: {},
});

// DAILY_COINS for each new day, up to MAX_COINS. The same day, or a clock that
// went back, adds nothing, and lastDay never moves backwards.
export function refill(ledger: Ledger, now: number): Ledger {
  const today = dayNumber(now);
  if (today <= ledger.lastDay) return ledger;
  const coins = Math.min(MAX_COINS, ledger.coins + DAILY_COINS * (today - ledger.lastDay));
  return { ...ledger, coins, lastDay: today };
}

export const serialize = (ledger: Ledger): string => JSON.stringify(ledger);

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// A whole number in [lo, hi], or the fallback when it is not a number at all.
function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, Math.floor(v)));
}

const IDS = new Set<string>(CARDS.map((c) => c.id));

export function normalizeLedger(raw: string | null | undefined, now: number, mintSeed: () => number): Ledger {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // bad JSON: start again
  }
  if (!isObject(parsed) || parsed.v !== 1) return freshLedger(mintSeed(), now);

  const owned: Ledger["owned"] = {};
  if (isObject(parsed.owned)) {
    for (const [id, count] of Object.entries(parsed.owned)) {
      if (IDS.has(id) && Number.isSafeInteger(count) && (count as number) > 0) owned[id as CardId] = count as number;
    }
  }
  const { seed, lastDay } = parsed;
  const ledger: Ledger = {
    v: 1,
    seed: Number.isSafeInteger(seed) ? (seed as number) : mintSeed(),
    draws: clampInt(parsed.draws, 0, Number.MAX_SAFE_INTEGER, 0),
    // junk never mints coins
    coins: clampInt(parsed.coins, 0, MAX_COINS, 0),
    lastDay: Number.isSafeInteger(lastDay) ? (lastDay as number) : dayNumber(now),
    sinceLegend: clampInt(parsed.sinceLegend, 0, Number.MAX_SAFE_INTEGER, 0),
    owned,
  };
  return refill(ledger, now);
}
