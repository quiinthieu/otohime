// Paper Strata: weekly activity into stacked cut-paper contours, plus the rustle cue.
// Pure. scripts/strata-index.ts writes content/strata.json. The stage only draws this.

import type { Cue } from "./sound.ts";

export const STRATA_YEARS = [2024, 2025, 2026] as const;
export const WEEKS_PER_YEAR = 52;
export const STRATA_SWATCHES = ["--paper-deep", "--amber", "--moss", "--sky", "--indigo", "--vermilion"] as const;
export const STRATA_FLOOR = 0.08;

export type StrataWeek = {
  isoYear: number;
  week: number;
  startDate: string;
  endDate: string;
  commits: number;
  notes: number;
  activity: number;
  shippedProjects: string[];
  highlights: string[];
};

export type StrataYearArchive = {
  year: number;
  source: "git" | "archive";
  totalCommits: number;
  totalNotes: number;
  peakWeek: number;
  weeks: StrataWeek[];
};

export type StrataData = {
  generatedAt: string;
  head: string | null;
  years: StrataYearArchive[];
};

export type StrataLayer = {
  index: number;
  swatch: (typeof STRATA_SWATCHES)[number];
  threshold: number;
  depth: number;
  d: string;
  shadow: { dx: number; dy: number; blur: number };
  anchors: { week: number; x: number; y: number }[];
};

export type StrataMetric = "activity" | "commits" | "notes";

const DAY = 86_400_000;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

function stamp(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Monday of ISO week 1 for an ISO year. */
function week1Monday(isoYear: number) {
  const jan4 = utc(isoYear, 1, 4);
  const day = jan4.getUTCDay() || 7;
  return new Date(jan4.getTime() - (day - 1) * DAY);
}

export function isoWeekOf(isoDate: string): { isoYear: number; week: number } {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = utc(y, m, d);
  const day = date.getUTCDay() || 7;
  const thursday = new Date(date.getTime() + (4 - day) * DAY);
  const isoYear = thursday.getUTCFullYear();
  const start = week1Monday(isoYear);
  const week = 1 + Math.round((date.getTime() - start.getTime()) / (7 * DAY));
  return { isoYear, week };
}

export function isoWeekBounds(isoYear: number, week: number): { startDate: string; endDate: string } {
  const start = new Date(week1Monday(isoYear).getTime() + (week - 1) * 7 * DAY);
  return { startDate: stamp(start), endDate: stamp(new Date(start.getTime() + 6 * DAY)) };
}

export function emptyStrataYear(year: number, source: "git" | "archive" = "archive"): StrataYearArchive {
  const weeks: StrataWeek[] = [];
  for (let week = 1; week <= WEEKS_PER_YEAR; week++) {
    const { startDate, endDate } = isoWeekBounds(year, week);
    weeks.push({
      isoYear: year,
      week,
      startDate,
      endDate,
      commits: 0,
      notes: 0,
      activity: 0,
      shippedProjects: [],
      highlights: [],
    });
  }
  return { year, source, totalCommits: 0, totalNotes: 0, peakWeek: 1, weeks };
}

function finishYear(year: StrataYearArchive) {
  let commits = 0;
  let notes = 0;
  let peakWeek = 1;
  let peak = -1;
  for (const week of year.weeks) {
    week.activity = week.commits + week.notes;
    commits += week.commits;
    notes += week.notes;
    if (week.activity > peak) {
      peak = week.activity;
      peakWeek = week.week;
    }
  }
  year.totalCommits = commits;
  year.totalNotes = notes;
  year.peakWeek = peakWeek;
  year.source = commits > 0 ? "git" : "archive";
}

export type StrataBuildInput = {
  generatedAt: string;
  head: string | null;
  years?: readonly number[];
  commits?: readonly string[];
  notes?: readonly { date: string; title: string }[];
  projects?: readonly { title: string; started?: string; shipped?: string; lastActivityAt?: string }[];
  experience?: readonly { date?: string; label?: string; title?: string; note?: string }[];
  ledgerNotes?: readonly { date: string; notes: number }[];
};

export function buildStrataData(input: StrataBuildInput): StrataData {
  const years = (input.years ?? STRATA_YEARS).map((year) => emptyStrataYear(year));
  const byYear = new Map(years.map((year) => [year.year, year]));

  const place = (isoDate: string | undefined) => {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return null;
    const day = isoDate.slice(0, 10);
    const located = isoWeekOf(day);
    const isoYear = located.isoYear;
    let week = located.week;
    // shortcut: ISO week 53 shares the week 52 sheet, split the bucket if a year view needs all 53.
    if (week > WEEKS_PER_YEAR) week = WEEKS_PER_YEAR;
    if (week < 1) return null;
    const year = byYear.get(isoYear);
    if (!year) return null;
    return year.weeks[week - 1];
  };

  for (const date of input.commits ?? []) {
    const week = place(date);
    if (week) week.commits += 1;
  }
  const noted = new Set<string>();
  for (const note of input.notes ?? []) {
    const week = place(note.date);
    if (!week) continue;
    week.notes += 1;
    if (week.highlights.length < 6) week.highlights.push(note.title);
    noted.add(note.date.slice(0, 10));
  }
  for (const day of input.ledgerNotes ?? []) {
    if (noted.has(day.date.slice(0, 10)) || !(day.notes > 0)) continue;
    const week = place(day.date);
    if (week) week.notes += day.notes;
  }
  for (const project of input.projects ?? []) {
    const shipped = place(project.shipped);
    if (shipped) {
      if (!shipped.shippedProjects.includes(project.title)) shipped.shippedProjects.push(project.title);
      if (shipped.highlights.length < 6) shipped.highlights.push(`Shipped ${project.title}`);
    }
    const started = place(project.started);
    if (started && project.started !== project.shipped && started.highlights.length < 6) {
      started.highlights.push(`Started ${project.title}`);
    }
  }
  for (const item of input.experience ?? []) {
    const week = place(item.date);
    const label = item.label || item.title || item.note;
    if (week && label && week.highlights.length < 6) week.highlights.push(label);
  }
  for (const year of years) {
    finishYear(year);
    if (year.source === "archive" && year.totalCommits + year.totalNotes === 0) {
      year.weeks[0].highlights.push("Pre-repository archive. Dated commits and notes in this index begin in 2026.");
    }
  }
  return { generatedAt: input.generatedAt, head: input.head, years };
}

/** Square-root height with a valley floor so empty weeks still hold a sheet of paper. */
export function scaleWeekHeight(activity: number, maxActivity: number, minFloor = STRATA_FLOOR): number {
  const floor = clamp(minFloor, 0, 0.95);
  if (!(activity > 0) || !(maxActivity > 0)) return floor;
  const t = Math.min(1, Math.sqrt(activity / maxActivity));
  return floor + (1 - floor) * t;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildStrataLayers(
  yearArchive: StrataYearArchive,
  options?: { bandCount?: number; width?: number; height?: number; seed?: number; metric?: StrataMetric },
): StrataLayer[] {
  const bandCount = options?.bandCount ?? 6;
  const width = options?.width ?? 960;
  const height = options?.height ?? 420;
  const metric = options?.metric ?? "activity";
  const rand = mulberry32(options?.seed ?? 1);
  const weeks = yearArchive.weeks;
  const n = weeks.length;
  const values = weeks.map((week) => (metric === "commits" ? week.commits : metric === "notes" ? week.notes : week.activity));
  const max = Math.max(1, ...values);
  const scaled = values.map((value) => scaleWeekHeight(value, max));
  const padX = 28;
  const padTop = 36;
  const padBottom = 28;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const xAt = (i: number) => padX + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (h: number) => padTop + (1 - h) * innerH;
  const layers: StrataLayer[] = [];

  for (let band = 0; band < bandCount; band++) {
    const threshold = band / bandCount;
    const top: string[] = [];
    const bottom: string[] = [];
    const anchors: StrataLayer["anchors"] = [];
    for (let i = 0; i < n; i++) {
      const wobble = (rand() - 0.5) * 7;
      const x = xAt(i);
      const y = yAt(Math.max(scaled[i], threshold)) + wobble * 0.35;
      const yb = yAt(threshold) + wobble * 0.12;
      top.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      bottom.push(`${x.toFixed(2)},${yb.toFixed(2)}`);
      anchors.push({ week: weeks[i]?.week ?? i + 1, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) });
    }
    layers.push({
      index: band,
      swatch: STRATA_SWATCHES[band % STRATA_SWATCHES.length],
      threshold,
      depth: (band + 1) / bandCount,
      d: `M ${top[0]} L ${top.slice(1).join(" L ")} L ${bottom.reverse().join(" L ")} Z`,
      shadow: { dx: 0, dy: 4 + band * 1.5, blur: 0 },
      anchors,
    });
  }
  return layers;
}

/** pointerX/pointerY are offsets around the sheet, usually -1..1. Reduced motion is a still stack. */
export function computeStrataParallax(pointerX: number, pointerY: number, reducedMotion: boolean) {
  const layers: { dx: number; dy: number }[] = [];
  for (let i = 0; i < 6; i++) {
    if (reducedMotion || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      layers.push({ dx: 0, dy: 0 });
      continue;
    }
    const depth = (i + 1) / 6;
    layers.push({
      dx: clamp(depth * pointerX * 14, -14, 14),
      dy: clamp(depth * pointerY * 8, -8, 8),
    });
  }
  return layers;
}

export function findNearestStrataWeek(weeks: readonly StrataWeek[], normalizedX: number): StrataWeek {
  if (weeks.length === 0) throw new Error("strata: no weeks");
  const x = Number.isFinite(normalizedX) ? clamp(normalizedX, 0, 1) : 0;
  const index = weeks.length === 1 ? 0 : Math.round(x * (weeks.length - 1));
  return weeks[clamp(index, 0, weeks.length - 1)];
}

export function stepStrataWeekIndex(currentIndex: number, key: string, totalWeeks: number): number {
  const last = Math.max(0, totalWeeks - 1);
  const current = clamp(currentIndex, 0, last);
  if (key === "Home") return 0;
  if (key === "End") return last;
  if (key === "ArrowLeft") return Math.max(0, current - 1);
  if (key === "ArrowRight") return Math.min(last, current + 1);
  return current;
}

export function resolveStrataYearSelection(years: readonly StrataYearArchive[], requestedYear?: number) {
  const ordered = [...years].sort((a, b) => a.year - b.year);
  const current = ordered.find((year) => year.year === requestedYear) ?? ordered[ordered.length - 1];
  if (!current) throw new Error("strata: no years");
  return {
    current,
    availableYears: ordered.map((year) => year.year),
    canScrub: ordered.length > 1,
  };
}

/** A short paper burst inside the site's note cue. playCustomCue only schedules notes. */
export function buildPaperRustleCue(yearIndex: number, totalYears: number): Cue {
  const index = clamp(yearIndex, 0, Math.max(0, totalYears - 1));
  const shift = index * 35;
  return {
    db: -24,
    notes: [
      { hz: 1280 + shift, at: 0, attack: 0.006, decay: 0.05 },
      { hz: 1510 + shift, at: 0.02, attack: 0.006, decay: 0.048 },
      { hz: 1090 + shift, at: 0.04, attack: 0.006, decay: 0.044 },
    ],
  };
}

export function shouldTriggerRustle(lastRustleAtMs: number, nowMs: number, cooldownMs = 90): boolean {
  return nowMs - lastRustleAtMs >= cooldownMs;
}

export function serializeStrata(data: StrataData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function parseStrataData(value: unknown): StrataData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as StrataData;
  if (typeof data.generatedAt !== "string" || !Array.isArray(data.years) || data.years.length === 0) return null;
  for (const year of data.years) {
    if (!year || year.weeks?.length !== WEEKS_PER_YEAR) return null;
    if (year.source !== "git" && year.source !== "archive") return null;
  }
  return data;
}
