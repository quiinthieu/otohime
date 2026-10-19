// A pebble is one finished session. Its seed is fixed by the day and its place
// in the day, so a day always re-renders the same way.
import type { PaletteName } from "./sea-glass.mjs";

export const LENGTHS = [15, 25, 45] as const;
export type Length = (typeof LENGTHS)[number];

export type Pebble = { startedAt: number; minutes: Length; palette: PaletteName; seed: number };

export const seedFor = (day: number, index: number): number => day * 101 + index;

export const paletteFor = (minutes: number): PaletteName =>
  minutes === 15 ? "amber" : minutes === 25 ? "mint" : "lilac";

// Whole local days since the epoch: the same number all day, in the visitor's zone.
export function dayNumber(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export function mint(startedAt: number, minutes: Length, index: number): Pebble {
  return { startedAt, minutes, palette: paletteFor(minutes), seed: seedFor(dayNumber(startedAt), index) };
}

// "3 pieces · 1 h 25 min"
export function tally(pebbles: Pebble[]): string {
  const total = pebbles.reduce((sum, p) => sum + p.minutes, 0);
  const n = `${pebbles.length} ${pebbles.length === 1 ? "piece" : "pieces"}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const time = h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  return `${n} · ${time}`;
}
