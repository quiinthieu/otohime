# Task 6 Execution Evidence — `pm-294` / `t-1688` (`run-9331`)

## 1. Run & Build Identity
- **Plan ID**: `pm-294` ("Ink Booth & Pipeline Pachinko", Revision 2)
- **Task ID**: `t-1688` ("Style Pipeline Pachinko with site paper-and-ink tokens, harden CI browser gates, and prove visual + drain E2E")
- **Run ID**: `run-9331`
- **Role / Model / Effort**: `software_engineer` / `Gemini 4 Argon` / `High`
- **Node.js Runtime**: `v22.23.3`
- **Next.js Production Build ID (`.next/BUILD_ID`)**: `NMxjQw6rEUd1kiWLGn1f-` (Next.js `16.4.2` Turbopack, 215 static/PPR routes generated)
- **Chromium Browser Binary**: `156.0.8078.48` via `playwright-core` (`channel: "chrome"`)
- **Base Commit (`HEAD` before commit)**: `770acf8661dc5c46affb3ac2c2a30c8413b46f81` (`pm-294/t-1687`)

## 2. Evidence Classification
- **Integration deployed**: Yes — all 8 declared task interfaces (`app/(site)/(app)/play/pachinko/pachinko.css`, `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`, `e2e/pachinko.test.ts`, `e2e/bottle-ui.test.ts`, `scripts/probe-end.mjs`, `.github/workflows/ci.yml`, `scripts/ci-workflow.test.mjs`, and `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-6-evidence.md`) are updated and wired into the production build and CI workflow.
- **Waiting for capacity**: None (`0` deferred checks; all local unit, typecheck, lint, gate-closure, Playwright E2E, and `scripts/probe-end.mjs` browser checks executed locally in this locked environment).
- **Execution demonstrated**: Yes — real production Next.js build (`next build` + `next start`), real embedded PostgreSQL (`scripts/e2e.mjs --serve-db`), real headless Chromium `156.0.8078.48` via `playwright-core`, real `scripts/check-gate-closure.mjs`, and real `scripts/probe-end.mjs` (`177 ok, 0 failed`) executed and passed.
- **Product delivered**: Yes — `/play/pachinko` uses only defined `:root` CSS custom properties from `app/(site)/globals.css`, renders visible borders (`>= 1.5px`) and opaque paper/ink surfaces across all machine and control elements, keeps `.pachinko-status-bar` below `.masthead` (`top: 4.5rem; z-index: 15`) on scroll, draws the Stage 3 join funnel walls from `sim.board.segments`, and drains a 60-record Backfill to `IN-FLIGHT: 0` (`completed: 60`) in `< 3s` at both `1366x768` and `390x844`.

## 3. Executable & Artifact Fingerprints (SHA-256)
| File | SHA-256 |
| --- | --- |
| `app/(site)/(app)/play/pachinko/pachinko.css` | `0def8d569e9981aef5417a8abb659d7706f47c78ecf7f81471230bb718f090a5` |
| `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx` | `0773b915e740d4de26f499778669dc3eba22449860bc641d4157e13ead72aac1` |
| `e2e/pachinko.test.ts` | `1be1cddf28b3a0246b1216f989f383dc1e8a41a2d6634a7127e7c947cd057b0b` |
| `e2e/bottle-ui.test.ts` | `c3f57839331578969779b49e565c227aee566617023ea2772ef4ee70ba3a643d` |
| `scripts/probe-end.mjs` | `2cbc4fd0f8bb6e3209e90f7548d06b0771c98e55290789c3b02d87ebe69bf7ad` |
| `.github/workflows/ci.yml` | `37cdc7fc1dfd5bee6075b0619b0caaca9a9e0e9d603476affce480d95f350987` |
| `scripts/ci-workflow.test.mjs` | `1a5bdc7d9be8f71a25ac64ebd90216661fbb6348c837719e791359acb811902d` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |

## 4. Defects Remediated
1. **Undefined CSS Variables & Transparent/Borderless Surfaces on `/play/pachinko` (`app/(site)/(app)/play/pachinko/pachinko.css`)**:
   - Replaced all 41 occurrences of `--fg`, 22 occurrences of `--bg`, 14 occurrences of `--accent`, and `@theme inline` `--font-mono` references with defined `:root` custom properties from `app/(site)/globals.css` (`--ink`, `--paper`, `--paper-2`, `--field`, `--muted`, `--line`, `--hairline`, `--danger`, `--coral`, `--yellow`, `--shade`, `--on-swatch`).
   - Gave `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-stage-panel`, `.pachinko-telemetry-panel`, `.pachinko-plunger-rail`, `.pachinko-plunger-track`, `.pachinko-plunger-knob`, `.pachinko-btn`, and `.pachinko-pager` explicit opaque `background-color` values, solid `border` widths (`1.5px` to `3px`), and hard ink offset `box-shadow`s.
   - Positioned `.pachinko-status-bar` at `position: sticky; top: 4.5rem; z-index: 15; background-color: var(--paper-2); border: 2px solid var(--ink)` so it stays cleanly below `.masthead` (`top: 0; height: 4rem; z-index: 20`) during scroll.
2. **Stage 3 Join Funnel Wall Rendering & 60-Record Backfill Drain Speed (`app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`)**:
   - Updated `drawBoard()` to stroke the Stage 3 funnel wall segments directly from `sim.board.segments` (`funnel-left` and `funnel-right`) in addition to the dashed join guide lines.
   - Scaled the `requestAnimationFrame` simulation tick loop (`STEPS_PER_FRAME_NORMAL = 8`, `STEPS_PER_FRAME_REDUCED = 16`, with delta-time scaling up to 24 steps/frame) so a 60-record Backfill drains completely to `IN-FLIGHT: 0` (`completed === 60`) in `< 3s` at both `1366x768` and `390x844`.
3. **Sub-pixel Layout Settlement at `390x844` in `e2e/bottle-ui.test.ts`**:
   - Hardened `settle(root, font)` in `e2e/bottle-ui.test.ts` to wait for `.end-inner`'s computed `paddingBlockStart` (`3.75 * root` unless inline `paddingBlockStart` is overridden by the negative control) and two consecutive `requestAnimationFrame` frames of stable `sceneTop` and `footerHeight` before measuring `topClearance`.
4. **Detached/Replaced `/music` Television Iframe Ownership in `scripts/probe-end.mjs`**:
   - Updated `recordIframes` in `scripts/probe-end.mjs` to wrap `Element.prototype.setAttribute`, `HTMLIFrameElement.prototype.src`, `Element.prototype.replaceWith`, and `Node.prototype.replaceChild` so player iframes inside `main#main` are tagged with `data-probe-end-player="1"` and reported to `__probeEndRecordPlayerFrame` before synchronous network requests fire.
   - Updated `verifyPlayerFrame` in `scripts/probe-end.mjs` to fall back to `recorded(frame)` whenever `!iframe.isConnected` or `frame.frameElement()` / `el.evaluate()` throws during `<Suspense>` hydration swap or route teardown, while still rejecting any iframe inside `footer, .end`.
5. **CI Workflow Timeout Budgets & POSIX `timeout` Fallback (`.github/workflows/ci.yml`, `scripts/ci-workflow.test.mjs`)**:
   - Verified `jobs.checks.timeout-minutes: 30` and `E2E against next start` `timeout-minutes: 17` with `timeout --signal=TERM --kill-after=10s 900s npm run test:e2e`, and added a POSIX shell `timeout()` fallback in `.github/workflows/ci.yml` when GNU `timeout` is not on `PATH` (fixing `scripts/ci-workflow.test.mjs` and `lib/e2e-runner.test.ts` on macOS workers).

## 5. Real / Fake Boundaries & Negative Controls
- **Real boundaries**:
  - Real Next.js `16.4.2` production build (`npm run build`) and production server (`next start`).
  - Real embedded PostgreSQL database (`scripts/e2e.mjs --serve-db`) with Drizzle migrations applied (`npm run db:migrate`).
  - Real Chromium `156.0.8078.48` browser layout, CSS custom property cascade, canvas rendering, and pointer/keyboard/scroll dispatch via `playwright-core`.
- **Fake boundaries**:
  - Synthetic `DeviceOrientationEvent` dispatch in `e2e/pachinko.test.ts` (headless Chromium has no hardware gyroscope).
  - Deterministic `launchBallWithSeed` DLQ consecutive counter test hook in `e2e/pachinko.test.ts` to test the 2-DLQ negative control and 3-DLQ positive trigger deterministically after verifying natural Backfill drain.
  - Unit-level mock DOM/Request harness in section `8b` of `scripts/probe-end.mjs` (`verifyPlayerFrame` / `isPlayerIframe` unit checks) paired with full live browser verification across all routes.
- **Negative controls exercised**:
  - `e2e/pachinko.test.ts`: 2 consecutive DLQ arrivals (`dlqConsecutive === 2`) proven NOT to open `.pachinko-pager` (`count === 0`), followed by the 3rd consecutive DLQ arrival opening `.pachinko-pager` (`role="alertdialog"`) and focusing `.pachinko-pager-ack`.
  - `e2e/bottle-ui.test.ts`: Old `.end-bottle-slot { inset-block-start: -0.75rem }` (`oldOffset.gap < 0`) and old `.end-inner { padding-block-start: 2.5rem }` (`oldPadding.topClearance < 0`) proven to fail clearance at `1366x768`, `768x1024`, and `390x844`, while the production styles pass (`gap >= 4`, `topClearance >= 2`).
  - `scripts/probe-end.mjs`: Delayed-src and detached/replaced player iframe inside `main#main` is attributed to the `/music` television (`isPlayerIframe === true`), whereas the exact same embed URL inside `footer.end` or on a look-alike host (`youtube.com.evil.example`) is rejected (`isPlayerIframe === false`).

## 6. Verification History & Outputs
- **History completeness**: Complete (`100%` of local verification runs and logs read in full; `0` truncated or unread failure tails).
- **Command 1 (`pachinko-booth-bottle-e2e`)**:
  ```
  (test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/pachinko.test.ts' 'e2e/booth.test.ts' 'e2e/bottle-ui.test.ts' && git checkout -- content/history.json
  ```
  - **Result**: Exit `0` (`26` tests passed, `0` failed in `45,128ms`: `6/6` in `e2e/pachinko.test.ts`, `5/5` in `e2e/booth.test.ts`, `15/15` in `e2e/bottle-ui.test.ts`).
- **Command 2 (`gate-closure-and-unit-checks`)**:
  ```
  (test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint && node scripts/check-gate-closure.mjs
  ```
  - **Result**: Exit `0` (`npm test`: `2,618` passed, `0` failed in `35,868ms`; `npm run typecheck`: `0` errors; `npm run lint`: `0` errors; `node scripts/check-gate-closure.mjs`: `certified: true`, `local_controls: "pass"`, `failures: []` across all 6 gate-closure suites).
- **Command 3 (Full Browser `scripts/probe-end.mjs` against `next start`)**:
  - **Result**: Exit `0` (`probe: 177 ok, 0 failed`, `52` external requests attributed to `/music`'s existing television, `0` unexpected external network requests from footer pages, `0` console/page/hydration/server errors).
