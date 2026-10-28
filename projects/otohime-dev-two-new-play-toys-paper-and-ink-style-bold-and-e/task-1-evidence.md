# Task 1 Execution Evidence — `pm-294` / `t-1683`: Ink Purikura film-stock shaders, strip composer, and camera controller

- **Plan**: `pm-294` (Ink Booth & Pipeline Pachinko)
- **Task**: `t-1683` (`sequence: 1`, `qa: "skip"`)
- **Run**: `run-9286` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model=Gemini 4 Argon (High)`, `effort=high`, `runner=fleet`, `worker_id=avietidol-z490`, `tm_task_id=90defa41-d811-4618-8655-03522c0b5f19`)

## 1. Delivery Classification & Status

| Dimension | Status | Evidence |
| --- | --- | --- |
| **Integration deployed** | **Pending CI / Green Gate** | Pure TypeScript modules (`lib/booth/film-stock.ts`, `lib/booth/sample-portrait.ts`, `lib/booth/camera.ts`, `lib/booth/strip.ts`, `lib/sound.ts`), unit suite (`lib/booth/booth.test.ts`, `lib/sound.test.ts`), and standalone verifier (`scripts/verify-booth-engine.mjs`) are committed and pushed to `origin/main` for plan-manager's post-push green gate. |
| **Waiting for capacity** | **None (`0` deferred)** | All local unit, verifier, typecheck, and lint checks executed immediately on `avietidol-z490` with zero capacity deferrals. |
| **Execution demonstrated** | **Proven** | Both build-contract verification commands (`booth engine and sound unit tests`: `23 / 23` unit tests + `scripts/verify-booth-engine.mjs` exit `0`; `repository unit suite and types`: `2,597 / 2,597` repository unit tests + `npm run typecheck` + `npm run lint` exit `0`) executed in locked Node `v22.23.3`. |
| **Product delivered** | **Proven for Task 1 contract scope** | All pure TypeScript booth engine deliverables are verified: `sumi-e`, `riso`, and `newsprint` film-stock definitions, WebGL2 vertex/fragment shaders, WebGL2 quad renderer with `webglcontextlost` fallback, deterministic Canvas 2D `ImageData` kernels, seeded `600x1800` torn-paper 4-frame strip composer with `YYYY.MM.DD` red circular hanko stamp and `otohime.dev` footer, vector purikura pen/eraser/sticker model with `undo`/`clear`, procedural sample paper portrait generator, opt-in camera lifecycle controller (`getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false })`), and `CUES.shutter` / `shutterClackSamples` (`<= -18 dB`) in `lib/sound.ts`. Interactive `/play/booth` route UI is owned by Task 2 (`t-1684`). |

## 2. Executable Fingerprint & Real/Fake Boundaries

### Locked Environment & Artifact Hashes (SHA-256)
- **Runtime**: Node `v22.23.3` (`linux-x64`), `next@16.4.2`, `react@19.3.0`, TypeScript `5.x`.
- `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`
- `lib/sound.ts`: `7711e42a5aa37824caafd391d3cb61e48020c621749602af8f3975109387af7f`
- `lib/sound.test.ts`: `3424d184c9fc5243461b4a2d972b88f38a2a97b9cda52fe3cbd4e56174fb2bd7`
- `lib/booth/film-stock.ts`: `87ec852c409c3831ca5eb9074fbdf5d4a652e5942cf7ceff2806739778b4b7b9`
- `lib/booth/sample-portrait.ts`: `b520a2132fd1f6e4ae1a0184e4677c0e40de4a7c68ed81ee0267b5988694b25c`
- `lib/booth/camera.ts`: `036f63fea66deaec15a1a30c6dec5bab22e38bc9e305014998fc47c712e66c14`
- `lib/booth/strip.ts`: `9fcd26680066b28b4f4f299d4ee70679d4ae7896f941c3464f8aa31d1c44607`
- `lib/booth/booth.test.ts`: `39744d63fc1f47eb8fbccbb41e96547052f59df528e729fb960a9573b3a6ab94`
- `scripts/verify-booth-engine.mjs`: `ac809b56d765bb9acc5f47e654a64e3e75e348d9efb506f6e78e3f8b477b663c`

### Real vs. Fake Boundaries
- **Real**: Real `lib/booth/film-stock.ts` RGBA pixel kernels (`applySumiEKernel`, `applyRisoKernel`, `applyNewsprintKernel`), real `lib/booth/sample-portrait.ts` procedural paper portrait synthesis, real `lib/booth/strip.ts` seeded `mulberry32` torn-paper polygon clipping (`600x1800`), 4-frame tilted rasterization, vermilion hanko stamp and `otohime.dev` bitmap glyph rasterization, vector stroke/eraser/sticker reducer and compositor, real `lib/booth/camera.ts` state machine, and real `lib/sound.ts` / `lib/sound-client.ts` cue envelope and gain calculations.
- **Fake / Stand-in**: `FakeAudioContext` in `lib/sound.test.ts` and `scripts/verify-booth-engine.mjs` (to verify WebAudio node scheduling and mute gating in headless Node without audio hardware), mock `RendererCanvasLike` WebGL2 context in `lib/booth/booth.test.ts` (to deterministically trigger `webglcontextlost` and verify fallback to `applyFilmStockKernel`), and mock `getUserMedia` / `MediaStreamTrack` adapter in `lib/booth/booth.test.ts` and `scripts/verify-booth-engine.mjs` (to verify opt-in activation, 4th-shot track stop, `visibilitychange` hidden cleanup, and `AbortSignal` cleanup in Node).

## 3. Bounded Paginated Run & Task History Inspection

- **`plan_manager_list_runs(plan_id="pm-294")`** (complete scan: `4 / 4` runs on plan `pm-294`, `0` truncated):
  - `run-9278` (`research`, `claude-sonnet-medium`, `model=claude-sonnet-5-5`, `effort=medium`, `tm_task_id=7680a09d-d451-4773-abdd-2a9842838f00`): `succeeded`
  - `run-9279` (`product_owner`, `agy-argon-medium`, `model=gemini-4-argon-medium`, `git_sha=a552b83`, `tm_task_id=36f3da50-a200-40d7-a393-fef922c6281c`): `succeeded`
  - `run-9286` (`t-1683`, `software_engineer`, `agy-argon-high`, `model=gemini-4-argon-high`, `tm_task_id=90defa41-d811-4618-8655-03522c0b5f19`): `running` (this run, attempt 1, 0 prior failures)
  - `run-9287` (`t-1685`, `software_engineer`, `agy-argon-high`, `model=gemini-4-argon-high`, `tm_task_id=83614667-93c1-4c85-839c-4a2822424652`): `running` (parallel Task 3 run)
- **`task_manager_list_tasks` bounded scan** (`limit=10, offset=0` per status, completely read):
  - `PENDING`: `0` tasks (`complete`).
  - `RUNNING`: `3` tasks (`90defa41-d811-4618-8655-03522c0b5f19` for `pm-294/run-9286`, `83614667-93c1-4c85-839c-4a2822424652` for `pm-294/run-9287`, and `66996231-fdae-45a9-8636-c532bafc1417` for `pm-257/run-9288`).
  - `COMPLETED`: `10` tasks scanned (`1` on `otohime` `e5c78831-ba7e-44c5-85e7-c1c921b29bda`; `0` prior attempts on `t-1683`).
  - `FAILED`: `10` tasks scanned (`2` on `otohime` from unrelated plans `pm-269/run-9284` and `pm-257/run-9276`; `0` failures match `pm-294` or `t-1683`).

## 4. Verification Suites & Negative Controls

1. **Contract Check 1 — `booth engine and sound unit tests`**:
   - Command: `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/booth/booth.test.ts lib/sound.test.ts && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-booth-engine.mjs`
   - Result: Exit `0` (`23 / 23` unit tests passed in `262.7ms`; `scripts/verify-booth-engine.mjs` exited `0`).
   - Verified invariants:
     - `sumi-e`, `riso`, and `newsprint` kernels produce deterministic, non-blank `PixelBuffer`s (`stdLuma > 30`, tonal range `> 120`) and pairwise distinct pixel outputs (`meanAbsDiff` `18.0+` for `sumi-e` vs `riso`, `12.0+` for `sumi-e` vs `newsprint`, `20.0+` for `riso` vs `newsprint`, and `riso` two-colour chroma `> 3x` monochrome stocks).
     - `createTornPaperPolygon` produces identical polygons for identical seeds, distinct polygons for different seeds, and clips exterior pixels (`(0, 0)`) to `alpha = 0` while keeping interior strip pixels (`(300, 900)`) at `alpha = 255` on the `600x1800` 4-frame strip with `YYYY.MM.DD` hanko stamp and `otohime.dev` footer.
     - Vector purikura decoration state (`addPenStroke`, `addEraserStroke`, `addSticker`, `updateSticker`, `removeSticker`, `undoDecoration`, `clearDecorations`) preserves exact undo/clear invariants and visibly modifies composed strip pixels.
     - `createBoothCameraController` starts only on `openCamera()`, stops all tracks immediately after the 4th shot (`captureShot()` × 4), and cleans up tracks on `close()`, `visibilitychange` hidden, `AbortSignal` abort, or late `getUserMedia` resolution.
2. **Negative Controls Exercised**:
   - **Muted sound negative control**: Calling `play("shutter")` while `setSound(false)` is active creates `0` `AudioContext` instances and schedules `0` oscillator voices; enabling `setSound(true)` schedules all 5 `CUES.shutter` notes capped at `-20 dB <= -18 dB` (`MAX_DB`).
   - **Invalid film-stock ID negative control**: `isFilmStockId("sepia")`, `isFilmStockId("invalid-stock")`, and `isFilmStockId(null)` return `false`.
   - **WebGL context loss negative control**: Firing `webglcontextlost` on the canvas attached to `createFilmStockRenderer` calls `preventDefault()`, sets `contextLost = true`, switches `backend` from `"webgl2"` to `"canvas2d"`, and produces byte-identical output to `applyFilmStockKernel`.
   - **Denied / pre-gesture camera negative control**: Before `openCamera()`, `getUserMedia` call count is `0`; when `getUserMedia` rejects with `NotAllowedError`, the controller transitions to `state: "sample"` (`streamActive: false`) without leaking tracks and completes a 4-frame strip using `generateSamplePortrait`.
3. **Contract Check 2 — `repository unit suite and types`**:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`
   - Result: Exit `0` (`2,597 / 2,597` tests passed in `19,796.1ms`, `next typegen && tsc --noEmit` exited `0` with `0` errors, `eslint` exited `0` with `0` errors).

## 5. Defects & Deferred Checks

- **Defects observed**: None (`0`).
- **Deferred checks**: None (`0`) for Task 1's build contract. Browser route rendering for `/play/booth` is scheduled in Task 2 (`t-1684`, `depends_on: ["1"]`).
