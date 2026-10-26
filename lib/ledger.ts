// The Stamp Ledger's model: a year of lib/ledger-data.ts days turned into the
// 53x7 calendar the page stamps. Pure, no DOM, no clock and no Math.random, so
// the server and the first client render agree and lib/ledger.test.ts proves it.
//
// The calendar is the WINDOW_DAYS UTC days ending on a given day, one column per
// week (Sunday at the top), oldest week on the left. 365 days ending on any
// weekday fit 53 columns; a calendar leap year starting on a Saturday would not.

import type { Ledger, LedgerDay } from "./ledger-data.ts";

export const WEEKS = 53;
export const WEEKDAYS = 7;
export const WINDOW_DAYS = 365;

// Intensity levels: 0 is a blank day, 4 the darkest stamp.
export const MAX_LEVEL = 4;
// The busiest day sets the scale, but never below this, so a quiet year of one
// or two things a day does not stamp everything at full darkness.
export const MIN_SCALE = 16;

// A stamp leans at most this many degrees either way, and comes in SMUDGES variants.
export const MAX_ROTATION = 6;
export const SMUDGES = 4;
// Ink opacity per level.
export const INK = [0, 0.3, 0.5, 0.72, 0.92] as const;

export type MilestoneKind = "release" | "post";
export type Milestone = { kind: MilestoneKind; label: string };

export type StampStyle = { rotation: number; smudge: number; ink: number };

export type LedgerCell = {
  date: string;
  week: number;
  weekday: number;
  day: LedgerDay;
  total: number;
  level: number;
  milestones: Milestone[];
  style: StampStyle;
};

export type LedgerGrid = {
  from: string;
  to: string;
  // weeks[w][d]: column w (0 oldest), row d (0 Sunday); null outside the window.
  weeks: (LedgerCell | null)[][];
  // The columns where a month begins, with its short name.
  months: { week: number; label: string }[];
  scale: number;
};

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const EMPTY_DAY: LedgerDay = { commits: 0, notes: 0, sketches: 0, releases: [] };

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);

// The UTC calendar day of a YYYY-MM-DD or an ISO 8601 timestamp, or null.
export function endDay(v: string): string | null {
  if (DAY_RE.test(v)) {
    const ms = dayMs(v);
    return Number.isNaN(ms) || utcDay(ms) !== v ? null : v;
  }
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : utcDay(ms);
}

// The day a ledger's calendar ends on: the day it was generated, else its last
// day, else null for an empty ledger with no date.
export function endOf(ledger: Ledger): string | null {
  const generated = ledger.generated === null ? null : endDay(ledger.generated);
  if (generated) return generated;
  const days = Object.keys(ledger.days).sort();
  return days.length ? days[days.length - 1] : null;
}

// What a day's stamp counts: commits, notes and sketches. Releases are milestones.
export const total = (day: LedgerDay) => day.commits + day.notes + day.sketches;

// Log-quantised darkness 0..MAX_LEVEL of n things on a day, against the scale.
// Any activity is at least 1; the scale itself and above are MAX_LEVEL.
export function intensity(n: number, scale: number = MIN_SCALE): number {
  if (!(n > 0)) return 0;
  const s = Math.max(MIN_SCALE, scale);
  const level = Math.ceil((MAX_LEVEL * Math.log1p(n)) / Math.log1p(s));
  return Math.min(MAX_LEVEL, Math.max(1, level));
}

// FNV-1a, 32 bit, with murmur3's finaliser so neighbouring dates spread apart.
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// A stamp's lean (to a tenth of a degree) and smudge come from its date, its ink
// from its level, so the same day is pressed the same way on every render.
export function stampStyle(date: string, level: number): StampStyle {
  const h = hash(date);
  const t = (h / 0xffffffff) * 2 - 1;
  const rotation = Math.round(t * MAX_ROTATION * 10) / 10 || 0;
  const smudge = hash(`${date}:smudge`) % SMUDGES;
  const l = Number.isFinite(level) ? Math.min(MAX_LEVEL, Math.max(0, Math.round(level))) : 0;
  return { rotation, smudge, ink: INK[l] };
}

// The special stamps a day earns: one per release, then one for a new post.
export function milestones(day: LedgerDay): Milestone[] {
  const out: Milestone[] = day.releases.map((label) => ({ kind: "release", label }));
  if (day.notes > 0) out.push({ kind: "post", label: day.notes === 1 ? "new post" : `${day.notes} new posts` });
  return out;
}

// The calendar of the WINDOW_DAYS days ending on `end` (a day or a timestamp,
// read in UTC). Throws a RangeError when `end` is not a date.
export function ledgerGrid(ledger: Ledger, end: string): LedgerGrid {
  const to = endDay(end);
  if (!to) throw new RangeError(`not a date: ${end}`);
  const toMs = dayMs(to);
  const fromMs = toMs - (WINDOW_DAYS - 1) * DAY_MS;
  const from = utcDay(fromMs);
  // Column 0 starts on the Sunday WEEKS-1 weeks before the end's Sunday.
  const startMs = toMs - new Date(toMs).getUTCDay() * DAY_MS - (WEEKS - 1) * WEEKDAYS * DAY_MS;

  let busiest = 0;
  for (let ms = fromMs; ms <= toMs; ms += DAY_MS) {
    const day = ledger.days[utcDay(ms)];
    if (day) busiest = Math.max(busiest, total(day));
  }
  const scale = Math.max(MIN_SCALE, busiest);

  const weeks: (LedgerCell | null)[][] = [];
  const months: { week: number; label: string }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const column: (LedgerCell | null)[] = [];
    for (let d = 0; d < WEEKDAYS; d++) {
      const ms = startMs + (w * WEEKDAYS + d) * DAY_MS;
      if (ms < fromMs || ms > toMs) {
        column.push(null);
        continue;
      }
      const date = utcDay(ms);
      const day = ledger.days[date] ?? EMPTY_DAY;
      const n = total(day);
      const level = intensity(n, scale);
      column.push({ date, week: w, weekday: d, day, total: n, level, milestones: milestones(day), style: stampStyle(date, level) });
      if (date.endsWith("-01")) months.push({ week: w, label: MONTH_NAMES[Number(date.slice(5, 7)) - 1] });
    }
    weeks.push(column);
  }
  return { from, to, weeks, months, scale };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The tiny receipt shown on hover: the date, then one line per kind of thing
// done, then the releases. A day with nothing on it says so.
export function receiptLines({ date, day }: { date: string; day: LedgerDay }): string[] {
  const d = new Date(dayMs(date));
  const head = Number.isNaN(d.getTime())
    ? date
    : `${WEEKDAY_NAMES[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const lines = [head];
  if (day.commits) lines.push(plural(day.commits, "commit", "commits"));
  if (day.notes) lines.push(plural(day.notes, "note", "notes"));
  if (day.sketches) lines.push(plural(day.sketches, "sketch", "sketches"));
  for (const name of day.releases) lines.push(`release: ${name}`);
  if (lines.length === 1) lines.push("no ink today");
  return lines;
}

export const receiptText = (cell: { date: string; day: LedgerDay }) => receiptLines(cell).join("\n");

// The press replay: the year's days pressed again in date order, one every
// PRESS_MS (365 days in about six seconds), and a stamp thud on every
// PRESS_SOUND_EVERY-th day, once a week. The component steps it from
// requestAnimationFrame; under reduced motion it jumps straight to the end.
export const PRESS_MS = 16;
export const PRESS_SOUND_EVERY = WEEKDAYS;

// How many of n days should be pressed `elapsedMs` after the press starts: the
// first on the first frame, then one per stepMs, never more than n.
export function pressDue(elapsedMs: number, n: number, stepMs: number = PRESS_MS): number {
  const total = Math.max(0, Math.floor(n) || 0);
  const due = elapsedMs > 0 ? Math.floor(elapsedMs / stepMs) + 1 : 1;
  return Math.min(total, due);
}

// Whether stepping from `from` to `to` pressed days thuds: when one of the days
// pressed (indices from..to-1) is a multiple of `every`. One thud at most per
// step however many multiples it skips, so a dropped frame never doubles up.
export function pressSounds(from: number, to: number, every: number = PRESS_SOUND_EVERY): boolean {
  const n = Math.max(1, Math.floor(every) || 1);
  const a = Math.max(0, Math.ceil(from));
  const b = Math.floor(to);
  return b > a && Math.ceil(a / n) * n < b;
}
