// The deck: one pure reducer for the turntable and its one YouTube player.
// reduce(state, action) returns the next state and the effects the shell must
// run (player calls and timers); the UI reads only the derived functions at
// the bottom. YouTube's own state reports drive the phase, so the platter
// follows the player, not the buttons.
//
// Two YouTube rules shape it: only an action carrying `user: true` (a click,
// a key, a dropped tonearm) can ever produce a `play` effect, and nothing
// plays in a hidden tab. Auto-advance after a record ends and auto-skip after
// an error therefore cue the next record and wait for Play.
//
//   empty ─select─▶ loaded ─play{user}─▶ starting ─yt buffering─▶ buffering ─yt playing─▶ playing
//   starting ─play timeout (still waiting)─▶ tap ─play{user}─▶ starting
//   playing ─pause{user} / hidden / yt paused─▶ paused ─play{user}─▶ starting
//   playing ─yt ended─▶ ended ─advance timeout─▶ loaded (next record, cued)
//   any ─yt error─▶ error ─skip{user} / skip timeout─▶ loaded (next record, cued)
//   stop{user} ─▶ loaded   select / next / prev ─▶ loaded   eject ─▶ empty   unmount ─▶ destroy

import type { Rpm, VinylRecord } from "./records.ts";

export type Phase = "empty" | "loaded" | "starting" | "buffering" | "playing" | "paused" | "ended" | "tap" | "error";
export const PHASES: readonly Phase[] = ["empty", "loaded", "starting", "buffering", "playing", "paused", "ended", "tap", "error"];

export type TimerName = "play" | "skip" | "advance";
export const TIMERS: readonly TimerName[] = ["play", "skip", "advance"];
export const PLAY_TIMEOUT_MS = 1500; // no word from YouTube after Play: the browser refused it
export const ADVANCE_MS = 1500; // pause between a record ending and the next one cueing
export const SKIP_MS = 4000; // how long an error shows before the next record cues

// What YouTube reports, already mapped from YT.PlayerState numbers by player.ts.
export type YtState = "unstarted" | "ended" | "playing" | "paused" | "buffering" | "cued";

export type Action =
  | { type: "select"; index: number; user?: boolean }
  | { type: "next"; user?: boolean }
  | { type: "prev"; user?: boolean }
  | { type: "play"; user?: boolean }
  | { type: "pause"; user?: boolean }
  | { type: "stop"; user?: boolean }
  | { type: "eject"; user?: boolean }
  | { type: "skip"; user?: boolean }
  | { type: "seek"; seconds: number; user?: boolean }
  | { type: "volume"; value: number; user?: boolean }
  | { type: "rpm"; rpm: Rpm; user?: boolean }
  | { type: "ready" }
  | { type: "yt"; state: YtState }
  | { type: "ytError"; code: number }
  | { type: "time"; current: number; duration: number }
  | { type: "timeout"; name: TimerName }
  | { type: "hidden" }
  | { type: "unmount" };

export type Cue = { videoId: string; startSeconds?: number; endSeconds?: number };

export type Effect =
  | { type: "ensurePlayer" }
  | ({ type: "cue" } & Cue)
  | { type: "play" }
  | { type: "pause" }
  | ({ type: "stop" } & Cue) // stopVideo, then cue the record again
  | { type: "seek"; seconds: number }
  | { type: "volume"; value: number }
  | { type: "destroy" }
  | { type: "timer"; name: TimerName; ms: number }
  | { type: "clearTimer"; name: TimerName };

export type DeckState = {
  records: readonly VinylRecord[];
  phase: Phase;
  index: number | null; // the record on the platter
  player: "none" | "loading" | "ready";
  rpm: Rpm | null; // the 33/45 switch; null follows the record
  volume: number; // 0..100
  time: number; // seconds
  duration: number; // seconds, 0 until YouTube knows
  error: { code: number; message: string } | null;
};

export function initialDeck(records: readonly VinylRecord[]): DeckState {
  return { records, phase: "empty", index: null, player: "none", rpm: null, volume: 80, time: 0, duration: 0, error: null };
}

const ERRORS: Record<number, string> = {
  2: "That video id looks wrong",
  5: "The player hit an error",
  100: "That video is gone or private",
  101: "The owner doesn't allow playing it here",
  150: "The owner doesn't allow playing it here",
  153: "The browser didn't send a referrer",
};
export const GENERIC_ERROR = "This video can't be played here";
export const errorMessage = (code: number) => ERRORS[code] ?? GENERIC_ERROR;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function cueOf(record: VinylRecord): Cue {
  const cue: Cue = { videoId: record.youtubeVideoId };
  if (record.startSeconds !== undefined) cue.startSeconds = record.startSeconds;
  if (record.endSeconds !== undefined) cue.endSeconds = record.endSeconds;
  return cue;
}

const clearAll = (): Effect[] => TIMERS.map((name) => ({ type: "clearTimer", name }));
const WAITING: readonly Phase[] = ["starting", "buffering", "playing"]; // YouTube is (about to be) making sound

type Step = { state: DeckState; effects: Effect[] };
const same = (state: DeckState): Step => ({ state, effects: [] });

// Put record i on the platter and cue it. Never plays.
function load(state: DeckState, i: number): Step {
  const record = state.records[i];
  const effects: Effect[] = [...clearAll()];
  let player = state.player;
  if (player === "none") {
    effects.push({ type: "ensurePlayer" });
    player = "loading";
  }
  effects.push({ type: "cue", ...cueOf(record) });
  return {
    state: { ...state, phase: "loaded", index: i, player, rpm: null, time: record.startSeconds ?? 0, duration: 0, error: null },
    effects,
  };
}

function step(state: DeckState, by: number): Step {
  if (state.index === null || state.records.length === 0) return same(state);
  const n = state.records.length;
  return load(state, (((state.index + by) % n) + n) % n);
}

function onYt(state: DeckState, yt: YtState): Step {
  const { phase } = state;
  if (phase === "empty") return same(state);
  switch (yt) {
    case "playing":
      // Also when the visitor pressed play inside YouTube's own player.
      return { state: { ...state, phase: "playing", error: null }, effects: [{ type: "clearTimer", name: "play" }] };
    case "buffering":
      if (phase === "error") return same(state);
      return { state: { ...state, phase: "buffering" }, effects: [{ type: "clearTimer", name: "play" }] };
    case "paused":
      if (phase === "playing" || phase === "buffering" || phase === "starting") {
        return { state: { ...state, phase: "paused" }, effects: [{ type: "clearTimer", name: "play" }] };
      }
      return same(state);
    case "ended":
      if (phase === "playing" || phase === "buffering" || phase === "paused") {
        return {
          state: { ...state, phase: "ended", time: state.duration || state.time },
          effects: [{ type: "timer", name: "advance", ms: ADVANCE_MS }],
        };
      }
      return same(state);
    default:
      // unstarted and cued arrive while loading and after stop; the phase already says so.
      return same(state);
  }
}

export function reduce(state: DeckState, action: Action): Step {
  const { phase } = state;
  const record = state.index === null ? null : state.records[state.index];

  switch (action.type) {
    case "select":
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.records.length) return same(state);
      return load(state, action.index);
    case "next":
      return step(state, 1);
    case "prev":
      return step(state, -1);

    case "play":
      // The one way to a play effect: a gesture, a record, a ready player.
      if (action.user !== true || !record || state.player !== "ready") return same(state);
      if (phase === "loaded" || phase === "paused" || phase === "tap" || phase === "ended") {
        return {
          state: { ...state, phase: "starting", error: null },
          effects: [
            { type: "clearTimer", name: "advance" },
            { type: "play" },
            { type: "timer", name: "play", ms: PLAY_TIMEOUT_MS },
          ],
        };
      }
      return same(state);

    case "pause":
      if (!WAITING.includes(phase)) return same(state);
      return { state: { ...state, phase: "paused" }, effects: [{ type: "clearTimer", name: "play" }, { type: "pause" }] };

    case "hidden":
      // No background play: a hidden tab pauses whatever is (about to be) sounding.
      if (!WAITING.includes(phase)) return same(state);
      return { state: { ...state, phase: "paused" }, effects: [{ type: "clearTimer", name: "play" }, { type: "pause" }] };

    case "stop":
      if (!record || phase === "empty" || phase === "loaded" || phase === "error") return same(state);
      return {
        state: { ...state, phase: "loaded", time: record.startSeconds ?? 0 },
        effects: [...clearAll(), { type: "stop", ...cueOf(record) }],
      };

    case "eject":
      if (phase === "empty") return same(state);
      return {
        state: { ...state, phase: "empty", index: null, rpm: null, time: 0, duration: 0, error: null },
        effects: [...clearAll(), { type: "pause" }],
      };

    case "skip":
      if (phase !== "error") return same(state);
      return step(state, 1);

    case "seek": {
      if (!record || phase === "empty" || phase === "error") return same(state);
      const max = state.duration > 0 ? state.duration : Infinity;
      const seconds = clamp(Number.isFinite(action.seconds) ? action.seconds : 0, 0, max);
      return { state: { ...state, time: seconds }, effects: [{ type: "seek", seconds }] };
    }

    case "volume": {
      const value = Math.round(clamp(Number.isFinite(action.value) ? action.value : 0, 0, 100));
      return { state: { ...state, volume: value }, effects: [{ type: "volume", value }] };
    }

    case "rpm":
      if (!record) return same(state);
      return same({ ...state, rpm: action.rpm === record.rpm ? null : action.rpm });

    case "ready": {
      // The player exists now: give it the volume and the record it missed.
      const effects: Effect[] = [{ type: "volume", value: state.volume }];
      if (record) effects.push({ type: "cue", ...cueOf(record) });
      return { state: { ...state, player: "ready" }, effects };
    }

    case "yt":
      return onYt(state, action.state);

    case "ytError":
      if (phase === "empty") return same(state);
      return {
        state: { ...state, phase: "error", error: { code: action.code, message: errorMessage(action.code) } },
        effects: [...clearAll(), { type: "timer", name: "skip", ms: SKIP_MS }],
      };

    case "time":
      if (!record) return same(state);
      return same({
        ...state,
        time: Number.isFinite(action.current) ? Math.max(0, action.current) : state.time,
        duration: Number.isFinite(action.duration) ? Math.max(0, action.duration) : state.duration,
      });

    case "timeout":
      // A timer that outlived its phase does nothing.
      if (action.name === "play" && phase === "starting") return same({ ...state, phase: "tap" });
      if (action.name === "advance" && phase === "ended") return step(state, 1);
      if (action.name === "skip" && phase === "error") return step(state, 1);
      return same(state);

    case "unmount":
      return {
        state: { ...state, phase: record ? "loaded" : "empty", player: "none" },
        effects: [...clearAll(), { type: "destroy" }],
      };
  }
}

// ── Derived: the only things the UI reads ──────────────────────────────────

export function current(state: DeckState): VinylRecord | null {
  return state.index === null ? null : (state.records[state.index] ?? null);
}

export type Tonearm = "rest" | "hover" | "down" | "lifted";
export function tonearm(state: DeckState): Tonearm {
  switch (state.phase) {
    case "starting":
    case "buffering":
    case "tap":
      return "hover";
    case "playing":
      return "down";
    case "paused":
      return "lifted";
    default:
      return "rest";
  }
}

// 33 on the switch means 33⅓.
export const rpmValue = (rpm: Rpm) => (rpm === 33 ? 100 / 3 : 45);

export function selectedRpm(state: DeckState): Rpm | null {
  const record = current(state);
  return record ? (state.rpm ?? record.rpm) : null;
}

export function targetRpm(state: DeckState): number {
  const rpm = selectedRpm(state);
  return state.phase === "playing" && rpm ? rpmValue(rpm) : 0;
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const STATUS: Record<Exclude<Phase, "error">, string> = {
  empty: "Pick a record from the crate",
  loaded: "Ready. Press play",
  starting: "Dropping the needle…",
  buffering: "Buffering…",
  playing: "Playing",
  paused: "Paused",
  ended: "Side over",
  tap: "Tap the video to play",
};

export type Lcd = { title: string; artist: string; status: string; time: string };
export function lcd(state: DeckState): Lcd {
  const record = current(state);
  const status =
    state.phase === "error"
      ? (state.error?.message ?? GENERIC_ERROR)
      : state.phase === "loaded" && state.player !== "ready"
        ? "Loading the player…"
        : STATUS[state.phase];
  return {
    title: record?.title ?? "No record",
    artist: record?.artist ?? "",
    status,
    time: record ? `${clock(state.time)} / ${clock(state.duration)}` : "",
  };
}
