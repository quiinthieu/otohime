# Task 6 (`t-1688`) QA Report — Style Pipeline Pachinko with Site Paper-and-Ink Tokens, Harden CI Browser Gates, and Prove Visual + Drain E2E

## 1. Verdict & Identity Summary
- **Verdict**: `pass`
- **Plan ID**: `pm-294` (*Ink Booth & Pipeline Pachinko*, Revision 2)
- **Task ID**: `t-1688` (*Style Pipeline Pachinko with site paper-and-ink tokens, harden CI browser gates, and prove visual + drain E2E*)
- **QA Run ID**: `run-9343` (`role=quality_engineer`)
- **Task Manager Task ID**: `5c217345-626d-42d6-8da6-052aed9dc5f9` (`worker=avietidol-mac-mini`, Node.js `v22.23.3`, Next.js `16.4.2` Turbopack, Chromium `156.0.8078.48`)
- **QA Run Profile / Model / Effort**: `agent_profile=agy-argon-medium`, `profile_flags=--model gemini-4-argon-medium --dangerously-skip-permissions` (human-readable: Gemini 4 Argon Medium)
- **Software Engineer Delivery Run**:
  - `run-9331` (`role=software_engineer`, `agent_profile=agy-argon-high`, `profile_flags=--model gemini-4-argon-high --dangerously-skip-permissions`, task-manager task `c66c9264-0f4c-415a-91fb-e4fc0e5e17b3` on `avietidol-mac-mini`, `callbackState="delivered"`, commit `c532e4edbc259902b41c457bda0a77557d03b291`)
- **Green Gate Verify Run**:
  - `run-9341` (`role=verify`, `status=succeeded`, `sha=c532e4e`, task-manager task `b74faf2b-7be8-4350-950a-04140789e3b5` on `avietidol-z490`, `callbackState="delivered"`): both `pachinko-booth-bottle-e2e` (`82,817ms`, exit `0`) and `gate-closure-and-unit-checks` (`74,898ms`, exit `0`) passed.
- **Cited Delivery & Deployed SHA**: `c532e4edbc259902b41c457bda0a77557d03b291` (`c532e4e`)
  - **GitHub Actions Main CI & Production Deployment**: Run `40649996558` (`#544` for `c532e4edbc259902b41c457bda0a77557d03b291`) completed `success` across both `checks` (job `122687584073`: `E2E against next start` `07:30:40Z -> 07:41:52Z` `success`, `Motion probe, signed in` `07:41:52Z -> 07:44:42Z` `success`, `Footer walk` `07:44:42Z -> 07:44:44Z` `success`, `Footer Chromium probe` `07:44:44Z -> 07:45:46Z` `success`) and `production` (job `122694644371`: `07:46:05Z -> 07:49:13Z` `success`).
  - **Live Production Health Endpoint (`https://otohime.dev/api/health`)**: `{"ok":true,"sha":"c532e4edbc259902b41c457bda0a77557d03b291"}` (`git merge-base --is-ancestor c532e4edbc259902b41c457bda0a77557d03b291 c532e4edbc259902b41c457bda0a77557d03b291` exit `0`).
- **Commit Identity Check**:
  - Delivery commit `c532e4edbc259902b41c457bda0a77557d03b291` author & committer: `Otohime <quiinthieu@gmail.com>` with zero `Co-Authored-By` trailers.
  - Delivery artifact `author.txt` in `c66c9264-0f4c-415a-91fb-e4fc0e5e17b3` (`run-9331`): `sha256=7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada` (`size=44` bytes, matches `Otohime <quiinthieu@gmail.com>`).
  - `bash scripts/setup-owner-git.sh --check`: `Effective commit author: Otohime <quiinthieu@gmail.com>`.

## 2. Delivery Classification
- **Integration deployed**: Yes — all 8 declared task interfaces (`app/(site)/(app)/play/pachinko/pachinko.css`, `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx`, `e2e/pachinko.test.ts`, `e2e/bottle-ui.test.ts`, `scripts/probe-end.mjs`, `.github/workflows/ci.yml`, `scripts/ci-workflow.test.mjs`, and `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-6-evidence.md`) are landed on `main` (`c532e4edbc259902b41c457bda0a77557d03b291`) and deployed live to `https://otohime.dev`.
- **Waiting for capacity**: No (`0` pending capacity dependencies; `0` deferred checks).
- **Execution demonstrated**: Yes — both contract verification commands, `scripts/probe-end.sh`, `scripts/walk-end.sh`, `scripts/verify-pachinko-sim.mjs`, `scripts/verify-booth-engine.mjs`, and an independent QA Playwright negative-control probe (against both local `next start` and live `https://otohime.dev`) were executed and passed:
  1. Contract `gate-closure-and-unit-checks`: `npm test` (`2,618 pass, 0 fail` in `36,670.58ms`), `npm run typecheck` (`0` errors), `npm run lint` (`0` errors), and `node scripts/check-gate-closure.mjs` (`certified: true`, `local_controls: "pass"`, `failures: []`, exit `0`).
  2. Contract `pachinko-booth-bottle-e2e`: `26 pass, 0 fail` across `e2e/pachinko.test.ts` (`6/6`), `e2e/booth.test.ts` (`5/5`), and `e2e/bottle-ui.test.ts` (`15/15`) in `45,512.33ms` (exit `0`).
  3. Full browser footer probe (`SKIP_BUILD=1 PORT=4093 bash scripts/probe-end.sh`): `probe: 177 ok, 0 failed` (`66` external requests attributed to `/music` television, `0` unexpected external network requests from footer pages, `0` hydration/console/page errors, exit `0`).
  4. Footer walk (`SKIP_BUILD=1 PORT=4095 bash scripts/walk-end.sh`): `walk: 67 ok, 0 failed` (exit `0`).
  5. Independent QA Playwright negative-control & alternate-seed drain probe (`qa-independent-pachinko.test.ts`): passed against both local `next start` (`7,795.85ms`) and live `https://otohime.dev` across `1366x768` (light theme, `seed=777`, `IN-FLIGHT: 0`, `settled=33, joined=27` in `3.31s`) and `390x844` (dark theme, `seed=20261028`, `IN-FLIGHT: 0`, `settled=33, joined=27` in `2.27s`).
- **Product delivered**: Yes — all acceptance criteria and build contract requirements for `t-1688` are verified locally and in live production at `https://otohime.dev/play/pachinko`, `https://otohime.dev/play/booth`, and `https://otohime.dev/play` (`c532e4edbc259902b41c457bda0a77557d03b291`).

## 3. Executable & Artifact Fingerprints (SHA-256)
| File | Role | SHA-256 | Matches `c532e4e` |
| --- | --- | --- | --- |
| `app/(site)/(app)/play/pachinko/pachinko.css` | Paper-and-ink styles using only defined `:root` tokens from `app/(site)/globals.css`, solid borders, opaque surfaces, and sticky `.pachinko-status-bar` (`top: 4.5rem; z-index: 15`) | `0def8d569e9981aef5417a8abb659d7706f47c78ecf7f81471230bb718f090a5` | Yes |
| `app/(site)/(app)/play/pachinko/_components/pachinko-machine.tsx` | Stage 3 join funnel walls rendered from `sim.board.segments` and delta-scaled simulation steps (`8..24` steps/frame) | `0773b915e740d4de26f499778669dc3eba22449860bc641d4157e13ead72aac1` | Yes |
| `e2e/pachinko.test.ts` | Playwright E2E suite asserting CSS token resolution, opaque surfaces/borders, sticky `.masthead` clearance on scroll, and 60-record Backfill drain to `IN-FLIGHT: 0` at `1366x768` and `390x844` | `1be1cddf28b3a0246b1216f989f383dc1e8a41a2d6634a7127e7c947cd057b0b` | Yes |
| `e2e/bottle-ui.test.ts` | Reserved footer geometry E2E hardened in `settle(root, font)` to wait for `.end-inner` `paddingBlockStart` and 2 stable rAF ticks | `c3f57839331578969779b49e565c227aee566617023ea2772ef4ee70ba3a643d` | Yes |
| `scripts/probe-end.mjs` | Footer Chromium probe hardened in `recordIframes` and `verifyPlayerFrame` for detached/replaced `/music` television iframes | `2cbc4fd0f8bb6e3209e90f7548d06b0771c98e55290789c3b02d87ebe69bf7ad` | Yes |
| `.github/workflows/ci.yml` | CI workflow with `checks` `timeout-minutes: 30`, `E2E against next start` `timeout-minutes: 17`, and POSIX `timeout()` fallback | `37cdc7fc1dfd5bee6075b0619b0caaca9a9e0e9d603476affce480d95f350987` | Yes |
| `scripts/ci-workflow.test.mjs` | CI workflow budget & `timeout` guard unit tests | `1a5bdc7d9be8f71a25ac64ebd90216661fbb6348c837719e791359acb811902d` | Yes |
| `projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/task-6-evidence.md` | SWE execution evidence report | `c0f017740a118b509a76b3ae46a785588d112ba4efa7d47012f608e5d05ff0c8` | Yes |
| `package-lock.json` | Locked dependency tree (zero external dependencies added) | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` | Yes |

## 4. Real vs. Fake Boundaries
- **Real in QA verification**:
  - Real Next.js `16.4.2` production build (`.next/BUILD_ID` `cA6sCrtPfGhRKhcoZxF8a`), real embedded PostgreSQL 17 + Drizzle migrations, real `next start` server, and real live production deployment on `https://otohime.dev` (`c532e4edbc259902b41c457bda0a77557d03b291`).
  - Real headless Chromium (`156.0.8078.48` via `playwright-core`) executing CSS cascade, layout geometry, scroll sticky offsets, pointer/keyboard events, and live `requestAnimationFrame` physics ticks.
  - Real `scripts/probe-end.sh` (`177 ok, 0 failed`), `scripts/walk-end.sh` (`67 ok, 0 failed`), and `scripts/check-gate-closure.mjs` (`certified: true`).
- **Controlled test doubles**:
  - Synthetic `DeviceOrientationEvent` dispatch in `e2e/pachinko.test.ts` (headless Chromium has no hardware accelerometer/gyroscope).
  - Unit-level mock frame objects in section `8b` of `scripts/probe-end.mjs` (`verifyPlayerFrame` unit assertions), paired with full live browser verification across all routes.

## 5. Bounded History & Queue Completeness
- **`plan_manager_list_runs(plan_id="pm-294")`** (complete — `21` of `21` runs inspected):
  - Revision 1 (`run-9278`..`run-9303`): `t-1683`, `t-1684`, `t-1685`, `t-1686` completed; `run-9303` (`acceptance_engineer`, `claude-opus-high`, `tm_task_id=e9327cc6-3bd3-48b8-8303-b22053b19f06`, `2cc83e6`) identified the Revision 2 remediation scope.
  - Revision 2:
    - `run-9306` (`product_owner`, `agy-argon-medium`, `tm_task_id=25d62707-0826-4303-99d3-ee7ce4670170`, `7c23e5e`): `succeeded`
    - `run-9322` (`software_engineer`, `t-1687`, `agy-argon-high`, `tm_task_id=6f9cc888-f07f-4597-97c8-6e68b36c941e`, `770acf8`): `succeeded`
    - `run-9330` (`verify`, `t-1687`, `tm_task_id=41d20d47-6843-4904-950a-6c42afed87fb`, `770acf8`): `succeeded`
    - `run-9331` (`software_engineer`, `t-1688`, `agy-argon-high`, `tm_task_id=c66c9264-0f4c-415a-91fb-e4fc0e5e17b3`, `c532e4e`): `succeeded` (`callbackState="delivered"`, raw log `81` lines read in full)
    - `run-9341` (`verify`, `t-1688`, `tm_task_id=b74faf2b-7be8-4350-950a-04140789e3b5`, `c532e4e`): `succeeded` (`callbackState="delivered"`, raw log `51` lines read in full)
    - `run-9343` (`quality_engineer`, `t-1688`, `agy-argon-medium`, `tm_task_id=5c217345-626d-42d6-8da6-052aed9dc5f9`): `running`
- **`task_manager_list_tasks` bounded pagination (`limit=10, offset=0`)**:
  - `PENDING`: `0` of `0` (complete)
  - `RUNNING`: `4` of `4` (complete — current QA task `5c217345-626d-42d6-8da6-052aed9dc5f9` on `avietidol-mac-mini` plus 3 unrelated tasks)
  - `COMPLETED`: `10` of `5006` (bounded page 1 — plus direct inspection of `c66c9264-0f4c-415a-91fb-e4fc0e5e17b3` and `b74faf2b-7be8-4350-950a-04140789e3b5`, both `COMPLETED` with `callbackState="delivered"`)
  - `FAILED`: `10` of `1246` (bounded page 1 — `0` failures for `pm-294` / `t-1688`)

## 6. Independent Evidence & Negative Controls Exercised
Outside the SWE test suite (`e2e/pachinko.test.ts`), QA authored and executed an independent Playwright probe (`qa-independent-pachinko.test.ts`) against both the local production server (`next start`) and live `https://otohime.dev`:
1. **Negative Control A — Pre-fix Undefined `--fg` / `--bg` / `--accent` Collapse vs. Shipped Site Tokens (Light & Dark Themes)**:
   - Verified on both `1366x768` (`colorScheme: "light"`) and `390x844` (`colorScheme: "dark"`, `data-theme="dark"`) that every `var(--*)` token referenced in `pachinko.css` (`--paper`, `--paper-2`, `--field`, `--ink`, `--muted`, `--line`, `--hairline`, `--danger`, `--yellow`, `--coral`, `--shade`, `--on-swatch`) resolves to a non-empty value on `document.documentElement`, while `--fg`, `--bg`, and `--accent` resolve to `""`.
   - Injected a negative-control element styled with the pre-fix rule (`border: 1.5px solid var(--fg); background: color-mix(in oklab, var(--bg) 95%, var(--fg) 5%)`) and verified its computed `backgroundColor` collapses to `rgba(0, 0, 0, 0)`, whereas `.pachinko-root`, `.pachinko-status-bar`, and `.pachinko-pager` render opaque `rgb(...)` backgrounds and solid borders (`>= 1.5px`) in both light and dark themes.
2. **Negative Control B — Sticky `.pachinko-status-bar` Scroll Offset (`top: 4.5rem` vs. Pre-fix `top: 0.5rem`)**:
   - Scrolled `/play/pachinko` to `scrollY = 420` at both `1366x768` and `390x844`; verified the shipped `.pachinko-status-bar` stays below `.masthead` (`realStatusTop >= mastheadBottom - 1`), whereas temporarily overriding `statusBar.style.top = "0.5rem"` (the pre-fix value) causes `.pachinko-status-bar` to overlap `.masthead` (`negStatusTop < mastheadBottom`).
3. **Independent Alternate-Seed 60-Record Backfill Drain (`seed=777` & `seed=20261028`)**:
   - Outside the seed (`1346454344`) used in `e2e/pachinko.test.ts`, triggered `Backfill (x60)` with `seed=777` at `1366x768` and `seed=20261028` at `390x844` on both local `next start` and live `https://otohime.dev`. Verified both drained completely to `IN-FLIGHT: 0` with `settled (33) + joined (27) === 60` in `2.27s–4.01s` (`<= 12s` budget) and `0` page errors.

## 7. Contract Requirements Checklist
| Requirement | Status | Evidence |
| --- | --- | --- |
| Replace every `--fg`, `--bg`, and `--accent` in `pachinko.css` with defined site custom properties from `app/(site)/globals.css` so every `var(--*)` resolves non-empty on `document.documentElement` | Pass | `e2e/pachinko.test.ts` test 5 + `qa-independent-pachinko.test.ts` |
| Give `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-stage-panel`, `.pachinko-telemetry-panel`, `.pachinko-plunger-rail`, `.pachinko-plunger-track`, `.pachinko-plunger-knob`, `.pachinko-btn`, and `.pachinko-pager` opaque backgrounds, visible borders (`borderTopWidth >= 1px`), and offset `.pachinko-status-bar` below `.masthead` (`top: 4.5rem; z-index: 15`) | Pass | `e2e/pachinko.test.ts` test 5 + `qa-independent-pachinko.test.ts` (light & dark themes) |
| Update `pachinko-machine.tsx` so `drawBoard()` renders funnel walls from `sim.board.segments` and 60-record Backfill drains to `IN-FLIGHT: 0` within `<= 12s` | Pass | `pachinko-machine.tsx:247-254`, `606-613` + E2E drain (`< 4.1s`) |
| Expand `e2e/pachinko.test.ts` at `1366x768` and `390x844` to assert token resolution, opaque surfaces/borders, scroll clearance below `.masthead`, and 60-record Backfill drain to `IN-FLIGHT: 0` with `completed >= 30` | Pass | `e2e/pachinko.test.ts` (`6/6` pass) |
| Harden `e2e/bottle-ui.test.ts` (`settle`), `scripts/probe-end.mjs` (`verifyPlayerFrame` / `recordIframes`), and `.github/workflows/ci.yml` (`30m` job / `17m` E2E step) so `main` CI builds and deploys cleanly to production | Pass | Local `e2e/bottle-ui.test.ts` (`15/15`), `scripts/probe-end.sh` (`177 ok, 0 failed`), and GitHub Actions run `40649996558` (`checks` + `production` `success`, live `/api/health` = `c532e4edbc259902b41c457bda0a77557d03b291`) |

## 8. Defects & Deferred Checks
- **Defects**: None (`0`).
- **Deferred checks**: None (`0`).
