import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DB } from "../sound.ts";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BUCKET_TOP_Y,
  createPachinkoBoard,
  createPachinkoSim,
  createPegClickLimiter,
  DEDUPE_GATE_Y,
  DEFAULT_BACKFILL_COUNT,
  DEFAULT_BALL_RADIUS,
  dismissPager,
  DLQ_GUTTER_CENTER_X,
  FIXED_DT,
  formatAriaLiveSummary,
  FUNNEL_CENTER_X,
  FUNNEL_HOLD_Y,
  getReadout,
  hashKeyToPartition,
  hashRecordKey,
  JOINED_BALL_RADIUS,
  keyForPartitionBucket,
  launchBall,
  mapGammaToTiltAccel,
  mapPlungerLaunchVelocity,
  MAX_ACTIVE_BALLS,
  mulberry32,
  nudgeBalls,
  PACHINKO_CLICK_CUE,
  PARTITION_BUCKET_IDS,
  REDUCED_MOTION_BACKFILL_COUNT,
  scheduleBackfill,
  setTiltAcceleration,
  setTiltFromGamma,
  stepPachinko,
  triggerDlqStreakFixture,
} from "./sim.ts";

test("mulberry32 PRNG and seeded simulation runs are strictly deterministic across identical seeds", () => {
  const rngA = mulberry32(424242);
  const rngB = mulberry32(424242);
  const rngC = mulberry32(999999);

  const seqA = Array.from({ length: 16 }, () => rngA());
  const seqB = Array.from({ length: 16 }, () => rngB());
  const seqC = Array.from({ length: 16 }, () => rngC());

  assert.deepEqual(seqA, seqB, "Identical seeds must yield identical PRNG sequence");
  assert.notDeepEqual(seqA, seqC, "Different seeds must yield distinct PRNG sequences");

  const simA = createPachinkoSim({ seed: 20261028 });
  const simB = createPachinkoSim({ seed: 20261028 });

  assert.equal(simA.config.dt, FIXED_DT);
  assert.equal(FIXED_DT, 1 / 120);

  scheduleBackfill(simA, { count: 24, durationSeconds: 1.0 });
  scheduleBackfill(simB, { count: 24, durationSeconds: 1.0 });

  for (let frame = 0; frame < 480; frame++) {
    stepPachinko(simA, 2);
    stepPachinko(simB, 2);

    assert.equal(simA.simTime, simB.simTime);
    assert.equal(simA.balls.length, simB.balls.length);
    for (let i = 0; i < simA.balls.length; i++) {
      assert.equal(simA.balls[i]!.x, simB.balls[i]!.x);
      assert.equal(simA.balls[i]!.y, simB.balls[i]!.y);
      assert.equal(simA.balls[i]!.vx, simB.balls[i]!.vx);
      assert.equal(simA.balls[i]!.vy, simB.balls[i]!.vy);
      assert.equal(simA.balls[i]!.stage, simB.balls[i]!.stage);
    }
  }

  const readoutA = getReadout(simA);
  const readoutB = getReadout(simB);
  assert.deepEqual(readoutA, readoutB);
  assert.ok(readoutA.totalCompleted > 0, "Expected records to complete in 8 seconds of sim time");
});

test("Verlet integration enforces velocity clamping, active ball cap (<= 150), spatial-hash ball collisions, and peg/segment restitution", () => {
  const board = createPachinkoBoard();
  assert.equal(board.width, BOARD_WIDTH);
  assert.equal(board.height, BOARD_HEIGHT);
  assert.ok(board.pegs.some((p) => p.stage === "ingest"));
  assert.ok(board.pegs.some((p) => p.stage === "dedupe"));
  assert.ok(board.pegs.some((p) => p.stage === "join"));
  assert.ok(board.pegs.some((p) => p.stage === "partition"));
  assert.ok(board.pegs.some((p) => p.stage === "dlq"));
  assert.equal(board.buckets.length, 7);

  // 1. Velocity clamping
  const sim = createPachinkoSim({ seed: 7 });
  const fastBall = launchBall(sim, {
    x: 260,
    y: 120,
    vx: 4000,
    vy: 4000,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(fastBall);
  assert.ok(
    Math.hypot(fastBall.vx, fastBall.vy) <= sim.config.maxSpeed + 1e-6,
    "Initial speed must be clamped to maxSpeed",
  );
  stepPachinko(sim, 10);
  assert.ok(
    Math.hypot(fastBall.vx, fastBall.vy) <= sim.config.maxSpeed + 1e-6,
    "Stepped speed must stay clamped to maxSpeed",
  );

  // 2. Spatial-hash ball-ball collision impulse
  const collisionSim = createPachinkoSim({ seed: 11, gravity: 0 });
  const ballLeft = launchBall(collisionSim, {
    id: "left",
    x: 240,
    y: 166,
    vx: 220,
    vy: 0,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  const ballRight = launchBall(collisionSim, {
    id: "right",
    x: 254,
    y: 166,
    vx: -220,
    vy: 0,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(ballLeft && ballRight);
  stepPachinko(collisionSim, 2);
  assert.ok(ballLeft.vx < 0, `Expected left ball to rebound leftward, got vx=${ballLeft.vx}`);
  assert.ok(ballRight.vx > 0, `Expected right ball to rebound rightward, got vx=${ballRight.vx}`);

  // 3. Circle-vs-peg collision
  const pegSim = createPachinkoSim({ seed: 19 });
  const firstIngestPeg = pegSim.board.pegs.find((p) => p.stage === "ingest")!;
  const pegBall = launchBall(pegSim, {
    x: firstIngestPeg.x,
    y: firstIngestPeg.y - firstIngestPeg.radius - DEFAULT_BALL_RADIUS - 1,
    vx: 0,
    vy: 240,
    routeToDlq: false,
    skipLaunchLane: true,
  });
  assert.ok(pegBall);
  stepPachinko(pegSim, 4);
  assert.ok(pegBall.pegHits >= 1, "Ball dropped directly onto an ingest peg must register a peg collision");

  // 4. Hard cap of <= 150 active balls
  const capSim = createPachinkoSim({ seed: 23 });
  for (let i = 0; i < 210; i++) {
    launchBall(capSim, { routeToDlq: false });
    assert.ok(
      capSim.balls.length <= MAX_ACTIVE_BALLS,
      `Active balls (${capSim.balls.length}) must never exceed MAX_ACTIVE_BALLS (${MAX_ACTIVE_BALLS})`,
    );
  }
  assert.equal(capSim.balls.length, MAX_ACTIVE_BALLS);
  assert.equal(capSim.scheduledSpawns.length, 60);
  stepPachinko(capSim, 60);
  assert.ok(capSim.balls.length <= MAX_ACTIVE_BALLS);
});

test("plunger launch velocity mapping, launch lane traversal, and horizontal tilt/nudge controls work deterministically", () => {
  const low = mapPlungerLaunchVelocity(0, 0.5);
  const high = mapPlungerLaunchVelocity(1, 0.5);
  assert.equal(low.clampedPower, 0);
  assert.equal(high.clampedPower, 1);
  assert.ok(high.vy < low.vy, "Higher plunger power must produce stronger upward launch velocity");

  const sim = createPachinkoSim({ seed: 101 });
  const launched = launchBall(sim, { power: 0.85, routeToDlq: false });
  assert.ok(launched);
  assert.equal(launched.stage, "launch");

  // Step until the ball climbs the plunger lane and deflects into the ingest stage
  let enteredIngest = false;
  for (let i = 0; i < 120; i++) {
    stepPachinko(sim, 1);
    if (launched.stage !== "launch" && launched.enteredBoardAt !== null) {
      enteredIngest = true;
      break;
    }
  }
  assert.ok(enteredIngest, "Plunger-launched ball must curve off the top ramp into the ingest stage");

  // Verify tilt and nudge acceleration
  const accelRight = setTiltFromGamma(sim, 25);
  assert.ok(accelRight > 0);
  assert.equal(sim.tiltAccel, mapGammaToTiltAccel(25));

  setTiltAcceleration(sim, -150);
  assert.equal(sim.tiltAccel, -150);

  const vxBefore = launched.vx;
  const nudgedCount = nudgeBalls(sim, "right", 95);
  assert.equal(nudgedCount, 1);
  assert.ok(launched.vx > vxBefore, "Right nudge must increase playfield ball horizontal velocity");
});

test("dedupe filter gate detects duplicate record keys within the recent window, bounces them upward, and stamps 'DUP'", () => {
  const sim = createPachinkoSim({ seed: 303, dedupeWindowSize: 4 });

  // First record with key 'order-dup-1' crosses the dedupe gate cleanly
  const first = launchBall(sim, {
    key: "order-dup-1",
    x: 242,
    y: DEDUPE_GATE_Y - 10,
    vx: 0,
    vy: 180,
    routeToDlq: false,
    skipLaunchLane: true,
  })!;
  stepPachinko(sim, 12);
  assert.equal(first.dedupeChecked, true);
  assert.equal(first.dedupeBounced, false);
  assert.notEqual(first.stamp, "DUP");
  assert.ok(sim.recentKeys.includes("order-dup-1"));
  assert.equal(sim.dedupeBounceCount, 0);

  // Second record with duplicate key 'order-dup-1' hits the dedupe gate and bounces upward with 'DUP' stamp
  const duplicate = launchBall(sim, {
    key: "order-dup-1",
    x: 306,
    y: DEDUPE_GATE_Y - 6,
    vx: 0,
    vy: 190,
    routeToDlq: false,
    skipLaunchLane: true,
  })!;

  let sawBounceEvent = false;
  for (let i = 0; i < 12; i++) {
    stepPachinko(sim, 1);
    if (sim.events.some((e) => e.type === "dedupe-bounce" && e.ballId === duplicate.id)) {
      sawBounceEvent = true;
      break;
    }
  }

  assert.equal(sawBounceEvent, true, "Duplicate key must emit a dedupe-bounce event");
  assert.equal(duplicate.dedupeBounced, true);
  assert.equal(duplicate.stamp, "DUP");
  assert.ok(duplicate.vy < 0, `Duplicate ball must bounce upward (vy < 0), got vy=${duplicate.vy}`);
  assert.ok(duplicate.y < DEDUPE_GATE_Y, "Bounced duplicate ball must be positioned above the dedupe gate");
  assert.equal(sim.dedupeBounceCount, 1);

  // Push 4 distinct keys through the dedupe gate so 'order-dup-1' ages out of the 4-key window
  for (let k = 1; k <= 4; k++) {
    launchBall(sim, {
      key: `unique-key-${k}`,
      x: 180 + k * 30,
      y: DEDUPE_GATE_Y - 6,
      vx: 0,
      vy: 200,
      routeToDlq: false,
      skipLaunchLane: true,
    });
    stepPachinko(sim, 10);
  }
  assert.equal(sim.recentKeys.includes("order-dup-1"), false);

  // Now 'order-dup-1' is no longer in the recent window and passes without bouncing
  const afterWindow = launchBall(sim, {
    key: "order-dup-1",
    x: 242,
    y: DEDUPE_GATE_Y - 6,
    vx: 0,
    vy: 200,
    routeToDlq: false,
    skipLaunchLane: true,
  })!;
  stepPachinko(sim, 10);
  assert.equal(afterWindow.dedupeChecked, true);
  assert.equal(afterWindow.dedupeBounced, false);
});

test("two-ball join funnel holds the first ball, merges when a second arrives, and releases a lone waiting ball on timeout as a late arrival", () => {
  // Part A: Two-ball join merge
  const mergeSim = createPachinkoSim({ seed: 404, joinTimeoutSeconds: 2.0 });

  const ball1 = launchBall(mergeSim, {
    id: "join-a",
    key: "stream-left",
    x: FUNNEL_CENTER_X - 10,
    y: FUNNEL_HOLD_Y - 18,
    vx: 0,
    vy: 160,
    routeToDlq: false,
    skipLaunchLane: true,
  })!;
  ball1.dedupeChecked = true;

  // Step until ball1 is captured and held in the join funnel
  for (let i = 0; i < 20; i++) {
    stepPachinko(mergeSim, 1);
    if (mergeSim.joinHeldBallId === ball1.id) break;
  }
  assert.equal(mergeSim.joinHeldBallId, ball1.id, "First ball must be held in the join funnel");
  assert.equal(ball1.heldInJoin, true);

  // Launch second ball into the join funnel before timeout
  const ball2 = launchBall(mergeSim, {
    id: "join-b",
    key: "stream-right",
    x: FUNNEL_CENTER_X + 8,
    y: FUNNEL_HOLD_Y - 18,
    vx: 0,
    vy: 160,
    routeToDlq: false,
    skipLaunchLane: true,
  })!;
  ball2.dedupeChecked = true;

  let mergedEvent = false;
  for (let i = 0; i < 30; i++) {
    stepPachinko(mergeSim, 1);
    if (mergeSim.events.some((e) => e.type === "join-merge")) {
      mergedEvent = true;
      break;
    }
  }

  assert.equal(mergedEvent, true, "Second ball arriving in join funnel must trigger a join-merge event");
  assert.equal(mergeSim.joinHeldBallId, null, "Join funnel slot must be cleared after merging");
  assert.equal(mergeSim.joinMergeCount, 1);
  assert.equal(mergeSim.balls.length, 1, "Two balls must merge into a single active ball");

  const mergedBall = mergeSim.balls[0]!;
  assert.equal(mergedBall.joined, true);
  assert.equal(mergedBall.radius, JOINED_BALL_RADIUS);
  assert.ok(mergedBall.radius > DEFAULT_BALL_RADIUS);
  assert.deepEqual(mergedBall.joinedFromIds, ["join-a", "join-b"]);
  assert.equal(mergedBall.key, "stream-left+stream-right");
  assert.equal(mergedBall.stamp, "JOIN");

  // Step until merged ball lands in its hashed partition bucket
  stepPachinko(mergeSim, 260);
  const expectedMergedBucket = hashKeyToPartition("stream-left+stream-right");
  assert.equal(mergeSim.buckets[expectedMergedBucket], 1);

  // Part B: Lone-ball timeout release as late arrival
  const timeoutSim = createPachinkoSim({ seed: 505, joinTimeoutSeconds: 1.2 });
  const loneBall = launchBall(timeoutSim, {
    id: "lone-ball",
    key: keyForPartitionBucket("p2", 1),
    x: FUNNEL_CENTER_X,
    y: FUNNEL_HOLD_Y - 14,
    vx: 0,
    vy: 150,
    routeToDlq: false,
    skipLaunchLane: true,
  })!;
  loneBall.dedupeChecked = true;

  for (let i = 0; i < 20; i++) {
    stepPachinko(timeoutSim, 1);
    if (timeoutSim.joinHeldBallId === loneBall.id) break;
  }
  assert.equal(timeoutSim.joinHeldBallId, loneBall.id);

  // Advance past the 1.2s join timeout (160 steps at 1/120s = 1.33s)
  let sawTimeoutRelease = false;
  for (let i = 0; i < 170; i++) {
    stepPachinko(timeoutSim, 1);
    if (timeoutSim.events.some((e) => e.type === "join-timeout-release")) {
      sawTimeoutRelease = true;
      break;
    }
  }
  assert.equal(sawTimeoutRelease, true, "Lone waiting ball must be released when joinTimeoutSeconds elapses");
  assert.equal(timeoutSim.joinHeldBallId, null);
  assert.equal(timeoutSim.joinTimeoutReleaseCount, 1);
  assert.equal(loneBall.releasedByJoinTimeout, true);
  assert.equal(loneBall.lateArrival, true);
  assert.equal(loneBall.stamp, "LATE");

  // Let lone ball settle into bucket p2 and verify late-arrival percentage is 100%
  stepPachinko(timeoutSim, 260);
  const timeoutReadout = getReadout(timeoutSim);
  assert.equal(timeoutReadout.buckets.p2, 1);
  assert.equal(timeoutReadout.lateArrivalCount, 1);
  assert.equal(timeoutReadout.lateArrivalPct, 100);
});

test("partition splitter routes keys across all 6 buckets (p0..p5) and backfill floods populate every bucket", () => {
  const sim = createPachinkoSim({ seed: 606, joinTimeoutSeconds: 0.35 });

  // Verify keyForPartitionBucket and hashKeyToPartition cover p0..p5
  for (const bucket of PARTITION_BUCKET_IDS) {
    const key = keyForPartitionBucket(bucket, 10);
    assert.equal(hashKeyToPartition(key), bucket);
  }

  // Schedule a 60-ball backfill and run to completion
  const scheduled = scheduleBackfill(sim, {
    count: DEFAULT_BACKFILL_COUNT,
    durationSeconds: 1.5,
    dlqEvery: 15,
  });
  assert.equal(scheduled, 60);

  for (let step = 0; step < 960; step++) {
    stepPachinko(sim, 1);
    assert.ok(sim.balls.length <= MAX_ACTIVE_BALLS);
  }

  const readout = getReadout(sim);
  for (const bucket of PARTITION_BUCKET_IDS) {
    assert.ok(
      readout.buckets[bucket] >= 1,
      `Expected bucket ${bucket} to receive at least 1 record, got ${readout.buckets[bucket]}`,
    );
  }
  assert.ok(readout.totalPartitionCount >= 20, "Backfill flood must deliver records into partition buckets");
  assert.ok(readout.dedupeBounceCount >= 1, "Backfill with duplicate keys must trigger dedupe 'DUP' bounces");
  assert.ok(readout.joinMergeCount >= 1, "Backfill flood must trigger two-ball join merges");

  // Also verify reduced-motion backfill schedules 12 balls
  const rmSim = createPachinkoSim({ seed: 607 });
  const rmCount = scheduleBackfill(rmSim, { reducedMotion: true });
  assert.equal(rmCount, REDUCED_MOTION_BACKFILL_COUNT);
  assert.equal(rmCount, 12);
});

test("consecutive DLQ streak of 3 triggers pagerActive while 2 consecutive DLQ hits followed by a normal bucket reset the streak without triggering", () => {
  const sim = createPachinkoSim({ seed: 707 });

  // 1. Negative control: 2 consecutive DLQ hits followed by 1 normal bucket landing
  triggerDlqStreakFixture(sim, 2);
  stepPachinko(sim, 300);

  assert.equal(sim.dlqCount, 2);
  assert.equal(sim.dlqStreak, 2);
  assert.equal(sim.pagerActive, false, "2 consecutive DLQ hits must NOT trigger pagerActive");
  assert.equal(sim.pagerTriggerCount, 0);

  // Now land a normal record in partition bucket p0
  const normalBall = launchBall(sim, {
    key: keyForPartitionBucket("p0", 1),
    x: sim.board.bucketById.p0.centerX,
    y: BUCKET_TOP_Y - 25,
    vx: 0,
    vy: 200,
    routeToDlq: false,
    skipLaunchLane: true,
  })!;
  normalBall.dedupeChecked = true;
  normalBall.joinProcessed = true;
  stepPachinko(sim, 30);

  assert.equal(sim.buckets.p0, 1);
  assert.equal(sim.dlqCount, 2);
  assert.equal(sim.dlqStreak, 0, "Normal partition bucket landing must reset dlqStreak to 0");
  assert.equal(sim.pagerActive, false, "pagerActive must remain false after streak reset");
  assert.equal(sim.pagerTriggerCount, 0);

  // 2. Positive trigger: 3 consecutive DLQ hits trigger pagerActive = true
  const spawned = triggerDlqStreakFixture(sim, 3);
  assert.equal(spawned.length, 3);
  assert.equal(spawned[0]!.x, DLQ_GUTTER_CENTER_X);
  assert.equal(spawned[0]!.stage, "dlq");

  stepPachinko(sim, 300);
  const readoutActive = getReadout(sim);
  assert.equal(readoutActive.dlqCount, 5);
  assert.equal(readoutActive.dlqStreak, 3);
  assert.equal(readoutActive.pagerActive, true, "3 consecutive DLQ hits must set pagerActive = true");
  assert.equal(readoutActive.pagerTriggerCount, 1);
  assert.match(formatAriaLiveSummary(readoutActive), /On-call pager alert active/);

  // 3. Dismissing pager resets pagerActive and dlqStreak
  dismissPager(sim);
  const readoutDismissed = getReadout(sim);
  assert.equal(readoutDismissed.pagerActive, false);
  assert.equal(readoutDismissed.dlqStreak, 0);
  assert.equal(readoutDismissed.dlqCount, 5);
});

test("rolling 5-second throughput (records/sec), late-arrival %, sound cue cap, and peg click rate limiter obey invariants", () => {
  const sim = createPachinkoSim({
    seed: 808,
    lateTransitThresholdSeconds: 2.5,
  });

  // Complete 10 records quickly near t ~ 0.1s (2 marked late)
  for (let i = 0; i < 10; i++) {
    const bucket = PARTITION_BUCKET_IDS[i % PARTITION_BUCKET_IDS.length]!;
    const b = launchBall(sim, {
      key: keyForPartitionBucket(bucket, i + 1),
      x: sim.board.bucketById[bucket].centerX,
      y: BUCKET_TOP_Y - 12,
      vx: 0,
      vy: 240,
      routeToDlq: false,
      lateArrival: i < 2,
      skipLaunchLane: true,
    })!;
    b.dedupeChecked = true;
    b.joinProcessed = true;
  }

  stepPachinko(sim, 20);
  const activeReadout = getReadout(sim);
  assert.equal(activeReadout.totalCompleted, 10);
  assert.equal(activeReadout.recordsPerSec, 2, "10 records in rolling 5s window must equal 2.0 records/sec");
  assert.equal(activeReadout.lateArrivalCount, 2);
  assert.equal(activeReadout.lateArrivalPct, 20);

  // Advance > 5 seconds (620 steps at 1/120s = 5.167s) with no new launches; rolling throughput must decay to 0
  stepPachinko(sim, 620);
  const idleReadout = getReadout(sim);
  assert.equal(idleReadout.recordsPerSec, 0, "Rolling 5s throughput must decay to 0 after 5s without completions");
  assert.equal(idleReadout.totalCompleted, 10);
  assert.equal(idleReadout.lateArrivalPct, 20);

  // Verify sound cue and rate limiter
  assert.ok(PACHINKO_CLICK_CUE.db <= MAX_DB, "Pachinko click cue must not exceed -18 dB");
  assert.ok(hashRecordKey("pachinko") > 0);

  const allowClick = createPegClickLimiter(20);
  let allowedInOneSecond = 0;
  for (let ms = 0; ms < 1000; ms += 5) {
    if (allowClick(ms / 1000)) {
      allowedInOneSecond += 1;
    }
  }
  assert.ok(
    allowedInOneSecond <= 20,
    `Rate limiter must allow at most 20 clicks/sec, got ${allowedInOneSecond}`,
  );
});
