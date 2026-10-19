// The tonearm: angle ↔ position round trips, where a pointer points it, what
// letting it go or pressing a key on it does, and that it never plays without
// a gesture or leaves the turntable's clipped view.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { initialDeck, PHASES, reduce, type Action, type DeckState, type Phase } from "./deck.ts";
import { contains, PLATTER, TONEARM_PIVOT, TONEARM_SWEEP, TURNTABLE_VIEW } from "./geometry.ts";
import { parseRecords } from "./records.ts";
import {
  angleToProgress,
  armAngle,
  armAria,
  armBox,
  dropAction,
  keyAction,
  LEAD_IN,
  ON_RECORD,
  PAGE_S,
  pointerToAngle,
  progressOf,
  progressToAngle,
  REST_ANGLE,
  REST_ZONE,
  RUN_OUT,
  scrubSeconds,
  STEP_S,
  stylusAt,
} from "./tonearm.ts";

const RECORDS = parseRecords(JSON.parse(readFileSync(join(import.meta.dirname, "records.json"), "utf8")));

// A deck in a given phase with record 0 on a ready player, 60 s into a 200 s video.
function deck(phase: Phase, over: Partial<DeckState> = {}): DeckState {
  const base = initialDeck(RECORDS);
  if (phase === "empty") return { ...base, ...over };
  return { ...base, phase, index: 0, player: "ready", time: 60, duration: 200, ...over };
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const radius = (angle: number) => {
  const s = stylusAt(angle);
  return Math.hypot(s.x - PLATTER.cx, s.y - PLATTER.cy);
};

test("angle and progress round-trip between the lead-in and the run-out", () => {
  for (let p = 0; p <= 1; p += 0.05) assert.ok(near(angleToProgress(progressToAngle(p)), p), `${p}`);
  for (let a = LEAD_IN; a <= RUN_OUT; a += 0.5) assert.ok(near(progressToAngle(angleToProgress(a)), a), `${a}`);
  assert.equal(progressToAngle(0), LEAD_IN);
  assert.equal(progressToAngle(1), RUN_OUT);
});

test("progress and angle clamp, and bad numbers fall back", () => {
  assert.equal(angleToProgress(0), 0);
  assert.equal(angleToProgress(90), 1);
  assert.equal(progressToAngle(-3), LEAD_IN);
  assert.equal(progressToAngle(7), RUN_OUT);
  assert.equal(progressToAngle(Number.NaN), LEAD_IN);
  assert.equal(angleToProgress(Number.NaN), 0);
  assert.equal(progressOf(50, 200), 0.25);
  assert.equal(progressOf(500, 200), 1);
  assert.equal(progressOf(50, 0), 0);
});

test("the lead-in and run-out put the stylus on the first and last grooves", () => {
  // The grooves are drawn from r 72 to r 162; the disc is r 170.
  assert.ok(radius(LEAD_IN) > 155 && radius(LEAD_IN) < 170, `${radius(LEAD_IN)}`);
  assert.ok(radius(RUN_OUT) > 72 && radius(RUN_OUT) < 85, `${radius(RUN_OUT)}`);
  assert.ok(radius(ON_RECORD) > 170 && radius(ON_RECORD) < 176, `${radius(ON_RECORD)}`);
  assert.ok(radius(REST_ZONE) > PLATTER.r, "the rest zone is off the platter");
  // inwards, steadily, as the record plays
  for (let a = LEAD_IN; a < RUN_OUT; a += 1) assert.ok(radius(a + 1) < radius(a));
});

test("pointerToAngle points the arm at the pointer, clamped to its travel", () => {
  for (const a of [0, 10, LEAD_IN, 33, RUN_OUT]) {
    assert.ok(near(pointerToAngle(TONEARM_PIVOT, stylusAt(a)), a, 1e-9), `${a}`);
  }
  const { x, y } = TONEARM_PIVOT;
  assert.equal(pointerToAngle(TONEARM_PIVOT, { x: x + 100, y: y + 10 }), REST_ANGLE); // out past the rest
  assert.equal(pointerToAngle(TONEARM_PIVOT, { x: x - 300, y: y - 10 }), RUN_OUT); // far over the spindle
  assert.equal(pointerToAngle(TONEARM_PIVOT, { x, y }), REST_ANGLE);
  assert.equal(pointerToAngle(TONEARM_PIVOT, { x: Number.NaN, y: 0 }), REST_ANGLE);
});

test("the arm and its shadow stay inside the sweep box and the clipped view at every angle", () => {
  const view = { x: 0, y: 0, w: TURNTABLE_VIEW.w, h: TURNTABLE_VIEW.h };
  assert.ok(contains(view, TONEARM_SWEEP));
  for (let a = REST_ANGLE; a <= RUN_OUT; a += 0.25) {
    const box = armBox(a);
    assert.ok(contains(TONEARM_SWEEP, box), `${a}°: ${JSON.stringify(box)}`);
  }
});

test("the arm is drawn at rest, or at the playback position", () => {
  assert.equal(armAngle("rest", 0.5), REST_ANGLE);
  for (const arm of ["hover", "down", "lifted"] as const) {
    assert.equal(armAngle(arm, 0), LEAD_IN);
    assert.equal(armAngle(arm, 0.5), (LEAD_IN + RUN_OUT) / 2);
  }
});

test("scrubSeconds maps a held arm to a time, and off the record to nothing", () => {
  assert.equal(scrubSeconds(LEAD_IN, 200), 0);
  assert.equal(scrubSeconds(RUN_OUT, 200), 200);
  assert.equal(scrubSeconds((LEAD_IN + RUN_OUT) / 2, 200), 100);
  assert.equal(scrubSeconds(ON_RECORD, 200), 0);
  assert.equal(scrubSeconds(ON_RECORD - 0.1, 200), null);
  assert.equal(scrubSeconds(RUN_OUT, 0), null);
});

const MID = (LEAD_IN + RUN_OUT) / 2;

test("dropped over the record from rest or lifted → play{user}", () => {
  for (const phase of ["loaded", "tap", "ended"] as const) {
    assert.deepEqual(dropAction(MID, deck(phase)), [{ type: "play", user: true }], phase);
  }
  // a paused record is moved to the spot, then played
  assert.deepEqual(dropAction(MID, deck("paused")), [
    { type: "seek", seconds: 100, user: true },
    { type: "play", user: true },
  ]);
  // a paused record with no duration yet just plays
  assert.deepEqual(dropAction(MID, deck("paused", { duration: 0 })), [{ type: "play", user: true }]);
});

test("moved while the needle is down → seek{user}", () => {
  for (const phase of ["playing", "buffering", "starting"] as const) {
    assert.deepEqual(dropAction(RUN_OUT, deck(phase)), [{ type: "seek", seconds: 200, user: true }], phase);
  }
  assert.deepEqual(dropAction(MID, deck("playing", { duration: 0 })), []);
});

test("lifted back to the rest zone → pause{user}; at rest already → nothing", () => {
  for (const phase of ["playing", "buffering", "starting"] as const) {
    assert.deepEqual(dropAction(REST_ANGLE, deck(phase)), [{ type: "pause", user: true }], phase);
    assert.deepEqual(dropAction(REST_ZONE - 1, deck(phase)), [{ type: "pause", user: true }], phase);
  }
  for (const phase of ["loaded", "paused", "tap", "ended", "error"] as const) {
    assert.deepEqual(dropAction(REST_ANGLE, deck(phase)), [], phase);
  }
});

test("a drop outside the record does nothing", () => {
  for (const phase of PHASES) {
    for (const a of [REST_ZONE, (REST_ZONE + ON_RECORD) / 2, ON_RECORD - 0.01]) {
      assert.deepEqual(dropAction(a, deck(phase)), [], `${phase} at ${a}`);
    }
  }
  // and with no record on the platter, nothing happens anywhere
  for (const a of [REST_ANGLE, MID, RUN_OUT]) assert.deepEqual(dropAction(a, deck("empty")), []);
  assert.deepEqual(dropAction(Number.NaN, deck("loaded")), []);
});

test("never a play without user: every action the arm makes is a gesture, and the deck plays only on them", () => {
  for (const phase of PHASES) {
    const state = deck(phase);
    const actions: Action[] = [];
    for (let a = -10; a <= 60; a += 0.5) actions.push(...dropAction(a, state));
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", "Enter"]) {
      actions.push(...(keyAction(key, state) ?? []));
    }
    for (const action of actions) {
      assert.equal((action as { user?: boolean }).user, true, `${phase}: ${JSON.stringify(action)}`);
      // the same action stripped of its gesture never makes the deck play
      const bare = { ...action, user: undefined } as Action;
      assert.ok(!reduce(state, bare).effects.some((e) => e.type === "play"), `${phase}: ${action.type}`);
    }
  }
});

test("keys: arrows ±5 s, PageUp/PageDown ±30 s, Home and End, clamped", () => {
  const state = deck("playing");
  const seekTo = (key: string) => {
    const out = keyAction(key, state);
    assert.ok(out && out.length === 1 && out[0].type === "seek", key);
    return (out[0] as { seconds: number }).seconds;
  };
  assert.equal(seekTo("ArrowRight"), 60 + STEP_S);
  assert.equal(seekTo("ArrowUp"), 60 + STEP_S);
  assert.equal(seekTo("ArrowLeft"), 60 - STEP_S);
  assert.equal(seekTo("ArrowDown"), 60 - STEP_S);
  assert.equal(seekTo("PageUp"), 60 + PAGE_S);
  assert.equal(seekTo("PageDown"), 60 - PAGE_S);
  assert.equal(seekTo("Home"), 0);
  assert.equal(seekTo("End"), 200);
  assert.deepEqual(keyAction("ArrowLeft", deck("playing", { time: 2 })), [{ type: "seek", seconds: 0, user: true }]);
  assert.deepEqual(keyAction("PageUp", deck("playing", { time: 190 })), [{ type: "seek", seconds: 200, user: true }]);
});

test("keys: Enter drops the needle or lifts it; other keys are not the arm's", () => {
  assert.deepEqual(keyAction("Enter", deck("loaded")), [{ type: "play", user: true }]);
  assert.deepEqual(keyAction("Enter", deck("paused")), [{ type: "play", user: true }]);
  assert.deepEqual(keyAction("Enter", deck("error")), []);
  assert.deepEqual(keyAction("Enter", deck("playing")), [{ type: "pause", user: true }]);
  assert.deepEqual(keyAction("Enter", deck("empty")), []);
  for (const key of [" ", "Escape", "a", "Tab"]) assert.equal(keyAction(key, deck("playing")), null, key);
  // no duration yet: the arm keeps the arrows (so they don't change record) but seeks nowhere
  assert.deepEqual(keyAction("ArrowRight", deck("loaded", { duration: 0 })), []);
  assert.deepEqual(keyAction("ArrowRight", deck("empty")), []);
});

test("the slider's value and text", () => {
  assert.deepEqual(armAria(deck("playing")), { now: 60, max: 200, text: "1:00 of 3:20, playing" });
  assert.deepEqual(armAria(deck("paused", { time: 5.7 })), { now: 5, max: 200, text: "0:05 of 3:20, lifted" });
  assert.deepEqual(armAria(deck("empty")), { now: 0, max: 0, text: "0:00 of 0:00, at rest" });
});
