// Standalone verifier for the pure Pipeline Pachinko 2D Verlet physics engine,
// 5 pipeline stages (ingest, dedupe, join funnel, 6-bucket partition splitter,
// DLQ gutter), live throughput readouts, and 3-streak on-call pager trigger.
import assert from "node:assert/strict";
import {
  BUCKET_TOP_Y,
  createPachinkoSim,
  DEDUPE_GATE_Y,
  DEFAULT_BALL_RADIUS,
  dismissPager,
  FIXED_DT,
  FUNNEL_CENTER_X,
  FUNNEL_HOLD_Y,
  getReadout,
  JOINED_BALL_RADIUS,
  keyForPartitionBucket,
  launchBall,
  MAX_ACTIVE_BALLS,
  PARTITION_BUCKET_IDS,
  scheduleBackfill,
  stepPachinko,
  triggerDlqStreakFixture,
} from "../lib/pachinko/sim.ts";

assert.equal(FIXED_DT, 1 / 120, "Fixed Verlet timestep must be 1/120 s");

// 1. Verify seeded determinism across 10 seeds
for (let seed = 1; seed <= 10; seed++) {
  const sim1 = createPachinkoSim({ seed });
  const sim2 = createPachinkoSim({ seed });

  scheduleBackfill(sim1, { count: 18, durationSeconds: 0.9 });
  scheduleBackfill(sim2, { count: 18, durationSeconds: 0.9 });

  stepPachinko(sim1, 600);
  stepPachinko(sim2, 600);

  assert.deepEqual(
    getReadout(sim1),
    getReadout(sim2),
    `Seed ${seed} must produce identical readouts and bucket counts`,
  );
  assert.deepEqual(
    sim1.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
    sim2.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
    `Seed ${seed} must produce identical ball trajectories`,
  );
}

// 2. Verify dedupe 'DUP' upward bounce and stamp
{
  const sim = createPachinkoSim({ seed: 1001 });
  launchBall(sim, {
    key: "dup-check-key",
    x: 242,
    y: DEDUPE_GATE_Y - 8,
    vx: 0,
    vy: 190,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  stepPachinko(sim, 10);
  assert.equal(sim.dedupeBounceCount, 0);

  const dupBall = launchBall(sim, {
    key: "dup-check-key",
    x: 306,
    y: DEDUPE_GATE_Y - 6,
    vx: 0,
    vy: 190,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(dupBall);
  stepPachinko(sim, 4);
  assert.equal(dupBall.dedupeBounced, true, "Duplicate key must trigger dedupe bounce");
  assert.equal(dupBall.stamp, "DUP", "Duplicate ball must be stamped 'DUP'");
  assert.ok(dupBall.vy < 0, "Duplicate ball must bounce upward (vy < 0)");
  assert.equal(sim.dedupeBounceCount, 1);
}

// 3. Verify two-ball join merge and lone-ball timeout release
{
  const mergeSim = createPachinkoSim({ seed: 2002, joinTimeoutSeconds: 2.0 });
  const first = launchBall(mergeSim, {
    id: "first",
    key: "k-left",
    x: FUNNEL_CENTER_X - 6,
    y: FUNNEL_HOLD_Y - 14,
    vx: 0,
    vy: 160,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(first);
  first.dedupeChecked = true;
  stepPachinko(mergeSim, 10);
  assert.equal(mergeSim.joinHeldBallId, "first");

  const second = launchBall(mergeSim, {
    id: "second",
    key: "k-right",
    x: FUNNEL_CENTER_X + 6,
    y: FUNNEL_HOLD_Y - 14,
    vx: 0,
    vy: 160,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(second);
  second.dedupeChecked = true;
  stepPachinko(mergeSim, 12);

  assert.equal(mergeSim.joinMergeCount, 1, "Two balls in join funnel must merge");
  assert.equal(mergeSim.balls.length, 1);
  assert.equal(mergeSim.balls[0].joined, true);
  assert.equal(mergeSim.balls[0].radius, JOINED_BALL_RADIUS);
  assert.ok(mergeSim.balls[0].radius > DEFAULT_BALL_RADIUS);

  // Lone-ball timeout release
  const timeoutSim = createPachinkoSim({ seed: 2003, joinTimeoutSeconds: 1.0 });
  const lone = launchBall(timeoutSim, {
    id: "lone",
    key: keyForPartitionBucket("p4", 1),
    x: FUNNEL_CENTER_X,
    y: FUNNEL_HOLD_Y - 14,
    vx: 0,
    vy: 160,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(lone);
  lone.dedupeChecked = true;
  stepPachinko(timeoutSim, 10);
  assert.equal(timeoutSim.joinHeldBallId, "lone");

  stepPachinko(timeoutSim, 140);
  assert.equal(timeoutSim.joinHeldBallId, null);
  assert.equal(timeoutSim.joinTimeoutReleaseCount, 1);
  assert.equal(lone.releasedByJoinTimeout, true);
  assert.equal(lone.lateArrival, true);
}

// 4. Verify 6-bucket partition distribution (p0..p5) and <= 150 active ball cap
{
  const distSim = createPachinkoSim({ seed: 3003, joinTimeoutSeconds: 0.35 });
  scheduleBackfill(distSim, { count: 60, durationSeconds: 1.5, dlqEvery: 15 });
  for (let i = 0; i < 960; i++) {
    stepPachinko(distSim, 1);
    assert.ok(distSim.balls.length <= MAX_ACTIVE_BALLS);
  }
  const readout = getReadout(distSim);
  for (const bucket of PARTITION_BUCKET_IDS) {
    assert.ok(
      readout.buckets[bucket] >= 1,
      `Partition bucket ${bucket} must receive at least 1 record`,
    );
  }
}

// 5. Verify 2 consecutive DLQ + 1 normal bucket resets streak (negative control)
//    and 3 consecutive DLQ hits triggers pagerActive = true
{
  const dlqSim = createPachinkoSim({ seed: 4004 });
  triggerDlqStreakFixture(dlqSim, 2);
  stepPachinko(dlqSim, 300);
  assert.equal(dlqSim.dlqCount, 2);
  assert.equal(dlqSim.dlqStreak, 2);
  assert.equal(dlqSim.pagerActive, false);

  const normal = launchBall(dlqSim, {
    key: keyForPartitionBucket("p1", 1),
    x: dlqSim.board.bucketById.p1.centerX,
    y: BUCKET_TOP_Y - 20,
    vx: 0,
    vy: 200,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(normal);
  normal.dedupeChecked = true;
  normal.joinProcessed = true;
  stepPachinko(dlqSim, 30);

  assert.equal(dlqSim.buckets.p1, 1);
  assert.equal(dlqSim.dlqStreak, 0, "Normal bucket landing must reset DLQ streak");
  assert.equal(dlqSim.pagerActive, false, "2 DLQ + 1 normal must not trigger pager");

  triggerDlqStreakFixture(dlqSim, 3);
  stepPachinko(dlqSim, 300);
  assert.equal(dlqSim.dlqCount, 5);
  assert.equal(dlqSim.dlqStreak, 3);
  assert.equal(dlqSim.pagerActive, true, "3 consecutive DLQ hits must trigger pagerActive");

  dismissPager(dlqSim);
  assert.equal(dlqSim.pagerActive, false);
  assert.equal(dlqSim.dlqStreak, 0);
}

console.log(
  "ok - Pipeline Pachinko Verlet engine, 5 pipeline stages, 6-bucket partition distribution, and 3-DLQ pager verified.",
);
