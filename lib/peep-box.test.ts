import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boundEye,
  projectLayer,
  orientationPose,
  smoothAxis,
  PoseSession,
  NEUTRAL,
  type PoseSource,
} from "./peep-box.ts";

test("analytic fixed-window ray intersections, neutral and mirrored displaced eyes", () => {
  // World point (100,50), relative to the centre, at depth 300: t=600/900.
  for (const [x, y] of [
    [0, 0],
    [120, 0],
    [-120, 0],
    [0, 90],
    [0, -90],
  ]) {
    const p = projectLayer({ x, y, z: 600 }, 300);
    assert.ok(
      Math.abs(400 * p.scale + p.x - (300 + (100 * 2) / 3 + x / 3)) < 1e-9,
    );
    assert.ok(
      Math.abs(230 * p.scale + p.y - (180 + (50 * 2) / 3 + y / 3)) < 1e-9,
    );
  }
  assert.ok(
    Math.abs(
      projectLayer({ x: 120, y: 0, z: 600 }, 60).x -
        projectLayer(NEUTRAL, 60).x -
        120 / 11,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      projectLayer({ x: 120, y: 0, z: 600 }, 300).x -
        projectLayer(NEUTRAL, 300).x -
        40,
    ) < 1e-9,
  );
});

test("near plane, malformed geometry and nonfinite eye never produce invalid transforms", () => {
  assert.deepEqual(boundEye({ x: Infinity, y: NaN, z: -1 }), {
    x: 0,
    y: 0,
    z: 300,
  });
  assert.deepEqual(boundEye({ x: 999, y: -999, z: 9999 }), {
    x: 150,
    y: -100,
    z: 900,
  });
  assert.deepEqual(projectLayer(NEUTRAL, -1000), { scale: 1, x: 0, y: 0 });
  assert.deepEqual(projectLayer(NEUTRAL, NaN), { scale: 1, x: 0, y: 0 });
  assert.throws(
    () => projectLayer(NEUTRAL, 60, { width: NaN, height: 360, viewer: 600 }),
    RangeError,
  );
  assert.throws(
    () => projectLayer(NEUTRAL, 60, { width: 600, height: 360, viewer: 0 }),
    RangeError,
  );
  for (const p of [NEUTRAL, { x: NaN, y: Infinity, z: 0 }]) {
    for (const depth of [0, 60, 500, Infinity])
      assert.ok(Object.values(projectLayer(p, depth)).every(Number.isFinite));
  }
});

test("orientation uses calibrated deltas and screen rotation, rejecting absent sensor values", () => {
  assert.deepEqual(
    orientationPose(20, 10, 0, { beta: 20, gamma: 10 }),
    NEUTRAL,
  );
  assert.deepEqual(orientationPose(20, 30, 0, { beta: 20, gamma: 10 }), {
    x: 100,
    y: 0,
    z: 600,
  });
  const p = orientationPose(20, 30, 90, { beta: 20, gamma: 10 })!;
  assert.ok(Math.abs(p.x) < 1e-9);
  assert.equal(p.y, -100);
  assert.equal(orientationPose(null, 0, 0, { beta: 0, gamma: 0 }), null);
  assert.equal(orientationPose(NaN, 0, 0, { beta: 0, gamma: 0 }), null);
});

test("critically damped movement is bounded, settles, and clamps elapsed time", () => {
  let state = { position: 0, velocity: 0 };
  for (let i = 0; i < 240; i++) {
    state = smoothAxis(state, 150, 1 / 60);
    assert.ok(state.position >= 0 && state.position <= 150);
  }
  assert.equal(state.position, 150);
  assert.equal(state.velocity, 0);
  assert.deepEqual(
    smoothAxis({ position: 0, velocity: 0 }, 150, 100),
    smoothAxis({ position: 0, velocity: 0 }, 150, 0.05),
  );
});

test("source handoff and final stop dispose exactly once and bound future camera input", () => {
  const events: string[] = [];
  const make = (kind: PoseSource["kind"]): PoseSource => ({
    kind,
    start(emit) {
      events.push(kind);
      emit({ x: 999, y: 0, z: 600 });
      return () => {
        events.push(`stop ${kind}`);
      };
    },
  });
  const s = new PoseSession();
  const poses: unknown[] = [];
  s.select(make("pointer"), (p) => poses.push(p));
  s.select(make("camera"), (p) => poses.push(p));
  s.stop();
  s.stop();
  assert.deepEqual(events, [
    "pointer",
    "stop pointer",
    "camera",
    "stop camera",
  ]);
  assert.deepEqual(poses, [
    { x: 150, y: 0, z: 600 },
    { x: 150, y: 0, z: 600 },
  ]);
});

test("late callbacks from a relinquished pose source cannot move the next source", () => {
  const s = new PoseSession();
  const poses: unknown[] = [];
  let late = (pose: typeof NEUTRAL) => {
    void pose;
  };
  s.select(
    {
      kind: "camera",
      start(emit) {
        late = emit;
        return () => {};
      },
    },
    (p) => poses.push(p),
  );
  s.stop();
  late(NEUTRAL);
  assert.deepEqual(poses, []);
});
