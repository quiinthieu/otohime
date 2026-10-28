# Task 4 Execution Evidence — Pipeline Pachinko Route, Play Discovery Teasers & E2E Verification (`pm-294` / `t-1686`)

## 1. Run & Agent Identity
- **Plan ID**: `pm-294` ("Ink Booth & Pipeline Pachinko", revision `1`)
- **Task ID**: `t-1686` (Sequence `4`: "Pipeline Pachinko route, Play page discovery teasers, and E2E verification")
- **Run ID**: `run-9300` (`role=software_engineer`)
- **Task-Manager Task ID**: `002b5eae-1c0c-49fe-879e-f7ed76fd12aa` (`worker=avietidol-mac-mini`)
- **Actual Run Profile / Model / Effort**: `agent_profile=agy-argon-high`, model `Gemini 4 Argon (High)`, `effort=high`
- **Base Commit (before run-9300 fix)**: `f50d7aa017c946540199262177a531f652a9980a` (`pm-294/t-1686: feat(pachinko): add Pipeline Pachinko route, Play page teasers, and E2E suite`)

## 2. Green Gate Failure Diagnosis (`run-9299` / `f9910a17-20e9-4e81-8448-f8840e762be2`) & Fix
- **Observed failure in `run-9299` (`f50d7aa`)**: Test 3 in `e2e/pachinko.test.ts` (`sound is muted by default (0 AudioContexts) and rate-limited (<= 20/s, <= -18 dB) when toggled on; keyboard and DeviceOrientationEvent tilt-to-nudge work`) failed at `e2e/pachinko.test.ts:432:14` (`page.waitForFunction: Timeout 15000ms exceeded` waiting for `[data-testid="pachinko-tilt-btn"]` text to include `24°`) after line 424 had already confirmed `root.getAttribute("data-tilt-status") === "active"`.
- **Root cause**: `handleToggleTilt` called `setTiltStatus("active")` inside an `async` continuation (`await DeviceOrientationEvent.requestPermission()`), and `PachinkoMachine` registered `window.addEventListener("deviceorientation", onOrientation)` inside a passive `useEffect([tiltStatus])`. In React 19, the DOM attribute `data-tilt-status="active"` commits during the render commit phase before passive `useEffect` callbacks are flushed via `MessageChannel`. While the 60-ball backfill `requestAnimationFrame` loop was running, Playwright observed `data-tilt-status="active"` immediately after DOM commit and dispatched the one-shot synthetic `deviceorientation` (`gamma = 24`) event before React flushed the passive `useEffect` that attached `window.addEventListener("deviceorientation", ...)`.
- **Fix applied in `run-9300`**:
  1. `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`: Attached the `window` `"deviceorientation"` listener, `"keydown"` listener, HiDPI canvas setup, and pager focus management in `useLayoutEffect` (synchronous commit phase) gated by a synchronous `tiltActiveRef` set before `setTiltStatus("active")`; ignored null-sensor events (`typeof e.gamma !== "number" || !Number.isFinite(e.gamma)`); read `getSound()` directly in `playRateLimitedPegClicks` instead of a passive `useEffect` ref; and initialized the simulation seed and `?fixture=dlq-streak` synchronously on first `ensureSim()` call.
  2. `e2e/pachinko.test.ts`: Awaited `data-hydrated="true"` on `[data-testid="pachinko-root"]` across tests and awaited `data-tilt-status === "active"` via `waitForFunction` before dispatching the synthetic `deviceorientation` event, asserting both `24°` button text and `data-tilt-gamma="24"`.

## 3. Execution Evidence Classification
- **Integration deployed**: Yes — `/play/pachinko` server page (`app/(site)/(app)/play/pachinko/page.tsx`), styles (`app/(site)/(app)/play/pachinko/pachinko.css`), interactive client workbench (`app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`), `/play` discovery teasers (`app/(site)/(app)/play/page.tsx`), and Chromium E2E test suite (`e2e/pachinko.test.ts`) are built and wired into the Next.js 16.4.2 production route table (`◐ /play/pachinko`, `◐ /play`, `◐ /play/booth`).
- **Waiting for capacity**: None (`0` deferred checks).
- **Execution demonstrated**: Yes — full production Next.js build (`next build`) + Chromium Playwright E2E suite (`e2e/pachinko.test.ts`, `5/5` tests passing in `18795.04 ms`) + full unit/invariant test suite (`npm test`, `2609/2609` tests passing in `34373.95 ms`) + `npm run typecheck` (`0` errors) + `npm run lint` (`0` errors) executed in the locked local environment.
- **Product delivered**: Yes — all acceptance criteria for `t-1686` verified end-to-end with zero console, page, or network errors.

## 4. Executable & Artifact Fingerprints (SHA-256)
| File | SHA-256 | Role |
| --- | --- | --- |
| `app/(site)/(app)/play/page.tsx` | `0c05b131e770beb0f8e0820dedd82f91de4fafa8f7b04b93344a4d55fbdee8c2` | `/play` index page with discovery teasers for `/play/booth` (`data-testid="play-booth-link"`) and `/play/pachinko` (`data-testid="play-pachinko-link"`) |
| `app/(site)/(app)/play/pachinko/page.tsx` | `3382097720e4e1a5a27b23a6f210380743e96faf47796296a9f05d4bfd52a2aa` | Next.js 16 App Router page wrapping `<PachinkoMachine />` in `<ViewTransition enter="page-in" exit="page-out" default="none">` |
| `app/(site)/(app)/play/pachinko/pachinko.css` | `2df59b69e06dacd4d40913200c2cede0423b310cae08908aaed964ad0e953fdc` | Ink-and-washi styles, `.rise:has(.pachinko-root)` transform suppression, responsive workbench, 6-bucket bar chart, and viewport-pinned `.pachinko-pager` |
| `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx` | `7e4ef0b44b2072c9e2d30c23873a6238be5362e1ef74681be728811d52c4eed8` | Interactive Canvas 2D + DOM Pipeline Pachinko client component wired to `lib/pachinko/sim.ts` and `lib/sound-client.ts` |
| `e2e/pachinko.test.ts` | `b841e3432dbd5e1a20bfcfee27f53db43ed0e64623620a1152b1d124cd972d72` | Real Chromium Playwright E2E verification suite (`5` end-to-end tests) |
| `lib/pachinko/sim.ts` | `e20b7fb544b22d07a5bd1f3b8a89e35bd9af5d7c9788325d6a73221f8f52fd96` | Pure deterministic 2D Verlet simulation & 5-stage pipeline state machine (Task 3 dependency) |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` | Unmodified lockfile (zero new runtime or dev dependencies added; no Matter.js) |

## 5. Real vs. Fake Boundaries
- **Real in locked environment**:
  - Next.js `16.4.2` (Turbopack) production build (`next build`) and production HTTP server (`next start`) launched by `scripts/e2e.mjs` with embedded PostgreSQL and Drizzle migrations.
  - Real headless Chromium via `playwright-core` rendering `/play`, `/play/booth`, and `/play/pachinko` at `1366x768` desktop and `390x844` mobile viewports.
  - Real HTML5 Canvas 2D rendering (`600x860` logical board scaled by `devicePixelRatio` clamped to `2`), real pointer drag-and-release gestures (`page.mouse.move/down/up`), real keyboard `Space`/`Enter`/`ArrowLeft`/`ArrowRight` events, real `lib/pachinko/sim.ts` fixed-timestep (`dt = 1/120 s`) Verlet physics and 5-stage routing, and real WebAudio synthesis via `lib/sound-client.ts` (`play("move")` at `-24 dB <= -18 dB`) gated by `createPegClickLimiter(20)`.
- **Controlled test doubles / instrumentation in E2E**:
  - `window.AudioContext` subclass wrapper in `e2e/pachinko.test.ts` (`addInitScript`) that delegates to the browser's real `AudioContext` while counting context instantiations, `createOscillator()` timestamps, and `GainNode` peak gain values (`tracker.maxGain`).
  - `window.DeviceOrientationEvent.requestPermission` mock in `e2e/pachinko.test.ts` returning `"granted"` (or `"denied"`) to exercise mobile iOS/Android orientation permission gating in headless desktop Chromium, paired with synthetic `deviceorientation` (`gamma = 24`) event dispatch.

## 6. Bounded History Inspection & Completeness
- **`plan_manager_list_runs(plan_id="pm-294")`**: `12` of `12` runs inspected (complete, not truncated):
  - `run-9278` (`research`, `claude-sonnet-medium`, `tm_task_id=7680a09d-d451-4773-abdd-2a9842838f00`): `succeeded`
  - `run-9279` (`product_owner`, `agy-argon-medium`, `tm_task_id=36f3da50-a200-40d7-a393-fef922c6281c`, `git_sha=a552b83`): `succeeded`
  - `run-9286` (`software_engineer`, `t-1683`, `agy-argon-high`, `tm_task_id=90defa41-d811-4618-8655-03522c0b5f19`, `git_sha=5fd54a7`): `succeeded`
  - `run-9289` (`verify`, `t-1683`, `tm_task_id=99cc3062-dbde-42d4-8eed-60a4746c1217`, `git_sha=5fd54a7`): `succeeded`
  - `run-9287` (`software_engineer`, `t-1685`, `agy-argon-high`, `tm_task_id=83614667-93c1-4c85-839c-4a2822424652`, `git_sha=2f40534`): `succeeded`
  - `run-9291` (`verify`, `t-1685`, `tm_task_id=afdbe3b2-f748-4d20-b350-70484218a69f`, `git_sha=2f40534`): `succeeded`
  - `run-9290` (`software_engineer`, `t-1684`, `agy-argon-high`, `tm_task_id=ef6af4ef-aebb-4723-88b0-dc1759b7a99e`, `git_sha=995279a`): `succeeded`
  - `run-9293` (`verify`, `t-1684`, `tm_task_id=742cdd08-d956-4f05-a8bd-048ad901a079`, `git_sha=995279a`): `succeeded`
  - `run-9294` (`quality_engineer`, `t-1684`, `agy-argon-medium`, `tm_task_id=56bc8d7b-4584-47d2-8c24-f66fc9d122f8`, `git_sha=b5bbad5`): `succeeded`
  - `run-9295` (`software_engineer`, `t-1686`, `agy-argon-high`, `tm_task_id=9bef85b6-7611-40c2-97d6-660947049d38`, `git_sha=f50d7aa`): `succeeded`
  - `run-9299` (`verify`, `t-1686`, `tm_task_id=f9910a17-20e9-4e81-8448-f8840e762be2`, `git_sha=f50d7aa`): `verify-runner` completed (`callbackState="delivered"`), item `pachinko and booth browser e2e` failed at `e2e/pachinko.test.ts:432:14` (raw runner log inspected via `task_manager_get_task_logs(task_id="f9910a17-20e9-4e81-8448-f8840e762be2")`, `49` lines complete).
  - `run-9300` (`software_engineer`, `t-1686`, `agy-argon-high`, `tm_task_id=002b5eae-1c0c-49fe-879e-f7ed76fd12aa`): `running`
- **`task_manager_list_tasks` bounded pagination (`limit=10, offset=0`)**:
  - `RUNNING`: `10` tasks inspected (including `002b5eae-1c0c-49fe-879e-f7ed76fd12aa` for `run-9300`).
  - `COMPLETED`: `10` recent tasks inspected (`f9910a17-20e9-4e81-8448-f8840e762be2` verify run `run-9299`, `callbackState="delivered"`, `callbackAttempts=1`).
  - `FAILED`: `10` recent tasks inspected (`0` belong to `pm-294` / `otohime`).

## 7. Verification & Negative Controls Exercised
1. **E2E Suite (`scripts/e2e.mjs --test 'e2e/pachinko.test.ts'`) — `5/5` passed (`18795.04 ms`)**:
   - **Test 1 (`/play` discovery links)**: Verified `[data-testid="play-booth-link"]` (`/play/booth`) and `[data-testid="play-pachinko-link"]` (`/play/pachinko`) on `/play`, navigated to `/play/pachinko`, verified `[data-testid="pachinko-back-to-play"]` back to `/play`, and navigated to `/play/booth`.
   - **Test 2 (Plunger drag, keyboard launch, duplicate `'DUP'` bounce, Backfill flood, 6-bucket bar chart, and throttled `aria-live`)**: Verified `touch-action: none` on `[data-testid="pachinko-canvas"]` and `[data-testid="pachinko-plunger"]`; pointer drag-and-release and `Space`/`Enter` launches; duplicate key `'DUP'` bounce incrementing `[data-testid="pachinko-readout-deduped"]`; `Backfill (60 records)` populating `p0`..`p5` in `[data-testid="pachinko-bar-chart"]`, `records/sec > 0`, `late-arrival %`, `DLQ count`, and throttled (`~1 s`) `aria-live="polite"` updates (`data-update-count` bounded in `[1, 10]`).
   - **Test 3 (Negative Control — Sound muted by default + Rate-limited WebAudio + Tilt & Keyboard Nudge)**:
     - **Negative control #1 (Muted default)**: Launched records and triggered a backfill with sound at default `OFF` (`data-sound-on="false"`) and verified `tracker.audioContexts === 0` and `tracker.oscillators === 0`.
     - **Positive control (Sound enabled)**: Toggled `[data-testid="pachinko-sound-toggle"]` `ON`, ran a backfill flood, and verified `tracker.audioContexts === 1` (shared `AudioContext`), `tracker.maxInOneSecond <= 20` (`<= 20/s` rate limit), and `tracker.maxGain <= dbToGain(-18) + 1e-6` (`<= -18 dB` gain ceiling).
     - Verified `ArrowLeft`, `ArrowRight`, `[data-testid="pachinko-nudge-left"]`, `[data-testid="pachinko-nudge-right"]`, and `DeviceOrientationEvent.requestPermission()` + `deviceorientation` (`gamma = 24°`, `data-tilt-gamma="24"`).
   - **Test 4 (`prefers-reduced-motion: reduce`)**: Verified `data-reduced-motion="true"`, `IN-FLIGHT: 0` on initial load (no auto-running motion), and reduced backfill batch size (`data-batch-size="12"`).
   - **Test 5 (Negative Control — 2 DLQ hits + normal bucket reset + 1 DLQ hit vs. 3-consecutive-DLQ `'on-call pager'` Easter egg & viewport containment)**:
     - **Negative control #2 (Non-consecutive DLQ spills)**: Injected `2` DLQ spills (`data-streak="2"`), settled normal records into `p0`..`p5` (`data-streak="0"`), and injected a `3rd` total DLQ spill (`data-value="3"`, `data-streak="1"`). Verified `[data-testid="pachinko-pager"]` count remained `0`.
     - **Positive control (3 consecutive DLQ spills)**: Triggered `3` consecutive DLQ spills (via `[data-testid="pachinko-dlq-streak-btn"]` on `1366x768` desktop and `?fixture=dlq-streak` on `390x844` mobile after scrolling `window.scrollTo(0, 420)`), verified `[data-testid="pachinko-pager"]` (`role="dialog"`) appeared with focus moved to `[data-testid="pachinko-pager-dismiss"]` and bounding rect strictly inside both `1366x768` and `390x844` viewports (`top >= 0`, `left >= 0`, `right <= innerWidth`, `bottom <= innerHeight`), and verified dismissing reset `data-streak` to `"0"`.
2. **Unit Tests, Typecheck & Lint**:
   - `TMPDIR=/tmp npm test`: `2609` passed, `0` failed (`34.37 s`).
   - `npm run typecheck`: `0` errors (`next typegen && tsc --noEmit`).
   - `npm run lint`: `0` errors (`eslint`).

## 8. Deferred Checks & Open Defects
- **Observed defects**: `0`
- **Deferred checks**: `0`
