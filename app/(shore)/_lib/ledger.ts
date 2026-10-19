// The ledger is what localStorage["shore-v1"] holds. Whatever is in there came
// from a browser, so it is read through normalizeLedger and never trusted.
import { LENGTHS, type Length, type Pebble, dayNumber, paletteFor, seedFor } from "./pebbles.ts";

export const STORAGE_KEY = "shore-v1";
export const KEEP_DAYS = 30;

export type Scene = "light" | "dark";
export type Ledger = { scene: Scene; pebbles: Pebble[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

// The nearest allowed length, so 20 becomes 15 (ties go to the shorter).
function clampMinutes(v: unknown): Length | null {
  const n = typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return null;
  return LENGTHS.reduce((best, l) => (Math.abs(l - n) < Math.abs(best - n) ? l : best), LENGTHS[0]);
}

export function normalizeLedger(raw: string | null | undefined, now: number): Ledger {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // bad JSON: start again
  }
  const input = isObject(parsed) ? parsed : {};
  const cutoff = now - KEEP_DAYS * 86_400_000;

  const seen = new Map<number, number>(); // pebbles kept per day, for fallback seeds
  const pebbles: Pebble[] = [];
  const list = Array.isArray(input.pebbles) ? input.pebbles : [];
  for (const entry of list) {
    if (!isObject(entry)) continue;
    const { startedAt, seed } = entry;
    const minutes = clampMinutes(entry.minutes);
    if (typeof startedAt !== "number" || !Number.isFinite(startedAt) || startedAt < cutoff) continue;
    if (minutes === null) continue;
    const day = dayNumber(startedAt);
    const index = seen.get(day) ?? 0;
    seen.set(day, index + 1);
    pebbles.push({
      startedAt,
      minutes,
      palette: paletteFor(minutes),
      seed: typeof seed === "number" && Number.isSafeInteger(seed) && seed >= 0 ? seed : seedFor(day, index),
    });
  }
  pebbles.sort((a, b) => a.startedAt - b.startedAt);
  return { scene: input.scene === "dark" ? "dark" : "light", pebbles };
}

export const today = (ledger: Ledger, now: number): Pebble[] =>
  ledger.pebbles.filter((p) => dayNumber(p.startedAt) === dayNumber(now));

export const serialize = (ledger: Ledger): string => JSON.stringify(ledger);
