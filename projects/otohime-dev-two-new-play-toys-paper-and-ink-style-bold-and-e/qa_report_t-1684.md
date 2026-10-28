# Task 2 (`t-1684`) QA Report — Ink Purikura Photobooth Route, Purikura Doodle Layer, and Print/PNG Export

## 1. Verdict & Identity Summary
- **Verdict**: `pass`
- **Plan ID**: `pm-294` (*Ink Booth & Pipeline Pachinko*)
- **Task ID**: `t-1684` (*Ink Purikura Photobooth route, purikura doodle layer, and print/PNG export*)
- **QA Run ID**: `run-9294` (`role=quality_engineer`)
- **Task Manager Task ID**: `56bc8d7b-4584-47d2-8c24-f66fc9d122f8` (`worker=avietidol-z490`, Node.js `v22.23.3`, Next.js `16.4.2` Turbopack)
- **QA Run Profile / Model / Effort**: `agent_profile=agy-argon-medium`, `profile_flags=--model gemini-4-argon-medium --dangerously-skip-permissions` (human-readable: Gemini 4 Argon Medium)
- **Software Engineer Delivery Run**: `run-9290` (`role=software_engineer`, `agent_profile=agy-argon-high`, `profile_flags=--model gemini-4-argon-high --dangerously-skip-permissions`, task-manager task `742cdd08-d956-4f05-a8bd-048ad901a079`)
- **Green Gate Verify Run**: `run-9293` (`role=verify`, `status=succeeded`, `sha=995279a`, task-manager task `c7daf648-8fdd-4e5d-ba63-d2563eba2435`)
- **Cited Delivery & Deployed SHA**: `995279a572db68e48ace27cd2aaa04b9d6611e72` (`995279a`, `HEAD` of `origin/main`; `git merge-base --is-ancestor 995279a572db68e48ace27cd2aaa04b9d6611e72 995279a572db68e48ace27cd2aaa04b9d6611e72` exit `0`)
- **Commit Identity Check**:
  - Delivery commit `995279a572db68e48ace27cd2aaa04b9d6611e72` author: `Otohime <quiinthieu@gmail.com>` with zero `Co-Authored-By` trailers.
  - `bash scripts/setup-owner-git.sh --check`: `Effective commit author: Otohime <quiinthieu@gmail.com>`.

## 2. Delivery Classification
- **Integration deployed**: Yes — `next.config.ts` serves `Permissions-Policy: camera=(self), microphone=()` on `/play/booth` while preserving `/play`; `/play/booth` builds cleanly in Next.js `16.4.2` production (`◐ /play/booth`) and serves `app/(site)/(app)/play/booth/page.tsx`, `app/(site)/(app)/play/booth/booth.css`, and `app/(site)/(app)/play/booth/_components/booth-studio.tsx` wrapped in `<ViewTransition enter="page-in" exit="page-out" default="none">`.
- **Waiting for capacity**: No (`0` pending capacity dependencies).
- **Execution demonstrated**: Yes — both contract verification suites plus an independent QA negative-control probe were executed against the locked production build (`995279a572db68e48ace27cd2aaa04b9d6611e72`) in real headless Chromium (`playwright-core` `1.64.0`) and Node.js `v22.23.3`:
  1. Contract `e2e/booth.test.ts`: `6 pass, 0 fail` (`11,354.97ms`, exit `0`).
  2. Independent QA negative-control probe (`booth-qa-probe.test.ts`): `2 pass, 0 fail` (`3,022.74ms`, exit `0`).
  3. Contract repository unit suite, typecheck, and lint (`npm test && npm run typecheck && npm run lint`): `2,609 pass, 0 fail` (`35,514.88ms`), `0` TypeScript errors, `0` ESLint errors (exit `0`).
- **Product delivered**: Yes — all acceptance criteria and build contract items for `t-1684` are verified end-to-end with zero defects and zero deferred checks.

## 3. Executable & Artifact Fingerprints (SHA-256)
| File | Role | SHA-256 | Matches `task-2-evidence.md` |
| --- | --- | --- | --- |
| `next.config.ts` | `/play/booth` `Permissions-Policy: camera=(self), microphone=()` header rule | `321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d` | Yes |
| `app/(site)/(app)/play/booth/page.tsx` | Server route for `/play/booth` wrapped in `ViewTransition` | `2208cb6f23b6961f58d7668be2f4ae4279dc56410ea4a71043b56467728a5ee0` | Yes |
| `app/(site)/(app)/play/booth/booth.css` | Paper-and-ink studio styles, `.rise:has(.booth-root)` transform suppression, `@media print` `5cm x 15cm`, reduced-motion rules | `46ea204976b04b1bd223d86d4e5a251439702b1102e5fd8e0e58a12e97c97ebd` | Yes |
| `app/(site)/(app)/play/booth/_components/booth-studio.tsx` | Interactive client studio component | `04ef99affa3ae4b3290c01ae241193b0f0eb91740d77887b519b1127e03264a6` | Yes |
| `e2e/booth.test.ts` | Chromium E2E test suite for `/play/booth` | `95df9ca7ac7bb91a9d324ea02e9eb60592e7e62d42ef21e3ffbcfd31d296f240` | Yes |
| `lib/booth/film-stock.ts` | Film-stock WebGL2 shader + Canvas 2D kernels | `2ab8d83e2d23733c26d3e8c6329ef48b06242ff56b5715fd1e5032346ef49680` | Yes |
| `lib/booth/strip.ts` | `600x1800` torn-paper strip composer, hanko stamp, footer, purikura vector decorations | `9fcd26680066b28b4f4f299d54ee70679d4ae7896f941c3464f8aa31d1c44607` | Yes |
| `lib/booth/camera.ts` | Opt-in camera lifecycle controller | `036f63fea66deaec15a1a30c6dec5bab22e38bc9e305014998fc47c712e66c14` | Yes |
| `lib/booth/sample-portrait.ts` | Bundled procedural sample paper portrait | `b520a2132fd1f6e4ae1a0184e4677c0e40de4a7c68ed81ee0267b5988694b25c` | Yes |
| `package-lock.json` | Locked dependency tree | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` | Yes |

## 4. Real vs. Fake Boundaries
- **Real in QA verification**:
  - Real Next.js `16.4.2` production build (`next build`), embedded PostgreSQL + Drizzle migrations, and production server (`next start`) via `scripts/e2e.mjs`.
  - Real HTTP response header verification on `GET /play/booth` and `GET /play` (`Permissions-Policy: camera=(self), microphone=()`).
  - Real headless Chromium (`playwright-core` `1.64.0`) executing `/play/booth`, running live film-stock kernels (`sumi-e`, `riso`, `newsprint`), composing the `600x1800` torn-paper strip with date hanko seal and `otohime.dev` footer, drawing pointer/keyboard strokes and stickers, triggering real `canvas.toBlob` PNG downloads (verified via `89 50 4E 47 0D 0A 1A 0A` magic bytes and `IHDR` `600x1800` dimensions), emulating `@media print` (`5cm x 15cm` strip dimensions and hidden chrome) and `prefers-reduced-motion: reduce`, and auditing all network requests (`0` image uploads).
  - Real WebAudio `AudioContext` oscillator and gain synthesis (`lib/sound.ts` / `lib/sound-client.ts`) verified at `<= -18 dB`.
- **Controlled test doubles in E2E**:
  - `navigator.mediaDevices.getUserMedia`: Stubbed via `context.addInitScript` in E2E tests with (1) a `<canvas>`-backed `captureStream()` `MediaStream` tracking `track.stop()` lifecycle calls, (2) `DOMException("Permission denied", "NotAllowedError")`, and (3) `DOMException("Requested device not found", "NotFoundError")` in our independent QA negative control so camera lifecycle and error fallbacks are deterministically proven on a headless worker without physical camera hardware.

## 5. Bounded History & Queue Completeness
- **`plan_manager_list_runs(plan_id="pm-294")`** (complete — `9` of `9` runs inspected):
  - `run-9278` (`research`, `claude-sonnet-medium`): `succeeded`
  - `run-9279` (`product_owner`, `agy-argon-medium`): `succeeded` (`a552b83`)
  - `run-9286` (`software_engineer`, `t-1683`, `agy-argon-high`): `succeeded` (`5fd54a7`)
  - `run-9289` (`verify`, `t-1683`): `succeeded` (`5fd54a7`)
  - `run-9287` (`software_engineer`, `t-1685`, `agy-argon-high`): `succeeded` (`2f40534`)
  - `run-9291` (`verify`, `t-1685`): `succeeded` (`2f40534`)
  - `run-9290` (`software_engineer`, `t-1684`, `agy-argon-high`): `succeeded` (`995279a`)
  - `run-9293` (`verify`, `t-1684`): `succeeded` (`995279a`)
  - `run-9294` (`quality_engineer`, `t-1684`, `agy-argon-medium`): `running` (`0` prior failed runs on `t-1684` or `pm-294`)
- **`task_manager_list_tasks` bounded pagination (`limit=10, offset=0`)**:
  - `PENDING`: `2` of `2` (complete — unrelated `plan-manager` coding tasks `58d9985a-4dda-4216-aa7b-b7e85aea7c48` and `ba060ab0-7380-40cf-a3aa-81f8f7fb05d7`)
  - `RUNNING`: `2` of `2` (complete — current QA task `56bc8d7b-4584-47d2-8c24-f66fc9d122f8` on `avietidol-z490` and `2543df22-3a7e-472a-9dbd-8f47427a0276` on `avietidol-mac-mini`)
  - `COMPLETED`: `10` of `5257` (bounded page 1 — includes `742cdd08-d956-4f05-a8bd-048ad901a079` for `run-9290` SWE delivery and `c7daf648-8fdd-4e5d-ba63-d2563eba2435` for `run-9293` green-gate verification, both `callbackState="delivered"`)
  - `FAILED`: `10` of `1195` (bounded page 1 — `0` failures for `pm-294`)

## 6. Independent Evidence & Negative Controls Exercised
In addition to rerunning both required contract verification suites, QA authored and executed an independent Chromium negative-control probe (`booth-qa-probe.test.ts` via `scripts/e2e.mjs`, `2/2` pass in `3,022.74ms`):
1. **Negative Control A — `NotFoundError` device absence & `visibilitychange` background tab track teardown**:
   - Injected a `DOMException("Requested device not found", "NotFoundError")` rejection from `navigator.mediaDevices.getUserMedia` when clicking `[data-testid="booth-open-camera"]`; verified `/play/booth` caught the rejection cleanly without page errors and transitioned to `data-camera-state="sample"`, `data-fallback-reason="NotFoundError"`, and `data-stream-active="false"`.
   - Switched to a live `<canvas>` stream (`data-camera-state="streaming"`, `activeTracks === 1`), then dispatched `document.dispatchEvent(new Event("visibilitychange"))` with `document.visibilityState === "hidden"`. Verified `data-stream-active` immediately transitioned to `"false"` and `activeTracks` dropped to `0` (`stoppedTracks === 1`), proving backgrounded tabs never leave webcam tracks open.
2. **Negative Control B — Keyboard accessibility (`Space`, `Enter`, `Control+z`), `eraser` tool stroke, and pointer drag on `.booth-sticker-handle`**:
   - Focused `[data-testid="booth-strip-canvas"]`, pressed `Space` to draw a keyboard brush stroke (`data-stroke-count === "1"`), and pressed `Control+z` to undo (`data-stroke-count === "0"`).
   - Selected `gold` ink (`[data-testid="ink-color-gold"]`) and `3px` width (`[data-testid="brush-width-3"]`), drew with `Enter` (`data-stroke-count === "1"`), switched to `[data-testid="tool-eraser"]`, applied an eraser stroke (`data-stroke-count === "2"`), stamped `[data-testid="add-sticker-hanko-cat"]`, dragged `.booth-sticker-handle[data-sticker-kind="hanko-cat"]` by `(+40px, +30px)` via pointer events (verifying its `aria-label` coordinates updated), and removed the sticker via `[data-testid="sticker-remove"]` (`data-sticker-count === "0"`).

## 7. Contract Requirements Checklist
| Requirement | Status | Evidence |
| --- | --- | --- |
| `next.config.ts` `Permissions-Policy: camera=(self), microphone=()` on `/play/booth` (preserving `/play`) | Pass | `e2e/booth.test.ts` test 1 (`200 OK` headers on `/play` and `/play/booth`) |
| `page.tsx`, `booth.css`, `booth-studio.tsx` wrapped in `ViewTransition` with privacy notice, opt-in `Open camera`, and `Use sample portrait` fallback | Pass | `e2e/booth.test.ts` tests 1 & 2 + `booth-qa-probe.test.ts` test 1 |
| Live film-stock switching (`sumi-e`, `riso`, `newsprint`), `3-2-1` countdown (`aria-live="polite"`), WebAudio shutter clack (`<= -18 dB`), reduced-motion-safe ink flash | Pass | `e2e/booth.test.ts` tests 1, 3 & 5 |
| `600x1800` torn-paper 4-frame strip with red date hanko stamp & `otohime.dev` footer, purikura pen/eraser/undo/clear + stickers, PNG download (`otohime-booth-YYYYMMDD.png`), `@media print` `~5x15cm` strip | Pass | `e2e/booth.test.ts` tests 2 & 4 + `booth-qa-probe.test.ts` test 2 |
| Suppress `.rise` transform on `.rise:has(.booth-root)` for `1366x768` desktop and `390x844` mobile viewports; zero network image uploads | Pass | `e2e/booth.test.ts` tests 1, 2, 4 & 6 |

## 8. Defects & Deferred Checks
- **Defects**: None (`0`).
- **Deferred checks**: None (`0`).
