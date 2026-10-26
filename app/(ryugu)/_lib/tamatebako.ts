// The Tamatebako's changelog replay. Urashima opened the box and the centuries he had missed caught up with him; this
// box replays otohime.dev's own commits (content/history.json, built from git log at build time) on a leaf of paper
// that yellows the further back the scrubber goes. It is a replay of the changelog: dates and subjects of real
// commits, never a rebuilt old version of the site. Pure functions only; ../_components/tamatebako.tsx draws them.

// One commit on the scrubber: the fields of a content/history.json entry the leaf shows.
export type Leaf = {
  sha: string;
  date: string; // ISO 8601, UTC
  plan: string | null;
  task: string | null;
  subject: string;
  files: number;
  areas: string[];
};

// The scrubber's positions, oldest first (position 0) to newest (the last), and how many commits the repository
// had in all, of which the index kept the newest.
export type Replay = { leaves: Leaf[]; total: number };

export const EMPTY_REPLAY: Replay = { leaves: [], total: 0 };

const SHA = /^[0-9a-f]{7,40}$/;
const str = (v: unknown) => (typeof v === "string" ? v : null);

// The index as the palace reads it. history.json lists the newest commit first; the scrubber runs from the oldest.
// An entry without a sha, a real date or a subject is left out rather than drawn as a blank leaf, and anything
// that is not an index at all is an empty box.
export function replay(index: unknown): Replay {
  const raw = (index as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(raw)) return EMPTY_REPLAY;
  const leaves: Leaf[] = [];
  for (const e of raw as Record<string, unknown>[]) {
    const sha = str(e?.sha);
    const date = str(e?.date);
    const subject = str(e?.subject)?.trim();
    if (!sha || !SHA.test(sha) || !date || Number.isNaN(Date.parse(date)) || !subject) continue;
    leaves.push({
      sha,
      date,
      plan: str(e.plan),
      task: str(e.task),
      subject,
      files: typeof e.files === "number" && e.files >= 0 ? e.files : 0,
      areas: Array.isArray(e.areas) ? e.areas.filter((a): a is string => typeof a === "string") : [],
    });
  }
  leaves.reverse();
  const total = (index as { total?: unknown }).total;
  return { leaves, total: typeof total === "number" && total >= leaves.length ? total : leaves.length };
}

// How old the paper is at a position: 0 at the newest commit, 1 at the oldest, in even steps. The steps follow
// position, not elapsed time, so the paper yellows at every step back however the commits bunch together in time.
export function ageAt(position: number, count: number): number {
  if (count <= 1 || !Number.isFinite(position)) return 0;
  const p = Math.min(Math.max(Math.round(position), 0), count - 1);
  return (count - 1 - p) / (count - 1);
}

type RGB = [number, number, number];
const FRESH: RGB = [242, 239, 231]; // the site's paper, --paper
const AGED: RGB = [214, 186, 122]; // the same sheet, yellowed
const INK: RGB = [35, 30, 22];
const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const round = (n: number) => Math.round(n * 1000) / 1000;

// The leaf's paper at an age: the sheet yellows, the ink fades and foxing spots come up. The values are custom
// properties for ryugu.css's .leaf.
export function paperAt(age: number) {
  const t = Math.min(Math.max(Number.isFinite(age) ? age : 0, 0), 1);
  const [r, g, b] = mix(FRESH, AGED, t);
  return {
    "--leaf-paper": `rgb(${r}, ${g}, ${b})`,
    "--leaf-ink": `rgba(${INK.join(", ")}, ${round(1 - 0.38 * t)})`,
    "--leaf-foxing": `${round(0.6 * t)}`,
    "--leaf-edge": `${round(4 + 22 * t)}px`,
  };
}

// The age in words, for the leaf and for a screen reader.
export function ageWord(age: number): string {
  if (age < 0.05) return "fresh paper";
  if (age < 0.35) return "faintly yellowed";
  if (age < 0.7) return "yellowed";
  return "old and foxed";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

// A commit's date as the leaf prints it, in UTC and without the visitor's locale, so the server's text is the
// client's: "26 Oct 2026, 11:17 UTC".
export function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC`;
}

// What a screen reader hears for a scrubber position: the date and subject of the commit, where it stands, and how
// old the paper is.
export function valueText(leaves: Leaf[], position: number): string {
  const leaf = leaves[position];
  if (!leaf) return "No changelog";
  return `${stamp(leaf.date)}: ${leaf.subject}. Commit ${position + 1} of ${leaves.length}, ${ageWord(ageAt(position, leaves.length))}.`;
}

// How the box opens: a puff of smoke that clears after SMOKE_MS, or, under reduced motion, no smoke and the
// replay at once.
export const SMOKE_MS = 1400;
export const opening = (reduced: boolean) => (reduced ? { smoke: false, ms: 0 } : { smoke: true, ms: SMOKE_MS });
