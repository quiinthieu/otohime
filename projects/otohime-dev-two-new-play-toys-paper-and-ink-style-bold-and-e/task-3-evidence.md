# Task 3 (`t-1685`) Execution Evidence — Pipeline Pachinko Deterministic Verlet Engine & Stage Rules

## 1. Run & Build Identity

- **Plan ID**: `pm-294` ("Ink Booth & Pipeline Pachinko", revision 1)
- **Task ID**: `t-1685` ("Pipeline Pachinko deterministic Verlet engine and stage rules")
- **Run ID**: `run-9287`
- **Role / Profile / Model / Effort**: `software_engineer` / `agy-argon-high` / `gemini-4-argon` / `high`
- **Node Runtime**: `v22.23.3` (linux x64, locked `package-lock.json` SHA-256 `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`)
- **Evidence Classification**:
  - **Integration deployed**: Yes — pure TypeScript simulation engine in `lib/pachinko/sim.ts`, unit suite in `lib/pachinko/pachinko.test.ts`, and standalone verifier in `scripts/verify-pachinko-sim.mjs` wired into `npm test`, `npm run typecheck`, and `npm run lint`.
  - **Waiting for capacity**: None (`0` deferred checks).
  - **Execution demonstrated**: Yes — `8 / 8` unit tests in `lib/pachinko/pachinko.test.ts`, standalone verifier `scripts/verify-pachinko-sim.mjs` across `10` seeded runs, full repository unit suite (`2598 / 2598` passing tests), `npm run typecheck`, and `npm run lint` all exited `0`.
  - **Product delivered**: Yes — deterministic 2D Verlet physics engine (`FIXED_DT = 1/120 s` with `3` substeps) modeling all 5 pipeline stages (`ingest`, `dedupe`, `join`, `partition` `p0..p5`, and `dlq`), rolling 5 s `recordsPerSec`, `lateArrivalPct`, `dlqCount`, and 3-streak `pagerActive` trigger.

---

## 2. Executable & Artifact Fingerprints (SHA-256)

| File | SHA-256 |
| --- | --- |
| `lib/pachinko/sim.ts` | `e20b7fb544b22d07a5bd1f3b8a89e35bd9af5d7c9788325d6a73221f8f52fd96` |
| `lib/pachinko/pachinko.test.ts` | `0a38dc200a6f19bf8a7f7bc987b9115ddbb793c3fcafc901a03374ab94f33b2a` |
| `scripts/verify-pachinko-sim.mjs` | `580c8bcbfe755f41e75ceb0ab6ace05b23425c30dd1818d4b63a6ba58729fc5d` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |

---

## 3. Physics, Pipeline Stages & Readout Verification

1. **Seeded PRNG & Fixed-Timestep Verlet Integration (`lib/pachinko/sim.ts`)**:
   - Implemented `mulberry32` seeded 32-bit PRNG, `FIXED_DT = 1 / 120` s Verlet integration with `3` substeps (`subDt = 1 / 360` s), velocity clamping (`MAX_SPEED = 780` px/s), spatial-hash broadphase ball-ball collision (`SPATIAL_HASH_CELL_SIZE = 28` px) with active balls capped at `MAX_ACTIVE_BALLS = 150` (excess launches queue in `scheduledSpawns`), circle-vs-peg (`PEG_RESTITUTION = 0.54`) and circle-vs-segment (`WALL_RESTITUTION = 0.48`) restitution with co-shifted `prevX`/`prevY` overlap projection, plunger launch velocity mapping (`mapPlungerLaunchVelocity`), and horizontal tilt/nudge controls (`mapGammaToTiltAccel`, `setTiltFromGamma`, `setTiltAcceleration`, `nudgeBalls`).
2. **Five Pipeline Stages**:
   - **Stage 1 (`ingest`)**: 5-row staggered peg lattice (`37` pegs across `x = 104..508, y = 112..256`) below the plunger launch ramp.
   - **Stage 2 (`dedupe`)**: Filter gate at `DEDUPE_GATE_Y = 310` tracking a sliding window (`DEDUPE_WINDOW_SIZE = 12`) of recent record keys; duplicate keys within the window are stamped `stamp = "DUP"`, marked `dedupeBounced = true`, and bounced upward (`vy < 0`) with a `"dedupe-bounce"` event.
   - **Stage 3 (`join`)**: Two-ball join funnel (`FUNNEL_CENTER_X = 306, FUNNEL_HOLD_Y = 438`) holding the first arriving ball (`joinHeldBallId`, `"join-hold"` event) until a second arrives to emit one merged larger ball (`radius = 11.5 > 8`, `mass = 2`, `joined = true`, `stamp = "JOIN"`, combined key `${k1}+${k2}`), or releasing a lone waiting ball when `joinTimeoutSeconds` (`1.8` s default) elapses with `releasedByJoinTimeout = true`, `lateArrival = true`, `stamp = "LATE"`, and `"join-timeout-release"` event.
   - **Stage 4 (`partition`)**: 4-row splitter wedge lattice aligned with the 5 bucket dividers routing records by FNV-1a key hash (`hashKeyToPartition`) into the 6 partition buckets (`p0..p5`).
   - **Stage 5 (`dlq`)**: Left-side dead-letter queue gutter (`x = 24..76`) capturing poison-pill/routed records into the `"dlq"` sink.
3. **Live Readouts & On-Call Pager Trigger**:
   - `getReadout(state)` computes `buckets` (`p0..p5`), `totalPartitionCount`, rolling 5-second `recordsPerSec`, `lateArrivalPct` (from records exceeding `lateTransitThresholdSeconds` or released via join timeout), `dlqCount`, `dlqStreak`, and `pagerActive` (`true` when `dlqStreak >= 3`, reset with `dlqStreak = 0` via `dismissPager(state)`).
   - Exported `PACHINKO_CLICK_CUE` (`db = -22 <= MAX_DB = -18`), `createPegClickLimiter(20)`, `scheduleBackfill` (`60` default, `12` under `reducedMotion: true`), `triggerDlqStreakFixture`, and `formatAriaLiveSummary`.

---

## 4. Real/Fake Boundaries, History Completeness & Negative Controls

- **Real Boundaries**:
  - Real `node` (`v22.23.3`) executing real TypeScript modules (`lib/pachinko/sim.ts`, `lib/sound.ts`) in the locked repository environment (`node --experimental-strip-types --test`, `npm test`, `next typegen && tsc --noEmit`, `eslint`).
- **Fake Boundaries**:
  - None (pure deterministic physics and state machine; no mocks or fake runners used).
- **History Completeness**:
  - Task `t-1685` run `run-9287` is the first execution attempt for this task (`0` prior failed or completed runs on `t-1685`).
- **Negative Controls Exercised**:
  1. **2 consecutive DLQ hits + 1 normal bucket (`p0`/`p1`) reset**: Verified in both `lib/pachinko/pachinko.test.ts` and `scripts/verify-pachinko-sim.mjs` that 2 consecutive DLQ landings (`dlqStreak = 2, pagerActive = false`) followed by 1 normal partition bucket landing resets `dlqStreak` to `0` while keeping `pagerActive === false` and `pagerTriggerCount === 0`.
  2. **Distinct seeds diverge**: Verified that `mulberry32(424242)` and `mulberry32(999999)` produce distinct PRNG sequences while identical seeds (`20261028`, plus seeds `1..10` in `scripts/verify-pachinko-sim.mjs`) produce byte-identical trajectories and bucket counts.
  3. **Dedupe sliding window eviction**: Verified that after `dedupeWindowSize` distinct keys pass the gate, an earlier key is evicted from `recentKeys` and passes without triggering a `'DUP'` bounce.
  4. **Rolling 5-second throughput idle decay**: Verified that `recordsPerSec` drops from `2.0` records/sec to `0` after advancing `> 5.0` seconds of simulation time with no new completions.

---

## 5. Verification Commands & Results

1. `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/pachinko/pachinko.test.ts && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-pachinko-sim.mjs` -> `8 / 8` unit tests passed, standalone verifier printed `ok`, exit `0`.
2. `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint` -> `2598 / 2598` repository unit tests passed, `next typegen && tsc --noEmit` exit `0`, `eslint` exit `0` (`0` errors).

---

## 6. Deferred Checks

- None (`0` deferred checks).
