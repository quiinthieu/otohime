// Every arrow of the deck's state diagram, the error fallback, tap-to-play,
// the hidden-tab pause, and the rule that nothing plays without a gesture.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  ADVANCE_MS,
  clock,
  errorMessage,
  GENERIC_ERROR,
  initialDeck,
  lcd,
  PHASES,
  PLAY_TIMEOUT_MS,
  reduce,
  rpmValue,
  SKIP_MS,
  targetRpm,
  tonearm,
  type Action,
  type DeckState,
  type Effect,
  type Phase,
} from "./deck.ts";
import { parseRecords } from "./records.ts";

const RECORDS = parseRecords(JSON.parse(readFileSync(join(import.meta.dirname, "records.json"), "utf8")));
const N = RECORDS.length;
const timed = RECORDS.findIndex((r) => r.startSeconds !== undefined);

// Run actions in order, keeping every effect.
function run(state: DeckState, ...actions: Action[]) {
  const effects: Effect[] = [];
  for (const action of actions) {
    const out = reduce(state, action);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}
const types = (effects: Effect[]) => effects.map((e) => e.type);
const has = (effects: Effect[], type: Effect["type"]) => effects.some((e) => e.type === type);

const empty = initialDeck(RECORDS);
// Record 0 on the platter, player ready.
const loaded = run(empty, { type: "select", index: 0, user: true }, { type: "ready" }).state;
const starting = reduce(loaded, { type: "play", user: true }).state;
const buffering = reduce(starting, { type: "yt", state: "buffering" }).state;
const playing = reduce(buffering, { type: "yt", state: "playing" }).state;
const paused = reduce(playing, { type: "pause", user: true }).state;
const ended = reduce(playing, { type: "yt", state: "ended" }).state;
const tap = reduce(starting, { type: "timeout", name: "play" }).state;
const errored = reduce(loaded, { type: "ytError", code: 150 }).state;
const AT: Record<Phase, DeckState> = { empty, loaded, starting, buffering, playing, paused, ended, tap, error: errored };

test("the fixtures sit in the phases they are named after", () => {
  for (const phase of PHASES) assert.equal(AT[phase].phase, phase);
});

test("selecting a record loads it: player first, then a cue, never a play", () => {
  const { state, effects } = reduce(empty, { type: "select", index: 2, user: true });
  assert.equal(state.phase, "loaded");
  assert.equal(state.index, 2);
  assert.equal(state.player, "loading");
  const t = types(effects).filter((x) => x !== "clearTimer");
  assert.deepEqual(t, ["ensurePlayer", "cue"]);
  assert.deepEqual(effects.find((e) => e.type === "cue"), { type: "cue", videoId: RECORDS[2].youtubeVideoId });
  // a second selection reuses the player
  const again = reduce(state, { type: "select", index: 3, user: true });
  assert.ok(!has(again.effects, "ensurePlayer"));
  assert.equal(again.state.index, 3);
});

test("a cue carries the record's start and end", () => {
  const { effects } = reduce(empty, { type: "select", index: timed });
  const r = RECORDS[timed];
  assert.deepEqual(effects.find((e) => e.type === "cue"), { type: "cue", videoId: r.youtubeVideoId, startSeconds: r.startSeconds, endSeconds: r.endSeconds });
});

test("ready gives the player the volume and the record it missed", () => {
  const sel = reduce(empty, { type: "select", index: 1 }).state;
  const { state, effects } = reduce(sel, { type: "ready" });
  assert.equal(state.player, "ready");
  assert.deepEqual(effects, [
    { type: "volume", value: 80 },
    { type: "cue", videoId: RECORDS[1].youtubeVideoId },
  ]);
  assert.deepEqual(reduce(empty, { type: "ready" }).effects, [{ type: "volume", value: 80 }]);
});

test("play{user}: loaded → starting with a play effect and a play timer", () => {
  const { state, effects } = reduce(loaded, { type: "play", user: true });
  assert.equal(state.phase, "starting");
  assert.ok(has(effects, "play"));
  assert.deepEqual(effects.find((e) => e.type === "timer"), { type: "timer", name: "play", ms: PLAY_TIMEOUT_MS });
  assert.equal(tonearm(state), "hover");
});

test("play waits for a record and a ready player", () => {
  assert.deepEqual(reduce(empty, { type: "play", user: true }).effects, []);
  const notReady = reduce(empty, { type: "select", index: 0 }).state;
  const out = reduce(notReady, { type: "play", user: true });
  assert.equal(out.state.phase, "loaded");
  assert.deepEqual(out.effects, []);
  assert.equal(lcd(notReady).status, "Loading the player…");
});

test("starting → buffering → playing, and starting → playing directly", () => {
  const b = reduce(starting, { type: "yt", state: "buffering" });
  assert.equal(b.state.phase, "buffering");
  assert.deepEqual(b.effects, [{ type: "clearTimer", name: "play" }]);
  assert.equal(tonearm(b.state), "hover", "the arm hovers while YouTube buffers");
  assert.equal(targetRpm(b.state), 0);
  const p = reduce(b.state, { type: "yt", state: "playing" });
  assert.equal(p.state.phase, "playing");
  assert.equal(tonearm(p.state), "down");
  assert.equal(reduce(starting, { type: "yt", state: "playing" }).state.phase, "playing");
});

test("the platter follows YouTube's state, not the buttons", () => {
  // pressing play is not enough to spin
  assert.equal(targetRpm(starting), 0);
  assert.equal(targetRpm(playing), rpmValue(RECORDS[0].rpm));
  // YouTube's own controls drive it too
  assert.equal(reduce(loaded, { type: "yt", state: "playing" }).state.phase, "playing");
  assert.equal(reduce(playing, { type: "yt", state: "paused" }).state.phase, "paused");
  assert.equal(reduce(paused, { type: "yt", state: "playing" }).state.phase, "playing");
  // unstarted and cued change nothing
  for (const phase of PHASES) {
    for (const yt of ["unstarted", "cued"] as const) assert.equal(reduce(AT[phase], { type: "yt", state: yt }).state, AT[phase]);
  }
});

test("play timeout while still waiting → tap; play{user} or yt playing leave tap", () => {
  assert.equal(tap.phase, "tap");
  assert.equal(lcd(tap).status, "Tap the video to play");
  assert.equal(tonearm(tap), "hover");
  const again = reduce(tap, { type: "play", user: true });
  assert.equal(again.state.phase, "starting");
  assert.ok(has(again.effects, "play"));
  assert.equal(reduce(tap, { type: "yt", state: "playing" }).state.phase, "playing");
  // a play timer that outlived its phase does nothing
  for (const s of [buffering, playing, paused, loaded]) assert.equal(reduce(s, { type: "timeout", name: "play" }).state, s);
});

test("pause stops the spin: playing → paused lifts the arm and targets 0 rpm", () => {
  const { state, effects } = reduce(playing, { type: "pause", user: true });
  assert.equal(state.phase, "paused");
  assert.ok(has(effects, "pause"));
  assert.equal(targetRpm(state), 0);
  assert.equal(tonearm(state), "lifted");
  const resumed = reduce(paused, { type: "play", user: true });
  assert.equal(resumed.state.phase, "starting");
  assert.ok(has(resumed.effects, "play"));
});

test("buffering from playing or paused", () => {
  assert.equal(reduce(playing, { type: "yt", state: "buffering" }).state.phase, "buffering");
  assert.equal(reduce(paused, { type: "yt", state: "buffering" }).state.phase, "buffering");
  assert.equal(reduce(errored, { type: "yt", state: "buffering" }).state.phase, "error");
});

test("ended returns the arm, then cues the next record and does not play it", () => {
  const e = reduce(playing, { type: "yt", state: "ended" });
  assert.equal(e.state.phase, "ended");
  assert.equal(tonearm(e.state), "rest");
  assert.deepEqual(e.effects, [{ type: "timer", name: "advance", ms: ADVANCE_MS }]);
  const next = reduce(ended, { type: "timeout", name: "advance" });
  assert.equal(next.state.phase, "loaded");
  assert.equal(next.state.index, 1);
  assert.ok(has(next.effects, "cue"));
  assert.ok(!has(next.effects, "play"));
  // the last record wraps to the first
  const last = run(empty, { type: "select", index: N - 1 }, { type: "ready" }, { type: "play", user: true }, { type: "yt", state: "playing" }, { type: "yt", state: "ended" }, { type: "timeout", name: "advance" });
  assert.equal(last.state.index, 0);
});

test("stop{user} from every phase with sound or a pending play → loaded, stopped and re-cued", () => {
  for (const phase of ["starting", "buffering", "playing", "paused", "tap", "ended"] as const) {
    const { state, effects } = reduce(AT[phase], { type: "stop", user: true });
    assert.equal(state.phase, "loaded", phase);
    assert.deepEqual(effects.filter((e) => e.type === "stop"), [{ type: "stop", videoId: RECORDS[0].youtubeVideoId }], phase);
    assert.ok(effects.filter((e) => e.type === "clearTimer").length === 3, phase);
    assert.equal(targetRpm(state), 0);
  }
  for (const phase of ["empty", "loaded", "error"] as const) assert.deepEqual(reduce(AT[phase], { type: "stop", user: true }).effects, []);
});

test("select, next and prev from any phase but empty cue a record and land in loaded", () => {
  for (const phase of PHASES.filter((p) => p !== "empty")) {
    const s = AT[phase];
    for (const [action, index] of [
      [{ type: "select", index: 5, user: true }, 5],
      [{ type: "next", user: true }, 1],
      [{ type: "prev", user: true }, N - 1],
    ] as [Action, number][]) {
      const out = reduce(s, action);
      assert.equal(out.state.phase, "loaded", `${phase} ${action.type}`);
      assert.equal(out.state.index, index, `${phase} ${action.type}`);
      assert.equal(out.state.error, null);
      assert.ok(has(out.effects, "cue") && !has(out.effects, "play"), `${phase} ${action.type}`);
      assert.equal(out.effects.filter((e) => e.type === "clearTimer").length, 3, "pending timers die with the old record");
    }
  }
  assert.equal(reduce(empty, { type: "next", user: true }).state, empty);
  assert.equal(reduce(empty, { type: "prev", user: true }).state, empty);
  for (const index of [-1, N, 1.5, NaN]) assert.equal(reduce(loaded, { type: "select", index }).state, loaded);
});

test("each error code → error with its message and a skip timer (the fallback)", () => {
  const expected: Record<number, string> = {
    2: "That video id looks wrong",
    5: "The player hit an error",
    100: "That video is gone or private",
    101: "The owner doesn't allow playing it here",
    150: "The owner doesn't allow playing it here",
    153: "The browser didn't send a referrer",
    999: GENERIC_ERROR,
  };
  for (const [code, message] of Object.entries(expected)) {
    for (const phase of PHASES.filter((p) => p !== "empty")) {
      const { state, effects } = reduce(AT[phase], { type: "ytError", code: Number(code) });
      assert.equal(state.phase, "error", `${phase} ${code}`);
      assert.deepEqual(state.error, { code: Number(code), message });
      assert.equal(lcd(state).status, message);
      assert.equal(tonearm(state), "rest");
      assert.equal(targetRpm(state), 0);
      assert.deepEqual(effects.at(-1), { type: "timer", name: "skip", ms: SKIP_MS });
      assert.ok(!has(effects, "play"));
    }
    assert.equal(errorMessage(Number(code)), message);
  }
  assert.equal(reduce(empty, { type: "ytError", code: 2 }).state, empty);
});

test("skip{user} or the skip timer cue the next record and never play it", () => {
  for (const action of [{ type: "skip", user: true }, { type: "timeout", name: "skip" }] as Action[]) {
    const { state, effects } = reduce(errored, action);
    assert.equal(state.phase, "loaded");
    assert.equal(state.index, 1);
    assert.equal(state.error, null);
    assert.ok(has(effects, "cue") && !has(effects, "play"));
  }
  // skip and its timer mean nothing outside error
  for (const phase of PHASES.filter((p) => p !== "error")) {
    assert.equal(reduce(AT[phase], { type: "skip", user: true }).state, AT[phase]);
    assert.equal(reduce(AT[phase], { type: "timeout", name: "skip" }).state, AT[phase]);
    if (phase !== "ended") assert.equal(reduce(AT[phase], { type: "timeout", name: "advance" }).state, AT[phase]);
  }
});

test("eject from any phase → empty, paused and with no timers left", () => {
  for (const phase of PHASES.filter((p) => p !== "empty")) {
    const { state, effects } = reduce(AT[phase], { type: "eject", user: true });
    assert.equal(state.phase, "empty", phase);
    assert.equal(state.index, null);
    assert.equal(state.player, "ready", "the one player stays");
    assert.deepEqual(types(effects), ["clearTimer", "clearTimer", "clearTimer", "pause"]);
    assert.equal(tonearm(state), "rest");
  }
  assert.deepEqual(reduce(empty, { type: "eject", user: true }).effects, []);
});

test("a hidden tab pauses whatever is or is about to be sounding", () => {
  for (const phase of ["starting", "buffering", "playing"] as const) {
    const { state, effects } = reduce(AT[phase], { type: "hidden" });
    assert.equal(state.phase, "paused", phase);
    assert.ok(has(effects, "pause"), phase);
  }
  for (const phase of ["empty", "loaded", "paused", "ended", "tap", "error"] as const) {
    assert.deepEqual(reduce(AT[phase], { type: "hidden" }).effects, [], phase);
  }
});

test("unmount destroys the player and clears every timer", () => {
  for (const phase of PHASES) {
    const { state, effects } = reduce(AT[phase], { type: "unmount" });
    assert.deepEqual(effects.at(-1), { type: "destroy" }, phase);
    assert.equal(effects.filter((e) => e.type === "clearTimer").length, 3);
    assert.equal(state.player, "none");
    assert.ok(state.phase === "loaded" || state.phase === "empty");
    assert.equal(targetRpm(state), 0);
  }
  // after a remount, the next selection asks for a player again
  const gone = reduce(playing, { type: "unmount" }).state;
  assert.ok(has(reduce(gone, { type: "select", index: 0 }).effects, "ensurePlayer"));
});

// Every action, as it could arrive from anything but a gesture.
const NOT_GESTURES: Action[] = [
  { type: "select", index: 0 },
  { type: "select", index: 3, user: false },
  { type: "next" },
  { type: "prev" },
  { type: "play" },
  { type: "play", user: false },
  { type: "pause" },
  { type: "stop" },
  { type: "eject" },
  { type: "skip" },
  { type: "seek", seconds: 10 },
  { type: "volume", value: 50 },
  { type: "rpm", rpm: 45 },
  { type: "ready" },
  ...(["unstarted", "ended", "playing", "paused", "buffering", "cued"] as const).map((state) => ({ type: "yt", state }) as Action),
  { type: "ytError", code: 150 },
  { type: "time", current: 30, duration: 200 },
  { type: "timeout", name: "play" },
  { type: "timeout", name: "skip" },
  { type: "timeout", name: "advance" },
  { type: "hidden" },
  { type: "unmount" },
];

test("never plays without a gesture: every phase × every non-gesture action", () => {
  for (const phase of PHASES) {
    for (const action of NOT_GESTURES) {
      assert.ok(!has(reduce(AT[phase], action).effects, "play"), `${phase} + ${JSON.stringify(action)}`);
    }
  }
  // and two steps deep, so no pair of automatic events sneaks one in
  for (const phase of PHASES) {
    for (const a of NOT_GESTURES) {
      const mid = reduce(AT[phase], a).state;
      for (const b of NOT_GESTURES) assert.ok(!has(reduce(mid, b).effects, "play"), `${phase} + ${a.type} + ${JSON.stringify(b)}`);
    }
  }
});

test("seek clamps to 0..duration; volume clamps to 0..100", () => {
  const known = reduce(playing, { type: "time", current: 30, duration: 200 }).state;
  assert.deepEqual(reduce(known, { type: "seek", seconds: 500, user: true }).effects, [{ type: "seek", seconds: 200 }]);
  assert.deepEqual(reduce(known, { type: "seek", seconds: -4, user: true }).effects, [{ type: "seek", seconds: 0 }]);
  assert.equal(reduce(known, { type: "seek", seconds: 42, user: true }).state.time, 42);
  assert.deepEqual(reduce(empty, { type: "seek", seconds: 4 }).effects, []);
  assert.deepEqual(reduce(errored, { type: "seek", seconds: 4 }).effects, []);
  assert.deepEqual(reduce(playing, { type: "volume", value: 140 }).effects, [{ type: "volume", value: 100 }]);
  assert.deepEqual(reduce(playing, { type: "volume", value: -3 }).effects, [{ type: "volume", value: 0 }]);
  assert.equal(reduce(empty, { type: "volume", value: 33.4 }).state.volume, 33);
});

test("the 33/45 switch overrides the record until the next one", () => {
  const record = RECORDS[0];
  const other = record.rpm === 33 ? 45 : 33;
  const switched = reduce(playing, { type: "rpm", rpm: other, user: true }).state;
  assert.equal(targetRpm(switched), rpmValue(other));
  assert.equal(reduce(switched, { type: "rpm", rpm: record.rpm }).state.rpm, null);
  assert.equal(reduce(switched, { type: "next" }).state.rpm, null);
  assert.equal(reduce(empty, { type: "rpm", rpm: 45 }).state, empty);
  assert.equal(rpmValue(33), 100 / 3);
  assert.equal(rpmValue(45), 45);
});

test("tonearm per phase", () => {
  const expected: Record<Phase, string> = {
    empty: "rest",
    loaded: "rest",
    ended: "rest",
    error: "rest",
    starting: "hover",
    buffering: "hover",
    tap: "hover",
    playing: "down",
    paused: "lifted",
  };
  for (const phase of PHASES) assert.equal(tonearm(AT[phase]), expected[phase], phase);
});

test("only playing spins", () => {
  for (const phase of PHASES) assert.equal(targetRpm(AT[phase]) > 0, phase === "playing", phase);
});

test("the LCD reads title, artist, status and time", () => {
  assert.deepEqual(lcd(empty), { title: "No record", artist: "", status: "Pick a record from the crate", time: "" });
  const t = reduce(playing, { type: "time", current: 75.9, duration: 3601 }).state;
  assert.deepEqual(lcd(t), { title: RECORDS[0].title, artist: RECORDS[0].artist, status: "Playing", time: "1:15 / 60:01" });
  assert.equal(lcd(buffering).status, "Buffering…");
  assert.equal(lcd(paused).status, "Paused");
  assert.equal(lcd(loaded).status, "Ready. Press play");
  assert.equal(clock(NaN), "0:00");
  assert.equal(clock(-5), "0:00");
  // time reports without a record, or with nonsense, change nothing harmful
  assert.equal(reduce(empty, { type: "time", current: 3, duration: 4 }).state, empty);
  assert.equal(reduce(t, { type: "time", current: NaN, duration: Infinity }).state.time, t.time);
});
