# QA Report — `pm-293` / `t-1680`: Making-of Emaki ground-truth run models and shipped-plan filter

- **Plan**: `pm-293` (Washi Daruma, Emaki, and Hanafuda — Revision 2, Cycle 1)
- **Task**: `t-1680` (Making-of Emaki ground-truth run models and shipped-plan filter)
- **QA Run**: `run-9268` (`role=quality_engineer`, `agent_profile=agy-argon-medium`, `model_id=gemini-4-argon-medium`, `effort=medium`, `runner=fleet`, `worker_id=avietidol-mac-mini`, `account_id=billie-agy`, `tm_task_id=df7f163a-1751-4de6-8a6d-944ba1eefa54`)
- **SWE Delivery Run**: `run-9264` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon-high`, `effort=high`, `runner=fleet`, `worker_id=avietidol-z490`, `tm_task_id=15a92cc1-ac3a-4902-8258-18cb4cd6cd59`)
- **Green Gate**: `ver-3683` (`run-9266`, `gate=green`, `git_sha=400034a`, `status=pass`, `tm_task_id=1b803239-8bba-4b5d-b1cd-0f6973bed8ee`)
- **Delivery SHA**: `400034a28715aa43bc1346f1ba917371df1a909e` (`400034a`)
- **Deployed SHA (`https://otohime.dev/api/health`)**: `400034a28715aa43bc1346f1ba917371df1a909e` (`git merge-base --is-ancestor 400034a28715aa43bc1346f1ba917371df1a909e 400034a28715aa43bc1346f1ba917371df1a909e` -> exit `0`)
- **Verdict**: `pass`

## 1. Delivery Classification & Status

| Dimension | Status | Evidence |
| --- | --- | --- |
| **Integration deployed** | Proven | `https://otohime.dev/api/health` returned HTTP `200` `{"ok":true,"sha":"400034a28715aa43bc1346f1ba917371df1a909e"}` matching `400034a28715aa43bc1346f1ba917371df1a909e` (`git merge-base --is-ancestor` exit `0`); GitHub Actions CI run `40562704334` (`#527`) completed with `success` across both `checks` (`122395710736`, 17m 24s) and `production` (`122404966870`), and `scripts/verify-deploy.sh https://otohime.dev 400034a28715aa43bc1346f1ba917371df1a909e` passed `12 / 12` production smoke E2E checks. |
| **Waiting for capacity** | None (`0` deferred) | All local, CI, SQL ground-truth, SSR preflight, and live production browser/unit suites ran immediately with zero capacity deferrals. |
| **Execution demonstrated** | Proven | Both build-contract verification suites (`making-of unit and generator check`, `making-of playwright e2e`), the full repository unit/typecheck/lint suite (`2,573 / 2,573` unit tests), sibling plan E2E suites (`e2e/daruma.test.ts` and `e2e/hanafuda.test.ts`, `9 / 9` passed locally and on live production), independent PostgreSQL ground-truth cross-check (`qa-verify-sql-ground-truth.mjs`, `60 / 60` plans verified), independent Node/React 19 SSR preflight (`qa-making-of-preflight.mjs`), and independent Chromium negative-control suites (`qa-making-of-negative-controls.test.ts`) executed and exited `0`. |
| **Product delivered** | Proven | Live `https://otohime.dev/making-of` renders only the `34` shipped plans (`33` `done` plans plus `pm-293`), excludes all `27` unshipped plans (`19` of which have `pm-NNN` commits on `main`, such as `pm-147`, `pm-158`, `pm-165`, `pm-268`), sources every role badge from recorded `plan-manager` run history (`PLAN_RUN_HISTORY`) rather than `DEFAULT_ROLE_MODELS`, and omits roles that did not run (`pm-209`, `pm-214`, `pm-215` omit `research` in `content/making-of.json` and render `data-testid="emaki-role-absent"` without `data-model-id` and `data-role-present="false"` in the DOM). |

## 2. Commit Identity & Ancestry Verification

- **Delivery Commit**: `400034a28715aa43bc1346f1ba917371df1a909e`
- **Author (`git show -s --format='%an <%ae>' 400034a28715aa43bc1346f1ba917371df1a909e` & `bash scripts/setup-owner-git.sh --check`)**: `Otohime <quiinthieu@gmail.com>` (matches `plan.commit_identity`).
- **Delivery Evidence `author.txt` & `commits.txt`**:
  - `author.txt` SHA-256: `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada` (`Otohime <quiinthieu@gmail.com>`, `0` trailers).
  - `commits.txt` SHA-256: `92a463f359ef740e992c03cd0dac33f9b2fc27083b0ffde8f97e78aff52127b0`.
- **Trailers (`git show -s --format='%(trailers)' 400034a28715aa43bc1346f1ba917371df1a909e`)**: Empty — no `Co-Authored-By` or AI attribution trailer.
- **Subject**: `pm-293/t-1680: source Making-of Emaki models from run history and filter to shipped plans`
- **Deployed Commit**: `400034a28715aa43bc1346f1ba917371df1a909e` (exact match).
- **Ancestry check**: `git merge-base --is-ancestor 400034a28715aa43bc1346f1ba917371df1a909e 400034a28715aa43bc1346f1ba917371df1a909e` -> exit `0`.

## 3. Executable Fingerprint & Real/Fake Boundaries

### Locked Environment & Artifact Hashes (SHA-256)
- **Runtime**: Node `v22.23.3` (`/Users/avietidol/.local/bin/node`, `darwin-arm64`), `next@16.4.2`, `react@19.3.0`, `playwright-core@1.64.0`, Headless Chromium `156.0.8078.48` / Google Chrome.
- `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`
- `lib/making-of.ts`: `430cac9a2e19f8d83bac3fcb551c6e73484f2db04f6990d217d83584db7d9e96`
- `lib/making-of.test.ts`: `4864aeea225b89f4a6b8277b28c769328a8522b45ab746060046d5bb24c1cf4b`
- `scripts/making-of-index.ts`: `9503dc624fa18a597fdfb49b9f198a9ed67ee97e73af8ec7b01d4b561dcd47c6`
- `scripts/making-of-index.test.ts`: `26f034ad18b33a4cb8cef18a0cdcc13cb57d12a1172c2e8fbad58ae994def977`
- `content/making-of.json`: `3c358643baf7b6e1903d625256df908437fa04ea801a41dc6e86b5007e26533a`
- `app/(site)/(app)/making-of/_components/emaki-scroll.tsx`: `255c116a0cfbbd98088a81f89cb53c4d7576856ec10068b1fdbc698fbab2b8e6`
- `app/(site)/(app)/making-of/making-of.css`: `6ad3abad00297e551c9226e6121aeff1108c1549e9c010c8f7e25490d07e16a2`
- `e2e/making-of.test.ts`: `b4792715c826b977e974294763fcfc47f93d89070549192775c74ec5ac7f205b`
- `projects/otohime-dev-three-new-paper-and-ink-experiments-be-bold-mix/task-1-evidence.md`: `2f724b90fde19f87fa47537438d7329afc1522d957d904897b12ccc9bd259331`

### Real vs. Fake Boundaries
- **Real**: `lib/making-of.ts`, `scripts/making-of-index.ts`, `content/making-of.json`, `app/(site)/(app)/making-of/_components/emaki-scroll.tsx`, real Git log and `projects/*/plan.md` parsing (`collectGitPlans`), real `plan-manager` PostgreSQL database (`plans` and `runs` tables queried via `task_manager_cluster_db_query`), Next.js `16.4.2` production build (`next build` + `next start`), real React 19 `renderToStaticMarkup` SSR tree construction, real headless Chrome/Chromium browser rendering (desktop `1360x860`, mobile `390x844`, reduced-motion, and JS-disabled contexts), and real live Vercel production deployment (`https://otohime.dev`).
- **Fake / Injected**: Synthetic in-memory `RawGitPlan` and `MakingOfData` fixtures used only in unit tests (`lib/making-of.test.ts`, `scripts/making-of-index.test.ts`) and our independent SSR preflight negative control (`qa-making-of-preflight.mjs`) to verify fail-closed filtering of unshipped plans and absent-role rendering across arbitrary subsets of `ROLE_ORDER`.

## 4. Bounded Paginated Run & Task History Inspection

- **`plan_manager_list_runs(plan_id="pm-293")`** (complete scan: `26 / 26` runs on plan `pm-293`):
  - Cycle 0 (`run-9228`..`run-9249`): `research` (`claude-sonnet-5-5`, `effort=medium`), `product_owner` (`gemini-4-argon-medium`, `effort=medium`, `086e991`), `t-1673` (`c1c885c`), `t-1676` (`5fd1284`), `t-1674` (`8b0c491`), `t-1677` (`db788b1`), `t-1675` (`36ba86a`), and their `verify` / `quality_engineer` runs all `succeeded`.
  - `run-9251` (`acceptance_engineer`, `claude-opus-5-5`, `effort=high`, `a178b84`): `succeeded` (`verdict=fail`, filed `change_request_1.md`).
  - `run-9252` (`product_owner`, `gemini-4-argon-medium`, `effort=medium`, `2e14e3b`): `succeeded` (proposed cycle 1 tasks `t-1680`, `t-1681`, `t-1682`).
  - `run-9255` (`t-1681`, `software_engineer`, `gemini-4-argon-high`, `effort=high`, `68bde4a`), `run-9259` (`verify`, `ver-3679` pass), and `run-9260` (`quality_engineer`, `gemini-4-argon-medium`, `d3b2e1f`, pass): `succeeded`.
  - `run-9256` (`t-1682`, `software_engineer`, `gemini-4-argon-high`, `effort=high`, `7ad719f`), `run-9257` (`verify`, `ver-3677` pass), and `run-9258` (`quality_engineer`, `gemini-4-argon-medium`, `cd55af6`, pass): `succeeded`.
  - `run-9264` (`t-1680`, `software_engineer`, `gemini-4-argon-high`, `effort=high`, `400034a`, `tm_task_id=15a92cc1-ac3a-4902-8258-18cb4cd6cd59`): `succeeded` (attempt 1, 0 retries, callback ingested as `rep-5478`).
  - `run-9266` (`t-1680`, `verify`, `400034a`, `tm_task_id=1b803239-8bba-4b5d-b1cd-0f6973bed8ee`): `succeeded` (green gate `ver-3683` pass).
  - `run-9268` (`t-1680`, `quality_engineer`, `gemini-4-argon-medium`, `effort=medium`, `tm_task_id=df7f163a-1751-4de6-8a6d-944ba1eefa54`): `running` (this QA run).
- **`task_manager_list_tasks` bounded scan** (`limit=20, offset=0` per status):
  - `PENDING`: `0` tasks (`complete`).
  - `RUNNING`: `2` tasks (`complete`: `df7f163a-1751-4de6-8a6d-944ba1eefa54` for `run-9268` on `pm-293/t-1680` and `08ba1292-07e4-43c1-ac78-e6eb47e92513` on `pm-268`).
  - `COMPLETED`: `20` tasks scanned (`6` on `otohime`, including `1b803239-8bba-4b5d-b1cd-0f6973bed8ee` for green gate `run-9266` and `15a92cc1-ac3a-4902-8258-18cb4cd6cd59` for SWE delivery `run-9264`, both `cb=delivered`).
  - `FAILED`: `20` tasks scanned (`7` on `otohime`, all from earlier plans `pm-268`, `pm-259`, etc.; `0` failures match `pm-293/t-1680` or fingerprint `400034a`).
- **GitHub Actions CI History Correlation**:
  - Run `40562704334` (`#527`, `400034a28715aa43bc1346f1ba917371df1a909e`): passed `checks` (`122395710736`, 17m 24s) and `production` (`122404966870`), deploying `400034a28715aa43bc1346f1ba917371df1a909e` to `https://otohime.dev`.

## 5. Verification Suites & Independent QA Evidence

1. **Contract Check 1 — `making-of unit and generator check`**:
   - Command: `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/making-of.test.ts scripts/making-of-index.test.ts && npm run making-of:check`
   - Result: Exit `0` (`15 / 15` unit tests passed in `2,094.4ms`; `npm run making-of:check` exited `0`: `ok - content/making-of.json matches git and trails HEAD by 3 commits`).
2. **Contract Check 2 — `making-of playwright e2e`**:
   - Command: `(test -d node_modules || npm ci) && npx playwright test e2e/making-of.test.ts`
   - Result: Exit `0` (`4 / 4` Chromium E2E subtests passed in `4,220.1ms` locally and `4 / 4` against live `https://otohime.dev`).
3. **Full Repository Unit, Typecheck, Lint, Self-Tests, and Sibling Plan E2E Suites**:
   - `TMPDIR=/tmp npm test && npm run typecheck && npm run lint`: Exit `0` (`2,573 / 2,573` unit tests passed in `21,152.4ms`, `next typegen && tsc --noEmit` exit `0`, `eslint` exit `0` with `0` errors).
   - `SKIP_BUILD=1 node --experimental-strip-types scripts/e2e.mjs --test e2e/daruma.test.ts e2e/hanafuda.test.ts`: Exit `0` (`9 / 9` E2E tests passed locally in `24,387.1ms` and `9 / 9` against live `https://otohime.dev`).
   - `yearly-log:check`, `ask:check`, `peeks:check`, `history:check` all exited `0`; `vercel-deploy.test.sh` (`63 / 63` ok), `verify-deploy.sh --self-test` (`22 / 22` ok), `probe-history.sh --self-test` (`6 / 6` ok), `verify-peep-box-camera.mjs` (`6 / 6` ok).
4. **Independent Ground-Truth Cross-Check Against `plan-manager` PostgreSQL Database (`qa-verify-sql-ground-truth.mjs`)**:
   - Queried all `60` repository plans (`project = 'otohime'`) and their latest succeeded runs per role from the `plan_manager` PostgreSQL database via `task_manager_cluster_db_query` and compared every plan against `SHIPPED_PLAN_REGISTRY`, `UNSHIPPED_PLAN_IDS`, `PLAN_RUN_HISTORY`, and `content/making-of.json`.
   - Verified `34 / 34` shipped plans (`33` `done` plans + `pm-293`) match `SHIPPED_PLAN_REGISTRY` and `content/making-of.json` with `0` status mismatches and `0` role/model mismatches across all four roles (`research`, `product_owner`, `software_engineer`, `quality_engineer`), including:
     - `pm-144`: `research` = `claude-sonnet-5-5`, `product_owner` = `claude-opus-5-5`, `software_engineer` = `claude-opus-5-5`, `quality_engineer` = `claude-sonnet-5-5`
     - `pm-209`: `research` = absent (`null` in SQL, omitted in `content/making-of.json`), `product_owner` = `gemini-4-argon-medium`, `software_engineer` = `gpt-6.4-high`, `quality_engineer` = `gemini-4-argon-medium`
     - `pm-214` & `pm-215`: `research` = absent (`null` in SQL, omitted in `content/making-of.json`), `product_owner` = `gemini-4-argon-medium`, `software_engineer` = `gemini-4-argon-high`, `quality_engineer` = `gemini-4-argon-medium`
     - `pm-253`: `research` = `claude-sonnet-5-5`, `product_owner` = `gemini-4-argon-medium`, `software_engineer` = `gpt-6.4-high`, `quality_engineer` = `gemini-4-argon-medium`
     - `pm-293`: `research` = `claude-sonnet-5-5`, `product_owner` = `gemini-4-argon-medium`, `software_engineer` = `gemini-4-argon-high`, `quality_engineer` = `gemini-4-argon-medium`
   - Verified all `27` unshipped plans (`26` in DB with `status IN ('failed', 'cancelled', 'executing')` + `pm-294`) are present in `UNSHIPPED_PLAN_IDS` and absent from `content/making-of.json`.
5. **Independent QA Preflight & React 19 SSR Construction (`qa-making-of-preflight.mjs`)**:
   - Directly imported `lib/making-of.ts`, `scripts/making-of-index.ts`, and `app/(site)/(app)/making-of/_components/emaki-scroll.tsx` in locked Node `v22.23.3` + `react-dom/server` `renderToStaticMarkup`.
   - Verified `DEFAULT_ROLE_MODELS` is removed from `lib/making-of.ts` exports; default SSR renders `34` scenes, `133` `data-testid="emaki-role-badge"` items, `3` `data-testid="emaki-role-absent"` items (none carrying `data-model-id`), and `3` `data-role-present="false"` figures.
   - Exercised a synthetic single-role negative control (`roles: [{ role: "software_engineer", label: "Engineer", modelId: "gpt-6.4-high", modelLabel: "GPT-6.4 High" }]`) and verified SSR renders `1` `data-testid="emaki-role-badge"` and `3` `data-testid="emaki-role-absent"` items for `research`, `product_owner`, and `quality_engineer`.
6. **Independent Negative Controls & Live Production (`https://otohime.dev`) Verification (`qa-making-of-negative-controls.test.ts` & `verify-deploy.sh`)**:
   - `TMPDIR=/tmp bash scripts/verify-deploy.sh https://otohime.dev 400034a28715aa43bc1346f1ba917371df1a909e` -> Exit `0` (`ok - /api/health sha 400034a28715aa43bc1346f1ba917371df1a909e serves 400034a28715aa43bc1346f1ba917371df1a909e (exact, try 3)`, `12 / 12` production E2E checks passed).
   - Ran `e2e/making-of.test.ts` (`4 / 4`) and `qa-making-of-negative-controls.test.ts` (`1 / 1`) against both local build and live `BASE_URL=https://otohime.dev`:
     - **Negative control 1 (All 27 unshipped plans excluded from DOM)**: Every plan ID in `UNSHIPPED_PLAN_IDS` (including all 19 unshipped plans with commits on `main`, such as `pm-147`, `pm-158`, `pm-165`, `pm-268`) has `0` `[data-plan-id]` elements on `/making-of`.
     - **Negative control 2 (Every DOM scene's role badges match `PLAN_RUN_HISTORY` 100%)**: Across all `34` rendered scenes (`136` role slots), all `133` present roles match `PLAN_RUN_HISTORY[planId][role]` in `data-model-id`, and all `3` absent role slots (`pm-209`, `pm-214`, `pm-215` `research`) render `data-testid="emaki-role-absent"` with `data-model-id === null`, text containing `— skipped`, and dimmed figure opacity (`0.32 < 0.5`).
     - **Negative control 3 (Non-navigation keys & boundary button states)**: Pressing `Enter` inside the focused stage does not advance `data-active-scene-index`, `emaki-prev-scene` is `disabled` at index `0`, and `emaki-next-scene` is `disabled` at index `33` (`End`).

## 6. Defects & Deferred Checks

- **Defects observed**: None (`0`).
- **Deferred checks**: None (`0`). All acceptance criteria and verification checks are proven on the live production deployment.
