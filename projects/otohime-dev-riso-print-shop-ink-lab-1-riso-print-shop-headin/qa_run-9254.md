# QA Report — `pm-268` / `t-1678` (`run-9254`)

- **Plan**: `pm-268` ("Riso Ink Studio")
- **Task**: `t-1678` ("Stabilize Riso heading plates and /projects Kame hydration")
- **QA Run**: `run-9254` (`tm_task_id: 5ded3c30-3a85-46f3-b898-e9f33dd1f1bf`, profile `agy-argon-high`, model `gemini-4-argon`, effort `high`, account `billie-agy`, worker `avietidol-mac-mini`, attempt `1`)
- **Delivery Under Test**: `a62c6356893c4080714795d11599469b55f9aa2e` (`a62c635`, merging `a770c135ab76fcb6a651baa9496e71af7c84f508` and `c5497e0ce3a170ad7291702f22cdceeeb287ac52`), delivered by SWE `run-9250` (`tm_task_id: 7e22f3c7-7f8d-4942-ba3b-5fdd3643e598`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, account `codex-main`, worker `billie-mac`, attempt `3`)
- **Green Gate**: `ver-3675` (`run-9253`, `tm_task_id: 752d182a-4138-4dbe-a236-e6d6aa55adbf`, template `verify-runner`, agent `shell`, worker `avietidol-mac-mini`) — **PASSED** all 5 verification items at `a62c635`
- **Verdict**: **FAIL** (`cause=code`)

---

## 1. Executive Summary & Delivery State Distinction

| Dimension | Status | Evidence |
| :--- | :--- | :--- |
| **Execution Demonstrated (Local Locked Build)** | **DEMONSTRATED (PASS)** | All 5 contract verification gates (`5/5` Riso unit, `4/4` paper-hydration unit, `2,571/2,571` `npm test`, `npm run typecheck`, `npm run lint`, `19/19` contract E2E in `e2e/riso-headings.test.ts` + `e2e/kame.test.ts`), `23/23` surrounding E2E tests (`e2e/tactile-tear.test.ts`, `e2e/kame-fetch.test.ts`, `e2e/daruma.test.ts`), and the independent QA browser probe (`1/1` with 3 negative controls) passed on locked production build `KESi-gU_6yDrJzwGpWMjS` with zero React `#418` hydration errors and zero `pageerror`s. |
| **Integration Deployed (GitHub Actions CI & Vercel)** | **FAILED AT CI STEP 18** | GitHub Actions workflow run `40548308774` (`push` on `main` for `a62c6356893c4080714795d11599469b55f9aa2e`, `2026-10-27T17:12:05Z`–`17:16:17Z`) failed in job `checks` (`122344833837`) at Step 18 (`Run npm run history:index -- --strict --rev="$GITHUB_SHA"`, exit `1`), skipping `production` job `122347217303`. |
| **Waiting for Capacity** | **NONE** | `0` pending tasks in `task-manager`; GitHub Actions runner executed `40548308774` immediately. |
| **Product Delivered (`https://otohime.dev`)** | **NOT DELIVERED** | Live `https://otohime.dev/api/health` serves `{"ok":true,"sha":"36ba86a99f78ce93a8972c8e1f4d003242325469"}`. `git merge-base --is-ancestor a62c6356893c4080714795d11599469b55f9aa2e 36ba86a99f78ce93a8972c8e1f4d003242325469` exits `1` (false), and live `https://otohime.dev/projects` still serves pre-`t-1678` markup (`0` `[data-paper-host]` nodes). |

### Root Cause of CI Failure (`cause=code`)

Comparing failing GitHub Actions run `40548308774` (`a62c6356893c4080714795d11599469b55f9aa2e`) against the immediately preceding green `main` run `40539710809` (`36ba86a99f78ce93a8972c8e1f4d003242325469`, `2026-10-27T16:19:05Z`–`16:43:14Z`) shows **zero** changes to `.github/workflows/ci.yml` or `scripts/history-index.ts` between the two commits (`git log 36ba86a99f78..a62c6356893c -- .github/workflows/ci.yml scripts/history-index.ts` is empty).

Instead, SWE `run-9250` published `a62c6356893c4080714795d11599469b55f9aa2e` as a **two-parent merge commit** (`Merge parents: a770c135ab76fcb6a651baa9496e71af7c84f508 and c5497e0ce3a170ad7291702f22cdceeeb287ac52`) rather than rebasing rescued commit `c5497e0ce3a170ad7291702f22cdceeeb287ac52` onto `origin/main` (`git pull --rebase`) as required by the SWE role contract:
1. When `HEAD` is `a62c6356893c4080714795d11599469b55f9aa2e`, `indexAt(run, head)` in `scripts/history-index.ts` (lines 240–246) collects `git log --no-merges` reachable from `a62c6356893c` (including both `a770c135ab` from parent 1 and `c5497e0ce3` from parent 2) and sets `index.head = commits[0].sha = "a770c135ab76fcb6a651baa9496e71af7c84f508"`.
2. Immediately afterward, `main()` (`scripts/history-index.ts:441`) calls `checkHistory(run, repo, readText(file), { strict: true, rev })`.
3. At `scripts/history-index.ts:342–345`, `checkHistory` runs `const rebuiltAtLeaf = indexAt(git, committed.head)` (`indexAt(git, "a770c135ab76fcb6a651baa9496e71af7c84f508")`). Because `c5497e0ce3a170ad7291702f22cdceeeb287ac52` is on the second parent of merge commit `a62c6356893c4080714795d11599469b55f9aa2e`, it is not reachable from `a770c135ab76fcb6a651baa9496e71af7c84f508`, so `rebuiltAtLeaf` omits `c5497e0ce3` and `checkHistory` fails deterministically with:
   `history:index: strict post-write check failed for .../content/history.json: does not match git at its own head a770c135ab; run npm run history:index` (exit code `1`).
4. Subsequent commit `2e14e3b50be6e2b360e637f17495d0f90398b762` (`pm-293/plan: revise Washi Daruma, Emaki, and Hanafuda for cycle 1`) is a linear non-merge commit on top of `a62c6356893c` where `history:index -- --strict` passes (`{ ok: true, message: "matches git and trails HEAD by 0 commits" }`), **but** `2e14e3b50be6` only touched `projects/**/plan.md` and was skipped by `.github/workflows/ci.yml` (`paths-ignore: ["projects/**", "**.md"]`).

Because the CI failure on `a62c6356893c4080714795d11599469b55f9aa2e` was caused by the SWE delivery commit topology (`git merge` instead of linear `git pull --rebase`) rather than a runner or pipeline change, this failure is classified as `cause=code` with an accompanying surgical `fix_plan` (`fix_plan_run-9254.md`).

---

## 2. Commit Identity & `author.txt` Verification

- **Required Plan Commit Identity**: `Otohime <quiinthieu@gmail.com>` with no `Co-Authored-By` trailer (`plan.commit_identity`).
- **Git Commit Headers Checked**:
  - `c5497e0ce3a170ad7291702f22cdceeeb287ac52`: Author `Otohime <quiinthieu@gmail.com>`, Committer `Otohime <quiinthieu@gmail.com>`, trailers: none (`0` `Co-Authored-By` lines).
  - `a770c135ab76fcb6a651baa9496e71af7c84f508`: Author `Otohime <quiinthieu@gmail.com>`, Committer `Otohime <quiinthieu@gmail.com>`, trailers: none (`0` `Co-Authored-By` lines).
  - `a62c6356893c4080714795d11599469b55f9aa2e`: Author `Otohime <quiinthieu@gmail.com>`, Committer `Otohime <quiinthieu@gmail.com>`, trailers: none (`0` `Co-Authored-By` lines).
- **Task-Manager `author.txt` Artifact Receipt**:
  - In `task_manager_get_task` for both SWE delivery task `7e22f3c7-7f8d-4942-ba3b-5fdd3643e598` (`run-9250`) and rescued SWE task `8e9ae0a1-f0c8-49ed-9faf-3bd121d2b056` (`run-9247`), the recorded artifact manifest contains `author.txt` (`size: 44`, `sha256: 7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`), matching the exact `author.txt` hash recorded on every compliant `Otohime <quiinthieu@gmail.com>` run (e.g., `9937d4ea-48f6-4203-a43c-ae60e0da903b` / `run-9252`) with `git_author_name: "Otohime"`, `git_author_email: "quiinthieu@gmail.com"`, `commit_attribution: "none"`.

---

## 3. Executable & Build Fingerprint

- **Environment**: macOS (`darwin` arm64), worker `avietidol-mac-mini`, Node `v22.23.3`, npm `10.9.2`, Google Chrome `154.0.8037.57`, embedded PostgreSQL `17`, locked `npm ci` (`517` packages).
- **Production Build ID (`.next/BUILD_ID`)**: `KESi-gU_6yDrJzwGpWMjS`
- **Real Imports Preflighted in Locked Environment**: `next` (`16.4.2`), `react` (`19.3.0-canary`), `playwright-core` (`1.52.0`), `embedded-postgres`, `drizzle-orm`, `pg`, plus direct execution of `lib/riso-heading.ts`, `lib/paper-hydration.ts`, and `scripts/history-index.ts`.
- **File SHA-256 Fingerprints**:
  - `package.json`: `e77f344d3388b7ea988ff6dadfafd873a8dd6baf7f64139f84e0be4b31038d92` (`6,866` B)
  - `package-lock.json`: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` (`353,159` B)
  - `next.config.ts`: `e2ab6eeb96755f02796a76a876f4d617db0d9d4b9cf8124156cd7e08814ab83e` (`2,233` B)
  - `.github/workflows/ci.yml`: `ce7c02f99ff47d8fd2f43f063712a4d2bed709982af1973aa15763809fa3f746` (`17,903` B)
  - `lib/paper-hydration.ts`: `780e832cacc91efc4f356bd3aa1ce1ec50a3808d6ecf7d459c38082e625bd671` (`1,867` B)
  - `lib/paper-hydration.test.ts`: `4582fdbe799b294f05be455f0126fbe719283e354711fecaa231e54f13892e1f` (`2,760` B)
  - `components/paper-host.tsx`: `92b98ee80994a92907a843beb47a4561b887f4543162a85d8257690955e16a16` (`818` B)
  - `app/(site)/layout.tsx`: `bec08692201b48a19b7f4bcb390fcf19490d7bb461afb71facaff2a48ee378d8` (`4,936` B)
  - `components/kame/loader.tsx`: `ff2039c33ff668b19ebc68ca1cf658d1bf30f367f55bebda737f8bfb936fbeaa` (`2,028` B)
  - `components/kame/companion.tsx`: `1fd83169547d0d85f5496707a524c05ba08423e7a5d1a6aeb7831cfd87d5868d` (`15,045` B)
  - `components/tactile/loader.tsx`: `84978d2076d5b213cd51604883ea258a6d30acca865f811be30c39bc245dd52d` (`1,876` B)
  - `components/tactile/paper-layer.tsx`: `548dd941449fc4231d13f82cafd95f82e2073e8e039974330a80bb7ed182131e` (`11,829` B)
  - `components/cartridge.tsx`: `b48c838ff9ee0fabd58be01cec5e3c0be5ed4431be77016fd763cb4498ec3189` (`2,971` B)
  - `components/end-footer.tsx`: `659055c72339b886cd0da35c9bc9899b010bdcc4ef23fdcda574d387c5d7dcda` (`4,831` B)
  - `app/(site)/(app)/notes/page.tsx`: `223a6472da862caa9cd44d3b514906904a31d65fc5bf47c65d57937918c88c5b` (`1,443` B)
  - `lib/riso-heading.ts`: `5c8d025338b6526b2d0073eed306b269e9d80b7ba56355e096ad65ec2082823b` (`1,337` B)
  - `lib/riso-heading.test.ts`: `d79c52bc35298243921c459adce3b156e95de78d6e0d90e1efbbf4872ee0edb3` (`1,840` B)
  - `components/riso-heading.tsx`: `a725d673449386c6ebe8899c0898ae659bda20a11af662b9ed7a5432ab4912e5` (`3,878` B)
  - `components/riso-heading.css`: `fd64c5d5386762695074995bf4a66c8a9ec50e784120276da223439f3edad1cd` (`2,542` B)
  - `e2e/kame.test.ts`: `b20b662c0fb7e0a801338a50e708631d8825274f9cd53cacaea50ca113952dfc` (`25,309` B)
  - `e2e/riso-headings.test.ts`: `f0e491fac01a72f2c6839d856e5ff0d822f3233330322fea7908971868ac220b` (`15,709` B)

---

## 4. Bounded History & Callback Completeness

### 4.1 Task-Manager Paginated History (`task_manager_list_tasks`)
- **`FAILED` Tasks**: Scanned 2 bounded pages (`limit=10, offset=0` and `limit=10, offset=10` -> `20` tasks read out of `total=1,175`).
  - `8e9ae0a1-f0c8-49ed-9faf-3bd121d2b056` (`otohime`, `pm-268`, `run-9247`, `software_engineer`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-mac-mini`): `FAILED` (`agent_failed: exit 1 class=push_failed marker=push_not_on_main: HEAD cbf862f5ef45 is not on origin/main`), `callbackState: delivered`, `callbackAttempts: 1`. Rescued onto `origin/main` in `run-9250`.
  - `6aa8840f-e4eb-490f-bb0d-29e347722422` (`otohime`, `pm-268`, `run-9240`, `quality_engineer`): `FAILED` (`push_not_on_main: HEAD 76c9c71c4f42 is not on origin/main`), `callbackState: delivered`, `callbackAttempts: 1`.
- **`COMPLETED` Tasks**: Scanned 2 bounded pages (`limit=10, offset=0` and `limit=10, offset=10` -> `20` tasks read out of `total=6,294`) plus direct `task_manager_get_task` + `task_manager_get_task_logs` for `t-1678` runs:
  - `7e22f3c7-7f8d-4942-ba3b-5fdd3643e598` (`otohime`, `pm-268`, `run-9250`, `software_engineer`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `billie-mac`, attempt `3`): `COMPLETED` (`exit_code: 0`, `git_sha: a62c6356893c4080714795d11599469b55f9aa2e`), `callbackState: delivered`, `callbackAttempts: 1`.
  - `752d182a-4138-4dbe-a236-e6d6aa55adbf` (`otohime`, `pm-268`, `run-9253`, `verify-runner` / `shell` for `ver-3675`, worker `avietidol-mac-mini`, `git_sha: a62c635`): `COMPLETED` (`exit_code: 0`, all 5 verification items passed in `98s`), `callbackState: delivered`, `callbackAttempts: 1`.
  - `b2e9f86a-f006-4dfc-aaab-f7d29139a9e8` (`otohime`, `pm-268`, `run-9246`, `verify-runner` / `shell` for `ver-3672`, `git_sha: 58140857ae2d`): `COMPLETED` (`red_gate_vacuous` before `t-1678` implementation), `callbackState: delivered`, `callbackAttempts: 1`.
- **`RUNNING` Tasks**: Scanned page 1 (`limit=10, offset=0` -> `4` tasks read out of `total=4`, 100% complete):
  - `5ded3c30-3a85-46f3-b898-e9f33dd1f1bf` (`otohime`, `pm-268`, `run-9254`, `quality_engineer` — this run).
  - `afe22cca-cec9-48c4-be0a-a05444b2a158` (`otohime`, `pm-293`, `run-9255`, `software_engineer`).
  - `a7feb562-c61c-4940-a65b-5ee491ad42af` (`otohime`, `pm-293`, `run-9256`, `software_engineer`).
  - `101871c8-d22b-41e8-897c-d08da02fcce1` (`mono-v2`, `coding-agent`).
- **`PENDING` Tasks**: Scanned page 1 (`limit=10, offset=0` -> `0` tasks read out of `total=0`, 100% complete).

### 4.2 GitHub Actions CI History (`/repos/quiinthieu/otohime/actions/runs`)
- Scanned 1 bounded page (`per_page=15`, `15` workflow runs read out of `total_count=523`) plus full job/step/annotation records for `40548308774`:
  - **Run `40548308774`** (`head_sha: a62c6356893c4080714795d11599469b55f9aa2e`, event `push` on `main`, `2026-10-27T17:12:05Z`–`17:16:17Z`): `completed` / `failure`.
    - Job `checks` (`122344833837`): Steps 1–11 (`actions/checkout@v7` with `fetch-depth: 0`, guestbook & Vercel author checks, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`) and Steps 13–17 (`vercel-deploy.test.sh`, `verify-deploy.sh --self-test`, `probe-history.sh --self-test`, `npm run ask:check`, `Migrations match db/schema.ts`) all succeeded. Step 18 (`Run npm run history:index -- --strict --rev="$GITHUB_SHA"`) **failed** (`exit 1`, `17:16:13Z`–`17:16:14Z`). Steps 19–27 (`history:check`, `npm run build`, camera probe, `db:migrate`, `E2E against next start`, `Motion probe`, `Footer walk`, `Footer Chromium probe`) were skipped.
    - Job `production` (`122347217303`): `skipped`.
  - **Run `40539710809`** (`head_sha: 36ba86a99f78ce93a8972c8e1f4d003242325469`, event `push` on `main`, `2026-10-27T16:19:05Z`–`16:43:14Z`): `completed` / `success` (currently deployed on `https://otohime.dev`).

---

## 5. Verification Suites & Independent QA Evidence

### 5.1 Contract & Project Suites Executed Locally (Real Locked Environment)
1. `node --experimental-strip-types --test lib/riso-heading.test.ts`: **5/5 passed** (`0` fail, `0` skip, `80.0ms`).
2. `node --experimental-strip-types --test lib/riso-heading.test.ts lib/paper-hydration.test.ts`: **9/9 passed** (`0` fail, `0` skip).
3. `npm test`: **2,571/2,571 passed** across 2 suites (`0` fail, `0` skip, `25,128.3ms`).
4. `npm run typecheck`: **PASS** (`exit 0`, `0` diagnostics).
5. `npm run lint`: **PASS** (`exit 0`, `0` errors, `10` pre-existing warnings).
6. `TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts e2e/kame.test.ts`: **19/19 passed** (`0` fail, `0` skip, `23,188.2ms` against fresh production build `KESi-gU_6yDrJzwGpWMjS` + real Chrome `154.0.8037.57` + embedded PostgreSQL 17).
7. `SKIP_BUILD=1 TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test e2e/tactile-tear.test.ts e2e/kame-fetch.test.ts e2e/daruma.test.ts`: **23/23 passed** (`0` fail, `0` skip, `67,880.8ms`).

### 5.2 Independent QA Probe & Negative Controls (`/tmp/qa-run-9254/independent-qa-probe.mjs`)
Executed via `SKIP_BUILD=1 TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test /tmp/qa-run-9254/independent-qa-probe.mjs` (`1/1 passed`, `15,837.8ms`):
- **Riso Headings Across `/`, `/projects`, `/play`, `/notes`**:
  - Verified `.riso-text` count (`5` on `/`, `3` on `/projects`, `8` on `/play`, `5` on `/notes`), `.riso-source` accessible text (`user-select: none`), `.riso-visual[aria-hidden="true"]`, `.riso-anchor` (`user-select: text`), `::before` and `::after` pseudo-element spot-color plates, and `0` `.riso-char` nodes with `view-transition-name`.
  - Verified `200%` text zoom at `390x844` mobile viewport (`overflow !== "hidden"`, non-zero geometry, `0` overlaps).
  - Verified `prefers-reduced-motion: reduce` + `forced-colors: active` (`data-riso-state="settled"`, `::before` / `::after` `display: none`, `animationName: "none"`).
  - Verified `javaScriptEnabled: false` on `/projects` (`h1 .riso-source` = `"Projects"`, `16` `[data-paper-host]` elements present in SSR HTML with `0` `data-paper-hydrated` attributes).
- **`/projects` Real-Time Hydration, Tactile Corner Peel, and Daruma View Switch**:
  - Verified all `16` `[data-paper-host]` elements (`12` project cartridges + `3` footer lines + `#kame-shell`) transition to `data-paper-hydrated="true"` after hydration and `[data-paper-controls]` attaches to all `12` cartridges with `0` React `#418` or `pageerror`s.
  - Verified keyboard peel (`Peel corner` + `Enter` -> `data-paper-state="peeled"`) and reset (`Reset` + `Space` -> `data-paper-state="intact"`).
  - Verified switching to `Daruma shelf` (`[data-testid="daruma-board"]` visible) and back to `Cartridges` re-hydrates all `12` cartridges with `data-paper-hydrated="true"` and reattaches `[data-paper-controls]` with `0` errors.
- **Independent Negative Controls**:
  1. **Negative Control A (Pre-Hydration DOM Mutation on `/projects`)**: Injecting a child node into `.cartridge[data-paper-id][data-tossable]` via `MutationObserver` while holding the Daruma chunk for `300ms` reproduces `Minified React error #418` (`caughtHydrationError: true`, `errorCount: 1`), proving the test harness catches pre-hydration mutations while `afterPaperHydration` prevents them in the unmodified build.
  2. **Negative Control B (Accessible Heading Name Duplication)**: Removing `aria-hidden="true"` from `.riso-visual` on `/` causes the unhidden heading text nodes to duplicate (`"OtohimeOtohime"`, `isCorruptedWhenUnhidden: true`), proving the accessibility invariant check catches plate leakage.
  3. **Negative Control C (`scripts/history-index.ts --strict` on Merge Commit vs Linear Commit)**: Calling `checkHistory(..., { strict: true, rev })` at two-parent merge commit `a62c6356893c4080714795d11599469b55f9aa2e` fails with `{ ok: false, message: "does not match git at its own head a770c135ab; run npm run history:index" }` (`indexedHead: a770c135ab76fcb6a651baa9496e71af7c84f508`, `total: 660`), whereas calling it at linear commit `2e14e3b50be6e2b360e637f17495d0f90398b762` passes with `{ ok: true, message: "matches git and trails HEAD by 0 commits" }` (`total: 661`).

### 5.3 Real / Fake Boundaries
- **Real**: Next.js 16.4.2 production build (`KESi-gU_6yDrJzwGpWMjS`), `next start` HTTP server, embedded PostgreSQL 17 with Drizzle migrations, Google Chrome `154.0.8037.57` (`playwright-core`), `scripts/history-index.ts` against real git history, and live HTTPS requests to `https://otohime.dev` and `https://api.github.com`.
- **Fake / Controlled**: Playwright fake clock (`page.clock.install()`) and route hold (`page.route("**/_next/static/**")`) used to deterministically test the `46s` idle Kame timer and pre-hydration chunk delay window, plus synthetic DOM mutations in Negative Controls A and B.

---

## 6. Observed Defect & Deferred / Pending Checks

- **Observed Defect (`defect-t1678-merge-commit-strict-history`)**:
  - **Location**: Delivery commit `a62c6356893c4080714795d11599469b55f9aa2e` (two-parent merge of `a770c135ab76` and `c5497e0ce3a1`) interacting with `scripts/history-index.ts:342–345` in `.github/workflows/ci.yml:129` (`npm run history:index -- --strict --rev="$GITHUB_SHA"`).
  - **Impact**: GitHub Actions run `40548308774` failed at `checks` Step 18, skipping `production` deployment and leaving `https://otohime.dev/api/health` at `36ba86a99f78ce93a8972c8e1f4d003242325469`.
- **Deferred / Pending Check (`post-fix-ci-and-production-deploy`)**:
  - **ID**: `t-1678-live-production-verification`
  - **Owner**: `software_engineer` (to push linear commit per `fix_plan_run-9254.md`) -> `plan-manager` (`verify-runner` green gate + `quality_engineer` re-verification).
  - **Failure Condition**: GitHub Actions `ci.yml` (`checks` or `production` job) fails on the new linear `t-1678` commit, or `https://otohime.dev/api/health` does not advance to a commit where `git merge-base --is-ancestor <new-delivery-sha> <deployed-sha>` exits `0`, or live `https://otohime.dev/projects` exhibits any React `#418` / `pageerror` or missing `[data-paper-hydrated="true"]`.
