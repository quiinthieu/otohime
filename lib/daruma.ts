// Pure Daruma project board logic:
// - Eye-state classification ("none" | "left" | "both") from started/shipped lifecycle dates
// - 90-day inactivity abandonment default for unshipped projects (plus explicit abandoned flag)
// - Shelf grouping ("shipped" | "active" | "unfinished")
// - Injectable clock and ?kuyo=1 / toggle override for the December Daruma Kuyo ink-fire ceremony

import type { Swatch } from "../components/figures.tsx";

export const ABANDONED_DAYS_THRESHOLD = 90;
export const DAY_MS = 86_400_000;
export const DEFAULT_CLOCK_ISO = "2026-10-27T00:00:00Z";
export const DEFAULT_NOW_MS = Date.UTC(2026, 9, 27);
export const EYE_STROKE_LENGTH = 100;

export type DarumaEyeState = "none" | "left" | "both";
export type DarumaShelfKind = "active" | "shipped" | "unfinished";
export type DarumaViewMode = "cartridges" | "daruma";

export type ClockInput =
  | number
  | string
  | Date
  | (() => number | string | Date)
  | null
  | undefined;

export type DarumaProjectInput = {
  title: string;
  note: string;
  href?: string;
  status: "building" | "live" | "shelved";
  colour?: Swatch;
  started?: string;
  shipped?: string;
  lastActivityAt?: string;
  abandoned?: boolean;
};

export type ClassifiedDaruma<P extends DarumaProjectInput = DarumaProjectInput> = {
  project: P;
  eyeState: DarumaEyeState;
  leftEyePainted: boolean;
  rightEyePainted: boolean;
  leftEyeDashoffset: number;
  rightEyeDashoffset: number;
  shelf: DarumaShelfKind;
  unfinished: boolean;
  abandoned: boolean;
  daysInactive: number | null;
  retiringInKuyo: boolean;
  startedDate: string | null;
  shippedDate: string | null;
  lastActivityDate: string | null;
};

export type DarumaShelves<P extends DarumaProjectInput = DarumaProjectInput> = {
  all: ClassifiedDaruma<P>[];
  shipped: ClassifiedDaruma<P>[];
  active: ClassifiedDaruma<P>[];
  unfinished: ClassifiedDaruma<P>[];
  abandoned: ClassifiedDaruma<P>[];
  kuyoActive: boolean;
  kuyoRetiring: ClassifiedDaruma<P>[];
  nowMs: number;
};

export type GroupDarumaOptions = {
  now?: ClockInput;
  clock?: ClockInput;
  kuyo?: boolean | string | null;
  kuyoOverride?: boolean | string | null;
};

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseUtcMs(raw: unknown): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const dayMatch = DAY_RE.exec(trimmed);
  if (dayMatch) {
    const year = Number(dayMatch[1]);
    const month = Number(dayMatch[2]);
    const day = Number(dayMatch[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.toISOString().slice(0, 10) !== trimmed) return null;
    return d.getTime();
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeUtcDay(raw: unknown): string | null {
  const ms = parseUtcMs(raw);
  if (ms === null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export function resolveNowMs(clock?: ClockInput, fallbackMs = DEFAULT_NOW_MS): number {
  const value = typeof clock === "function" ? clock() : clock;
  const ms = parseUtcMs(value);
  return ms !== null ? ms : fallbackMs;
}

export function daysSince(dateStr: string | undefined | null, now?: ClockInput): number | null {
  const targetMs = parseUtcMs(dateStr);
  if (targetMs === null) return null;
  const nowMs = resolveNowMs(now);
  if (nowMs <= targetMs) return 0;
  return Math.floor((nowMs - targetMs) / DAY_MS);
}

export function computeEyeState(
  project: Pick<DarumaProjectInput, "started" | "shipped">,
): DarumaEyeState {
  const shipped = normalizeUtcDay(project.shipped);
  if (shipped !== null) return "both";
  const started = normalizeUtcDay(project.started);
  if (started !== null) return "left";
  return "none";
}

export function isProjectAbandoned(project: DarumaProjectInput, now?: ClockInput): boolean {
  if (project.abandoned === true) return true;
  if (project.abandoned === false) return false;
  const shipped = normalizeUtcDay(project.shipped);
  if (shipped !== null || project.status === "live") return false;
  const refDate = project.lastActivityAt ?? project.started;
  const inactiveDays = daysSince(refDate, now);
  return inactiveDays !== null && inactiveDays >= ABANDONED_DAYS_THRESHOLD;
}

export function parseKuyoParam(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (Array.isArray(raw)) return raw.length > 0 ? parseKuyoParam(raw[0]) : false;
  if (raw instanceof URLSearchParams) return parseKuyoParam(raw.get("kuyo"));
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.includes("=") || trimmed.startsWith("?")) {
    const params = new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
    return parseKuyoParam(params.get("kuyo"));
  }
  const lower = trimmed.toLowerCase();
  return lower === "1" || lower === "true" || lower === "yes" || lower === "on" || lower === "kuyo";
}

export function parseDarumaViewParam(raw: unknown): DarumaViewMode {
  if (raw instanceof URLSearchParams) {
    if (parseKuyoParam(raw.get("kuyo"))) return "daruma";
    return parseDarumaViewParam(raw.get("view"));
  }
  if (Array.isArray(raw)) return raw.length > 0 ? parseDarumaViewParam(raw[0]) : "cartridges";
  if (typeof raw !== "string") return "cartridges";
  const trimmed = raw.trim();
  if (!trimmed) return "cartridges";
  if (trimmed.includes("=") || trimmed.startsWith("?")) {
    const params = new URLSearchParams(trimmed.startsWith("?") ? trimmed.slice(1) : trimmed);
    return parseDarumaViewParam(params);
  }
  const lower = trimmed.toLowerCase();
  return lower === "daruma" || lower === "shelf" ? "daruma" : "cartridges";
}

export function parseClockParam(raw: unknown): number | null {
  if (raw instanceof URLSearchParams) {
    return parseUtcMs(raw.get("now") ?? raw.get("clock"));
  }
  if (Array.isArray(raw)) return raw.length > 0 ? parseClockParam(raw[0]) : null;
  if (typeof raw === "string" && (raw.includes("=") || raw.startsWith("?"))) {
    const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
    return parseClockParam(params);
  }
  return parseUtcMs(raw);
}

export function isKuyoSeason(now?: ClockInput, kuyoOverride?: boolean | string | null): boolean {
  if (parseKuyoParam(kuyoOverride)) return true;
  const nowMs = resolveNowMs(now);
  return new Date(nowMs).getUTCMonth() === 11;
}

export function classifyDaruma<P extends DarumaProjectInput>(
  project: P,
  now?: ClockInput,
  kuyoOverride?: boolean | string | null,
): ClassifiedDaruma<P> {
  const nowMs = resolveNowMs(now);
  const startedDate = normalizeUtcDay(project.started);
  const shippedDate = normalizeUtcDay(project.shipped);
  const lastActivityDate = normalizeUtcDay(project.lastActivityAt);
  const eyeState = computeEyeState(project);
  const leftEyePainted = eyeState === "left" || eyeState === "both";
  const rightEyePainted = eyeState === "both";
  const leftEyeDashoffset = leftEyePainted ? 0 : EYE_STROKE_LENGTH;
  const rightEyeDashoffset = rightEyePainted ? 0 : EYE_STROKE_LENGTH;

  const refDate = project.lastActivityAt ?? project.shipped ?? project.started;
  const daysInactive = daysSince(refDate, nowMs);
  const abandoned = isProjectAbandoned(project, nowMs);
  const kuyoActive = isKuyoSeason(nowMs, kuyoOverride);

  let shelf: DarumaShelfKind;
  if (shippedDate !== null && !abandoned) {
    shelf = "shipped";
  } else if (!abandoned && project.status === "building" && startedDate !== null) {
    shelf = "active";
  } else {
    shelf = "unfinished";
  }

  const unfinished = shelf !== "shipped";
  const retiringInKuyo = kuyoActive && abandoned;

  return {
    project,
    eyeState,
    leftEyePainted,
    rightEyePainted,
    leftEyeDashoffset,
    rightEyeDashoffset,
    shelf,
    unfinished,
    abandoned,
    daysInactive,
    retiringInKuyo,
    startedDate,
    shippedDate,
    lastActivityDate,
  };
}

export function groupDarumaShelves<P extends DarumaProjectInput>(
  projects: readonly P[],
  optionsOrNow?: GroupDarumaOptions | ClockInput,
  kuyoOverride?: boolean | string | null,
): DarumaShelves<P> {
  const isOptionsObj =
    typeof optionsOrNow === "object" &&
    optionsOrNow !== null &&
    !(optionsOrNow instanceof Date);

  const nowInput = isOptionsObj
    ? (optionsOrNow.now ?? optionsOrNow.clock)
    : (optionsOrNow as ClockInput);
  const kuyoInput = isOptionsObj
    ? (optionsOrNow.kuyo ?? optionsOrNow.kuyoOverride ?? kuyoOverride)
    : kuyoOverride;

  const nowMs = resolveNowMs(nowInput);
  const kuyoActive = isKuyoSeason(nowMs, kuyoInput);
  const all = projects.map((p) => classifyDaruma(p, nowMs, kuyoActive));

  const shipped = all.filter((d) => d.shelf === "shipped");
  const active = all.filter((d) => d.shelf === "active");
  const unfinished = all.filter((d) => d.unfinished);
  const abandoned = all.filter((d) => d.abandoned);
  const kuyoRetiring = all.filter((d) => d.retiringInKuyo);

  return {
    all,
    shipped,
    active,
    unfinished,
    abandoned,
    kuyoActive,
    kuyoRetiring,
    nowMs,
  };
}

export function formatKuyoAnnouncement(
  shelves: Pick<DarumaShelves, "kuyoActive" | "kuyoRetiring" | "abandoned">,
): string {
  if (!shelves.kuyoActive) {
    const waiting = shelves.abandoned.length;
    return waiting === 0
      ? "Daruma Kuyo fire is at rest. No abandoned dolls on the shelf."
      : `Daruma Kuyo fire is at rest. ${waiting} abandoned Daruma ${waiting === 1 ? "doll waits" : "dolls wait"} on the unfinished shelf.`;
  }
  const retiring = shelves.kuyoRetiring.length;
  if (retiring === 0) {
    return "Daruma Kuyo ink-fire ceremony lit: no abandoned Daruma dolls to retire.";
  }
  const names = shelves.kuyoRetiring.map((d) => d.project.title).join(", ");
  return `Daruma Kuyo ink-fire ceremony lit: retiring ${retiring} abandoned Daruma ${retiring === 1 ? "doll" : "dolls"} (${names}) in sumi ink flames.`;
}
