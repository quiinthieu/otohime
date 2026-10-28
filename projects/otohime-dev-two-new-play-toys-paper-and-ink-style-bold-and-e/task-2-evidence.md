# Task 2 (`t-1684`) Execution Evidence — Ink Purikura Photobooth Route, Purikura Doodle Layer, and Print/PNG Export

## 1. Run & Execution Identity
- **Plan ID**: `pm-294` (*Ink Booth & Pipeline Pachinko*)
- **Task ID**: `t-1684` (*Task 2: Ink Purikura Photobooth route, purikura doodle layer, and print/PNG export*)
- **Run ID**: `run-9290` (`role=software_engineer`)
- **Task Manager Task ID**: `ef6af4ef-aebb-4723-88b0-dc1759b7a99e`
- **Worker / Host**: `avietidol-z490` (Linux, Node.js `v22.23.3`, Next.js `16.4.2` Turbopack)
- **Actual Run Profile / Model / Effort**: `agent_profile=agy-argon-high`, `model=Gemini 4 Argon (High)`, `effort=high`
- **Base Commit SHA (`origin/main`)**: `2f4053482442ab38219235a5308c55c2b93e0df0` (`pm-294/t-1685: feat(pachinko): add Pipeline Pachinko deterministic 2D physics, stages, and metrics`)

## 2. Delivery Classification
- **Integration deployed**: Yes — `/play/booth` route (`app/(site)/(app)/play/booth/page.tsx`), stylesheet (`app/(site)/(app)/play/booth/booth.css`), interactive client studio (`app/(site)/(app)/play/booth/_components/booth-studio.tsx`), `next.config.ts` `Permissions-Policy: camera=(self), microphone=()` header on `/play/booth`, and Chromium E2E test suite (`e2e/booth.test.ts`) are built in production (`next build`) and verified against the production Next.js server.
- **Waiting for capacity**: No (`0` pending capacity dependencies).
- **Execution demonstrated**: Yes — both required contract verification commands executed in the locked repository environment (`node v22.23.3`, `playwright-core` Chromium via `scripts/e2e.mjs`) with exit code `0`:
  - `e2e/booth.test.ts`: `6 pass, 0 fail` (`10,864.83ms`)
  - Full repository unit suite (`npm test`), `npm run typecheck`, and `npm run lint`: `2,609 pass, 0 fail` (`35,507.94ms`), `0` TypeScript errors, `0` ESLint errors.
- **Product delivered**: Yes — all acceptance criteria and build contract requirements for Task 2 (`t-1684`) are delivered and verified with zero defects and zero deferred checks.

## 3. Executable & Artifact Fingerprints (SHA-256)
| File | Role | SHA-256 |
| --- | --- | --- |
| `next.config.ts` | `/play/booth` `Permissions-Policy: camera=(self), microphone=()` header rule (preserving `/play` rule) | `321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d` |
| `app/(site)/(app)/play/booth/page.tsx` | Server route for `/play/booth` with `<ViewTransition enter="page-in" exit="page-out" default="none">` | `2208cb6f23b6961f58d7668be2f4ae4279dc56410ea4a71043b56467728a5ee0` |
| `app/(site)/(app)/play/booth/booth.css` | Scoped paper-and-ink studio styles, `.rise:has(.booth-root)` transform suppression, `@media print` `5cm x 15cm` strip rule, and `@media (prefers-reduced-motion: reduce)` | `46ea204976b04b1bd223d86d4e5a251439702b1102e5fd8e0e58a12e97c97ebd` |
| `app/(site)/(app)/play/booth/_components/booth-studio.tsx` | Client studio component (webcam opt-in, sample portrait fallback, film stocks, 3-2-1 countdown + shutter clack, purikura pen/eraser/stickers, undo/clear, PNG blob download, print) | `04ef99affa3ae4b3290c01ae241193b0f0eb91740d77887b519b1127e03264a6` |
| `e2e/booth.test.ts` | Real Chromium E2E suite covering all `/play/booth` requirements and negative controls | `95df9ca7ac7bb91a9d324ea02e9eb60592e7e62d42ef21e3ffbcfd31d296f240` |
| `lib/booth/film-stock.ts` | Consumed Task 1 film-stock kernels & WebGL2/Canvas2D renderer | `2ab8d83e2d23733c26d3e8c6329ef48b06242ff56b5715fd1e5032346ef49680` |
| `lib/booth/strip.ts` | Consumed Task 1 `600x1800` torn-paper strip composer, hanko seal, footer & purikura decorations | `9fcd26680066b28b4f4f299d54ee70679d4ae7896f941c3464f8aa31d1c44607` |
| `lib/booth/camera.ts` | Consumed Task 1 opt-in camera lifecycle controller | `036f63fea66deaec15a1a30c6dec5bab22e38bc9e305014998fc47c712e66c14` |
| `lib/booth/sample-portrait.ts` | Consumed Task 1 deterministic sample paper portrait generator | `b520a2132fd1f6e4ae1a0184e4677c0e40de4a7c68ed81ee0267b5988694b25c` |
| `package-lock.json` | Locked dependency graph (unmodified) | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |

## 4. Real vs. Fake Boundaries
- **Real in verification**:
  - Real Next.js `16.4.2` production build (`next build`) and production HTTP server (`next start`) started by `scripts/e2e.mjs` with embedded PostgreSQL and Drizzle migrations.
  - Real HTTP response header inspection on `GET /play/booth` (`Permissions-Policy: camera=(self), microphone=()`) and `GET /play` (`Permissions-Policy: camera=(), microphone=()`).
  - Real headless Chromium browser (`playwright-core`) rendering `/play/booth`, executing WebGL2 / Canvas2D shaders and pixel kernels (`lib/booth/film-stock.ts`), composing the `600x1800` torn-paper strip (`lib/booth/strip.ts`), dispatching real pointer drawing events and sticker transforms, triggering a real browser `download` event via `canvas.toBlob(..., "image/png")`, reading the downloaded file bytes (`89 50 4E 47 0D 0A 1A 0A` and `IHDR` `600x1800`), emulating `@media print` and `prefers-reduced-motion: reduce`, and auditing network requests (`POST`/`PUT` and external requests).
  - Real WebAudio synthesis via `lib/sound-client.ts` (`useSound().play("shutter")`, `play("stamp")`, `play("move")` from `lib/sound.ts`).
- **Controlled test doubles in E2E**:
  - `navigator.mediaDevices.getUserMedia`: Replaced in the first two E2E tests via `page.addInitScript` with (a) a real `<canvas>`-backed `captureStream()` `MediaStream` whose track `.stop()` calls are counted, and (b) a rejecting `DOMException("Permission denied", "NotAllowedError")` to deterministically verify both camera track teardown and denied-permission fallback in headless CI without physical webcam hardware.

## 5. Bounded History & Queue Inspection
- **`plan_manager_list_runs(plan_id="pm-294")`** (complete — 7 of 7 runs inspected):
  - `run-9278` (`research`): `succeeded` (`e8c488f`)
  - `run-9279` (`product_owner`): `succeeded` (`a552b83`)
  - `run-9286` (`software_engineer`, `t-1683` Task 1): `succeeded` (`5fd54a7`)
  - `run-9289` (`verify`, `t-1683` Task 1): `succeeded` (`5fd54a7`)
  - `run-9287` (`software_engineer`, `t-1685` Task 3): `succeeded` (`2f40534`)
  - `run-9291` (`verify`, `t-1685` Task 3): `succeeded` (`2f40534`)
  - `run-9290` (`software_engineer`, `t-1684` Task 2): `running` (attempt 1, 0 prior failed runs on `t-1684` or `pm-294`)
- **`task_manager_list_tasks` bounded pagination** (`limit=10, offset=0` per status):
  - `PENDING`: `0` of `0` (complete)
  - `RUNNING`: `2` of `2` (complete) — `ef6af4ef-aebb-4723-88b0-dc1759b7a99e` (`pm-294/run-9290` on `avietidol-z490`) and `2543df22-3a7e-472a-9dbd-8f47427a0276` (`pm-257/run-9292` on `avietidol-mac-mini`)
  - `COMPLETED`: `10` of `5248` (bounded page 1) — includes `afdbe3b2-f748-4d20-b350-70484218a69f` (`pm-294/t-1685` verify-runner, exit 0, `callbackState: "delivered"`) and `99cc3062-dbde-42d4-8eed-60a4746c1217` (`pm-294/t-1683` verify-runner, exit 0, `callbackState: "delivered"`)
  - `FAILED`: `10` of `1193` (bounded page 1) — `0` failures for `pm-294` (the 2 recent `otohime` failures in page 1 belong to `pm-269/run-9284` and `pm-257/run-9276`).

## 6. Verification Results & Negative Controls Exercised

### 6.1 Contract Verification Command 1: `booth browser e2e`
Command:
```bash
(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/booth.test.ts' && git checkout -- content/history.json
```
Result (`exit 0`, `6 pass, 0 fail`, `10,864.83ms`):
1. `✔ /play/booth serves Permissions-Policy camera=(self), microphone=(), renders privacy notice, waits for opt-in before getUserMedia, runs 3-2-1 countdown with shutter clack, and stops camera tracks after 4th frame (2819.12ms)`
   - **Negative control**: Verifies `getUserMediaCalls === 0` before clicking `[data-testid="booth-open-camera"]`, proving the camera never opens on initial page load. Also verifies `/play` retains `Permissions-Policy: camera=(), microphone=()`.
2. `✔ denied camera permission and explicit 'Use sample portrait' button fall back cleanly to procedural paper portrait and render the 600x1800 torn-paper strip (1035.09ms)`
   - **Negative control**: Injects a `NotAllowedError` rejection on `getUserMedia` and asserts `/play/booth` transitions cleanly to `data-camera-state="sample"` (`data-fallback-reason="permission_denied"`) with zero uncaught page errors and non-blank `600x1800` strip pixels.
3. `✔ film-stock switching ('sumi-e', 'riso', 'newsprint') updates live viewfinder and strip pixels distinctly and handles webglcontextlost (1272.81ms)`
   - **Negative control**: Dispatches a synthetic `Event("webglcontextlost")` on the renderer's WebGL canvas and verifies `data-renderer-backend="canvas2d"` fallback continues rendering distinct `sumi-e`, `riso`, and `newsprint` strip checksums without throwing.
4. `✔ purikura ink pen strokes, stickers, transform controls, undo, clear, PNG magic-byte download, and @media print 5x15cm layout (1931.43ms)`
   - Verifies pointer pen strokes, heart/star sticker placement, scale/rotate transform buttons, multi-step undo restoring the exact initial strip pixel checksum (`afterUndoChecksum === baseChecksum`), PNG download magic bytes (`89 50 4E 47 0D 0A 1A 0A`) and `IHDR` `600x1800` dimensions, `@media print` hiding UI controls while sizing `[data-testid="booth-strip-print-target"]` to `5cm x 15cm` (`1:3` aspect ratio), and `0` `POST`/`PUT` or external network requests.
5. `✔ prefers-reduced-motion suppresses ink-flash keyframe animations while keeping the 3-2-1 countdown and static click indicator (2141.28ms)`
   - **Negative control**: Under `page.emulateMedia({ reducedMotion: "reduce" })`, verifies `getComputedStyle(flashOverlay).animationName === "none"` while all 4 frames and `3,2,1,shutter` countdown transitions still complete.
6. `✔ 390x844 mobile and 1366x768 desktop viewports suppress .rise transform and keep sticky status controls strictly in viewport without horizontal overflow (1156.13ms)`
   - Verifies `.rise:has(.booth-root)` has `transform: none` and `translate: none`, sticky status bar remains pinned in viewport after scrolling, and `documentElement.scrollWidth <= window.innerWidth` at both `390x844` and `1366x768`.

### 6.2 Contract Verification Command 2: `repository unit suite and types`
Command:
```bash
(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint
```
Result (`exit 0`):
- `npm test`: `2,609` tests passed, `0` failed (`35,507.94ms`), including `lib/booth/booth.test.ts` (22/22 pass) and `lib/motion.test.ts` (103/103 pass).
- `npm run typecheck`: `next typegen && tsc --noEmit` succeeded with `0` errors.
- `npm run lint`: `eslint` succeeded with `0` errors (`0` warnings in touched files).

## 7. Defects & Deferred Checks
- **Observed defects**: None (`0`).
- **Deferred checks**: None (`0`).
