# QA Report — `pm-293` / `t-1674`: Daruma project board and Kuyo shelf

- **Plan**: `pm-293` (Washi Daruma, Emaki, and Hanafuda)
- **Task**: `t-1674` (Daruma project board and Kuyo shelf)
- **QA Run**: `run-9237` (`role=quality_engineer`, `agent_profile=agy-argon-medium`, `model_id=gemini-4-argon`, `effort=medium`, `runner=fleet`, `worker_id=billie-mac`, `tm_task_id=8a295849-a0cc-49b2-b384-95e62f2f146a`)
- **SWE Delivery Run**: `run-9234` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `runner=fleet`, `worker_id=avietidol-mac-mini`, `tm_task_id=e11f2717-152c-48a7-9a57-754e47db243f`)
- **Green Gate**: `ver-3668` (`run-9235`, `gate=green`, `git_sha=8b0c491`, `status=pass`)
- **Delivery SHA**: `8b0c491af0bc134065c6928ea3e72b28cbaaa268` (`8b0c491`)
- **Deployed SHA (`https://otohime.dev/api/health`)**: `8b0c491af0bc134065c6928ea3e72b28cbaaa268` (`git merge-base --is-ancestor 8b0c491af0bc134065c6928ea3e72b28cbaaa268 8b0c491af0bc134065c6928ea3e72b28cbaaa268` -> exit `0`)
- **Verdict**: `pass`

## 1. Delivery Classification & Status

| Dimension | Status | Evidence |
| --- | --- | --- |
| **Integration deployed** | Proven | `https://otohime.dev/api/health` returned HTTP `200` `{"ok":true,"sha":"8b0c491af0bc134065c6928ea3e72b28cbaaa268"}`; GitHub Actions CI run `40529749649` completed with `success` across both `checks` (`15:19:03Z`–`15:36:01Z`) and `production` (`15:36:04Z`–`15:39:19Z`) for `8b0c491af0bc134065c6928ea3e72b28cbaaa268`. |
| **Waiting for capacity** | None (`0` deferred) | All local, CI, and live production browser/unit suites ran immediately with zero capacity deferrals. |
| **Execution demonstrated** | Proven | All 3 build-contract verification suites (`daruma unit and content checks`, `daruma browser e2e`, `repository unit suite and types`) plus independent Node/React 19 SSR preflight and independent Chromium negative-control suites executed and exited `0`. |
| **Product delivered** | Proven | Live `https://otohime.dev/projects` serves the `Cartridges` / `Daruma shelf` view switcher, 11 SVG Daruma dolls (`8` shipped `eyeState="both"`, `1` active `eyeState="left"`, `2` abandoned `eyeState="left"` / `"none"`), hover/focus wobble (`daruma-wobble`), `prefers-reduced-motion: reduce` stillness, and on-demand Daruma Kuyo ink-fire retirement via `?kuyo=1`, toggle button, and injectable clock (`?now=YYYY-MM-DD` / `window.__DARUMA_NOW__`). |

## 2. Commit Identity & Ancestry Verification

- **Commit inspected**: `8b0c491af0bc134065c6928ea3e72b28cbaaa268`
- **Author (`git show -s --format='%an <%ae>' 8b0c491af0bc134065c6928ea3e72b28cbaaa268` & `author.txt` / `setup-owner-git.sh --check`)**: `Otohime <quiinthieu@gmail.com>` (matches `plan.commit_identity`).
- **Trailers (`git show -s --format='%b' 8b0c491af0bc134065c6928ea3e72b28cbaaa268`)**: Empty — no `Co-Authored-By` or AI attribution trailer.
- **Subject**: `pm-293/t-1674: Implement Daruma project board and Kuyo shelf`
- **Ancestry check**: `git merge-base --is-ancestor 8b0c491af0bc134065c6928ea3e72b28cbaaa268 8b0c491af0bc134065c6928ea3e72b28cbaaa268` -> exit `0`.

## 3. Executable Fingerprint & Real/Fake Boundaries

### Locked Environment & Artifact Hashes (SHA-256)
- **Runtime**: Node `v22.23.4` (`darwin-arm64`, official tarball SHA-256 `c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428`), `next@16.4.2`, `react@19.3.0`, `playwright-core@1.64.0`, Headless Chromium `156.0.8078.48`.
- `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`
- `content/site.ts`: `869d7160667655852f9848920524ec938a18ba2bed5947af91678c488a793bfe`
- `lib/daruma.ts`: `9050d0eaef026545f355221540b72c4a56d35e883bb32b085dbafd89fd60685a`
- `lib/daruma.test.ts`: `454a1de4c31abe6a2e0981defb9ca68ce96c33e13960f61500dab2b749445c06`
- `components/daruma-board.tsx`: `64c63ffed243cda6f41f63e941472e61391ef40c1b7fee68910cf62ba0575a30`
- `app/(site)/(app)/projects/page.tsx`: `fa9fb18b0bae6158d77cc868b8f19b0e80865c90eff0e65a6d491a3b0caa90dc`
- `app/(site)/(app)/projects/daruma.css`: `420261930d01cc4037e40f30a90433fb34c59a4f3fd27a72c5e89eb306386cb4`
- `e2e/daruma.test.ts`: `ceb2539db9a87ad54221a04086ae5994f05592588b2e3b002a3eee493dcc69cb`

### Real vs. Fake Boundaries
- **Real**: Next.js 16.4.2 production build (`next build` + `next start`), real embedded PostgreSQL 17 with Drizzle migrations (`scripts/e2e.mjs`), real React 19 `renderToStaticMarkup` SSR tree construction, real headless Chromium browser rendering and Web Animations API (`Element.getAnimations()`), and real live Vercel production deployment (`https://otohime.dev`).
- **Fake / Injected**: Injectable clock parameter (`?now=YYYY-MM-DD`, `?clock=...`, `window.__DARUMA_NOW__`, and `now` prop in `lib/daruma.ts`) used to deterministically test the 89-day vs 90-day inactivity threshold and December UTC Kuyo season without waiting for calendar time.

## 4. Bounded Paginated Run & Task History Inspection

- **`plan_manager_list_runs(plan_id="pm-293")`** (complete scan: `10 / 10` runs on plan `pm-293`):
  - `run-9228` (`research`, `claude-sonnet-medium`): `succeeded`
  - `run-9229` (`product_owner`, `agy-argon-medium`, `086e991`): `succeeded`
  - `run-9230` (`t-1673`, `software_engineer`, `agy-argon-high`, `c1c885c`): `succeeded`
  - `run-9231` (`t-1673`, `verify`, `c1c885c`): `succeeded`
  - `run-9232` (`t-1676`, `software_engineer`, `agy-argon-high`, `5fd1284`): `succeeded`
  - `run-9233` (`t-1676`, `verify`, `5fd1284`): `succeeded`
  - `run-9234` (`t-1674`, `software_engineer`, `agy-argon-high`, `8b0c491`): `succeeded` (attempt 1, 0 retries)
  - `run-9235` (`t-1674`, `verify`, `8b0c491`): `succeeded` (`ver-3668` green gate pass)
  - `run-9236` (`t-1677`, `software_engineer`, `agy-argon-high`): `running`
  - `run-9237` (`t-1674`, `quality_engineer`, `agy-argon-medium`): `running` (this QA run)
- **`task_manager_list_tasks` bounded scan** (`limit=20, offset=0` per status):
  - `PENDING`: `0` tasks (`complete`).
  - `RUNNING`: `3` tasks (`complete`, all 3 on `otohime` including `8a295849-a0cc-49b2-b384-95e62f2f146a` for `run-9237`).
  - `COMPLETED`: `20` tasks scanned (`2` on `otohime`, including `a54b57d7-e678-43d8-a41d-87335d579f86` for green gate `run-9235` on `8b0c491`, callback ingested as `ver-3668`).
  - `FAILED`: `20` tasks scanned (`6` on `otohime`, all from earlier plans' non-fast-forward push races or a prior MCP timeout; `0` failures match `pm-293/t-1674` or fingerprint `8b0c491`).

## 5. Verification Suites & Independent QA Evidence

1. **Contract Check 1 — `daruma unit and content checks`**:
   - Command: `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/daruma.test.ts && npm run ask:check && npm run peeks:check`
   - Result: Exit `0` (`4 / 4` unit subtests passed in `91.4ms`; `ask:check` and `peeks:check` verified `public/ask-index.json` and `public/peeks.json` up to date).
2. **Contract Check 2 — `daruma browser e2e`**:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/daruma.test.ts' && git checkout -- content/history.json`
   - Result: Exit `0` (`3 / 3` Chromium E2E tests passed in `6,289.8ms` against production build + real embedded Postgres 17).
3. **Contract Check 3 — `repository unit suite and types`**:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`
   - Result: Exit `0` (`2,552 / 2,552` unit and main-lane closure tests passed in `30,081.0ms`, `next typegen && tsc --noEmit` exited `0`, `eslint` exited `0` with `0` errors).
4. **Independent QA Preflight & React 19 SSR Construction (`qa-preflight.mjs`)**:
   - Directly imported `content/site.ts`, `lib/daruma.ts`, and `components/daruma-board.tsx` in locked Node `v22.23.4` + `react-dom/server` `renderToStaticMarkup`.
   - Verified leap-year date validation (`2026-02-29` rejected as `null`, `2024-02-29` accepted), future date clamping (`daysSince("2026-12-01", "2026-10-27") === 0`), exact UTC month boundaries for `isKuyoSeason` (`2026-11-30T23:59:59Z` -> `false`, `2026-12-01T00:00:00Z` -> `true`, `2026-12-31T23:59:59Z` -> `true`, `2027-01-01T00:00:00Z` -> `false`), and SSR output of `<DarumaBoard>` in both `cartridges` and `daruma` (`initialKuyo=true`) modes.
5. **Independent Negative Controls & Live Production (`https://otohime.dev`) Verification**:
   - Ran both `e2e/daruma.test.ts` (`3 / 3` passed) and independent `qa-browser-negative-controls.test.ts` (`1 / 1` passed) against both the local production server and live `BASE_URL=https://otohime.dev`:
     - **Negative control 1 (Invalid query params & November clock)**: `/projects?view=bogus&kuyo=0&now=2026-11-30` falls back to `data-active-view="cartridges"`, renders `0` `[data-testid="daruma-board"]` elements, and keeps all `11` Cartridge items visible. Switching to `Daruma shelf` at `now=2026-11-30` sets `data-kuyo-active="false"` and renders `0` `[data-testid="daruma-kuyo-fire"]` elements.
     - **Negative control 2 (Live & active projects spared from abandonment/Kuyo)**: Even when Kuyo is active (`?kuyo=1` or December clock `2026-12-24` via `window.__DARUMA_NOW__` popstate), shipped (`Shore`) and active (`Barometer` at `2026-10-27`) cards have `data-abandoned="false"`, `data-kuyo-retiring="false"`, and `0` `[data-testid="daruma-kuyo-fire"]` children, and when all shelved projects are filtered out, `formatKuyoAnnouncement` reports `"Daruma Kuyo ink-fire ceremony lit: no abandoned Daruma dolls to retire."` with `kuyoRetiring.length === 0`.
     - **Negative control 3 (Reduced motion stillness)**: Under `prefers-reduced-motion: reduce` on `/projects?kuyo=1`, `data-reduced-motion="true"`, `.daruma-doll-figure` `animationName === "none"` and `transform === "none"`, `.daruma-kuyo-flame` `animationName === "none"`, and `card.getAnimations({ subtree: true }).length === 0`.
     - **Coexistence & Route Budget (`e2e/kamishibai.test.ts`)**: `7 / 7` tests passed; `/projects` gzipped bundle is `26,629` bytes (`<= 40,960` byte budget) across desktop, mobile, and 200% zoom, and `GazetteDesks` + `ProjectStories` remain intact.

## 6. Defects & Deferred Checks

- **Defects observed**: None (`0`).
- **Deferred checks**: None (`0`). All acceptance criteria and verification checks are proven now.
