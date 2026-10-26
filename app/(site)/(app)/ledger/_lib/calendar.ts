// The Stamp Ledger page's drawing and keyboard arithmetic over lib/ledger.ts's
// grid. Pure, no DOM, so _lib/calendar.test.ts proves it and
// _components/stamp-calendar.tsx only draws what it returns.
import type { Hand } from "../../../../../lib/ink-modes.ts";
import { WEEKDAYS, WEEKS, type LedgerCell, type LedgerGrid } from "../../../../../lib/ledger.ts";
import type { LedgerDay } from "../../../../../lib/ledger-data.ts";

// The calendar's user units: one PITCH square per day, a STAMP pressed in its
// middle, gutters for the weekday and month labels.
export const PITCH = 16;
export const STAMP = 13;
export const GUTTER = { left: 30, top: 18 };
export const VIEW = { w: GUTTER.left + WEEKS * PITCH, h: GUTTER.top + WEEKDAYS * PITCH };

// The centre of the day in column `week`, row `weekday`.
export const centre = (week: number, weekday: number) => ({
  x: GUTTER.left + week * PITCH + PITCH / 2,
  y: GUTTER.top + weekday * PITCH + PITCH / 2,
});

// The SMUDGES ways a stamp can be pressed: lib/ink-modes.ts filters, one shared
// <filter> each, so the whole year costs SMUDGES filters however many days it has.
export const SMUDGE_FILTERS: readonly { hand: Hand; seed: number; wobble: number }[] = [
  { hand: "ink", seed: 0, wobble: 1.2 },
  { hand: "pencil", seed: 17, wobble: 1.6 },
  { hand: "crayon", seed: 41, wobble: 1.2 },
  { hand: "ink", seed: 63, wobble: 2 },
];

// The days of the grid in date order: the columns top to bottom, oldest first.
export const daysOf = (grid: LedgerGrid): LedgerCell[] =>
  grid.weeks.flat().filter((cell): cell is LedgerCell => cell !== null);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "12 Mar" for 2026-03-12. Within one 365-day window no two days share it.
export const shortDate = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
// "12 Mar 2026".
export const longDate = (date: string) => `${shortDate(date)} ${date.slice(0, 4)}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// What a screen reader hears for a day: "12 Mar: 5 commits, 1 note, release v1.2".
export function cellLabel({ date, day }: { date: string; day: LedgerDay }): string {
  const parts: string[] = [];
  if (day.commits) parts.push(plural(day.commits, "commit", "commits"));
  if (day.notes) parts.push(plural(day.notes, "note", "notes"));
  if (day.sketches) parts.push(plural(day.sketches, "sketch", "sketches"));
  for (const name of day.releases) parts.push(`release ${name}`);
  return `${shortDate(date)}: ${parts.length ? parts.join(", ") : "no ink"}`;
}

// Roving focus over the n days in date order: up and down step a day, left and
// right a week (one column), Home and End the ends. Moves stop at the ends.
// Null for a key the calendar does not take.
const STEPS: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -WEEKDAYS, ArrowRight: WEEKDAYS };

export function moveIndex(i: number, key: string, n: number): number | null {
  if (!(n > 0)) return null;
  if (key === "Home") return 0;
  if (key === "End") return n - 1;
  const step = STEPS[key];
  if (step === undefined) return null;
  return Math.min(n - 1, Math.max(0, i + step));
}

export type Totals = { commits: number; notes: number; sketches: number; releases: number; inked: number };

// The year's sums, and how many days carry any ink at all.
export function totals(cells: readonly LedgerCell[]): Totals {
  const t: Totals = { commits: 0, notes: 0, sketches: 0, releases: 0, inked: 0 };
  for (const { day, total } of cells) {
    t.commits += day.commits;
    t.notes += day.notes;
    t.sketches += day.sketches;
    t.releases += day.releases.length;
    if (total > 0 || day.releases.length) t.inked++;
  }
  return t;
}

// The release rosette: a star of `points` scallops between radii r and inner,
// as a closed path with two decimals.
export function rosette(r: number, inner: number, points: number): string {
  const n = Math.max(3, Math.floor(points));
  const out: string[] = [];
  for (let k = 0; k < 2 * n; k++) {
    const a = (Math.PI * k) / n - Math.PI / 2;
    const rad = k % 2 === 0 ? r : inner;
    out.push(`${k === 0 ? "M" : "L"}${(rad * Math.cos(a)).toFixed(2)} ${(rad * Math.sin(a)).toFixed(2)}`);
  }
  return `${out.join("")}Z`.replace(/-0\.00/g, "0.00");
}
