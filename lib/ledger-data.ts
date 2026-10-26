// The Stamp Ledger's data, as content/ledger.json holds it and the page reads it.
// scripts/ledger-fetch.mjs writes the file at build time; parseLedger here takes
// `unknown` and keeps only what is well formed, so a hand-edited or truncated
// file costs the bad days, never the page. No fetch, no env, no clock.
//
// Shape: { generated: ISO 8601, days: { "YYYY-MM-DD": { commits, notes, sketches, releases } } }
// Dates are UTC calendar days. commits, notes and sketches are counts; releases
// are the names of public releases published that day.

export type LedgerDay = { commits: number; notes: number; sketches: number; releases: string[] };

export type Ledger = {
  // When the file was written (ISO 8601), or null when that is unknown.
  generated: string | null;
  days: Record<string, LedgerDay>;
};

// Caps: a day count above MAX_COUNT is not believed, a release name is cut to
// RELEASE_NAME characters, and a day keeps at most MAX_RELEASES names.
export const MAX_COUNT = 10_000;
export const RELEASE_NAME = 64;
export const MAX_RELEASES = 8;

export const EMPTY_LEDGER: Ledger = { generated: null, days: {} };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A real calendar day in YYYY-MM-DD form: 2026-02-30 is not one.
export function isDay(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === v;
}

// A count is a whole number in [0, MAX_COUNT]; a missing one is 0.
function count(v: unknown): number | null {
  if (v === undefined) return 0;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_COUNT ? v : null;
}

// A release name with control characters and runs of space collapsed, cut to
// RELEASE_NAME code points. Null when nothing is left.
function releaseName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const chars = Array.from(s);
  return chars.length <= RELEASE_NAME ? s : `${chars.slice(0, RELEASE_NAME - 1).join("").trimEnd()}…`;
}

// One day, or null when any count is malformed or releases is not a list.
// Unusable release names are dropped; an all-zero day is still a day.
export function parseDay(v: unknown): LedgerDay | null {
  if (!isRecord(v)) return null;
  const commits = count(v.commits);
  const notes = count(v.notes);
  const sketches = count(v.sketches);
  if (commits === null || notes === null || sketches === null) return null;
  const raw = v.releases ?? [];
  if (!Array.isArray(raw)) return null;
  const releases = raw.map(releaseName).filter((n): n is string => n !== null).slice(0, MAX_RELEASES);
  return { commits, notes, sketches, releases };
}

// The whole file. Anything that is not an object with a days object is the
// empty ledger; a bad day is dropped and the rest kept, in date order.
export function parseLedger(v: unknown): Ledger {
  if (!isRecord(v) || !isRecord(v.days)) return EMPTY_LEDGER;
  const generated = typeof v.generated === "string" && !Number.isNaN(Date.parse(v.generated)) ? v.generated : null;
  const days: Record<string, LedgerDay> = {};
  for (const key of Object.keys(v.days).sort()) {
    if (!isDay(key)) continue;
    const day = parseDay(v.days[key]);
    if (day) days[key] = day;
  }
  return { generated, days };
}
