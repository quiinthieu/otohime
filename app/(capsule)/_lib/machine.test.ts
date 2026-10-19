import assert from "node:assert/strict";
import { test } from "node:test";
import { type Machine, type MachineAction, OPEN_FRAMES, type Phase, TURN_FRAMES, newMachine, step } from "./machine.ts";

const at = (phase: Phase, frame = 0): Machine => ({ phase, frame });
const PRESSES: MachineAction[] = ["insert", "turn", "open"];
const LEGAL: Record<Phase, MachineAction[]> = {
  idle: ["insert"],
  loaded: ["turn"],
  turning: [],
  ready: ["open"],
  opening: [],
  revealed: ["insert"],
};

test("a round runs idle, loaded, turning, ready, opening, revealed", () => {
  let m = newMachine();
  assert.deepEqual(m, at("idle"));
  m = step(m, "insert");
  assert.deepEqual(m, at("loaded"));
  m = step(m, "turn");
  assert.deepEqual(m, at("turning"));
  for (let i = 0; i < TURN_FRAMES; i++) m = step(m, "tick");
  assert.deepEqual(m, at("ready"));
  m = step(m, "open");
  assert.deepEqual(m, at("opening"));
  for (let i = 0; i < OPEN_FRAMES; i++) m = step(m, "tick");
  assert.deepEqual(m, at("revealed"));
  // insert from revealed starts the next round
  assert.deepEqual(step(m, "insert"), at("loaded"));
});

test("illegal presses are no-ops", () => {
  for (const phase of Object.keys(LEGAL) as Phase[]) {
    const m = at(phase, phase === "turning" || phase === "opening" ? 3 : 0);
    for (const press of PRESSES) {
      if (!LEGAL[phase].includes(press)) assert.equal(step(m, press), m, `${press} in ${phase}`);
    }
  }
});

test("settle finishes turning and opening, and does nothing at rest", () => {
  assert.deepEqual(step(at("turning", 0), "settle"), at("ready"));
  assert.deepEqual(step(at("turning", 7), "settle"), at("ready"));
  assert.deepEqual(step(at("opening", 0), "settle"), at("revealed"));
  for (const phase of ["idle", "loaded", "ready", "revealed"] as Phase[]) {
    const m = at(phase);
    assert.equal(step(m, "settle"), m);
  }
});

test("frames only advance on tick", () => {
  let m = step(at("loaded"), "turn");
  for (const press of PRESSES) m = step(m, press);
  assert.deepEqual(m, at("turning", 0));
  for (let i = 1; i < TURN_FRAMES; i++) {
    m = step(m, "tick");
    assert.deepEqual(m, at("turning", i));
  }
  assert.deepEqual(step(m, "tick"), at("ready"));
  for (const phase of ["idle", "loaded", "ready", "revealed"] as Phase[]) {
    const rest = at(phase);
    assert.equal(step(rest, "tick"), rest);
  }
});
