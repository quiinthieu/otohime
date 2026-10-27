# QA Report — `pm-293` / `t-1682`: Truthful Daruma project statuses and opt-in Kuyo fixture on `/projects`

- **Plan**: `pm-293` (Washi Daruma, Emaki, and Hanafuda — Revision 2, Cycle 1)
- **Task**: `t-1682` (Truthful Daruma project statuses and opt-in Kuyo fixture on `/projects`)
- **QA Run**: `run-9258` (`role=quality_engineer`, `agent_profile=agy-argon-medium`, `model_id=gemini-4-argon-medium`, `effort=medium`, `runner=fleet`, `worker_id=avietidol-mac-mini`, `account_id=billie-agy`, `tm_task_id=8a0d767f-e7c9-4aff-8150-1a18c87fae55`)
- **SWE Delivery Run**: `run-9256` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon-high`, `effort=high`, `runner=fleet`, `worker_id=avietidol-z490`, `tm_task_id=a7feb562-c61c-4940-a65b-5ee491ad42af`)
- **Green Gate**: `ver-3677` (`run-9257`, `gate=green`, `git_sha=7ad719f`, `status=pass`, `tm_task_id=f20f9a0b-5d72-4bcd-946b-f35cc03fb676`)
- **Delivery SHA**: `7ad719fc89d0075bd4d480a33d68ccbce20310f3` (`7ad719f`)
- **Deployed SHA (`https://otohime.dev/api/health`)**: `68bde4aca8b7aa99fb92c374cc2e7e413be12778` (`git merge-base --is-ancestor 7ad719fc89d0075bd4d480a33d68ccbce20310f3 68bde4aca8b7aa99fb92c374cc2e7e413be12778` -> exit `0`)
- **Verdict**: `pass`

## 1. Delivery Classification & Status

| Dimension | Status | Evidence |
| --- | --- | --- |
| **Integration deployed** | Proven | `https://otohime.dev/api/health` returned HTTP `200` `{"ok":true,"sha":"68bde4aca8b7aa99fb92c374cc2e7e413be12778"}` containing `7ad719fc89d0075bd4d480a33d68ccbce20310f3` (`git merge-base --is-ancestor` exit `0`); GitHub Actions CI run `40555071055` (`#526`) completed with `success` across both `checks` (`122368821137`) and `production` (`122378431659`), and `scripts/verify-deploy.sh https://otohime.dev 7ad719fc89d0075bd4d480a33d68ccbce20310f3` passed `12 / 12` production smoke E2E checks. |
| **Waiting for capacity** | None (`0` deferred) | All local, CI, and live production browser/unit suites ran immediately with zero capacity deferrals. |
| **Execution demonstrated** | Proven | Both build-contract verification suites (`daruma and yearly-log unit and check`, `daruma playwright e2e`), the full repository unit/typecheck/lint suite (`2,572 / 2,572` unit tests), the full repository E2E suite (`203 / 203` E2E tests), local footer/camera/deploy gates (`walk-end.sh` `67/67`, `probe-end.sh` `173/173`, `verify-peep-box-camera.mjs` `6/6`), independent Node/React 19 SSR preflight (`qa-ssr-preflight.mjs`), and independent Chromium negative-control suites (`qa-daruma-negative-controls.test.ts`) executed and exited `0`. |
| **Product delivered** | Proven | Live `https://otohime.dev/projects` renders all 11 shipped projects (`Shore`, `Capsule`, `Orrery`, `Elements`, `Vinyl`, `Rotor`, `Planisphere`, `Barometer`, `Gazette`, `Structures`, `Design system`) with `status: "live"` and real October 2026 dates in sync with `content/yearly-log.json` (`0` entries in months `05` and `06`), shows all 11 as two-eyed upright Daruma dolls with an honest empty state on the unfinished shelf (`[data-testid="daruma-unfinished-empty"]`), and supports the opt-in Kuyo demo fixture (`?fixture=kuyo`, `window.__DARUMA_FIXTURES__`, and `[data-testid="daruma-fixture-toggle"]`) without misreporting any live route. |

## 2. Commit Identity & Ancestry Verification

- **Delivery Commit**: `7ad719fc89d0075bd4d480a33d68ccbce20310f3`
- **Author (`git show -s --format='%an <%ae>' 7ad719fc89d0075bd4d480a33d68ccbce20310f3` & `bash scripts/setup-owner-git.sh --check`)**: `Otohime <quiinthieu@gmail.com>` (matches `plan.commit_identity`).
- **Trailers (`git show -s --format='%b' 7ad719fc89d0075bd4d480a33d68ccbce20310f3`)**: Empty — no `Co-Authored-By` or AI attribution trailer.
- **Subject**: `pm-293/t-1682: restore truthful live project statuses and add opt-in Daruma Kuyo fixture`
- **Deployed Commit**: `68bde4aca8b7aa99fb92c374cc2e7e413be12778` (also authored by `Otohime <quiinthieu@gmail.com>` with no trailers).
- **Ancestry check**: `git merge-base --is-ancestor 7ad719fc89d0075bd4d480a33d68ccbce20310f3 68bde4aca8b7aa99fb92c374cc2e7e413be12778` -> exit `0`.

## 3. Executable Fingerprint & Real/Fake Boundaries

### Locked Environment & Artifact Hashes (SHA-256)
- **Runtime**: Node `v22.23.3` (`/Users/avietidol/.local/bin/node`, `darwin-arm64`), `next@16.4.2`, `react@19.3.0`, `playwright-core@1.64.0`, Headless Chromium `156.0.8078.48` / Google Chrome.
- `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`
- `content/site.ts`: `5bf5875b6df1a1342b64df309e5003a57319e8145857bc2a4b26da84f19ade8d`
- `content/yearly-log.json`: `7916708e6d5f025e4554a9e272eca7195bc62cb542a769af5505ae7a5106a611`
- `lib/daruma.ts`: `89943a181098fd3874d1d8bc3b5b12ff6a81b7677fc5c85268c84479bda21c53`
- `lib/daruma.test.ts`: `14823ca0b6d10a85b64dfa34fe519a5b11558475fcc84694d0be1c0586d6065f`
- `scripts/yearly-log.test.ts`: `67579a1674ef32bee0bca8f66d073ecc25b6207e5e2efe6877da9658b68601f9`
- `components/daruma-board.tsx`: `e2ff58ba226ec2160fd80f28aaf8bbc4272a22c90621d64af3dbd68a7f3945a0`
- `app/(site)/(app)/projects/daruma.css`: `ed0041755afaad1dc2bf4944738f8d15a0c20bf4563826ef4476e0977e769afe`
- `e2e/daruma.test.ts`: `9faa07fa0d5b59f276953cf4339ad7cdf0f13521c2cd2b1f104b974c7a4245c8`
- `projects/otohime-dev-three-new-paper-and-ink-experiments-be-bold-mix/task-3-evidence.md`: `0907aedc084eb2ae8734ac6afcbba836a0ec16be39e71a41748819c960192cc7`

### Real vs. Fake Boundaries
- **Real**: `content/site.ts`, `content/yearly-log.json`, `lib/daruma.ts`, `components/daruma-board.tsx`, Next.js `16.4.2` production build (`next build` + `next start`), real embedded PostgreSQL `17` with Drizzle migrations (`scripts/e2e.mjs`), real React 19 `renderToStaticMarkup` SSR tree construction, real headless Chrome/Chromium browser rendering and Web Animations API (`Element.getAnimations()`), and real live Vercel production deployment (`https://otohime.dev`).
- **Fake / Injected**: Explicit opt-in demo fixture (`?fixture=kuyo`, `window.__DARUMA_FIXTURES__`, `[data-testid="daruma-fixture-toggle"]`, and `KUYO_DEMO_FIXTURES` in `lib/daruma.ts`) and injectable clock (`?now=YYYY-MM-DD`, `window.__DARUMA_NOW__`, and `now` option in `lib/daruma.ts`) used to exercise the one-eyed/blank-eyed unfinished shelf and Daruma Kuyo ink-fire retirement ceremony without misreporting real shipped routes.

## 4. Bounded Paginated Run & Task History Inspection

- **`plan_manager_list_runs(plan_id="pm-293")`** (complete scan: `21 / 21` runs on plan `pm-293`):
  - Cycle 0 (`run-9228`..`run-9249`): `research` (`claude-sonnet-5-5`), `product_owner` (`gemini-4-argon-medium`, `086e991`), `t-1673` (`c1c885c`), `t-1676` (`5fd1284`), `t-1674` (`8b0c491`), `t-1677` (`db788b1`), `t-1675` (`36ba86a`), and their `verify` / `quality_engineer` runs all `succeeded`.
  - `run-9251` (`acceptance_engineer`, `claude-opus-5-5`, `effort=high`, `a178b84`): `succeeded` (`verdict=fail`, filed `change_request_1.md`).
  - `run-9252` (`product_owner`, `gemini-4-argon-medium`, `2e14e3b`): `succeeded` (proposed cycle 1 tasks `t-1680`, `t-1681`, `t-1682`).
  - `run-9255` (`t-1681`, `software_engineer`, `gemini-4-argon-high`, `68bde4a`): `succeeded` (pinned Hanafuda mobile prompts and updated `e2e/hanafuda.test.ts` Month 10 commit count assertion to read `rawYearlyLog.months["10"].commits` dynamically).
  - `run-9256` (`t-1682`, `software_engineer`, `gemini-4-argon-high`, `7ad719f`, `tm_task_id=a7feb562-c61c-4940-a65b-5ee491ad42af`): `succeeded` (attempt 1, 0 retries, callback ingested as `rep-5470`).
  - `run-9257` (`t-1682`, `verify`, `7ad719f`, `tm_task_id=f20f9a0b-5d72-4bcd-946b-f35cc03fb676`): `succeeded` (green gate `ver-3677` pass).
  - `run-9258` (`t-1682`, `quality_engineer`, `gemini-4-argon-medium`, `tm_task_id=8a0d767f-e7c9-4aff-8150-1a18c87fae55`): `running` (this QA run).
- **`task_manager_list_tasks` bounded scan** (`limit=20, offset=0` per status):
  - `PENDING`: `0` tasks (`complete`).
  - `RUNNING`: `3` tasks (`complete`, all 3 on `otohime`, including `8a0d767f-e7c9-4aff-8150-1a18c87fae55` for `run-9258`).
  - `COMPLETED`: `20` tasks scanned (`2` on `otohime`: `f20f9a0b-5d72-4bcd-946b-f35cc03fb676` for green gate `run-9257` and `a7feb562-c61c-4940-a65b-5ee491ad42af` for SWE delivery `run-9256`, both `cb=delivered`).
  - `FAILED`: `20` tasks scanned (`7` on `otohime`, all from earlier plans `pm-268`, `pm-259`, etc. with `push_not_on_main` or `mcp_probe_failed`; `0` failures match `pm-293/t-1682` or fingerprint `7ad719f`).
- **GitHub Actions CI History Correlation**:
  - Run `40552915182` (`#524`, `7ad719f`) ran before sibling task `t-1681` (`68bde4a`) pushed its `e2e/hanafuda.test.ts` update; `#524` passed `201 / 202` E2E tests (including all `e2e/daruma.test.ts` tests) and failed only on `e2e/hanafuda.test.ts:345` (`645` hardcoded vs `660` in regenerated `content/yearly-log.json`).
  - Run `40555071055` (`#526`, `68bde4aca8b7aa99fb92c374cc2e7e413be12778`, descendant of `7ad719f`) resolved that cross-task assertion and passed `checks` (`122368821137`) and `production` (`122378431659`) with `0` errors, deploying `68bde4aca8b7aa99fb92c374cc2e7e413be12778` to `https://otohime.dev`.

## 5. Verification Suites & Independent QA Evidence

1. **Contract Check 1 — `daruma and yearly-log unit and check` ( plus `ask:check` & `peeks:check`)**:
   - Command: `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/daruma.test.ts scripts/yearly-log.test.ts && npm run yearly-log:check && npm run ask:check && npm run peeks:check`
   - Result: Exit `0` (`15 / 15` unit tests passed in `2,193.4ms`; `yearly-log:check`, `ask:check`, and `peeks:check` all exited `0`).
2. **Contract Check 2 — `daruma playwright e2e`**:
   - Command: `(test -d node_modules || npm ci) && npx playwright test e2e/daruma.test.ts`
   - Result: Exit `0` (`3 / 3` Chromium E2E subtests passed in `12,636.4ms` locally and `3 / 3` against live `https://otohime.dev`).
3. **Full Repository Unit, Typecheck, Lint, and Full E2E Suites**:
   - `TMPDIR=/tmp npm test && npm run typecheck && npm run lint`: Exit `0` (`2,572 / 2,572` unit tests passed in `23,282.3ms`, `next typegen && tsc --noEmit` exit `0`, `eslint` exit `0` with `0` errors).
   - `SKIP_BUILD=1 TMPDIR=/tmp npm run test:e2e`: Exit `0` (`203 / 203` E2E tests passed in `430,817.5ms`, including `e2e/daruma.test.ts`, `e2e/hanafuda.test.ts`, `e2e/making-of.test.ts`, and `e2e/kamishibai.test.ts` with `/projects` gzipped bundle at `27,711 <= 40,960` bytes).
   - `walk-end.sh` (`67 / 67` ok), `probe-end.sh` (`173 / 173` ok), `verify-peep-box-camera.mjs` (`6 / 6` ok), `vercel-deploy.test.sh` (`63 / 63` ok), `verify-deploy.sh --self-test` (`22 / 22` ok), `probe-history.sh --self-test` (`6 / 6` ok).
4. **Independent QA Preflight & React 19 SSR Construction (`qa-ssr-preflight.mjs`)**:
   - Directly imported `content/site.ts`, `lib/daruma.ts`, and `components/daruma-board.tsx` in locked Node `v22.23.3` + `react-dom/server` `renderToStaticMarkup`.
   - Verified default SSR (`initialView="daruma"`, `initialKuyo=true`, `initialFixture=false`) renders `data-fixture-active="false"`, `[data-testid="daruma-unfinished-empty"]`, `"All 11 current projects have shipped — every Daruma doll has both eyes painted."`, `"Daruma Kuyo ink-fire ceremony lit: no abandoned Daruma dolls to retire."`, `0` `[data-testid="daruma-kuyo-fire"]` elements, and `0` `[data-testid="daruma-fixture-badge"]` elements.
   - Verified fixture SSR (`initialFixture="kuyo"`, `initialKuyo=true`) renders `data-fixture-active="true"`, `3` `[data-testid="daruma-fixture-badge"]` badges, and `2` `[data-testid="daruma-kuyo-fire"]` elements.
5. **Independent Negative Controls & Live Production (`https://otohime.dev`) Verification (`qa-daruma-negative-controls.test.ts` & `verify-deploy.sh`)**:
   - `TMPDIR=/tmp bash scripts/verify-deploy.sh https://otohime.dev 7ad719fc89d0075bd4d480a33d68ccbce20310f3` -> Exit `0` (`ok - /api/health sha 68bde4aca8b7aa99fb92c374cc2e7e413be12778 serves 7ad719fc89d0075bd4d480a33d68ccbce20310f3 (contains, try 2)`, `12 / 12` production E2E checks passed).
   - Ran `e2e/daruma.test.ts` (`3 / 3`) and `qa-daruma-negative-controls.test.ts` (`1 / 1`) against both local build and live `BASE_URL=https://otohime.dev`:
     - **Negative control 1 (Falsy/bogus fixture & view params)**: `/projects?fixture=0&kuyo=0&view=bogus&now=2026-11-30` keeps `data-active-view="cartridges"`, `data-fixture-active="false"`, `11` live Cartridge items, and when switched to `Daruma shelf` renders `data-fixture-active="false"`, `data-kuyo-active="false"`, `[data-testid="daruma-unfinished-empty"]`, `0` unfinished cards, `0` fixture badges, and `0` Kuyo fires.
     - **Negative control 2 (Explicit `view=cartridges` override)**: `/projects?fixture=kuyo&view=cartridges` honours `data-active-view="cartridges"` while setting `data-fixture-active="true"` and displaying `"11 shipped · 3 on the unfinished shelf (demo fixture)"`.
     - **Negative control 3 (Far-future December Kuyo clock on truthful default board)**: `/projects?now=2027-12-31&kuyo=1` keeps all 11 live projects on `section[data-shelf="shipped"]` with `data-abandoned="false"`, `data-kuyo-retiring="false"`, and `0` `[data-testid="daruma-kuyo-fire"]` overlays.
     - **Negative control 4 (Custom `window.__DARUMA_FIXTURES__` collision resistance & malformed entry filtering)**: Injecting a fixture item with duplicate live title `"Structures"` (`status: "shelved", abandoned: true`) plus `{ invalid: true }` never overwrites the real `"Structures"` card on `section[data-shelf="shipped"]` (which keeps `data-eye-state="both"`, `data-abandoned="false"`, `data-demo-fixture="false"`, and `a.daruma-title[href="/structures"]`) and ignores `{ invalid: true }`.

## 6. Defects & Deferred Checks

- **Defects observed**: None (`0`).
- **Deferred checks**: None (`0`). All acceptance criteria and verification checks are proven on the live production deployment.
