// The deck driving a fake YouTube player: each effect becomes the right API
// call, the player variables are the documented three, and whole flows
// (select, play, pause, error, hide, unmount) end in the calls YouTube's rules expect.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { initialDeck, reduce, targetRpm, type Action, type DeckState, type Effect } from "./deck.ts";
import { mapState, PLAYER_VARS, runEffect, YT_STATE, type CueArgs, type PlayerLike } from "./player.ts";
import { parseRecords } from "./records.ts";

const RECORDS = parseRecords(JSON.parse(readFileSync(join(import.meta.dirname, "records.json"), "utf8")));

type Call = [string, ...unknown[]];
function fakePlayer() {
  const calls: Call[] = [];
  const player: PlayerLike = {
    cueVideoById: (args: CueArgs) => void calls.push(["cueVideoById", args]),
    loadVideoById: (args: CueArgs) => void calls.push(["loadVideoById", args]),
    playVideo: () => void calls.push(["playVideo"]),
    pauseVideo: () => void calls.push(["pauseVideo"]),
    stopVideo: () => void calls.push(["stopVideo"]),
    seekTo: (s: number, ahead: boolean) => void calls.push(["seekTo", s, ahead]),
    setVolume: (v: number) => void calls.push(["setVolume", v]),
    getCurrentTime: () => 0,
    getDuration: () => 0,
    getPlayerState: () => -1,
    destroy: () => void calls.push(["destroy"]),
  };
  return { player, calls };
}

test("PLAYER_VARS is exactly playsinline, rel and origin", () => {
  const vars = PLAYER_VARS("https://otohime.dev");
  assert.deepEqual(vars, { playsinline: 1, rel: 0, origin: "https://otohime.dev" });
  assert.deepEqual(Object.keys(vars).sort(), ["origin", "playsinline", "rel"]);
  for (const banned of ["autoplay", "controls", "mute", "iv_load_policy", "disablekb", "fs", "modestbranding"]) {
    assert.ok(!(banned in vars), banned);
  }
});

test("mapState covers every YT.PlayerState and nothing else", () => {
  assert.deepEqual(mapState(YT_STATE.UNSTARTED), { type: "yt", state: "unstarted" });
  assert.deepEqual(mapState(YT_STATE.ENDED), { type: "yt", state: "ended" });
  assert.deepEqual(mapState(YT_STATE.PLAYING), { type: "yt", state: "playing" });
  assert.deepEqual(mapState(YT_STATE.PAUSED), { type: "yt", state: "paused" });
  assert.deepEqual(mapState(YT_STATE.BUFFERING), { type: "yt", state: "buffering" });
  assert.deepEqual(mapState(YT_STATE.CUED), { type: "yt", state: "cued" });
  assert.equal(mapState(4), null);
  assert.equal(mapState(99), null);
});

test("runEffect maps each effect to its API call", () => {
  const cases: [Effect, Call[]][] = [
    [{ type: "cue", videoId: "IXA6bQsVNjs" }, [["cueVideoById", { videoId: "IXA6bQsVNjs" }]]],
    [
      { type: "cue", videoId: "agneRtEe-t8", startSeconds: 15, endSeconds: 120 },
      [["cueVideoById", { videoId: "agneRtEe-t8", startSeconds: 15, endSeconds: 120 }]],
    ],
    [{ type: "play" }, [["playVideo"]]],
    [{ type: "pause" }, [["pauseVideo"]]],
    [{ type: "stop", videoId: "vR49dHUwMUA" }, [["stopVideo"], ["cueVideoById", { videoId: "vR49dHUwMUA" }]]],
    [{ type: "seek", seconds: 42 }, [["seekTo", 42, true]]],
    [{ type: "volume", value: 55 }, [["setVolume", 55]]],
    [{ type: "destroy" }, [["destroy"]]],
  ];
  for (const [effect, expected] of cases) {
    const { player, calls } = fakePlayer();
    assert.equal(runEffect(player, effect), true, effect.type);
    assert.deepEqual(calls, expected, effect.type);
  }
});

test("ensurePlayer and timers are the shell's; nothing runs without a player", () => {
  const { player, calls } = fakePlayer();
  for (const effect of [{ type: "ensurePlayer" }, { type: "timer", name: "play", ms: 1500 }, { type: "clearTimer", name: "skip" }] as Effect[]) {
    assert.equal(runEffect(player, effect), false);
  }
  assert.equal(runEffect(null, { type: "play" }), false);
  assert.deepEqual(calls, []);
});

// A tiny shell: the reducer plus runEffect against the fake player, the way
// vinyl-app.tsx will wire them.
function shell() {
  const fake = fakePlayer();
  let state: DeckState = initialDeck(RECORDS);
  const shellEffects: Effect[] = [];
  const dispatch = (action: Action | null) => {
    if (!action) return;
    const out = reduce(state, action);
    state = out.state;
    for (const e of out.effects) if (!runEffect(state.player === "ready" || e.type === "destroy" ? fake.player : null, e)) shellEffects.push(e);
  };
  return { dispatch, calls: fake.calls, shellEffects, get state() { return state; } };
}

test("selecting a record loads it: the player is asked for, then the record is cued, not played", () => {
  const s = shell();
  s.dispatch({ type: "select", index: 4, user: true });
  assert.ok(s.shellEffects.some((e) => e.type === "ensurePlayer"));
  s.dispatch({ type: "ready" });
  const r = RECORDS[4];
  assert.deepEqual(s.calls, [
    ["setVolume", 80],
    ["cueVideoById", { videoId: r.youtubeVideoId, startSeconds: r.startSeconds, endSeconds: r.endSeconds }],
  ]);
  assert.ok(!s.calls.some((c) => c[0] === "playVideo"));
});

test("play, then YouTube's reports, then pause: the spin follows the player", () => {
  const s = shell();
  s.dispatch({ type: "select", index: 0, user: true });
  s.dispatch({ type: "ready" });
  s.dispatch({ type: "play", user: true });
  assert.equal(s.calls.at(-1)?.[0], "playVideo");
  assert.equal(targetRpm(s.state), 0, "no spin until YouTube says it is playing");
  s.dispatch(mapState(YT_STATE.BUFFERING));
  s.dispatch(mapState(YT_STATE.PLAYING));
  assert.ok(targetRpm(s.state) > 0);
  s.dispatch({ type: "pause", user: true });
  assert.equal(s.calls.at(-1)?.[0], "pauseVideo");
  assert.equal(targetRpm(s.state), 0, "pause stops the spin");
  s.dispatch(mapState(YT_STATE.PAUSED));
  assert.equal(s.state.phase, "paused");
});

test("an error shows the fallback, and the skip cues the next record without playing", () => {
  const s = shell();
  s.dispatch({ type: "select", index: 0, user: true });
  s.dispatch({ type: "ready" });
  s.dispatch({ type: "play", user: true });
  s.dispatch({ type: "ytError", code: 150 });
  assert.equal(s.state.phase, "error");
  assert.equal(s.state.error?.message, "The owner doesn't allow playing it here");
  assert.ok(s.shellEffects.some((e) => e.type === "timer" && e.name === "skip"));
  const before = s.calls.length;
  s.dispatch({ type: "timeout", name: "skip" });
  assert.deepEqual(s.calls.slice(before), [["cueVideoById", { videoId: RECORDS[1].youtubeVideoId }]]);
});

test("hiding the tab pauses, unmounting destroys, and nothing plays after", () => {
  const s = shell();
  s.dispatch({ type: "select", index: 0, user: true });
  s.dispatch({ type: "ready" });
  s.dispatch({ type: "play", user: true });
  s.dispatch(mapState(YT_STATE.PLAYING));
  s.dispatch({ type: "hidden" });
  assert.equal(s.calls.at(-1)?.[0], "pauseVideo");
  s.dispatch({ type: "unmount" });
  assert.equal(s.calls.at(-1)?.[0], "destroy");
  const after = s.calls.length;
  // late events from a destroyed player
  s.dispatch(mapState(YT_STATE.PLAYING));
  s.dispatch({ type: "play", user: true });
  assert.ok(!s.calls.slice(after).some((c) => c[0] === "playVideo"));
});

test("switching through every record twice reuses one player and plays nothing by itself", () => {
  const s = shell();
  s.dispatch({ type: "select", index: 0, user: true });
  s.dispatch({ type: "ready" });
  for (let i = 0; i < RECORDS.length * 2; i++) s.dispatch({ type: "next", user: true });
  assert.equal(s.shellEffects.filter((e) => e.type === "ensurePlayer").length, 1);
  assert.ok(!s.calls.some((c) => c[0] === "playVideo" || c[0] === "loadVideoById"));
  assert.equal(s.calls.filter((c) => c[0] === "cueVideoById").length, 1 + RECORDS.length * 2);
  assert.equal(s.state.index, 0, "back where it started");
});
