# Plan: Ink Booth & Pipeline Pachinko (`pm-294`)

- **Plan ID**: `pm-294`
- **Title**: Ink Booth & Pipeline Pachinko
- **Revision**: `2` (`run-9306`, Acceptance Cycle 1 Remediation)
- **Plan Folder**: `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/`
- **Target Routes**: `/play/booth` (Ink Purikura Photobooth), `/play/pachinko` (Pipeline Pachinko), and `/play` (Play index navigation links)

---

## 1. Acceptance Cycle 0 Status & Revision 2 Scope

### What Passed in Acceptance Cycle 0 (`rep-5511` / `rep-5510`)
- **Ink Purikura Photobooth (`/play/booth`) is live in production (`22a88f0`) and passed 32 / 32 acceptance checks** across desktop (`1366x768`) and mobile (`390x844`):
  - Sample Portrait zero-camera flow, 3-2-1 countdown (`prefers-reduced-motion` instant capture), shutter clack + ink flash, and 4-frame capture (`4 / 4 frames`).
  - Live switching across all 3 film stocks (`Sumi-e Ink Wash`, `Riso Two-Colour Halftone`, `Newsprint Dot Screen`) with verified pixel deltas and distinct strip buffers.
  - Vertical torn-paper photo strip with 4 distinct frame crops, red hanko date stamp, `otohime.dev // ink purikura booth` footer, 6 purikura stamps, 3 ink pens (`Sumi Ink`, `Vermilion`, `Gold Leaf`), `Undo` / `Clear`, valid `600x1800` PNG download (`151,694` bytes), and `@media print` sheet rules.
- **Completed Tasks Preserved from Revision 1**:
  - `t-1683` (*Ink Purikura film-stock shaders, sample portraits, and torn-paper strip composer*) — `done`
  - `t-1684` (*Ink Purikura Photobooth route (/play/booth), purikura doodle studio, and E2E verification*) — `done`
  - `t-1685` (*Pipeline Pachinko 2D physics simulation, stage mechanics, and WebAudio click synthesizer*) — `done`
  - `t-1686` (*Pipeline Pachinko route (/play/pachinko), play index integration, and E2E verification*) — `done`

### Defects Identified in Acceptance Cycle 0 & Remediated in Revision 2
1. **Defect 1 (Blocker — Production Deployment Blocked by Main CI Failures)**:
   - `https://otohime.dev/play/pachinko` returns `404` and `https://otohime.dev/play` lacks the `/play/booth` and `/play/pachinko` index cards in production because `main` CI failed on both pachinko commits:
     - Run `40633395018` (`f50d7aa`): `E2E against next start` hit the 12-minute step timeout after adding `e2e/booth.test.ts` and `e2e/pachinko.test.ts`, and `e2e/bottle-ui.test.ts:185` (`"sceneTop: Bottle state preserves reserved footer geometry"` at `768px` / `200%` root font scale) raced with `.end-inner` `padding-block-start: 3.75rem` layout reflow.
     - Run `40635091133` (`68dd79d`): `Gate: Footer Chromium probe` (`scripts/probe-end.mjs`) failed with `network: zero unexpected external network requests from footer pages: /music -> https://www.youtube.com/embed/...` because when `Television` on `/music` unmounts (either on `<Suspense>` fallback-to-live swap or route navigation to `/projects`), `verifyPlayerFrame` evaluated `iframe.closest("main#main")` on an already-disconnected `<iframe>` element (returning `false` without throwing and bypassing `recorded(frame)`), or exited early when `frame.frameElement()` threw before Playwright updated `frame.isDetached()`.
2. **Defect 2 (Blocker — Undefined CSS Custom Properties in `pachinko.css`)**:
   - `app/(site)/(app)/play/pachinko/pachinko.css` references `var(--fg)` (41×), `var(--bg)` (22×), and `var(--accent)` (14×), which are not defined in `app/(site)/globals.css` (the site defines `--paper`, `--paper-2`, `--field`, `--ink`, `--muted`, `--line`, `--hairline`, `--danger`, `--yellow`, `--coral`, `--mint`, `--blue`, `--pink`, `--shade`, `--on-swatch`).
   - Consequently, every `border: ... var(--fg)` and `background: color-mix(in srgb, var(--bg) ..., ...)` collapsed to `0px none` and `rgba(0, 0, 0, 0)` (transparent), leaving:
     - No visible plunger track or knob (`border: 0px none; background: rgba(0, 0, 0, 0)`).
     - Bare bold text for `Launch Record`, `Backfill (x60)`, `Sound`, `Force DLQ x3`, and `Reset Board` buttons.
     - No machine frame or panel backgrounds (`rgba(0, 0, 0, 0)`).
3. **Defect 3 (Major — Sticky Status Bar Overprints Site Header on Scroll)**:
   - `.pachinko-status-bar` had `position: sticky; top: 0.5rem; z-index: 20` with a transparent background (`color-mix` with undefined `var(--bg)`), sitting directly on top of `.masthead` (`position: sticky; top: 0; height: 4rem; z-index: 20`) and overprinting the site logo, `Sign in`, and theme buttons when scrolled.
4. **Defect 4 (Major — On-Call Pager Modal Has Transparent Background and No Border)**:
   - `.pachinko-pager` used `background: var(--bg)` and `border: 2.5px solid var(--fg)`, rendering as transparent floating text over the board and footer (`backgroundColor: rgba(0, 0, 0, 0)`, `border: 0px none`).
5. **Defect 5 (Major — Backfill Jams on the Join Funnel Forever)**:
   - In `lib/pachinko/sim.ts`, the slanted funnel walls `funnel-left` (`(92, 355) -> (262, 438)`) and `funnel-right` (`(520, 355) -> (350, 438)`) pass within `18.7px` of `join-p0 (190, 382)` and `12.8px` of `join-p2 (238, 412)`—narrower than `2 * ball.radius + peg.radius = 21.5px`. Combined with inward horizontal guidance (`dx * 8.5`) and a downward-only anti-stall kick (`vy = Math.max(vy, 130)`), 7–10 records out of every 60-record Backfill remain `IN-FLIGHT` forever across all seeds.
   - Additionally, `drawBoard()` in `pachinko-machine.tsx` drew funnel walls from `FUNNEL_CENTER_X ± 150` (`156..456`) to `FUNNEL_CENTER_X ± 24` (`282..330`), mismatching the physics segments in `lib/pachinko/sim.ts`.
6. **Defect 6 (Process / Verification Gap in `e2e/pachinko.test.ts`)**:
   - `e2e/pachinko.test.ts` asserted only bounding-box dimensions and `completed > 0`, missing the undefined CSS variables, transparent backgrounds/borders, sticky header collision, and permanent `IN-FLIGHT` jam.
7. **Cosmetic Polish (Ink Booth Hanko Date Stamp Overflow in `lib/booth/strip.ts`)**:
   - In `lib/booth/strip.ts`, `dateScale = Math.max(1, Math.round(scaleFactor * 1.5))` evaluates to `2` at `600x1800`, making the 10-character date `YYYY.MM.DD` `120px` wide inside a hanko stamp of `radius = 56px` (inner ring diameter `2 * 56 * 0.74 = 82.88px`), spilling past both edges of the inner ring.

---

## 2. Technical Remediation Design

### 2.1 Deterministic Join-Funnel Drain (`lib/pachinko/sim.ts`) & Hanko Stamp Bounds (`lib/booth/strip.ts`)
- **Join-Funnel Geometry & Guidance (`lib/pachinko/sim.ts`)**:
  - Align the `funnel-left` and `funnel-right` segment endpoints in `createPachinkoBoard()` with the visual funnel geometry in `pachinko-machine.tsx` (`(156, 355) -> (282, 438)` and `(456, 355) -> (330, 438)`), leaving a wide central throat (`x = 282..330`, `48px` wide for `7.5px`-radius balls).
  - Reposition the `join` pegs so every peg lies strictly above the funnel throat with `>= 36px` clearance from both slanted funnel walls (`funnel-left` and `funnel-right`), eliminating any sub-diameter pinch point.
  - Update `computeStageGuidanceAccel` and anti-stall handling in `stepPachinko` so balls in the join stage (`y >= 340..466`) are guided along the funnel slope toward the central mouth (`FUNNEL_CENTER_X = 306`, `y = 438`) rather than pushed straight down into the slanted wall, and any ball whose stage age exceeds a bounded threshold (`> 4.5s` in a single upper stage or `> 10s` total flight time) is deterministically routed through the funnel mouth into the partition/bucket stage.
  - Verify across `DEFAULT_SEED` (`0x50414348`), `777`, `424242`, `20261028`, `99`, and `42` (plus back-to-back sequential 60-ball backfills) that every 60-record `scheduleBackfill` drains completely to `activeBalls === 0` and `scheduledSpawns.length === 0` within `<= 1800` simulation steps (`15s` simulated time), while preserving `joinMergeCount > 0`, `dedupeBounceCount > 0`, and `totalCompleted > 0`.
- **Booth Hanko Stamp Inner-Ring Fit (`lib/booth/strip.ts`)**:
  - In `composeStripBuffer` (`lib/booth/strip.ts`), render the hanko date inside the inner ring (`innerR = hR * 0.74`) by stacking the year (`YYYY`, 4 chars) and month-day (`MM.DD`, 5 chars) on two centered rows below `"OTOHIME"` (or scaling the date glyphs so maximum text width is `<= innerR * 1.35`), adjusting the horizontal divider bars so every red date-glyph pixel lies strictly inside `d <= hR * 0.72` with zero pixels spilling into the ring gap (`hR * 0.74 < d < hR * 0.84`) or outside the stamp.

### 2.2 Site Paper-and-Ink CSS Tokens (`pachinko.css`), Visual + Drain E2E (`e2e/pachinko.test.ts`), and CI Gate Hardening
- **CSS Token Replacement (`app/(site)/(app)/play/pachinko/pachinko.css`)**:
  - Replace all 77 occurrences of undefined `--fg`, `--bg`, and `--accent` with defined site tokens from `app/(site)/globals.css`:
    - `--fg` -> `var(--ink)`
    - `--bg` -> `var(--paper)` / `var(--paper-2)` / `var(--field)`
    - `--accent` -> `var(--danger)` / `var(--coral)`
  - Give `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-stage-panel`, `.pachinko-telemetry-panel`, `.pachinko-plunger-rail`, `.pachinko-plunger-track`, `.pachinko-plunger-knob`, `.pachinko-btn`, and `.pachinko-pager` explicit opaque backgrounds (`background-color: var(--paper-2)` / `var(--paper)` / `var(--ink)` / `var(--danger)`) and explicit solid borders (`border: 2px solid var(--ink)` / `1.5px solid var(--ink)`), with hard ink offset shadows (`var(--shade)`).
  - Change `.pachinko-status-bar` sticky offset from `top: 0.5rem; z-index: 20` to `top: 4.5rem; z-index: 15` with solid `background-color: var(--paper-2)` and `border: 2px solid var(--ink)` so scrolling never overlaps or overprints the `4rem` sticky `.masthead`.
- **Browser Drain Speed & Funnel Visual Sync (`app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`)**:
  - Ensure `drawBoard()` uses the exact funnel wall coordinates from `sim.board.segments` (`funnel-left` and `funnel-right`) so the drawn ink funnel and physics segments are identical.
  - Step the simulation during active backfills so a 60-record Backfill completes and reaches `IN-FLIGHT: 0` well within `<= 12s` of wall-clock browser time.
- **Playwright E2E Visual & Drain Assertions (`e2e/pachinko.test.ts`)**:
  - Parse `pachinko.css` and verify in the browser that every referenced `var(--*)` custom property resolves to a non-empty value on `getComputedStyle(document.documentElement)`.
  - Assert at both `1366x768` and `390x844` that `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-btn`, `.pachinko-plunger-track`, `.pachinko-plunger-knob`, and `.pachinko-pager` have `parseFloat(computedStyle.borderTopWidth) >= 1` and opaque `backgroundColor` (not `rgba(0, 0, 0, 0)` or `transparent`).
  - Scroll the page down (`window.scrollTo(0, 360)`) and assert `.pachinko-status-bar`'s bounding box does not overlap `.masthead` (`statusBarBox.top >= mastheadBox.bottom - 1`) and has an opaque background.
  - Trigger `Backfill (x60)` and wait until `data-testid="pachinko-active-badge"` returns to `"IN-FLIGHT: 0"` with `completed >= 30`, proving zero wedged records in the live browser loop.
- **CI Browser Gate Hardening (`e2e/bottle-ui.test.ts`, `scripts/probe-end.mjs`, `.github/workflows/ci.yml`, `scripts/ci-workflow.test.mjs`)**:
  - `e2e/bottle-ui.test.ts`: Update `settle(root, font)` in the reserved footer geometry test so after changing `document.documentElement.style.fontSize`, it waits for `.end-inner`'s computed `paddingBlockStart` to reflect `3.75 * root` (when inline `paddingBlockStart` is not overridden by the negative control) and waits for two consecutive animation frames with stable `sceneTop` and `footerHeight` before sampling `scaled`, while preserving the 1px tolerance and both negative controls.
  - `scripts/probe-end.mjs`: Fix `verifyPlayerFrame` and `recordIframes` so that when `/music`'s YouTube `<iframe>` inside `main#main` is created and then detached during `<Suspense>` swap or route navigation, `verifyPlayerFrame` always falls back to `recorded(frame)` whenever `isPlayerIframe` returns `false` on a disconnected node (`!iframe.isConnected`) or when `frame.frameElement()` / `el.evaluate()` throws during frame teardown, and `recordIframes` records both `src` and `getAttribute("src")` synchronously on mutation.
  - `.github/workflows/ci.yml` & `scripts/ci-workflow.test.mjs`: Increase `checks` job `timeout-minutes` from `25` to `30` and `E2E against next start` step `timeout-minutes` from `12` to `17` (updating the corresponding assertion in `scripts/ci-workflow.test.mjs`) so the full 21-file E2E suite completes reliably in CI without timing out at 12 minutes.

---

## 3. Prerequisites (`platform.plan-prerequisites.v1`)

All implementation, rendering, simulation, styling, and CI gate checks are 100% repository-owned (`external_dependencies_reviewed: true`, `prerequisites: []`). See `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/prerequisites.json`.

---

## 4. Revision 2 Task Breakdown (Build Contracts)

Completed Revision 1 tasks (`t-1683`, `t-1684`, `t-1685`, `t-1686`) remain preserved. Revision 2 proposes the 2 remaining remediation tasks numbered from `1`:

### Task 1 (`sequence: 1`, `role: "software_engineer"`, `qa: "skip"`)
- **Title**: Drain Pipeline Pachinko Backfill and fit Booth hanko date inside stamp ring
- **Depends on**: `[]`
- **Problem**: In `lib/pachinko/sim.ts`, every 60-record Backfill wedges 7–10 balls permanently between the slanted `funnel-left`/`funnel-right` segments and the `join-p0..p3` pegs because the peg-to-wall clearance (`12.8px`–`18.7px`) is smaller than `2 * ball.radius + peg.radius` (`21.5px`) and stage guidance pushes stalled balls straight downward into the V-wedge. Additionally, in `lib/booth/strip.ts`, the hanko stamp date text (`YYYY.MM.DD` at `dateScale = 2`, `120px` wide) is wider than the inner stamp ring (`~82.8px` diameter) and spills across both edges of the ring.
- **Interfaces**:
  - `lib/pachinko/sim.ts`
  - `lib/pachinko/pachinko.test.ts`
  - `scripts/verify-pachinko-sim.mjs`
  - `lib/booth/strip.ts`
  - `lib/booth/booth.test.ts`
  - `scripts/verify-booth-engine.mjs`
  - `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-5-evidence.md`
- **Action Items**:
  1. Update `createPachinkoBoard()` and stage guidance/anti-stall rules in `lib/pachinko/sim.ts` so `funnel-left` (`(156, 355) -> (282, 438)`) and `funnel-right` (`(456, 355) -> (330, 438)`) match the visual funnel walls, every `join` peg has `>= 36px` clearance from the slanted funnel segments, and slow balls in the join stage are guided along the funnel slope toward `FUNNEL_CENTER_X` (`306`) and through the funnel mouth (`y = 438`) without stalling.
  2. Add a deterministic stage-progression guarantee in `lib/pachinko/sim.ts` so no ball can remain trapped in launch/ingest/dedupe/join/partition indefinitely, and a 60-record `scheduleBackfill` always drains to `activeBalls === 0` and `scheduledSpawns.length === 0` within `<= 1800` simulation steps (`15s` at `1/120s`) with `totalCompleted > 0`, `joinMergeCount > 0`, and `dedupeBounceCount > 0` across `DEFAULT_SEED`, `777`, `424242`, `20261028`, `99`, and `42`, including back-to-back sequential backfills.
  3. Update `composeStripBuffer` in `lib/booth/strip.ts` so the hanko stamp date (`YYYY.MM.DD`) fits strictly inside the inner hanko circle (`d <= hanko.radius * 0.72`, e.g. by stacking `YYYY` and `MM.DD` or sizing the date glyphs and divider bars inside the inner ring) with zero date-glyph pixels spilling into the ring gap (`hanko.radius * 0.74 < d < hanko.radius * 0.84`) or outside the stamp.
  4. Expand `lib/pachinko/pachinko.test.ts`, `scripts/verify-pachinko-sim.mjs`, `lib/booth/booth.test.ts`, and `scripts/verify-booth-engine.mjs` to assert zero in-flight balls after Backfill across all 6 seeds and strict inner-ring containment of the hanko date stamp, and record verification output in `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-5-evidence.md`.
- **Non-Goals**:
  - Modifying CSS stylesheets or Playwright E2E tests (handled in Task 2).
- **Acceptance Criteria**:
  - Every 60-record `scheduleBackfill` in `lib/pachinko/sim.ts` drains completely to `activeBalls === 0` and `scheduledSpawns.length === 0` within `<= 1800` steps across seeds `0x50414348`, `777`, `424242`, `20261028`, `99`, and `42` (and across consecutive backfills), and the hanko date text in `lib/booth/strip.ts` stays strictly inside the inner stamp ring with all unit and verification scripts passing.
- **Verification**:
  - `pachinko-and-booth-engine-tests`: `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/pachinko/pachinko.test.ts lib/booth/booth.test.ts && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-pachinko-sim.mjs && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/verify-booth-engine.mjs`
  - `repo-checks`: `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`

### Task 2 (`sequence: 2`, `depends_on: ["1"]`, `role: "software_engineer"`, `qa: "required"`)
- **Title**: Style Pipeline Pachinko with site paper-and-ink tokens, harden CI browser gates, and prove visual + drain E2E
- **Depends on**: `["1"]`
- **Problem**: `app/(site)/(app)/play/pachinko/pachinko.css` uses undefined CSS variables `--fg` (41×), `--bg` (22×), and `--accent` (14×), causing all borders and backgrounds on `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-btn`, `.pachinko-plunger-track`, `.pachinko-plunger-knob`, and `.pachinko-pager` to collapse to `0px none` and `rgba(0, 0, 0, 0)`, the sticky `.pachinko-status-bar` to overprint `.masthead` on scroll, and the on-call pager to render as bare overlapping text. Furthermore, `e2e/pachinko.test.ts` lacked assertions for computed styles and zero-in-flight Backfill drain, and `main` CI failed in `E2E against next start` (12m timeout + `e2e/bottle-ui.test.ts:185` 200% zoom reflow race) and `Gate: Footer Chromium probe` (`scripts/probe-end.mjs` `/music` YouTube iframe unmount attribution race), preventing production deployment.
- **Interfaces**:
  - `app/(site)/(app)/play/pachinko/pachinko.css`
  - `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`
  - `e2e/pachinko.test.ts`
  - `e2e/bottle-ui.test.ts`
  - `scripts/probe-end.mjs`
  - `.github/workflows/ci.yml`
  - `scripts/ci-workflow.test.mjs`
  - `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-6-evidence.md`
- **Action Items**:
  1. Replace every `--fg`, `--bg`, and `--accent` reference in `app/(site)/(app)/play/pachinko/pachinko.css` with defined site custom properties from `app/(site)/globals.css` (`--ink`, `--paper`, `--paper-2`, `--field`, `--muted`, `--line`, `--danger`, `--coral`, `--yellow`, `--shade`, `--on-swatch`) so every `var(--*)` referenced in `pachinko.css` resolves to a non-empty value on `document.documentElement`.
  2. Give `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-stage-panel`, `.pachinko-telemetry-panel`, `.pachinko-plunger-rail`, `.pachinko-plunger-track`, `.pachinko-plunger-knob`, `.pachinko-btn`, and `.pachinko-pager` solid opaque backgrounds (`alpha === 1`), visible non-zero borders (`borderTopWidth >= 1px`), and hard ink offset shadows, and offset `.pachinko-status-bar` below the sticky `.masthead` (`top: 4.5rem; z-index: 15`) so scrolling never overlaps the site header.
  3. Update `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx` so `drawBoard()` renders the funnel walls directly from `sim.board.segments` (`funnel-left` and `funnel-right`) and the animation loop drains a 60-record Backfill smoothly to `IN-FLIGHT: 0` within `<= 12s` of browser wall-clock time.
  4. Expand `e2e/pachinko.test.ts` at desktop (`1366x768`) and mobile (`390x844`) to assert: (a) every `var(--*)` token in `pachinko.css` resolves non-empty on `document.documentElement`, (b) computed `borderTopWidth >= 1` and non-transparent `backgroundColor` (`rgba(..., 0)` rejected) on `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-btn`, `.pachinko-plunger-track`, `.pachinko-plunger-knob`, and `.pachinko-pager`, (c) scrolling the page keeps `.pachinko-status-bar` below `.masthead` (`statusBar.top >= masthead.bottom - 1`) with an opaque background, and (d) clicking `Backfill (x60)` drains all the way back to `data-testid="pachinko-active-badge"` text `"IN-FLIGHT: 0"` with `completed >= 30`.
  5. Harden the three CI gates so `main` builds and deploys cleanly to production: (a) in `e2e/bottle-ui.test.ts`, make `settle(root, font)` wait for `.end-inner`'s computed `paddingBlockStart` (`3.75 * root` unless inline `paddingBlockStart` is set) and two consecutive rAF ticks of stable `sceneTop`/`footerHeight` before returning; (b) in `scripts/probe-end.mjs`, ensure `verifyPlayerFrame` falls back to `recorded(frame)` when an iframe inside `main#main` was already disconnected during `<Suspense>` swap or navigation teardown (`!iframe.isConnected` or CDP exception) and `recordIframes` captures `src` attributes synchronously; and (c) in `.github/workflows/ci.yml` and `scripts/ci-workflow.test.mjs`, raise `checks` `timeout-minutes` to `30` and `E2E against next start` `timeout-minutes` to `17`. Record verification output in `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-6-evidence.md`.
- **Non-Goals**:
  - Modifying `/play/booth` UI components or introducing external dependencies.
- **Acceptance Criteria**:
  - `/play/pachinko` uses only defined site CSS tokens with visible borders and opaque paper/ink surfaces on the machine frame, plunger track/knob, action buttons, sticky status bar (which stays below `.masthead` on scroll), and on-call pager card; a 60-record Backfill drains to `IN-FLIGHT: 0` in Playwright E2E at `1366x768` and `390x844`; and `e2e/bottle-ui.test.ts`, `scripts/probe-end.mjs`, `scripts/check-gate-closure.mjs`, and the full CI suite pass cleanly.
- **Verification**:
  - `pachinko-booth-bottle-e2e`: `(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/pachinko.test.ts' 'e2e/booth.test.ts' 'e2e/bottle-ui.test.ts' && git checkout -- content/history.json`
  - `gate-closure-and-unit-checks`: `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint && node scripts/check-gate-closure.mjs`
