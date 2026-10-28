# Ink Booth & Pipeline Pachinko

Plan `pm-294`, revision 1. Product-owner run `run-9279`, model `gemini-4-argon-medium`.

## Outcome

Visitors to `otohime.dev/play` gain two new tactile paper-and-ink Play toys under `/play/booth` and `/play/pachinko`, each discoverable from `/play` and built with zero new runtime dependencies:

1. **Ink Purikura Photobooth (`/play/booth`)**:
   - **Opt-in, local-only webcam with sample portrait fallback**: Clicking `"Open camera"` requests `getUserMedia({ video: { facingMode: "user", width: { ideal: 960 } }, audio: false })` after displaying `"Your camera stays in this tab. Nothing is uploaded."` No frame or image data ever leaves the browser tab. Camera tracks are stopped immediately after the 4th frame capture, when closing the camera, when the tab becomes hidden, or on component unmount. When no camera is present, permission is denied, or the visitor clicks `"Use sample portrait"`, a bundled procedural paper portrait runs through the identical shader/canvas pipeline.
   - **Live WebGL2 / Canvas 2D film stocks**: Three selectable booth film stocks render live in the viewfinder and at capture time via a raw WebGL2 full-screen quad fragment shader with an automatic, pixel-deterministic Canvas 2D `ImageData` fallback:
     - `sumi-e`: luminance ramp with multi-band ink wash thresholding and washi paper-grain modulation.
     - `riso`: two-colour (fluorescent berry/pink and teal/indigo) rotated halftone screens on separate channels with multiply blend and slight misregistration.
     - `newsprint`: 45-degree halftone dot screen with smoothstepped dot radius on warm newsprint stock.
   - **Countdown, shutter clack, and reduced-motion flash**: A `3-2-1` countdown (`aria-live="polite"`) triggers 4 sequential shots with a synthesised WebAudio shutter-clack cue (`lib/sound.ts`, capped at `<= -18 dB`, muted by default until the site sound toggle is enabled) and a CSS ink-flash overlay. Under `prefers-reduced-motion: reduce`, the flash animation is replaced by a static click indicator while preserving the `3-2-1` countdown.
   - **Torn-paper strip assembly, purikura doodle layer, PNG download, and print**: The 4 captured frames are composed onto a vertical torn-paper strip (`~600x1800` canvas) with a seeded random polyline edge mask, subtle frame tilt, a red circular date hanko stamp (`YYYY.MM.DD`), and an `otohime.dev` footer. Visitors can draw on the strip with an ink pen (multiple brush widths, sumi/vermilion/indigo/gold inks, eraser, undo, clear) and place/drag/scale/rotate purikura doodle stickers stored as a vector list. Visitors can download the composite as `otohime-booth-YYYYMMDD.png` or click `"Print strip"` using an `@media print` stylesheet that prints only the strip at roughly `5x15cm`.

2. **Pipeline Pachinko (`/play/pachinko`)**:
   - **Custom deterministic 2D Verlet physics engine (`lib/pachinko/sim.ts`)**: A fixed-timestep (`dt = 1/120 s` with substeps, velocity clamping, circle-peg and segment restitution, and spatial-hash ball-ball collision capped at `150` balls) simulation seeded via `mulberry32`.
   - **Five data-engineering pipeline stages**:
     - `ingest`: dense peg lattice below the plunger launch lane.
     - `dedupe`: filter gate that bounces balls whose record key duplicates a recent key and stamps `"DUP"` on the ball.
     - `join`: funnel that holds the first arriving ball until a second arrives, then merges and emits a single larger joined ball (with a deterministic timeout that releases a lone waiting ball as a late arrival so the funnel never stalls).
     - `partition`: wedge splitter that routes balls into 6 partition buckets (`p0`..`p5`).
     - `dead-letter queue (DLQ)`: side gutter capturing failed/routed records.
   - **Live bar chart, throughput readouts, controls, and audio**: Bottom buckets (`p0`..`p5`) fill as a live bar chart alongside a readout for `records/sec` (rolling 5 s window), `late-arrival %`, and `DLQ count`, backed by a throttled (`~1 s`) `aria-live="polite"` summary. Visitors launch balls via pointer drag-and-release on the plunger (`touch-action: none`), `Space`/`Enter`, or a `"Launch record"` button, trigger a `"Backfill"` flood (60 staggered balls default; 12 under `prefers-reduced-motion: reduce`), and nudge balls horizontally via mobile `DeviceOrientationEvent` tilt (behind an explicit permission button) or keyboard arrows / on-screen nudge buttons. Peg hits emit rate-limited (`<= 20/s`, `<= -18 dB`) WebAudio pachinko clicks gated by the site sound toggle.
   - **On-call pager Easter egg**: Hitting the DLQ 3 times in a row (`dlqStreak === 3`) pops a viewport-pinned, focus-managed paper `"on-call pager"` gag dialog (`data-testid="pachinko-pager"`, `role="dialog"`) on both `1366x768` desktop and `390x844` mobile viewports and resets the streak when dismissed.

## Architecture & Key Decisions

1. **Custom Verlet engine over Matter.js (`lib/pachinko/sim.ts`)**: Avoids ~80 KB of third-party bundle weight, guarantees seeded fixed-timestep determinism in `node:test`, and directly models pipeline stage hooks (`dedupe` bounce stamp, `join` hold/merge + timeout release, `partition` hash routing, and `dlqStreak === 3` pager state).
2. **Raw WebGL2 quad shader + deterministic Canvas 2D fallback (`lib/booth/film-stock.ts`)**: Keeps `/play/booth` zero-dependency and fast while guaranteeing pixel-verifiable unit tests and headless Chromium E2E reliability even if WebGL is unavailable or loses context.
3. **Mobile viewport pinning (`390x844`)**: Both `.rise:has(.booth-root)` and `.rise:has(.pachinko-root)` disable ancestor transform containment so fixed/sticky overlays (including the 3-DLQ `"on-call pager"` dialog) remain strictly within `[0, window.innerHeight]` and move keyboard focus (`focus({ preventScroll: true })`) to the primary action button.
4. **Parallel 4-task DAG**:
   - **Task 1 (`qa: "skip"`)**: Pure booth film-stock shaders/kernels, strip composer, sample portrait, camera lifecycle controller, and shutter-clack sound cue + unit tests.
   - **Task 2 (`depends_on: ["1"]`, `qa: "required"`)**: `/play/booth` UI route, `next.config.ts` camera `Permissions-Policy`, purikura doodle/sticker layer, PNG/print export, and Chromium E2E suite.
   - **Task 3 (`qa: "skip"`)**: Pure Pipeline Pachinko Verlet engine, 5 pipeline stages, metrics, and 3-DLQ pager trigger + unit tests.
   - **Task 4 (`depends_on: ["2", "3"]`, `qa: "required"`)**: `/play/pachinko` UI route, `/play` discovery teasers for both toys, and Chromium E2E suite.

## Prerequisites (`platform.plan-prerequisites.v1`)

All capabilities are repository-owned (`external_dependencies_reviewed: true`, `prerequisites: []`). Probed and admitted via `plan_manager_set_prerequisites` and `plan_manager_probe_prerequisites` (see `prerequisites.json` and `prerequisite-probe.md`).

## Task Contracts

### Task 1 — Ink Purikura film-stock shaders, strip composer, and camera controller (`sequence: 1`, `qa: "skip"`)
- **Depends on**: none
- **Interfaces**: `lib/booth/film-stock.ts; lib/booth/strip.ts; lib/booth/camera.ts; lib/booth/sample-portrait.ts; lib/booth/booth.test.ts; lib/sound.ts; lib/sound.test.ts; scripts/verify-booth-engine.mjs; projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-1-evidence.md`
- **Verification**:
  1. `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/booth/booth.test.ts lib/sound.test.ts && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-booth-engine.mjs`
  2. `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`

### Task 2 — Ink Purikura Photobooth route, purikura doodle layer, and print/PNG export (`sequence: 2`, `qa: "required"`)
- **Depends on**: `1`
- **Interfaces**: `next.config.ts; app/(site)/(app)/play/booth/page.tsx; app/(site)/(app)/play/booth/booth.css; app/(site)/(app)/play/booth/_components/booth-studio.tsx; e2e/booth.test.ts; projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-2-evidence.md`
- **Verification**:
  1. `(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/booth.test.ts' && git checkout -- content/history.json`
  2. `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`

### Task 3 — Pipeline Pachinko deterministic Verlet engine and stage rules (`sequence: 3`, `qa: "skip"`)
- **Depends on**: none
- **Interfaces**: `lib/pachinko/sim.ts; lib/pachinko/pachinko.test.ts; scripts/verify-pachinko-sim.mjs; projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-3-evidence.md`
- **Verification**:
  1. `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/pachinko/pachinko.test.ts && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-pachinko-sim.mjs`
  2. `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`

### Task 4 — Pipeline Pachinko route, Play page discovery teasers, and E2E verification (`sequence: 4`, `qa: "required"`)
- **Depends on**: `2`, `3`
- **Interfaces**: `app/(site)/(app)/play/pachinko/page.tsx; app/(site)/(app)/play/pachinko/pachinko.css; app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx; app/(site)/(app)/play/page.tsx; e2e/pachinko.test.ts; projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-4-evidence.md`
- **Verification**:
  1. `(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/pachinko.test.ts' && git checkout -- content/history.json`
  2. `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`
