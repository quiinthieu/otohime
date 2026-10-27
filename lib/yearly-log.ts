// Shared yearly shipped digest (content/yearly-log.json).
// Aggregates full git commit history across all 12 calendar months (01..12) alongside
// content/site.ts projects/notes and content/ledger.json activity counts.
// Pure functions and schema validation only: no filesystem, no child_process, no clock.

import { EMPTY_LEDGER, parseLedger, type Ledger } from "./ledger-data.ts";

export const MONTH_KEYS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;
export type MonthKey = (typeof MONTH_KEYS)[number];

export const MONTHLY_FLOWERS: Record<MonthKey, string> = {
  "01": "Pine",
  "02": "Plum",
  "03": "Cherry",
  "04": "Wisteria",
  "05": "Iris",
  "06": "Peony",
  "07": "Bush Clover",
  "08": "Susuki Grass",
  "09": "Chrysanthemum",
  "10": "Maple",
  "11": "Willow",
  "12": "Paulownia",
};

export const DEFAULT_YEAR = 2026;
export const SHA_LENGTH = 10;
export const SUBJECT_MAX = 100;
export const MAX_HIGHLIGHTS_PER_MONTH = 5;
export const MAX_HIGHLIGHTS = MAX_HIGHLIGHTS_PER_MONTH;
export const MAX_PROJECTS_PER_MONTH = 20;
export const MAX_NOTES_PER_MONTH = 20;
export const MAX_COMMITS_PER_MONTH = 100_000;

export type ShippedProjectEntry = {
  title: string;
  href?: string;
  shipped: string; // YYYY-MM-DD in UTC
};

export type MonthlyNoteEntry = {
  title: string;
  date: string; // YYYY-MM-DD in UTC
};

export type MonthlyHighlight = {
  sha: string; // first SHA_LENGTH hex digits
  date: string; // committer date, ISO 8601 in UTC to the second
  plan: string | null; // e.g. "pm-293" or null
  subject: string; // cleaned subject without prefix, capped at SUBJECT_MAX
};

export type MonthlyLog = {
  month: number; // 1..12
  flower: string; // traditional Hanafuda suit flower
  commits: number;
  shippedProjects: ShippedProjectEntry[];
  notes: MonthlyNoteEntry[];
  highlights: MonthlyHighlight[];
};

export type YearlyLog = {
  version: 1;
  head: string | null; // full 40-char SHA of newest indexed non-merge commit, or null when empty
  generatedYear: number;
  months: Record<MonthKey, MonthlyLog>;
};

export type CommitInput = {
  sha: string;
  date: string;
  plan?: string | null;
  task?: string | null;
  subject: string;
};

export type ProjectInput = {
  title: string;
  note?: string;
  href?: string;
  status?: string;
  started?: string;
  shipped?: string;
  lastActivityAt?: string;
  abandoned?: boolean;
};

export type NoteInput = {
  title: string;
  date: string;
  body?: string;
};

export type BuildYearlyLogInput = {
  head?: string | null;
  year?: number;
  commits?: readonly CommitInput[];
  projects?: readonly ProjectInput[];
  notes?: readonly NoteInput[];
  ledger?: unknown;
};

const PREFIX = /^(pm-\d+)\/([A-Za-z0-9_-]+):\s*/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FULL_SHA_RE = /^[0-9a-f]{40}$/;
const SHORT_SHA_RE = new RegExp(`^[0-9a-f]{${SHA_LENGTH}}$`);
const HEX_SHA_RE = new RegExp(`^[0-9a-f]{${SHA_LENGTH},40}$`);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isCount = (v: unknown, max = MAX_COMMITS_PER_MONTH): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max;
const hasKeys = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => k in v);

export function isMonthKey(v: unknown): v is MonthKey {
  return typeof v === "string" && (MONTH_KEYS as readonly string[]).includes(v);
}

export function isoSecond(date: string): string | null {
  if (typeof date !== "string" || DAY_RE.test(date.trim())) return null;
  const ms = Date.parse(date);
  return Number.isFinite(ms) ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z") : null;
}

export function utcDayOf(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  const m = DAY_RE.exec(trimmed);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.toISOString().slice(0, 10) === trimmed ? trimmed : null;
  }
  const iso = isoSecond(trimmed);
  return iso ? iso.slice(0, 10) : null;
}

export function monthKeyOf(monthOrDate: number | string): MonthKey | null {
  if (typeof monthOrDate === "number") {
    if (!Number.isInteger(monthOrDate) || monthOrDate < 1 || monthOrDate > 12) return null;
    return String(monthOrDate).padStart(2, "0") as MonthKey;
  }
  if (typeof monthOrDate === "string") {
    const trimmed = monthOrDate.trim();
    if (isMonthKey(trimmed)) return trimmed;
    if (/^\d{1,2}$/.test(trimmed)) {
      const n = Number(trimmed);
      if (n >= 1 && n <= 12) return String(n).padStart(2, "0") as MonthKey;
    }
    const day = utcDayOf(trimmed);
    if (day) return day.slice(5, 7) as MonthKey;
  }
  return null;
}

export function flowerForMonth(monthOrDate: number | string): string | null {
  const key = monthKeyOf(monthOrDate);
  return key ? MONTHLY_FLOWERS[key] : null;
}

export function splitPrefix(raw: string): { plan: string | null; task: string | null; subject: string } {
  const m = PREFIX.exec(raw);
  return m ? { plan: m[1], task: m[2], subject: raw.slice(m[0].length) } : { plan: null, task: null, subject: raw };
}

export function cleanSubject(raw: string, max = SUBJECT_MAX): string {
  const s = raw.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim();
  const chars = [...s];
  return chars.length <= max ? s : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

export function emptyMonths(): Record<MonthKey, MonthlyLog> {
  const out = {} as Record<MonthKey, MonthlyLog>;
  for (const key of MONTH_KEYS) {
    out[key] = {
      month: Number(key),
      flower: MONTHLY_FLOWERS[key],
      commits: 0,
      shippedProjects: [],
      notes: [],
      highlights: [],
    };
  }
  return out;
}

export function emptyYearlyLog(year = DEFAULT_YEAR): YearlyLog {
  const validYear = Number.isSafeInteger(year) && year >= 1970 && year <= 2100 ? year : DEFAULT_YEAR;
  return {
    version: 1,
    head: null,
    generatedYear: validYear,
    months: emptyMonths(),
  };
}

export const EMPTY_YEARLY_LOG: YearlyLog = emptyYearlyLog(DEFAULT_YEAR);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferProjectShippedDay(
  project: ProjectInput,
  commits: readonly { date: string; task: string | null; subject: string }[],
): string | null {
  const title = cleanSubject(project.title);
  if (!title) return null;
  const re = new RegExp(`\\b${escapeRegex(title)}\\b`, "i");
  let fallbackMatch: string | null = null;
  // Scan oldest-first so a project's initial implementation commit sets its shipped date.
  for (let i = commits.length - 1; i >= 0; i--) {
    const c = commits[i];
    if (!re.test(c.subject)) continue;
    const day = c.date.slice(0, 10);
    if (c.task !== "plan") return day;
    if (!fallbackMatch) fallbackMatch = day;
  }
  return fallbackMatch;
}

function normalizeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  const s = href.trim();
  if (!s || /[\x00-\x20\x7f]/.test(s)) return undefined;
  return s;
}

// Aggregates git commits, site.ts projects/notes, and ledger.json into a 12-month YearlyLog.
export function buildYearlyLog(input: BuildYearlyLogInput = {}): YearlyLog {
  const months = emptyMonths();
  const gitCommitsByMonth = new Map<MonthKey, Map<string, number>>();
  const ledgerCommitsByMonth = new Map<MonthKey, Map<string, number>>();
  for (const key of MONTH_KEYS) {
    gitCommitsByMonth.set(key, new Map());
    ledgerCommitsByMonth.set(key, new Map());
  }

  const normalizedCommits: {
    sha: string;
    shortSha: string;
    date: string;
    plan: string | null;
    task: string | null;
    subject: string;
    monthKey: MonthKey;
    day: string;
  }[] = [];

  for (const raw of input.commits ?? []) {
    if (!isRecord(raw) || typeof raw.sha !== "string" || typeof raw.date !== "string" || typeof raw.subject !== "string") {
      continue;
    }
    const sha = raw.sha.trim().toLowerCase();
    if (!HEX_SHA_RE.test(sha)) continue;
    const date = isoSecond(raw.date);
    if (!date) continue;
    const split = splitPrefix(cleanSubject(raw.subject));
    const plan =
      raw.plan !== undefined
        ? typeof raw.plan === "string" && /^pm-\d+$/.test(raw.plan)
          ? raw.plan
          : null
        : split.plan;
    const task =
      raw.task !== undefined
        ? typeof raw.task === "string" && /^[A-Za-z0-9_-]+$/.test(raw.task)
          ? raw.task
          : null
        : split.task;
    const subject = raw.plan !== undefined ? cleanSubject(raw.subject) : cleanSubject(split.subject);
    if (!subject) continue;
    const day = date.slice(0, 10);
    const monthKey = day.slice(5, 7) as MonthKey;
    if (!isMonthKey(monthKey)) continue;
    normalizedCommits.push({
      sha,
      shortSha: sha.slice(0, SHA_LENGTH),
      date,
      plan,
      task,
      subject,
      monthKey,
      day,
    });
  }

  for (const c of normalizedCommits) {
    const byDay = gitCommitsByMonth.get(c.monthKey)!;
    byDay.set(c.day, (byDay.get(c.day) ?? 0) + 1);
    const bucket = months[c.monthKey];
    if (bucket.highlights.length < MAX_HIGHLIGHTS_PER_MONTH) {
      bucket.highlights.push({
        sha: c.shortSha,
        date: c.date,
        plan: c.plan,
        subject: c.subject,
      });
    }
  }

  const ledger: Ledger =
    isRecord(input.ledger) && isRecord(input.ledger.days) ? parseLedger(input.ledger) : EMPTY_LEDGER;
  for (const [day, entry] of Object.entries(ledger.days)) {
    const monthKey = day.slice(5, 7) as MonthKey;
    if (!isMonthKey(monthKey) || entry.commits <= 0) continue;
    const byDay = ledgerCommitsByMonth.get(monthKey)!;
    byDay.set(day, (byDay.get(day) ?? 0) + entry.commits);
  }

  for (const key of MONTH_KEYS) {
    const gitByDay = gitCommitsByMonth.get(key)!;
    const ledgerByDay = ledgerCommitsByMonth.get(key)!;
    const allDays = new Set<string>([...gitByDay.keys(), ...ledgerByDay.keys()]);
    let totalCommits = 0;
    for (const day of allDays) {
      totalCommits += Math.max(gitByDay.get(day) ?? 0, ledgerByDay.get(day) ?? 0);
    }
    months[key].commits = Math.min(MAX_COMMITS_PER_MONTH, Math.max(totalCommits, months[key].highlights.length));
  }

  // Notes per month (deduplicated, sorted newest first)
  const seenNotes = new Set<string>();
  for (const raw of input.notes ?? []) {
    if (!isRecord(raw) || typeof raw.title !== "string" || typeof raw.date !== "string") continue;
    const title = cleanSubject(raw.title);
    const date = utcDayOf(raw.date);
    if (!title || !date) continue;
    const monthKey = date.slice(5, 7) as MonthKey;
    if (!isMonthKey(monthKey)) continue;
    const dedupKey = `${monthKey}\0${date}\0${title}`;
    if (seenNotes.has(dedupKey)) continue;
    seenNotes.add(dedupKey);
    months[monthKey].notes.push({ title, date });
  }
  for (const key of MONTH_KEYS) {
    months[key].notes.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.title.localeCompare(b.title)));
    if (months[key].notes.length > MAX_NOTES_PER_MONTH) {
      months[key].notes = months[key].notes.slice(0, MAX_NOTES_PER_MONTH);
    }
  }

  // Shipped projects per month
  const seenProjects = new Set<string>();
  for (const raw of input.projects ?? []) {
    if (!isRecord(raw) || typeof raw.title !== "string") continue;
    if (raw.abandoned === true) continue;
    const title = cleanSubject(raw.title);
    if (!title) continue;
    const explicitShipped = raw.shipped !== undefined ? utcDayOf(raw.shipped) : null;
    if (raw.shipped !== undefined && !explicitShipped) continue;
    if (!explicitShipped && raw.status !== "live") continue;
    if (!explicitShipped && raw.started !== undefined) continue;
    const shipped = explicitShipped ?? inferProjectShippedDay(raw, normalizedCommits);
    if (!shipped) continue;
    const monthKey = shipped.slice(5, 7) as MonthKey;
    if (!isMonthKey(monthKey)) continue;
    const dedupKey = `${monthKey}\0${title}`;
    if (seenProjects.has(dedupKey)) continue;
    seenProjects.add(dedupKey);
    const href = normalizeHref(raw.href);
    const entry: ShippedProjectEntry = href ? { title, href, shipped } : { title, shipped };
    if (months[monthKey].shippedProjects.length < MAX_PROJECTS_PER_MONTH) {
      months[monthKey].shippedProjects.push(entry);
    }
  }

  let head: string | null = null;
  if (input.head !== undefined) {
    head = typeof input.head === "string" && FULL_SHA_RE.test(input.head) ? input.head : null;
  } else if (normalizedCommits.length > 0 && FULL_SHA_RE.test(normalizedCommits[0].sha)) {
    head = normalizedCommits[0].sha;
  }

  let generatedYear = DEFAULT_YEAR;
  if (typeof input.year === "number" && Number.isSafeInteger(input.year) && input.year >= 1970 && input.year <= 2100) {
    generatedYear = input.year;
  } else if (normalizedCommits.length > 0) {
    generatedYear = Number(normalizedCommits[0].date.slice(0, 4));
  } else if (ledger.generated) {
    const y = Number(ledger.generated.slice(0, 4));
    if (Number.isSafeInteger(y) && y >= 1970 && y <= 2100) generatedYear = y;
  }

  return {
    version: 1,
    head,
    generatedYear,
    months,
  };
}

// --- validation and canonical serialization --------------------------------------------------------------------

const LOG_KEYS = ["version", "head", "generatedYear", "months"] as const;
const MONTH_LOG_KEYS = ["month", "flower", "commits", "shippedProjects", "notes", "highlights"] as const;
const NOTE_KEYS = ["title", "date"] as const;
const HIGHLIGHT_KEYS = ["sha", "date", "plan", "subject"] as const;

function validShippedProject(v: unknown, monthKey: MonthKey): v is ShippedProjectEntry {
  if (!isRecord(v)) return false;
  const keys = Object.keys(v);
  if (keys.length === 2) {
    if (!hasKeys(v, ["title", "shipped"])) return false;
  } else if (keys.length === 3) {
    if (!hasKeys(v, ["title", "href", "shipped"])) return false;
    if (typeof v.href !== "string" || normalizeHref(v.href) !== v.href) return false;
  } else {
    return false;
  }
  if (typeof v.title !== "string" || !v.title || cleanSubject(v.title) !== v.title) return false;
  if (typeof v.shipped !== "string" || utcDayOf(v.shipped) !== v.shipped || v.shipped.slice(5, 7) !== monthKey) {
    return false;
  }
  return true;
}

function validMonthlyNote(v: unknown, monthKey: MonthKey): v is MonthlyNoteEntry {
  if (!isRecord(v) || !hasKeys(v, NOTE_KEYS)) return false;
  if (typeof v.title !== "string" || !v.title || cleanSubject(v.title) !== v.title) return false;
  if (typeof v.date !== "string" || utcDayOf(v.date) !== v.date || v.date.slice(5, 7) !== monthKey) return false;
  return true;
}

function validHighlight(v: unknown, monthKey: MonthKey): v is MonthlyHighlight {
  if (!isRecord(v) || !hasKeys(v, HIGHLIGHT_KEYS)) return false;
  if (typeof v.sha !== "string" || !SHORT_SHA_RE.test(v.sha)) return false;
  if (typeof v.date !== "string" || isoSecond(v.date) !== v.date || v.date.slice(5, 7) !== monthKey) return false;
  if (v.plan !== null && (typeof v.plan !== "string" || !/^pm-\d+$/.test(v.plan))) return false;
  if (typeof v.subject !== "string" || !v.subject || cleanSubject(v.subject) !== v.subject) return false;
  return true;
}

function validMonthlyLog(v: unknown, key: MonthKey): v is MonthlyLog {
  if (!isRecord(v) || !hasKeys(v, MONTH_LOG_KEYS)) return false;
  if (v.month !== Number(key)) return false;
  if (v.flower !== MONTHLY_FLOWERS[key]) return false;
  if (!isCount(v.commits, MAX_COMMITS_PER_MONTH)) return false;
  if (
    !Array.isArray(v.shippedProjects) ||
    v.shippedProjects.length > MAX_PROJECTS_PER_MONTH ||
    !v.shippedProjects.every((p) => validShippedProject(p, key))
  ) {
    return false;
  }
  if (
    !Array.isArray(v.notes) ||
    v.notes.length > MAX_NOTES_PER_MONTH ||
    !v.notes.every((n) => validMonthlyNote(n, key))
  ) {
    return false;
  }
  if (
    !Array.isArray(v.highlights) ||
    v.highlights.length > MAX_HIGHLIGHTS_PER_MONTH ||
    !v.highlights.every((h) => validHighlight(h, key))
  ) {
    return false;
  }
  if (v.commits < v.highlights.length) return false;
  return true;
}

export function validateYearlyLog(v: unknown): YearlyLog | null {
  if (!isRecord(v) || !hasKeys(v, LOG_KEYS) || v.version !== 1) return null;
  if (
    typeof v.generatedYear !== "number" ||
    !Number.isSafeInteger(v.generatedYear) ||
    v.generatedYear < 1970 ||
    v.generatedYear > 2100
  ) {
    return null;
  }
  if (!isRecord(v.months) || !hasKeys(v.months, MONTH_KEYS)) return null;
  let totalHighlights = 0;
  let matchesHead = false;
  const headPrefix = typeof v.head === "string" && FULL_SHA_RE.test(v.head) ? v.head.slice(0, SHA_LENGTH) : null;
  if (v.head !== null && headPrefix === null) return null;

  for (const key of MONTH_KEYS) {
    const m = v.months[key];
    if (!validMonthlyLog(m, key)) return null;
    totalHighlights += m.highlights.length;
    if (headPrefix && m.highlights[0]?.sha === headPrefix) {
      matchesHead = true;
    }
  }

  if (v.head === null) {
    if (totalHighlights > 0) return null;
  } else if (!matchesHead) {
    return null;
  }

  return v as YearlyLog;
}

export function parseYearlyLog(text: string): YearlyLog | null {
  try {
    return validateYearlyLog(JSON.parse(text));
  } catch {
    return null;
  }
}

export function readYearlyLog(v: unknown): YearlyLog {
  return validateYearlyLog(v) ?? EMPTY_YEARLY_LOG;
}

export function monthLog(log: YearlyLog, monthOrDate: number | string): MonthlyLog | null {
  const key = monthKeyOf(monthOrDate);
  return key ? log.months[key] : null;
}

function serializeProject(p: ShippedProjectEntry): string {
  return JSON.stringify(
    p.href !== undefined ? { title: p.title, href: p.href, shipped: p.shipped } : { title: p.title, shipped: p.shipped },
  );
}

function serializeNote(n: MonthlyNoteEntry): string {
  return JSON.stringify({ title: n.title, date: n.date });
}

function serializeHighlight(h: MonthlyHighlight): string {
  return JSON.stringify({ sha: h.sha, date: h.date, plan: h.plan, subject: h.subject });
}

function serializeList<T>(items: readonly T[], fmt: (item: T) => string): string {
  if (items.length === 0) return "[]";
  return `[\n${items.map((item) => `        ${fmt(item)}`).join(",\n")}\n      ]`;
}

export function serializeYearlyLog(log: YearlyLog): string {
  const monthBlocks = MONTH_KEYS.map((key) => {
    const m = log.months[key];
    const projects = serializeList(m.shippedProjects, serializeProject);
    const notes = serializeList(m.notes, serializeNote);
    const highlights = serializeList(m.highlights, serializeHighlight);
    return [
      `    ${JSON.stringify(key)}: {`,
      `      "month": ${m.month},`,
      `      "flower": ${JSON.stringify(m.flower)},`,
      `      "commits": ${m.commits},`,
      `      "shippedProjects": ${projects},`,
      `      "notes": ${notes},`,
      `      "highlights": ${highlights}`,
      `    }`,
    ].join("\n");
  });

  return [
    "{",
    `  "version": 1,`,
    `  "head": ${JSON.stringify(log.head)},`,
    `  "generatedYear": ${log.generatedYear},`,
    `  "months": {`,
    monthBlocks.join(",\n"),
    `  }`,
    "}",
    "",
  ].join("\n");
}
