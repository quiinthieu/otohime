import assert from "node:assert/strict";
import { test } from "node:test";
import { TIERS, type Tier } from "./cards.ts";
import { dropIndex, turnFrames } from "./gacha.ts";
import {
  DROP_FRAMES,
  type Machine,
  type MachineAction,
  OPEN_STAGES,
  type OpenStage,
  type Phase,
  TURN_MAX,
  TURN_MIN,
  newMachine,
  openFrames,
  openStage,
  step,
} from "./machine.ts";

const turnOf = (frames: number, drop = 3, tier: Tier = "common"): MachineAction => ({ type: "turn", frames, drop, tier });
const at = (phase: Phase, frame = 0, tier: Tier | null = "rare"): Machine => ({ phase, frame, length: 20, drop: 5, tier });
const PRESSES: MachineAction[] = ["insert", turnOf(20), "open"];
const pressName = (a: MachineAction) => (typeof a === "string" ? a : a.type);
const LEGAL: Record<Phase, string[]> = {
  idle: ["insert"],
  loaded: ["turn"],
  turning: [],
  ready: ["open"],
  opening: [],
  revealed: ["insert"],
};

const ticks = (m: Machine, n: number) => {
  for (let i = 0; i < n; i++) m = step(m, "tick");
  return m;
};

test("a seeded round runs idle, loaded, turning for its own length, ready, opening, revealed", () => {
  for (let n = 0; n < 12; n++) {
    const frames = turnFrames(42, n);
    const drop = dropIndex(42, n);
    for (const tier of TIERS) {
      let m = newMachine();
      assert.equal(m.phase, "idle");
      m = step(m, "insert");
      assert.deepEqual(m, { phase: "loaded", frame: 0, length: 0, drop: 0, tier: null });
      m = step(m, turnOf(frames, drop, tier));
      assert.deepEqual(m, { phase: "turning", frame: 0, length: frames, drop, tier });
      m = ticks(m, frames - 1);
      assert.equal(m.phase, "turning", `still turning on frame ${frames - 1} of ${frames}`);
      m = step(m, "tick");
      assert.deepEqual(m, { phase: "ready", frame: 0, length: frames, drop, tier });
      m = step(m, "open");
      assert.equal(m.phase, "opening");
      m = ticks(m, openFrames(tier) - 1);
      assert.equal(m.phase, "opening");
      m = step(m, "tick");
      assert.deepEqual(m, { phase: "revealed", frame: 0, length: frames, drop, tier });
      // insert from revealed starts the next round and forgets this one
      assert.deepEqual(step(m, "insert"), { ...newMachine(), phase: "loaded" });
    }
  }
});

test("seeded turns differ in length within 16..28 frames", () => {
  const lengths = new Set<number>();
  for (let n = 0; n < 40; n++) {
    const frames = turnFrames(7, n);
    const m = ticks(step(step(newMachine(), "insert"), turnOf(frames)), frames - 1);
    assert.equal(m.phase, "turning");
    assert.ok(frames >= TURN_MIN && frames <= TURN_MAX);
    lengths.add(frames);
  }
  assert.ok(lengths.size > 4, `${lengths.size} lengths`);
  assert.ok(TURN_MIN > DROP_FRAMES);
});

test("a legend opens 6 frames longer, for its hold", () => {
  assert.equal(openFrames("common"), 28);
  assert.equal(openFrames("rare"), 28);
  assert.equal(openFrames("legend"), openFrames("common") + 6);
});

test("open stage boundaries: shake 6, part 4, rise 6, edge 6, hold 6 (legend only), flip 6", () => {
  const expect = (tier: Tier) =>
    OPEN_STAGES.filter(([s]) => s !== "hold" || tier === "legend").flatMap(([s, n]) => Array<OpenStage>(n).fill(s));
  for (const tier of TIERS) {
    const want = expect(tier);
    assert.equal(want.length, openFrames(tier));
    want.forEach((stage, f) => assert.equal(openStage(f, tier), stage, `${tier} frame ${f}`));
  }
  assert.equal(openStage(9, "legend"), "part");
  assert.equal(openStage(10, "legend"), "rise");
  assert.equal(openStage(16, "common"), "edge");
  assert.equal(openStage(22, "common"), "flip");
  assert.equal(openStage(22, "legend"), "hold");
  assert.equal(openStage(28, "legend"), "flip");
});

test("illegal presses are no-ops", () => {
  for (const phase of Object.keys(LEGAL) as Phase[]) {
    const m = at(phase, phase === "turning" || phase === "opening" ? 3 : 0);
    for (const press of PRESSES) {
      if (!LEGAL[phase].includes(pressName(press))) assert.equal(step(m, press), m, `${pressName(press)} in ${phase}`);
    }
  }
});

test("settle finishes turning and opening from any frame, and does nothing at rest", () => {
  for (const tier of TIERS) {
    for (let f = 0; f < 20; f++) assert.deepEqual(step(at("turning", f, tier), "settle"), at("ready", 0, tier));
    for (let f = 0; f < openFrames(tier); f++) assert.deepEqual(step(at("opening", f, tier), "settle"), at("revealed", 0, tier));
  }
  for (const phase of ["idle", "loaded", "ready", "revealed"] as Phase[]) {
    const m = at(phase);
    assert.equal(step(m, "settle"), m);
  }
});

test("frames only advance on tick", () => {
  let m = step(step(newMachine(), "insert"), turnOf(18));
  for (const press of PRESSES) m = step(m, press);
  assert.equal(m.phase, "turning");
  assert.equal(m.frame, 0);
  for (let i = 1; i < 18; i++) {
    m = step(m, "tick");
    assert.equal(m.frame, i);
  }
  assert.equal(step(m, "tick").phase, "ready");
  for (const phase of ["idle", "loaded", "ready", "revealed"] as Phase[]) {
    const still = at(phase);
    assert.equal(step(still, "tick"), still);
  }
});
