# Task 5 (`t-1687`) Execution Evidence — Drain Pipeline Pachinko Backfill & Fit Booth Hanko Date Inside Stamp Ring

## 1. Run & Build Identity

- **Plan ID**: `pm-294` ("Ink Booth & Pipeline Pachinko", revision 2)
- **Task ID**: `t-1687` ("Drain Pipeline Pachinko Backfill and fit Booth hanko date inside stamp ring")
- **Run ID**: `run-9322`
- **Role / Model / Effort**: `software_engineer` / `Gemini 4 Argon` / `High`
- **Node Runtime**: `v22.23.3` (darwin, locked `package-lock.json` SHA-256 `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`)
- **Evidence Classification**:
  - **Integration deployed**: Yes — updated `lib/pachinko/sim.ts`, `lib/pachinko/pachinko.test.ts`, `scripts/verify-pachinko-sim.mjs`, `lib/booth/strip.ts`, `lib/booth/booth.test.ts`, and `scripts/verify-booth-engine.mjs`.
  - **Waiting for capacity**: None (`0` deferred checks).
  - **Execution demonstrated**: Yes — `16 / 16` combined unit tests in `lib/pachinko/pachinko.test.ts` (`9 / 9`) and `lib/booth/booth.test.ts` (`7 / 7`), standalone verifiers `scripts/verify-pachinko-sim.mjs` and `scripts/verify-booth-engine.mjs`, full repository unit suite (`npm test`), `npm run typecheck`, and `npm run lint` all exited `0`.
  - **Product delivered**: Yes — every 60-record `scheduleBackfill` drains completely to `activeBalls === 0` and `scheduledSpawns.length === 0` in `962..1040` steps (`<= 1800` steps) across all 6 required seeds (`0x50414348`, `777`, `424242`, `20261028`, `99`, and `42`) and across consecutive backfills while conserving all 60 records (`totalCompleted + joinMergeCount === 60`, `joinMergeCount > 0`, `dedupeBounceCount > 0`), and the hanko stamp date in `lib/booth/strip.ts` renders strictly inside `d <= hanko.radius * 0.72` (`max d = 28.30px <= 40.32px`) with `0` pixels in the ring gap (`0.74 < d/R < 0.84`) or outside the stamp (`d > R`).

---

## 2. Executable & Artifact Fingerprints (SHA-256)

| File | SHA-256 |
| --- | --- |
| `lib/pachinko/sim.ts` | `a757f580ba3055b84cda407fe096e420f3df6b30fdd421102aabd8a341e4ab1a` |
| `lib/pachinko/pachinko.test.ts` | `25e9803f73b450d5a2f415451af427bff7061c97b4cfaf0d3ed0d474d2a96aaa` |
| `scripts/verify-pachinko-sim.mjs` | `b32720c19d0e3f64be12b5801ed7ad500397c3ed6089d130157e8732633e0123` |
| `lib/booth/strip.ts` | `c12e0796f1bbe8edf64017efd3a16911936a1be366cbf0f8e180f76d7e3dc30c` |
| `lib/booth/booth.test.ts` | `020d18f998424f00d627a935048998b870eb69826d354413da5ca7459417800c` |
| `scripts/verify-booth-engine.mjs` | `e56319c7d40552afb6c5ce99168217ac7ccabd1ae4bb804fc6713e10907631cb` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |

---

## 3. Technical Remediation & Verification Metrics

### 3.1 Pipeline Pachinko Join-Funnel Geometry & Deterministic Drain (`lib/pachinko/sim.ts`)

1. **Funnel Wall Alignment & Join Peg Clearance (`createPachinkoBoard`)**:
   - Updated `funnel-left` to `(156, 355) -> (282, 438)` (`FUNNEL_CENTER_X - 150` to `FUNNEL_CENTER_X - 24`) and `funnel-right` to `(456, 355) -> (330, 438)` (`FUNNEL_CENTER_X + 150` to `FUNNEL_CENTER_X + 24`), matching the visual funnel walls.
   - Repositioned `join-p0..p3` to `[[242, 356], [370, 356], [280, 380], [332, 380]]`.
   - Measured peg-to-funnel-segment clearances:
     - `join-p0 (242, 356)` to `funnel-left`: center distance `46.47px`, surface clearance `40.97px` (`>= 36px`).
     - `join-p1 (370, 356)` to `funnel-right`: center distance `46.47px`, surface clearance `40.97px` (`>= 36px`).
     - `join-p2 (280, 380)` to `funnel-left`: center distance `47.34px`, surface clearance `41.84px` (`>= 36px`).
     - `join-p3 (332, 380)` to `funnel-right`: center distance `47.34px`, surface clearance `41.84px` (`>= 36px`).
2. **Slope Guidance, Launch-Chute Protection & Bounded Stage Progression**:
   - Guided balls in the join region (`y >= DEDUPE_GATE_Y + 8..FUNNEL_EXIT_Y`, `!ball.joinProcessed`) along the funnel vector toward `(FUNNEL_CENTER_X = 306, FUNNEL_HOLD_Y = 438)` and made `seg.kind === "funnel"` collisions project balls inward and slide tangentially (`vt >= 145 px/s`) down to the funnel mouth.
   - Prevented launch-lane ball-ball rear-ending in `resolveSpatialHashBallCollisions` (`stage === "launch"` excluded alongside `heldInJoin`) and added a plunger floor (`y <= 225`) plus bounded stage-progression guarantees across `launch` (`> 0.65s`), `dedupe` (`> 2.8s`), `join` (`> 4.2s` or `y > FUNNEL_HOLD_Y + 6`), and `partition` (`> 6.5s`).
3. **Six-Seed & Consecutive 60-Record Backfill Drain Table**:

| Seed | Backfill #1 Drain Steps (`<= 1800`) | Active Balls #1 | Completed #1 | Join Merges #1 | Dedupe Bounces #1 | Backfill #2 Drain Steps (`<= 1800`) | Active Balls #2 | Completed #2 | Join Merges #2 | Dedupe Bounces #2 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0x50414348` (`1346454344`) | `1040` | `0` | `33` | `27` | `3` | `1007` | `0` | `66` | `54` | `6` |
| `777` | `1012` | `0` | `33` | `27` | `4` | `1026` | `0` | `66` | `54` | `8` |
| `424242` | `1005` | `0` | `33` | `27` | `2` | `999` | `0` | `66` | `54` | `7` |
| `20261028` | `962` | `0` | `33` | `27` | `5` | `1009` | `0` | `66` | `54` | `8` |
| `99` | `1009` | `0` | `33` | `27` | `3` | `1000` | `0` | `66` | `54` | `6` |
| `42` | `1001` | `0` | `33` | `27` | `4` | `1007` | `0` | `66` | `54` | `9` |

### 3.2 Ink Purikura Booth Hanko Date Stamp Containment (`lib/booth/strip.ts`)

- Stacked `hanko.dateText` (`YYYY.MM.DD`) into two centered rows (`YYYY` at `cy - 8 * dateScale` and `MM.DD` at `cy + 1 * dateScale` with compact dot advance) inside `composeStripBuffer`, with horizontal divider bars at `dy = ±0.38 * hR` (`d <= 0.66 * hR`), inner ring at `0.70..0.74 * hR`, and outer ring at `0.85..1.00 * hR`.
- Verified at full `600x1800` strip resolution (`hanko.cx = 476`, `hanko.cy = 1646`, `hanko.radius = 56`, inner bound `0.72 * 56 = 40.32px`):
  - Maximum radial distance of any date-glyph pixel from `(hanko.cx, hanko.cy)`: `28.30px <= 40.32px`.
  - Red hanko pixels in the ring gap (`hanko.radius * 0.74 < d < hanko.radius * 0.84`): `0`.
  - Red hanko pixels outside the stamp (`d > hanko.radius`): `0`.

---

## 4. Real/Fake Boundaries, History Completeness & Negative Controls

- **Real Boundaries**:
  - Real `node` (`v22.23.3`) executing real TypeScript modules (`lib/pachinko/sim.ts`, `lib/booth/strip.ts`, `lib/booth/film-stock.ts`, `lib/booth/sample-portrait.ts`, `lib/booth/camera.ts`, `lib/sound.ts`) in the locked repository environment.
- **Fake Boundaries**:
  - Mock WebGL2 / `getUserMedia` / `AudioContext` harnesses used only in unit tests for WebGL context-loss fallback, camera permission denial fallback, and muted audio negative control; all physics integration and strip pixel composition run against real buffers.
- **History Completeness**:
  - Task `t-1687` run `run-9322` is the first execution attempt for this remediation task (`0` prior failed or completed runs on `t-1687`); prior plan revision 1 simulation tasks (`t-1683`, `t-1685`) completed cleanly and Acceptance Cycle 0 (`rep-5511`) identified the Backfill jam and hanko date overflow remediated here.
- **Negative Controls Exercised**:
  1. **2 consecutive DLQ hits + 1 normal bucket reset**: Verified in `lib/pachinko/pachinko.test.ts` and `scripts/verify-pachinko-sim.mjs` that 2 consecutive DLQ landings followed by a normal bucket landing reset `dlqStreak` to `0` with `pagerActive === false`.
  2. **Dedupe sliding window eviction**: Verified that duplicate keys bounce (`stamp = "DUP"`, `vy < 0`) while keys evicted after `dedupeWindowSize` distinct keys pass without bouncing.
  3. **Hanko ring-gap (`0.74 < d/R < 0.84`) and exterior (`d > R`) pixel exclusion**: Verified that `0` red hanko pixels appear in the ring gap or outside `hanko.radius`, while inner date rows (`YYYY` and `MM.DD`) and outer ring (`0.85 <= d/R <= 1.00`) contain non-zero vermilion pixels.
  4. **Muted shutter cue negative control**: Verified in `scripts/verify-booth-engine.mjs` that `play("shutter")` with `setSound(false)` creates `0` `AudioContext` instances.

---

## 5. Verification Commands & Results

1. `pachinko-and-booth-engine-tests`:
   - Command: `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/pachinko/pachinko.test.ts lib/booth/booth.test.ts && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-pachinko-sim.mjs && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-booth-engine.mjs`
   - Result: `16 / 16` unit tests passed (`0` failed), both standalone verifiers printed `ok`, exit `0`.
2. `repo-checks`:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`
   - Result: `2614 / 2614` repository unit tests passed (`0` failed), `next typegen && tsc --noEmit` exited `0`, and `eslint` exited `0` (`0` errors).

---

## 6. Deferred Checks

- None (`0` deferred checks).
