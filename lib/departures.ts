// Pure data for the paper departures boards. Schedules and run statuses are
// illustrative, never readings from the pipelines or project health monitors.
import { site } from "../content/site.ts";
import { MAX_DB, type Cue } from "./sound.ts";

export const FLAP_ALPHABET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·/-:";
export const MAX_FLAP_STEPS = 12;
export const DEPARTURE_CLACK_INTERVAL_MS = 60;

export type DepartureStatus = "ON TIME" | "DELAYED" | "BACKFILLING";
export type DepartureRow = {
  id: string;
  code: string;
  name: string;
  schedule: string;
  status: DepartureStatus;
  note: string;
  href?: string;
  kind: "pipeline" | "project";
};

type WorkData = {
  pipeline: Pick<typeof site.pipeline, "stations" | "note">;
  stack: readonly { what: string; tools: string; note: string }[];
};
type ProjectData = { projectList: readonly Pick<(typeof site.projectList)[number], "title" | "note" | "href" | "started" | "shipped">[] };

const STATUSES: readonly DepartureStatus[] = ["ON TIME", "DELAYED", "BACKFILLING"];
const SCHEDULES = ["CONTINUOUS", "HOURLY", "NIGHTLY"] as const;
const STATIONS = ["source", "queue", "warehouse", "dashboard"] as const;
const BOARD_ROW_LIMIT = 12;
const illustrativeNote = (note: string) => `Illustrative schedule and status. ${note}`;

export function buildWorkDepartures(siteData: WorkData = site): DepartureRow[] {
  const stations: DepartureRow[] = STATIONS.map((key, i) => ({
    id: `pipeline-${key}`,
    code: `P${String(i + 1).padStart(2, "0")}`,
    name: siteData.pipeline.stations[key],
    schedule: SCHEDULES[i % SCHEDULES.length],
    status: STATUSES[i % STATUSES.length],
    note: illustrativeNote(siteData.pipeline.note),
    kind: "pipeline",
  }));
  const stack: DepartureRow[] = siteData.stack.slice(0, BOARD_ROW_LIMIT - stations.length).map((entry, i) => ({
    id: `stack-${i + 1}`,
    code: `W${String(i + 1).padStart(2, "0")}`,
    name: `${entry.what} / ${entry.tools}`,
    schedule: SCHEDULES[i % SCHEDULES.length],
    status: STATUSES[(i + stations.length) % STATUSES.length],
    note: illustrativeNote(entry.note),
    kind: "pipeline",
  }));
  return [...stations, ...stack];
}

/** Source order is stable. Empty/small catalogs stay empty/small, without invented projects. */
export function buildProjectDepartures(siteData: ProjectData = site): DepartureRow[] {
  return siteData.projectList.slice(0, BOARD_ROW_LIMIT).map((project, i) => ({
    id: `project-${i + 1}`,
    code: `J${String(i + 1).padStart(2, "0")}`,
    name: project.title,
    schedule: project.shipped || project.started || "ON DEMAND",
    status: STATUSES[i % STATUSES.length],
    note: illustrativeNote(project.note),
    ...(project.href ? { href: project.href } : {}),
    kind: "project",
  }));
}

/** One Unicode code point per cell; unsupported glyphs (including uppercase expansions) become a space. */
export function normalizeFlapChar(ch: string): string {
  const upper = (Array.from(ch)[0] ?? " ").toUpperCase();
  return upper.length === 1 && FLAP_ALPHABET.includes(upper) ? upper : " ";
}

/** Truncate on the right and pad with spaces, without expanding unsupported glyphs into extra cells. */
export function padFlapCell(text: string, width: number): string {
  if (!Number.isSafeInteger(width) || width < 0) throw new RangeError("Flap width must be a non-negative safe integer");
  return Array.from(text).slice(0, width).map(normalizeFlapChar).join("").padEnd(width, " ");
}

/**
 * Frames after the starting character, including the target. Short rotations
 * visit every drum slot; longer ones sample the forward arc evenly to fit the
 * budget. A zero budget is reduced motion: one final frame, no intermediates.
 */
export function flipPath(fromChar: string, toChar: string, maxSteps = MAX_FLAP_STEPS): string[] {
  const from = FLAP_ALPHABET.indexOf(normalizeFlapChar(fromChar));
  const target = normalizeFlapChar(toChar);
  const to = FLAP_ALPHABET.indexOf(target);
  const distance = (to - from + FLAP_ALPHABET.length) % FLAP_ALPHABET.length;
  const budget = Number.isNaN(maxSteps) ? 0 : Math.max(0, Math.min(MAX_FLAP_STEPS, Math.floor(maxSteps)));
  if (!distance || budget <= 0) return [target];
  const count = Math.min(distance, budget);
  return Array.from({ length: count }, (_, i) =>
    FLAP_ALPHABET[(from + Math.ceil(((i + 1) * distance) / count)) % FLAP_ALPHABET.length],
  );
}

/** All cells advance together; a cell that reaches its target holds it until the row settles. */
export function buildRowFlipFrames(fromText: string, toText: string, width: number, maxSteps = MAX_FLAP_STEPS): string[] {
  const from = padFlapCell(fromText, width);
  const target = padFlapCell(toText, width);
  const paths = Array.from(target, (char, i) => flipPath(from[i], char, maxSteps));
  const count = Math.max(1, ...paths.map((path) => path.length));
  return Array.from({ length: count }, (_, step) => paths.map((path) => path[Math.min(step, path.length - 1)]).join(""));
}

/** Callers keep the timestamp after playing. -Infinity represents no previous clack. */
export function canPlayDepartureClack(lastPlayedAtMs: number, nowMs: number, soundOn: boolean, reducedMotion: boolean): boolean {
  return soundOn && !reducedMotion && Number.isFinite(nowMs)
    && (Number.isFinite(lastPlayedAtMs) || lastPlayedAtMs === -Infinity)
    && nowMs - lastPlayedAtMs >= DEPARTURE_CLACK_INTERVAL_MS;
}

/** Noise-like high ticks then a low latch, using the shared oscillator Cue format; no playback or global state. */
export function buildDepartureClackCue(stepIndex = 0): Cue {
  const step = Number.isFinite(stepIndex) ? Math.abs(Math.trunc(stepIndex)) % 3 : 0;
  return {
    db: Math.min(MAX_DB, -22 - step),
    wave: "square",
    notes: [
      { hz: 1640 + step * 90, at: 0, attack: 0.001, decay: 0.007 },
      { hz: 1930 - step * 70, at: 0.009, attack: 0.001, decay: 0.007 },
      { hz: 135 + step * 15, at: 0.019, attack: 0.002, decay: 0.026 },
    ],
  };
}
