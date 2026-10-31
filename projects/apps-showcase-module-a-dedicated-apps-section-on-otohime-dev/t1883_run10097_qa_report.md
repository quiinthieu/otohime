# QA Report — `pm-303` / `t-1883` (`run-10097`)

> Author-side local observation only; the platform's measured execution of the committed `platform.role-suite.v1` suite (`projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/qa/suite.json`) after this process exits owns the final verdict and acceptance receipt.

## 1. Verdict & Delivery State

- **Verdict**: `fail` (`cause = "code"`)
- **Plan / Task / Run**: `pm-303` ("Ink Apps Workshop") / `t-1883` ("Animated ASCII and solar-drift terminal previews with contrast and reduced-motion safety") / `run-10097` (`quality_engineer`)
- **Required Coverage ID**: `t-1883:sha256:35304ad919bef86caf22c4c7304671952ff5b1e106ba37aee4691c759169da49`
- **Evaluated Delivery SHA (`HEAD` / `origin/main`)**: `607ccaf19d48c162057b3c5505094e8c72aabc91` (`source_sha: ""` in role-suite context because SWE `run-10095` exited without pushing a `t-1883` delivery commit)
- **Plan Base SHA**: `48043c85457bbd93ed81de44d4e588f9734130fb`
- **Delivery Classification**:
  - **Integration deployed**: Only `t-1882` (`be70fa432990352905ef0171f7819531e57c035a` + `t-1882` QA suite `607ccaf19d48c162057b3c5505094e8c72aabc91`) is on `origin/main` and deployed. Zero `t-1883` commits exist on `origin/main` or any remote branch.
  - **Waiting for capacity**: None (`0` pending jobs; `deployed_shas: {}`; `authorized_external_ids: null`).
  - **Execution demonstrated**:
    - Executed the updated `platform.role-suite.v1` suite in `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/qa/suite.json` (`4` cases, `declared_s = 960 <= budget_s = 1800`) and all `4` paired `--negative-control` invocations in the locked Node `v22.23.3` environment.
    - `t1882-data-nav-and-dropin-contract` passes (exit `0`), confirming `t-1882` remains green.
    - All `3` `t-1883` positive checks (`t1883-preview-engine-and-contrast-contract`, `t1883-lint-typecheck-and-unit-tests`, and `t1883-build-and-browser-preview-journey`) **fail** (exit `1`) against `607ccaf19d48c162057b3c5505094e8c72aabc91` because `lib/apps-preview.ts`, `lib/apps-preview.test.ts`, and `app/(site)/(app)/apps/_components/terminal-preview.tsx` are missing and `/apps/[slug]` does not mount `<TerminalPreview />`.
    - All `4` `--negative-control` invocations exit `1` as required when the same oracle functions detect the mutated observations.
  - **Product delivered**: **Not delivered** for `t-1883`.

---

## 2. Root-Cause Attribution & Identities

| Role / Stage | Run ID | Task Manager ID (`tm_task_id`) | Profile / Model / Effort | Worker / Account | Outcome & Attribution |
| --- | --- | --- | --- | --- | --- |
| Red Gate (`ver-4031`) | `run-10094` | `cd71ffe5-d08c-495c-ab7d-f605119a3507` | `agy-argon-high` / `Gemini 4 Argon (High)` / `high` (red-gate runner) | `avietidol-mac-mini` / `billie-agy` | `red_gate_already_green` on `607ccaf19d48c162057b3c5505094e8c72aabc91`: `node --test lib/apps-preview.test.ts lib/apps.test.ts lib/motion.test.ts` exited `0` even though `lib/apps-preview.test.ts` did not exist because `node --test` treats unmatched file arguments as patterns when `lib/apps.test.ts` and `lib/motion.test.ts` match. |
| Software Engineer (`t-1883`, attempt 2) | `run-10095` | `b8efd0cd-7f19-49d0-b72c-591fa99ea294` | `agy-argon-high` / `Gemini 4 Argon (High)` / `high` | `avietidol-z490` / `billie-agy` | Launched a background `check_browser_journey.mjs` task on Linux worker `avietidol-z490` that hung for 30 minutes (`root agent idle; waiting up to 30m0s for 1 background task(s)` -> `terminating 1 background task(s) on exit`) because `npx next start` left child `next-server` stdio pipes open after `server.kill("SIGTERM")`. The run exited `0` without committing, pushing, or calling `plan_manager_submit_report`. |
| Green Gate (`ver-4032`) | `run-10096` | `9c40a3a2-5372-4ae9-8d54-6f87ac90cb7f` | `verify-runner` (`agent=shell`) | `avietidol-z490` / `<none>` | Ran on untouched `607ccaf19d48c162057b3c5505094e8c72aabc91` and passed vacuously for the same `node --test` reason as `ver-4031`. |
| Quality Engineer (`t-1883`) | `run-10097` | `d5c7ac73-0448-4334-a5a3-f5acbd8696e0` | `agy-argon-medium` / `Gemini 4 Argon (Medium)` / `medium` | `avietidol-mac-mini` / `billie-agy` | Authored `t-1883` executable QA suite in `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/qa/`, fixed detached server process-group cleanup + explicit `process.exit(0)` in `check_browser_journey.mjs`, and recorded `verdict="fail"`, `cause="code"`. |

- **Commit Identity Verification (`plan.commit_identity`)**:
  - Checked-out `HEAD` (`607ccaf19d48c162057b3c5505094e8c72aabc91`): `Otohime <quiinthieu@gmail.com>`, `0` `Co-Authored-By` trailers.
  - `DEPLOY_AUTHOR_EMAIL=quiinthieu@gmail.com node scripts/check-deploy-author.mjs` -> `Deployment author verified: quiinthieu@gmail.com` (exit `0`).

---

## 3. Executable & Artifact Fingerprints (SHA-256)

Measured in locked environment (`Node.js v22.23.3`, `darwin arm64`, `next@16.4.2`):

| File | State on `607ccaf19d48c162057b3c5505094e8c72aabc91` | SHA-256 |
| --- | --- | --- |
| `package-lock.json` | Present | `12d97d467459cb8a785d151d5f57aaac75af7ba09f750a439fa755e897786d42` |
| `next.config.ts` | Present | `8cba884698800911dfac52009f573d129197e28423f69367b9b0ca3ade0b4d94` |
| `lib/apps.ts` | Present | `d38b09469647c50311d736689d6d8e058a82924713b2fb3276b63409a54c2286` |
| `app/(site)/(app)/apps/[slug]/page.tsx` | Present (no `<TerminalPreview />` wired) | `a1447ae245426bdfbe7aa7e0b9c41210a1cff1dba4508be6c49da0a70e82cd25` |
| `lib/apps-preview.ts` | **MISSING** | — |
| `lib/apps-preview.test.ts` | **MISSING** | — |
| `app/(site)/(app)/apps/_components/terminal-preview.tsx` | **MISSING** | — |
| `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/task-2-evidence.md` | **MISSING** | — |

---

## 4. Executable QA Suite (`platform.role-suite.v1`) & Negative Controls

Suite path: `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/qa/suite.json`
Budget preflight (`make -C projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/qa build`):
`{"schema":"platform.role-suite.v1","cases":4,"declared_s":960,"budget_s":1800}` (`2 * (30 + 30 + 120 + 300) = 960s <= 1800s`).

| Case ID | Script | Timeout (`s`) | Local Positive on `607ccaf` | Local Negative Control | Oracle & Defect Detected |
| --- | --- | --- | --- | --- | --- |
| `t1882-data-nav-and-dropin-contract` | `qa/check_data_and_nav.mts` | `30` | **PASS** (exit `0`) | **PASS** (exit `1`, `AssertionError: Dropping 5th JSON file must populate loadApps() with 5 apps`) | Verifies all `t-1882` manifest, drop-in, `PUBLIC_PAGES`, `CONSOLE_MENU`, and Pocket Terminal invariants. |
| `t1883-preview-engine-and-contrast-contract` | `qa/check_preview_engine.mts` | `30` | **FAIL** (exit `1`, `AssertionError: lib/apps-preview.ts must exist`) | **PASS** (exit `1`, `AssertionError: NIWA_STAGES must define exactly 5 growth stages`) | Dynamically imports `lib/apps-preview.ts` and verifies `NIWA_STAGES` (5 stages + macOS menu bar header + `NIWA_STATIC_STAGE = 3`), `SHIKI_SEASONS`, `SHIKI_PHASES`, `SHIKI_STATIC_PROGRESS = 0.68`, `wcagContrastRatio` (`21:1` and `1:1`), `shikiPaletteAt` (`contrastRatio >= 7.0` + independent luminance check across 804 samples in `[0, 1]`), `resolveFramePreview`, `lib/apps-preview.test.ts`, and `apps.css` reduced-motion block. |
| `t1883-lint-typecheck-and-unit-tests` | `qa/check_gates.mjs` | `120` | **FAIL** (exit `1`, `AssertionError: Gate "preview_unit_test" must exit 0: Missing required test file: lib/apps-preview.test.ts`) | **PASS** (exit `1`, `AssertionError: Gate "deploy_author" must exit 0 (got 1)`) | Runs `npm run lint`, `npm run typecheck`, `node --test lib/apps-preview.test.ts` (explicitly checking file existence first), `TMPDIR=/tmp npm test`, and `scripts/check-deploy-author.mjs`. |
| `t1883-build-and-browser-preview-journey` | `qa/check_browser_journey.mjs` | `300` | **FAIL** (exit `1`, `AssertionError: /apps/bento must render [data-terminal-preview="frames"]`) | **PASS** (exit `1`, `AssertionError: /apps/bento must render [data-terminal-preview="frames"]`) | Runs `npm run build`, starts `next start` in a detached process group (killing `-server.pid` on cleanup and calling `process.exit(0)`), and verifies `[data-terminal-preview]` on `/apps/{bento,niwa,kakeibo,shiki}` and a dropped-in 5th JSON manifest (`zzzz-qa-workshop-probe`), Niwa 5-stage controls + macOS menu bar, Shiki `<canvas>` + 4 phases + 4 seasons + live WCAG contrast `>= 7.0`, Bento/Kakeibo/custom `frames` stepper, `prefers-reduced-motion: reduce` static non-advancing timer + operable keyboard controls, `javaScriptEnabled: false` static frame rendering, and `0` finite mount animations. |

---

## 5. Bounded Task-Manager & Plan-Manager History Scan

- **Plan-Manager Run History (`plan_manager_list_runs(plan_id="pm-303")`, complete: `8/8` runs)**:
  - `run-10081` (`research`, `agy-argon-high`, `avietidol-mac-mini`, `tm_task_id=b73206bd-d493-411a-a5b7-d4f5a2147ff7`): `succeeded`.
  - `run-10083` (`product_owner`, `agy-argon-medium`, `avietidol-z490`, `tm_task_id=240b490e-cd1a-4cf3-a268-1b03b3a0f3a3`): `succeeded`, committed `48043c8`.
  - `run-10085` (`software_engineer`, `t-1882`, `agy-argon-high`, `avietidol-mac-mini`, `tm_task_id=50b59eb3-8ae8-4322-9ca0-5f7bc73a92fb`): `succeeded`, delivered `be70fa4`.
  - `run-10089` (`verify`, `t-1882`, `avietidol-z490`, `tm_task_id=cdcf4a43-e1c8-499e-9fc5-1e7d7a7d9e4f`): `succeeded` (`ver-4028`).
  - `run-10090` (`quality_engineer`, `t-1882`, `agy-argon-medium`, `avietidol-mac-mini`, `tm_task_id=c6b5c392-214e-4d9f-b27b-efc6a3f0d8bb`): `succeeded`, committed `607ccaf` (`rep-6017`, `rep-6018`).
  - `run-10094` (`software_engineer`, `t-1883`, attempt 1, `agy-argon-high`, `avietidol-mac-mini`, `tm_task_id=cd71ffe5-d08c-495c-ab7d-f605119a3507`): `succeeded` (`red_gate_already_green` `ver-4031` without starting agent CLI).
  - `run-10095` (`software_engineer`, `t-1883`, attempt 2, `agy-argon-high`, `avietidol-z490`, `tm_task_id=b8efd0cd-7f19-49d0-b72c-591fa99ea294`): `succeeded` at task-manager level after 30m idle timeout killed its background `check_browser_journey.mjs` task; pushed `0` commits and submitted `0` reports.
  - `run-10096` (`verify`, `t-1883`, `avietidol-z490`, `tm_task_id=9c40a3a2-5372-4ae9-8d54-6f87ac90cb7f`): `succeeded` (`ver-4032` passed vacuously on `607ccaf`).
  - `run-10097` (`quality_engineer`, `t-1883`, `agy-argon-medium`, `avietidol-mac-mini`, `tm_task_id=d5c7ac73-0448-4334-a5a3-f5acbd8696e0`): current active QA run.
- **Task-Manager Bounded History Scan (`project_id="plan-manager"`, scan limit `15` per status)**:
  - `COMPLETED` (`15/15` scanned, `callbackState="delivered"`): Includes `9c40a3a2-5372-4ae9-8d54-6f87ac90cb7f` (`run-10096`), `b8efd0cd-7f19-49d0-b72c-591fa99ea294` (`run-10095`), `cd71ffe5-d08c-495c-ab7d-f605119a3507` (`run-10094`), `c6b5c392-214e-4d9f-b27b-efc6a3f0d8bb` (`run-10090`), `cdcf4a43-e1c8-499e-9fc5-1e7d7a7d9e4f` (`run-10089`), and `50b59eb3-8ae8-4322-9ca0-5f7bc73a92fb` (`run-10085`).
  - `FAILED` (`15/15` scanned): `0` failures for `repoId="otohime"` or `plan_id="pm-303"` (all 15 belong to `mono-v2`).
  - `PENDING` (`15` limit): `0` pending tasks.
  - `RUNNING` (`15` limit): `1` running task (`d5c7ac73-0448-4334-a5a3-f5acbd8696e0`, this `run-10097` job).

---

## 6. Real / Fake Boundaries, Defects & Deferred Checks

- **Real Boundaries Exercised**:
  - Real dynamic import and filesystem verification against `lib/apps-preview.ts`, `lib/apps-preview.test.ts`, `lib/apps.ts`, `lib/apps-server.ts`, and `app/(site)/(app)/apps/apps.css`.
  - Real `eslint`, `next typegen`, `tsc --noEmit`, `node --test`, and `scripts/check-deploy-author.mjs` executions.
- **Controlled / Fake Boundaries**:
  - `--negative-control` invocations mutate in-memory observations (`check_data_and_nav.mts`, `check_preview_engine.mts`, `check_browser_journey.mjs`) or pass `DEPLOY_AUTHOR_EMAIL=wrong-author@example.com` (`check_gates.mjs`) into the exact same verification oracle functions without mutating tracked repository files.
- **Defects Consolidated (`cause = "code"`)**:
  1. `defect-t1883-unimplemented-delivery`: SWE `run-10095` exited on a 30m background-task idle timeout without committing or pushing `t-1883`. `lib/apps-preview.ts`, `lib/apps-preview.test.ts`, `app/(site)/(app)/apps/_components/terminal-preview.tsx`, and `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/task-2-evidence.md` are missing from `origin/main`, and `app/(site)/(app)/apps/[slug]/page.tsx` does not mount `<TerminalPreview />`.
- **Deferred Checks / External Handoffs**: `0` (`authorized_external_ids: null`).
