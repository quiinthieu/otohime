# Task 4 (`t-1686`) QA Report — Pipeline Pachinko Route, Play Page Discovery Teasers, and E2E Verification

## 1. Verdict & Identity Summary
- **Verdict**: `pass`
- **Plan ID**: `pm-294` (*Ink Booth & Pipeline Pachinko*)
- **Task ID**: `t-1686` (*Pipeline Pachinko route, Play page discovery teasers, and E2E verification*)
- **QA Run ID**: `run-9302` (`role=quality_engineer`)
- **Task Manager Task ID**: `657663c7-d2f8-42de-9d63-69b5b2c0460e` (`worker=billie-mac`, Node.js `v22.23.4`, Next.js `16.4.2` Turbopack)
- **QA Run Profile / Model / Effort**: `agent_profile=agy-argon-medium`, `profile_flags=--model gemini-4-argon-medium --dangerously-skip-permissions` (human-readable: Gemini 4 Argon Medium)
- **Software Engineer Delivery Runs**:
  - Attempt 1: `run-9295` (`role=software_engineer`, `agent_profile=agy-argon-high`, `profile_flags=--model gemini-4-argon-high --dangerously-skip-permissions`, task-manager task `9bef85b6-7611-40c2-97d6-660947049d38` on `avietidol-z490`, commit `f50d7aa017c946540199262177a531f652a9980a`)
  - Attempt 2 (fix): `run-9300` (`role=software_engineer`, `agent_profile=agy-argon-high`, `profile_flags=--model gemini-4-argon-high --dangerously-skip-permissions`, task-manager task `002b5eae-1c0c-49fe-879e-f7ed76fd12aa` on `avietidol-mac-mini`, commit `68dd79dba309c7713122e08b02ebb4e6844de749`)
- **Green Gate Verify Runs**:
  - `run-9299` (`role=verify`, `sha=f50d7aa`, task-manager task `f9910a17-20e9-4e81-8448-f8840e762be2` on `avietidol-mac-mini`, `callbackState="delivered"`): item `pachinko and booth browser e2e` failed at `e2e/pachinko.test.ts:432:14` due to passive `useEffect` race before `deviceorientation` listener attachment; resolved in `run-9300` (`68dd79d`).
  - `run-9301` (`role=verify`, `status=succeeded`, `sha=68dd79d`, task-manager task `a4fb2495-155a-4f0a-9b85-2731a7c83086` on `avietidol-z490`, `callbackState="delivered"`): both `pachinko and booth browser e2e` (`49,240ms`, exit `0`) and `repository unit suite and types` (`74,444ms`, exit `0`) passed.
- **Cited Delivery & Deployed SHA**: `68dd79dba309c7713122e08b02ebb4e6844de749` (`68dd79d`, `HEAD` of `origin/main`; `git merge-base --is-ancestor 68dd79dba309c7713122e08b02ebb4e6844de749 68dd79dba309c7713122e08b02ebb4e6844de749` exit `0`)
- **Commit Identity Check**:
  - Delivery commits `f50d7aa017c946540199262177a531f652a9980a` and `68dd79dba309c7713122e08b02ebb4e6844de749` author: `Otohime <quiinthieu@gmail.com>` with zero `Co-Authored-By` trailers.
  - Delivery artifact `author.txt` in `002b5eae-1c0c-49fe-879e-f7ed76fd12aa` (`run-9300`): `sha256=7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada` (`size=44` bytes, matches `Otohime <quiinthieu@gmail.com>`).
  - `bash scripts/setup-owner-git.sh --check`: `Effective commit author: Otohime <quiinthieu@gmail.com>`.

## 2. Delivery Classification
- **Integration deployed**: Yes — `/play/pachinko` (`app/(site)/(app)/play/pachinko/page.tsx`, `app/(site)/(app)/play/pachinko/pachinko.css`, and `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`) and `/play` discovery teasers (`app/(site)/(app)/play/page.tsx`) build cleanly in Next.js `16.4.2` production (`◐ /play/pachinko`, `◐ /play`, `◐ /play/booth`) wrapped in `<ViewTransition enter="page-in" exit="page-out" default="none">`.
- **Waiting for capacity**: No (`0` pending capacity dependencies).
- **Execution demonstrated**: Yes — both contract verification suites plus an independent QA negative-control probe were executed against the locked production build (`68dd79dba309c7713122e08b02ebb4e6844de749`) in real headless Chromium (`playwright-core` `1.64.0`) and Node.js `v22.23.4`:
  1. Contract `e2e/pachinko.test.ts`: `5 pass, 0 fail` (`27,104.44ms`, exit `0`).
  2. Independent QA negative-control probe (`pachinko-qa-probe.test.ts`): `2 pass, 0 fail` (`2,996.74ms`, exit `0`).
  3. Contract repository unit suite, typecheck, and lint (`npm test && npm run typecheck && npm run lint`): `2,609 pass, 0 fail` (`42,864.21ms`), `0` TypeScript errors, `0` ESLint errors (exit `0`).
- **Product delivered**: Yes — all acceptance criteria and build contract items for `t-1686` are verified end-to-end with zero defects and zero deferred checks.

## 3. Executable & Artifact Fingerprints (SHA-256)
| File | Role | SHA-256 | Matches `task-4-evidence.md` |
| --- | --- | --- | --- |
| `app/(site)/(app)/play/page.tsx` | `/play` index page with discovery teasers for `/play/booth` (`data-testid="play-booth-link"`) and `/play/pachinko` (`data-testid="play-pachinko-link"`) | `0c05b131e770beb0f8e0820dedd82f91de4fafa8f7b04b93344a4d55fbdee8c2` | Yes |
| `app/(site)/(app)/play/pachinko/page.tsx` | Server route for `/play/pachinko` wrapped in `ViewTransition` | `3382097720e4e1a5a27b23a6f210380743e96faf47796296a9f05d4bfd52a2aa` | Yes |
| `app/(site)/(app)/play/pachinko/pachinko.css` | Ink-and-washi styles, `.rise:has(.pachinko-root)` transform suppression, 6-bucket bar chart, and viewport-pinned `.pachinko-pager` | `2df59b69e06dacd4d40913200c2cede0423b310cae08908aaed964ad0e953fdc` | Yes |
| `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx` | Interactive Canvas 2D + DOM Pipeline Pachinko client component wired to `lib/pachinko/sim.ts` and `lib/sound-client.ts` | `7e4ef0b44b2072c9e2d30c23873a6238be5362e1ef74681be728811d52c4eed8` | Yes |
| `e2e/pachinko.test.ts` | Chromium E2E test suite for `/play/pachinko` and `/play` discovery links | `b841e3432dbd5e1a20bfcfee27f53db43ed0e64623620a1152b1d124cd972d72` | Yes |
| `lib/pachinko/sim.ts` | Pure deterministic 2D Verlet simulation & 5-stage pipeline state machine | `e20b7fb544b22d07a5bd1f3b8a89e35bd9af5d7c9788325d6a73221f8f52fd96` | Yes |
| `package-lock.json` | Locked dependency tree (zero new dependencies; no Matter.js) | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` | Yes |

## 4. Real vs. Fake Boundaries
- **Real in QA verification**:
  - Real Next.js `16.4.2` production build (`next build`), embedded PostgreSQL + Drizzle migrations, and production server (`next start`) via `scripts/e2e.mjs`.
  - Real headless Chromium (`playwright-core` `1.64.0`) executing `/play`, `/play/booth`, and `/play/pachinko` at `1366x768` desktop and `390x844` mobile viewports.
  - Real HTML5 Canvas 2D rendering (`600x860` logical board scaled by `devicePixelRatio` clamped to `2`, verified via `getImageData` pixel sampling for washi paper `#f5efe2`, sumi dark ink `#1a1714`, and vermilion `#c43b2b` strokes), real pointer drag-and-release gestures on the plunger, real keyboard `Space`/`Enter`/`ArrowLeft`/`ArrowRight`/`Escape` events, real `lib/pachinko/sim.ts` fixed-timestep (`dt = 1/120 s`) Verlet physics and 5-stage routing, and real WebAudio `AudioContext` synthesis (`lib/sound-client.ts`) gated by `createPegClickLimiter(20)`.
- **Controlled test doubles in E2E**:
  - `window.AudioContext` subclass instrumentation in `e2e/pachinko.test.ts` (`addInitScript`) delegating to the real browser `AudioContext` while recording context count, oscillator timestamps, and `GainNode` peak gain (`<= -18 dB`).
  - `window.DeviceOrientationEvent.requestPermission` stub in `e2e/pachinko.test.ts` and `pachinko-qa-probe.test.ts` returning `"granted"`, `"denied"`, or throwing `DOMException("Permission request rejected", "NotAllowedError")`, paired with synthetic `deviceorientation` events (`gamma = 24`, `-19.4`, `null`, `NaN`, `41`) to deterministically verify mobile orientation permission gating on a headless worker without physical accelerometer hardware.

## 5. Bounded History & Queue Completeness
- **`plan_manager_list_runs(plan_id="pm-294")`** (complete — `14` of `14` runs inspected):
  - `run-9278` (`research`, `claude-sonnet-medium`, `tm_task_id=7680a09d-d451-4773-abdd-2a9842838f00`): `succeeded`
  - `run-9279` (`product_owner`, `agy-argon-medium`, `tm_task_id=36f3da50-a200-40d7-a393-fef922c6281c`): `succeeded` (`a552b83`)
  - `run-9286` (`software_engineer`, `t-1683`, `agy-argon-high`, `tm_task_id=90defa41-d811-4618-8655-03522c0b5f19`): `succeeded` (`5fd54a7`)
  - `run-9289` (`verify`, `t-1683`, `tm_task_id=99cc3062-dbde-42d4-8eed-60a4746c1217`): `succeeded` (`5fd54a7`)
  - `run-9287` (`software_engineer`, `t-1685`, `agy-argon-high`, `tm_task_id=83614667-93c1-4c85-839c-4a2822424652`): `succeeded` (`2f40534`)
  - `run-9291` (`verify`, `t-1685`, `tm_task_id=afdbe3b2-f748-4d20-b350-70484218a69f`): `succeeded` (`2f40534`)
  - `run-9290` (`software_engineer`, `t-1684`, `agy-argon-high`, `tm_task_id=ef6af4ef-aebb-4723-88b0-dc1759b7a99e`): `succeeded` (`995279a`)
  - `run-9293` (`verify`, `t-1684`, `tm_task_id=742cdd08-d956-4f05-a8bd-048ad901a079`): `succeeded` (`995279a`)
  - `run-9294` (`quality_engineer`, `t-1684`, `agy-argon-medium`, `tm_task_id=56bc8d7b-4584-47d2-8c24-f66fc9d122f8`): `succeeded` (`b5bbad5`)
  - `run-9295` (`software_engineer`, `t-1686`, `agy-argon-high`, `tm_task_id=9bef85b6-7611-40c2-97d6-660947049d38`): `succeeded` (`f50d7aa`)
  - `run-9299` (`verify`, `t-1686`, `tm_task_id=f9910a17-20e9-4e81-8448-f8840e762be2`): `verify-runner` completed (`callbackState="delivered"`, raw log `49` lines inspected), item `pachinko and booth browser e2e` failed at `e2e/pachinko.test.ts:432:14` on `f50d7aa`.
  - `run-9300` (`software_engineer`, `t-1686`, `agy-argon-high`, `tm_task_id=002b5eae-1c0c-49fe-879e-f7ed76fd12aa`): `succeeded` (`68dd79d`, raw log `54` lines inspected).
  - `run-9301` (`verify`, `t-1686`, `tm_task_id=a4fb2495-155a-4f0a-9b85-2731a7c83086`): `succeeded` (`68dd79d`, `callbackState="delivered"`, raw log `50` lines inspected, both verification items `status=pass exit=0`).
  - `run-9302` (`quality_engineer`, `t-1686`, `agy-argon-medium`, `tm_task_id=657663c7-d2f8-42de-9d63-69b5b2c0460e`): `running`
- **`task_manager_list_tasks` bounded pagination (`limit=10, offset=0`)**:
  - `PENDING`: `0` of `0` (complete)
  - `RUNNING`: `2` of `2` (complete — current QA task `657663c7-d2f8-42de-9d63-69b5b2c0460e` on `billie-mac` and unrelated `1fced89c-55b3-4c9f-a6a4-5d37d8650eb2` for `run-9298`)
  - `COMPLETED`: `10` of `5170` (bounded page 1 — includes `a4fb2495-155a-4f0a-9b85-2731a7c83086` for `run-9301` verify pass on `68dd79d`, `002b5eae-1c0c-49fe-879e-f7ed76fd12aa` for `run-9300` SWE delivery, and `f9910a17-20e9-4e81-8448-f8840e762be2` for `run-9299`, all `callbackState="delivered"`)
  - `FAILED`: `10` of `1209` (bounded page 1 — `0` failures for `pm-294` / `otohime`)

## 6. Independent Evidence & Negative Controls Exercised
In addition to rerunning both required contract verification suites, QA authored and executed an independent Chromium negative-control probe (`pachinko-qa-probe.test.ts` via `scripts/e2e.mjs`, `2/2` pass in `2,996.74ms`):
1. **Negative Control A — `DeviceOrientationEvent` permission denial (`"denied"` & thrown `NotAllowedError`), null/NaN-sensor event filtering, and tilt toggle-off deactivation**:
   - Verified clicking `[data-testid="pachinko-tilt-btn"]` when `DeviceOrientationEvent.requestPermission()` resolves `"denied"` or rejects with `DOMException("Permission request rejected", "NotAllowedError")` transitions cleanly without page errors to `data-tilt-status="denied"` (`aria-pressed="false"`, text `"Tilt permission denied"`) and ignores subsequent `deviceorientation` (`gamma = 32`) events (`data-tilt-gamma` remains `"0"`).
   - Verified that when tilt is `"granted"` and active (`gamma = -19.4` -> `data-tilt-gamma="-19"`), dispatching null-sensor (`gamma = null`) and `NaN` (`gamma = NaN`) `deviceorientation` events leaves `data-tilt-gamma="-19"` unchanged, and clicking `[data-testid="pachinko-tilt-btn"]` a second time deactivates tilt (`data-tilt-status="idle"`, `data-tilt-gamma="0"`) and ignores any subsequent `deviceorientation` (`gamma = 41`) events.
2. **Negative Control B — Seed input `ArrowLeft`/`ArrowRight` isolation, `Reset board` state clearing, `Escape` key pager dismissal on `390x844` mobile, `.rise` transform suppression, and Canvas 2D ink pixel verification**:
   - Loaded `/play/pachinko?seed=777&fixture=dlq-streak` at `390x844` mobile viewport; verified `getComputedStyle(document.querySelector(".rise:has(.pachinko-root)")!)` has `transform === "none"`, `translate === "none"`, and `animationName === "none"`.
   - Sampled `HTMLCanvasElement` pixel data (`ctx.getImageData`) on `[data-testid="pachinko-canvas"]` and verified non-blank rendering of washi paper (`#f5efe2`), dark sumi ink (`#1a1714`), and vermilion (`#c43b2b`) stage accents.
   - Pressed `Escape` while `[data-testid="pachinko-pager"]` was open and verified the dialog closed (`count() === 0`) and `data-streak` reset to `"0"`.
   - Focused `[data-testid="pachinko-seed-input"]` and pressed `ArrowLeft` and `ArrowRight`; verified `data-nudge-count` stayed `"0"` and `data-last-nudge` stayed `"none"`. Filled seed `424242` and clicked `[data-testid="pachinko-reset-btn"]`, confirming `SETTLED: 0` and `DLQ=0`.

## 7. Contract Requirements Checklist
| Requirement | Status | Evidence |
| --- | --- | --- |
| Read Next 16 docs; build `/play/pachinko` (`page.tsx`, `pachinko.css`, `pachinko-machine.tsx`) rendering ink-and-washi Canvas 2D board (plunger lane, ingest pegs, dedupe gate with `DUP` stamps, join funnel, partition splitter `p0..p5`, DLQ gutter, live 6-bucket bar chart) | Pass | `e2e/pachinko.test.ts` tests 1 & 2 + `pachinko-qa-probe.test.ts` test 2 |
| Pointer drag-and-release plunger (`touch-action: none`), `Space`/`Enter` + `Launch record` button, `Backfill` flood button (`60` default / `12` under `prefers-reduced-motion: reduce`), `DeviceOrientationEvent` tilt-to-nudge + `ArrowLeft`/`ArrowRight` & on-screen nudge buttons, rate-limited (`<= 20/s`, `<= -18 dB`) WebAudio peg clicks gated by site sound toggle | Pass | `e2e/pachinko.test.ts` tests 2, 3 & 4 + `pachinko-qa-probe.test.ts` tests 1 & 2 |
| Live throughput readout (`records/sec`, `late-arrival %`, `DLQ count`) with throttled (`~1 s`) `aria-live="polite"` summary; 3-in-a-row DLQ paper `on-call pager` (`data-testid="pachinko-pager"`, `role="dialog"`, focus moved to dismiss button via `focus({ preventScroll: true })`) pinned strictly inside `1366x768` desktop and `390x844` mobile viewports | Pass | `e2e/pachinko.test.ts` tests 2 & 5 + `pachinko-qa-probe.test.ts` test 2 |
| Update `app/(site)/(app)/play/page.tsx` with paper-and-ink teasers and links for `/play/booth` (`data-testid="play-booth-link"`) and `/play/pachinko` (`data-testid="play-pachinko-link"`) alongside Hanafuda | Pass | `e2e/pachinko.test.ts` test 1 |
| Chromium E2E tests in `e2e/pachinko.test.ts` and execution evidence in `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-4-evidence.md` | Pass | `e2e/pachinko.test.ts` (`5/5` pass) + `task-4-evidence.md` |

## 8. Defects & Deferred Checks
- **Defects**: None (`0`).
- **Deferred checks**: None (`0`).
