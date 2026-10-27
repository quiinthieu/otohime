# QA Report — `pm-293` / `t-1675`: Making-of Emaki handscroll

- **Plan**: `pm-293` (Washi Daruma, Emaki, and Hanafuda)
- **Task**: `t-1675` (Making-of Emaki handscroll)
- **QA Run**: `run-9249` (`role=quality_engineer`, `agent_profile=agy-argon-medium`, `model_id=gemini-4-argon`, `effort=medium`, `runner=fleet`, `worker_id=billie-mac`, `tm_task_id=f9cd970d-9dfe-47fe-ab57-44fee106688c`)
- **SWE Delivery Run**: `run-9243` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `runner=fleet`, `worker_id=avietidol-z490`, `tm_task_id=4284548d-f1f4-48a4-ba0c-5a5ebdc94f67`)
- **Green Gate**: `ver-3674` (`run-9248`, `gate=green`, `git_sha=36ba86a`, `status=pass`, `tm_task_id=d0fbf399-a925-41ba-99b3-5f0f61aab9e2`)
- **Delivery SHA**: `36ba86a99f78ce93a8972c8e1f4d003242325469` (`36ba86a`)
- **Deployed SHA (`https://otohime.dev/api/health`)**: `36ba86a99f78ce93a8972c8e1f4d003242325469` (`git merge-base --is-ancestor 36ba86a99f78ce93a8972c8e1f4d003242325469 36ba86a99f78ce93a8972c8e1f4d003242325469` -> exit `0`)
- **Verdict**: `pass`

## 1. Delivery Classification & Status

| Dimension | Status | Evidence |
| --- | --- | --- |
| **Integration deployed** | Proven | `https://otohime.dev/api/health` returned HTTP `200` `{"ok":true,"sha":"36ba86a99f78ce93a8972c8e1f4d003242325469"}`; GitHub Actions CI run `40539710809` (`runNumber=522`, `WORKFLOW_RUN_CONCLUSION_SUCCESS`, `24m 9s`) passed job `checks` (`122314468463`, `aria-label="completed successfully: "`) and deployed `36ba86a99f78ce93a8972c8e1f4d003242325469` in job `production` (`122326361875`). |
| **Waiting for capacity** | None (`0` deferred) | All local, green-gate, and live production browser/unit suites ran immediately with zero capacity deferrals. |
| **Execution demonstrated** | Proven | All 3 build-contract verification suites (`making-of unit and snapshot check`, `making-of browser e2e`, `repository unit suite and types`), independent Node/React 19 SSR & indexer preflight (`qa-making-of-preflight.mjs`), `/work` and Riso headings coexistence E2E suites (`e2e/riso-headings.test.ts`, `e2e/ink-press.test.ts`), and independent Chromium negative-control suites (`qa-making-of-browser-negative.mjs`) executed and exited `0`. |
| **Product delivered** | Proven | Live `https://otohime.dev/work` links to `/making-of`, which renders the horizontal Emaki handscroll of all `53` shipped `pm-NNN` plans (`634` commits) from `content/making-of.json`, showing four reusable sumi-ink figures (`#emaki-figure-research`, `#emaki-figure-product_owner`, `#emaki-figure-software_engineer`, `#emaki-figure-quality_engineer`) passing a scroll baton along with plan title, date, public model ID per role, clickable GitHub commit link, 3-layer scroll-scrubbed parallax (`0.25x` clouds, `0.55x` pines, `1.0x` foreground), keyboard navigation (`ArrowLeft`/`ArrowRight`/`Home`/`End`) with `aria-live="polite"` status, static layout under `prefers-reduced-motion: reduce`, and a complete server-rendered semantic `<ol>` for assistive technology and no-JS visitors. |

## 2. Commit Identity & Ancestry Verification

- **Commit inspected**: `36ba86a99f78ce93a8972c8e1f4d003242325469`
- **Author (`git show -s --format='%an <%ae>' 36ba86a99f78ce93a8972c8e1f4d003242325469`, `bash scripts/setup-owner-git.sh --check`, and SWE artifact `author.txt` `sha256: 7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`, `44` bytes)**: `Otohime <quiinthieu@gmail.com>` (matches `plan.commit_identity`).
- **Trailers (`git show -s --format='%b' 36ba86a99f78ce93a8972c8e1f4d003242325469`)**: Empty — no `Co-Authored-By` or AI attribution trailer.
- **Subject**: `pm-293/t-1675: implement Making-of Emaki handscroll and plan index`
- **Ancestry check**: `git merge-base --is-ancestor 36ba86a99f78ce93a8972c8e1f4d003242325469 36ba86a99f78ce93a8972c8e1f4d003242325469` -> exit `0`.

## 3. Executable Fingerprint & Real/Fake Boundaries

### Locked Environment & Artifact Hashes (SHA-256)
- **Runtime**: Node `v22.23.4` (`darwin-arm64`, official tarball SHA-256 `c9e1dbc748b33ed2d14f42445191ecaf14c56259c7a9a26d0042c49ec2b66428`), `next@16.4.2` (production build ID `pPzLoMBVYsa4XRfXtG5t4`), `react@19.3.0`, `playwright-core@1.64.0`, Headless Chromium.
- `package.json`: `e77f344d3388b7ea988ff6dadfafd873a8dd6baf7f64139f84e0be4b31038d92`
- `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`
- `scripts/making-of-index.ts`: `d40ea050c1b6ed9125f77e6c0d3fc4fc58547b09928fff9c6c8a135b9d91954b`
- `scripts/making-of-index.test.ts`: `cfd2a73cbbadbbd4ac4a60f0d6435d7b130db67fdee9aa73125d317e7f9803f5`
- `content/making-of.json`: `38cacbebe4c36935d9e3e54d04d832ded265f6b8368284738d74c86a510115b4`
- `lib/making-of.ts`: `a9d5138d7b5dae3d7d8a033fa0ee53def5cb94b87fb8859a2a80dcd7d064c3e1`
- `lib/making-of.test.ts`: `8711d447ddc35881a58c4dfe39f2609ea9b0873cfeb6920425883126ac7835e8`
- `app/(site)/(app)/making-of/page.tsx`: `1a08694df85ad0b7d2d5c2223f7bd8916c7e4295e8bad5a17592c97613e1bde1`
- `app/(site)/(app)/making-of/making-of.css`: `5589a416876748171893a17cff2a8d5cac27446760867ebb60f8b1b47ae575bb`
- `app/(site)/(app)/making-of/_components/emaki-scroll.tsx`: `eeb2769926623683ec94f3c1170c5bf58262a4057fda5cf4823da6d6d010af1e`
- `app/(site)/(app)/work/page.tsx`: `8eca56b8a0d6032f6834d620bacc68781965862664461300902e5884f3b295ef`
- `e2e/making-of.test.ts`: `85aac0f010585a0d988c42e1d9901aaa7f4478a210f8d9a8d69e6cb87b0de7d9`

### Real vs. Fake Boundaries
- **Real**: Next.js 16.4.2 production build (`next build` + `next start`), real embedded PostgreSQL 17 with Drizzle migrations (`scripts/e2e.mjs`), real `git` repository log and `--numstat` history indexing via `scripts/making-of-index.ts`, real React 19 `renderToStaticMarkup` SSR tree construction across all 53 scenes, real headless Chromium browser rendering and Web Animations API (`Element.getAnimations()`), and real live Vercel production deployment (`https://otohime.dev`).
- **Fake / Stand-in**: Temporary git repositories (`mkdtempSync`) and stub `Git` runner callbacks in unit tests (`scripts/making-of-index.test.ts`) used to simulate gitless, empty, shallow, and corrupted git log conditions without mutating the main checkout.

## 4. Bounded Paginated Run & Task History Inspection

- **`plan_manager_list_runs(plan_id="pm-293")`** (complete scan: `15 / 15` runs on plan `pm-293`):
  - `run-9228` (`research`, `claude-sonnet-medium`, `model_id=claude-sonnet-5-5`, `effort=medium`, `tm_task_id=a9b766fa-f77b-4d64-9a57-c8dbd2f9d215`): `succeeded`
  - `run-9229` (`product_owner`, `agy-argon-medium`, `model_id=gemini-4-argon`, `effort=medium`, `086e991`, `tm_task_id=e9450dfe-56cd-4624-a974-06595fa0f5cc`): `succeeded`
  - `run-9230` (`t-1673`, `software_engineer`, `agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `c1c885c`, `tm_task_id=52dad46a-cbc6-451f-8ccf-9718fa4d4527`): `succeeded`
  - `run-9231` (`t-1673`, `verify`, `c1c885c`, `tm_task_id=43471b63-a4cd-4afd-a346-7041a515ac5d`): `succeeded`
  - `run-9232` (`t-1676`, `software_engineer`, `agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `5fd1284`, `tm_task_id=64c846b3-1fd7-42a6-bb83-d4a92e6244fa`): `succeeded`
  - `run-9233` (`t-1676`, `verify`, `5fd1284`, `tm_task_id=1faced93-14f4-4e90-846c-1ccb0391fef6`): `succeeded`
  - `run-9234` (`t-1674`, `software_engineer`, `agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `8b0c491`, `tm_task_id=e11f2717-152c-48a7-9a57-754e47db243f`): `succeeded`
  - `run-9235` (`t-1674`, `verify`, `8b0c491`, `tm_task_id=a54b57d7-e678-43d8-a41d-87335d579f86`): `succeeded`
  - `run-9236` (`t-1677`, `software_engineer`, `agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `db788b1`, `tm_task_id=ab91ef35-9b35-4461-84eb-e88aae355a9d`): `succeeded`
  - `run-9237` (`t-1674`, `quality_engineer`, `agy-argon-medium`, `model_id=gemini-4-argon`, `effort=medium`, `6a2e327`, `tm_task_id=8a295849-a0cc-49b2-b384-95e62f2f146a`): `succeeded`
  - `run-9242` (`t-1677`, `verify`, `db788b1`, `tm_task_id=508a2462-158b-4a94-b299-7a332e575bda`): `succeeded`
  - `run-9243` (`t-1675`, `software_engineer`, `agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`, `36ba86a`, `tm_task_id=4284548d-f1f4-48a4-ba0c-5a5ebdc94f67`): `succeeded` (attempt 1, 0 retries, `callbackState="delivered"`)
  - `run-9244` (`t-1677`, `quality_engineer`, `agy-argon-medium`, `model_id=gemini-4-argon`, `effort=medium`, `3c2f732`, `tm_task_id=e22b5897-d6f9-47cd-8584-7941e5475970`): `succeeded`
  - `run-9248` (`t-1675`, `verify`, `36ba86a`, `tm_task_id=d0fbf399-a925-41ba-99b3-5f0f61aab9e2`): `succeeded` (`ver-3674` green gate pass, `callbackState="delivered"`)
  - `run-9249` (`t-1675`, `quality_engineer`, `agy-argon-medium`, `model_id=gemini-4-argon`, `effort=medium`, `tm_task_id=f9cd970d-9dfe-47fe-ab57-44fee106688c`): `running` (this QA run)
- **`task_manager_list_tasks` bounded scan** (`limit=20, offset=0` per status):
  - `PENDING`: `0` tasks (`complete`).
  - `RUNNING`: `4` tasks (`complete`, 2 on `otohime` including `f9cd970d-9dfe-47fe-ab57-44fee106688c` for `run-9249`).
  - `COMPLETED`: `20` tasks scanned (`3` on `otohime`, including `d0fbf399-a925-41ba-99b3-5f0f61aab9e2` for green gate `run-9248` on `36ba86a` and `4284548d-f1f4-48a4-ba0c-5a5ebdc94f67` for SWE `run-9243`, callbacks ingested as `ver-3674` and `rep-5463`).
  - `FAILED`: `20` tasks scanned (`6` on `otohime` from earlier plans `pm-268`, `pm-259`, `pm-270`; `0` failures match `pm-293/t-1675` or fingerprint `36ba86a`).

## 5. Verification Suites & Independent QA Evidence

1. **Contract Check 1 — `making-of unit and snapshot check`**:
   - Command: `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/making-of.test.ts scripts/making-of-index.test.ts && npm run making-of:check`
   - Result: Exit `0` (`15 / 15` unit and indexer tests passed in `13,667.1ms`; `making-of:check` verified `content/making-of.json matches git and trails HEAD by 4 commits`).
2. **Contract Check 2 — `making-of browser e2e`**:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/making-of.test.ts' && git checkout -- content/history.json`
   - Result: Exit `0` (`3 / 3` Chromium E2E tests passed against fresh production build `pPzLoMBVYsa4XRfXtG5t4` + real embedded Postgres 17).
3. **Contract Check 3 — `repository unit suite and types`**:
   - Command: `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint`
   - Result: Exit `0` (`2,567 / 2,567` unit and main-lane closure tests passed in `77,403.2ms`, `next typegen && tsc --noEmit` exited `0`, `eslint` exited `0` with `0` errors).
4. **Independent QA Preflight & React 19 SSR Construction (`qa-making-of-preflight.mjs`)**:
   - Directly imported `lib/making-of.ts`, `scripts/making-of-index.ts`, and `app/(site)/(app)/making-of/_components/emaki-scroll.tsx` in locked Node `v22.23.4` + `react-dom/server` `renderToStaticMarkup`.
   - Verified `readMakingOf` fallback to `EMPTY_MAKING_OF` on invalid versions or leaked private emails/tokens (`quiinthieu@gmail.com`, `ghp_...`, `sk-ant-...`, `/Users/...`, `postgres://...`), `sanitizePublicText` and `sanitizeModelId` sanitization, `computeEmakiParallax` and `stepSceneIndex` bounds, real `checkMakingOf` against the repo's git log, and valid React 19 SSR markup across all 53 scenes (`189,832` bytes SSR output) as well as empty scenes (`7,762` bytes SSR output with `"No scenes indexed"`).
5. **Independent Negative Controls & Live Production (`https://otohime.dev`) Verification**:
   - Ran both `e2e/making-of.test.ts` (`3 / 3` passed) and independent `qa-making-of-browser-negative.mjs` (`1 / 1` passed) against both the local production server and live `BASE_URL=https://otohime.dev` (`8,727.8ms` total):
     - **Negative control 1 (Boundary clamping & disabled step controls)**: At scene `0` (`pm-293`), `[data-testid="emaki-prev-scene"]` (`← Newer plan`) is disabled and pressing `ArrowLeft` / `ArrowUp` stays clamped at `data-active-scene-index="0"`; jumping to `End` (`scene 52`, `pm-171`) disables `[data-testid="emaki-next-scene"]` (`Older plan →`), moves the scroll baton to `translate(560, 48)` (`data-active-role="quality_engineer"`), and pressing `ArrowRight` / `ArrowDown` stays clamped at `52`.
     - **Negative control 2 (Non-navigation key rejection)**: Pressing unhandled keys (`Enter`, `Escape`, `a`, `?`) on `[data-testid="emaki-controls"]` is ignored (`stepSceneIndex(...) === null`), leaving `data-active-scene-index="0"` and `data-progress="0.000"` unchanged.
     - **Negative control 3 (Reduced motion Web Animations stillness)**: Under `prefers-reduced-motion: reduce`, stepping across scenes with `ArrowRight` updates `data-active-scene-index="2"` while keeping `data-translate-x="0"`, `getComputedStyle(list).transform === "none"`, `batonTransform === "translate(80, 48)"`, `window.scrollY === 0`, and `root.getAnimations({ subtree: true }).length === 0`.
     - **Coexistence on `/work` (`e2e/riso-headings.test.ts` + `e2e/ink-press.test.ts`)**: `12 / 12` tests passed (`0` console or page errors).

## 6. Defects & Deferred Checks

- **Defects observed**: None (`0`).
- **Deferred checks**: None (`0`). All acceptance criteria and verification checks are proven now.
