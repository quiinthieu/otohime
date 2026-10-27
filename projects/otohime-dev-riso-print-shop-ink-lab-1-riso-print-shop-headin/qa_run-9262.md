# QA Report — `pm-268` / `t-1678` (`run-9262`)

- **Plan**: `pm-268` ("Riso Ink Studio")
- **Task**: `t-1678` ("Stabilize Riso heading plates and /projects Kame hydration")
- **QA Run**: `run-9262` (`tm_task_id: 59f8b92a-fb22-467f-b82c-40cd1d2db04d`, profile `agy-argon-high`, model `gemini-4-argon`, effort `high`, account `billie-agy`, worker `avietidol-z490`, attempt `2`)
- **Delivery Under Test**: `72e3657983fd5862e8037ea4b5afc840c342d6af` (`72e3657`, single-parent linear commit, parent `7a165b7e9507f0a087abd85f1f191ef98a71512e`), delivered by SWE `run-9259` (`tm_task_id: 8c73a365-9fce-4eb8-9579-6fdb30fdebf6`, profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, account `codex-main`, worker `avietidol-mac-mini`, attempt `4`)
- **Cited Deployed SHA**: `68bde4aca8b7aa99fb92c374cc2e7e413be12778` (`68bde4a`, direct child of `72e3657983fd5862e8037ea4b5afc840c342d6af`; `git merge-base --is-ancestor 72e3657983fd5862e8037ea4b5afc840c342d6af 68bde4aca8b7aa99fb92c374cc2e7e413be12778` exits `0`), live at `https://otohime.dev/api/health`
- **Green Gate**: `ver-3678` (`run-9260`, `tm_task_id: e3b65ffb-519f-4f42-a3af-385f56224197`, template `verify-runner`, worker `avietidol-mac-mini`, `sha: 72e3657`, `status: pass`)
- **Verdict**: **`pass`**

---

## 1. Stage Classification & Delivery Summary

| Stage | Status | Evidence |
| :--- | :--- | :--- |
| **1. Integration deployed** | **PROVEN** | Delivery `72e3657983fd5862e8037ea4b5afc840c342d6af` is a single-parent linear commit on `origin/main` (parent `7a165b7e9507f0a087abd85f1f191ef98a71512e`). Production `https://otohime.dev/api/health` returns `{"ok":true,"sha":"68bde4aca8b7aa99fb92c374cc2e7e413be12778"}`, where `72e3657983fd5862e8037ea4b5afc840c342d6af` is the direct parent of `68bde4aca8b7aa99fb92c374cc2e7e413be12778` (`git merge-base --is-ancestor 72e3657983fd5862e8037ea4b5afc840c342d6af 68bde4aca8b7aa99fb92c374cc2e7e413be12778` exits `0`). |
| **2. Waiting for capacity** | **NONE** | `0` pending or deferred checks; all local, CI, and live production checks completed on real infrastructure. |
| **3. Execution demonstrated** | **PROVEN** | Green gate `ver-3678` (`run-9260`, task `e3b65ffb-519f-4f42-a3af-385f56224197`) passed all 5 contract verification commands on `72e3657`. Independent QA execution on worker `avietidol-z490` passed all 5 contract commands (`10/10` unit, `typecheck`, `lint`, `2,573/2,573` full unit, `19/19` contract E2E), `23/23` surrounding E2E tests (`tactile-tear`, `kame-fetch`, `daruma`), `npm run history:index -- --strict --rev=72e3657983fd5862e8037ea4b5afc840c342d6af`, 3 independent negative controls, and live headless Chrome verification of `https://otohime.dev/projects`. |
| **4. Product delivered** | **PROVEN** | Live `https://otohime.dev/projects` (at `68bde4aca8b7aa99fb92c374cc2e7e413be12778`, containing `72e3657983fd5862e8037ea4b5afc840c342d6af`) renders Riso headings with `.riso-anchor` / `.riso-char` `::before` & `::after` pseudo-element plates (`0` extra DOM `.riso-plate` spans, `matrix(1, 0, 0, 1, -1.04455, -2.0162)` misregistration), hydrates `11/11` visible `.cartridge[data-paper-host]` elements with `data-paper-hydrated="true"` and `[data-paper-controls]`, mounts `[data-kame][data-state="swim"]` and `#kame-shell section.kame-tools`, and produces `0` React `#418` hydration errors. |

---

## 2. Commit Identity & `author.txt` Verification

- **Required Plan Commit Identity (`plan.commit_identity`)**: `Otohime <quiinthieu@gmail.com>`, `no_co_authored_by: true`.
- **Git Commit Inspection (`72e3657983fd5862e8037ea4b5afc840c342d6af`)**:
  - Author: `Otohime <quiinthieu@gmail.com>`
  - Committer: `Otohime <quiinthieu@gmail.com>`
  - Parents: `7a165b7e9507f0a087abd85f1f191ef98a71512e` (single-parent linear commit)
  - Subject: `pm-268/t-1678: verify paper hydration subscriber settlement`
  - Trailers: None (`0` `Co-Authored-By` trailers).
- **SWE Delivery Artifact `author.txt` (`tm_task_id: 8c73a365-9fce-4eb8-9579-6fdb30fdebf6`, `run-9259`)**:
  - Artifact metadata: `name: "author.txt"`, `size: 44` bytes, `sha256: 7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`.
  - Recorded payload fields: `git_author_name: "Otohime"`, `git_author_email: "quiinthieu@gmail.com"`, `commit_attribution: "none"`.
  - Status: **PASS** (exact match to `plan.commit_identity`).

---

## 3. Executable & Build Identities, Locked Environment, and Real/Fake Boundaries

### Locked Environment & Executable Identities
- **Worker / OS**: `avietidol-z490` (`linux`, clean worktree branch `pm-268-t-1678-qa-run-9262`)
- **Node.js / npm**: `v22.23.3` / `10.9.9` (`npm ci` installed `522` locked packages from `package-lock.json`)
- **Browser**: Real Google Chrome `154.0.8037.57` via `playwright-core` `1.59.1`
- **Database**: Real embedded PostgreSQL `17.10.0-beta.17` (`@embedded-postgres/linux-x64`) with Drizzle migrations applied (`npm run db:migrate`)
- **Next.js Production Build**: Next.js `16.4.2`, React `19.2.3`, `.next/BUILD_ID`: `zl9JdMtdpnWVXLHhl63gc`

### File SHA-256 Fingerprints
| File | SHA-256 |
| :--- | :--- |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |
| `components/riso-heading.tsx` | `a725d673449386c6ebe8899c0898ae659bda20a11af662b9ed7a5432ab4912e5` |
| `lib/riso-heading.ts` | `5c8d025338b6526b2d0073eed306b269e9d80b7ba56355e096ad65ec2082823b` |
| `lib/riso-heading.test.ts` | `d79c52bc35298243921c459adce3b156e95de78d6e0d90e1efbbf4872ee0edb3` |
| `lib/paper-hydration.ts` | `780e832cacc91efc4f356bd3aa1ce1ec50a3808d6ecf7d459c38082e625bd671` |
| `lib/paper-hydration.test.ts` | `06d30f149a8f201fda77c7dd2848bb040698c961f891ca78870a20c701e42616` |
| `components/paper-host.tsx` | `92b98ee80994a92907a843beb47a4561b887f4543162a85d8257690955e16a16` |
| `components/cartridge.tsx` | `b48c838ff9ee0fabd58be01cec5e3c0be5ed4431be77016fd763cb4498ec3189` |
| `components/end-footer.tsx` | `659055c72339b886cd0da35c9bc9899b010bdcc4ef23fdcda574d387c5d7dcda` |
| `components/kame/companion.tsx` | `1fd83169547d0d85f5496707a524c05ba08423e7a5d1a6aeb7831cfd87d5868d` |
| `components/kame/loader.tsx` | `ff2039c33ff668b19ebc68ca1cf658d1bf30f367f55bebda737f8bfb936fbeaa` |
| `components/tactile/loader.tsx` | `84978d2076d5b213cd51604883ea258a6d30acca865f811be30c39bc245dd52d` |
| `components/tactile/paper-layer.tsx` | `548dd941449fc4231d13f82cafd95f82e2073e8e039974330a80bb7ed182131e` |
| `app/(site)/layout.tsx` | `bec08692201b48a19b7f4bcb390fcf19490d7bb461afb71facaff2a48ee378d8` |
| `app/(site)/(app)/notes/page.tsx` | `223a6472da862caa9cd44d3b514906904a31d65fc5bf47c65d57937918c88c5b` |
| `e2e/riso-headings.test.ts` | `f0e491fac01a72f2c6839d856e5ff0d822f3233330322fea7908971868ac220b` |
| `e2e/kame.test.ts` | `b20b662c0fb7e0a801338a50e708631d8825274f9cd53cacaea50ca113952dfc` |
| `projects/otohime-dev-riso-print-shop-ink-lab-1-riso-print-shop-headin/implementation_run-9259.md` | `279ff002301006ce8a5b97721b3e48cc94e38035b98ebf5e37135be75e64db7d` |

### Real vs. Fake Boundaries
- **Real**: TypeScript module imports (`lib/riso-heading.ts`, `lib/paper-hydration.ts`, `scripts/history-index.ts`), `next build` and `next start` production server, embedded PostgreSQL `17.10.0-beta.17` with Drizzle schema migrations, Google Chrome `154.0.8037.57` rendering, CSS pseudo-element layout and View Transition stylesheet geometry, `localStorage` persistence, and live production HTTPS requests against `https://otohime.dev/api/health` and `https://otohime.dev/projects`.
- **Fake / Simulated**: Playwright network route interception (`page.route("**/_next/static/chunks/*.js", ...)`) used exclusively in `e2e/kame.test.ts` (to delay the Daruma client chunk and verify hydration gating under slow chunk arrival) and in Negative Control A (to hold the Daruma chunk while injecting a pre-hydration child node into an unhydrated `.cartridge[data-paper-host]` and prove React `#418` detection sensitivity).

---

## 4. Contract Verification Gates & Independent QA Suite Execution

| Check | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Contract Gate 1** | `node --experimental-strip-types --test lib/riso-heading.test.ts lib/paper-hydration.test.ts` | **PASS** (`0`) | `10/10` tests passed (`5/5` in `lib/riso-heading.test.ts` + `5/5` in `lib/paper-hydration.test.ts`, including `"duplicate host acknowledgements preserve readiness for late subscribers without reactivating overlays"`), `0` failed, `83.9ms`. |
| **Contract Gate 2** | `npm run typecheck` | **PASS** (`0`) | `next typegen && tsc --noEmit` completed with `0` errors. |
| **Contract Gate 3** | `npm run lint` | **PASS** (`0`) | `eslint` exited `0` (`0` errors, `10` pre-existing warnings). |
| **Contract Gate 4** | `npm test` | **PASS** (`0`) | `2,573/2,573` unit tests passed (`2` suites, `0` failed, `0` skipped, `21,112.6ms`). |
| **Contract Gate 5** | `TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts e2e/kame.test.ts` | **PASS** (`0`) | `19/19` E2E tests passed (`0` failed, `0` skipped, `21,257.2ms`) against fresh `next build` + `next start`. |
| **Surrounding E2E** | `SKIP_BUILD=1 TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test e2e/tactile-tear.test.ts e2e/kame-fetch.test.ts e2e/daruma.test.ts` | **PASS** (`0`) | `23/23` E2E tests passed (`0` failed, `0` skipped, `47,972.1ms`). |
| **Strict History Gate** | `npm run history:index -- --strict --rev=72e3657983fd5862e8037ea4b5afc840c342d6af` | **PASS** (`0`) | Rebuilt `content/history.json` (`head: 72e3657983`, `total: 1091`) and passed strict verification at `72e3657983fd5862e8037ea4b5afc840c342d6af`. |
| **Independent QA Probe** | `SKIP_BUILD=1 TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test .../qa-probe-run-9262.mjs` | **PASS** (`0`) | Passed desktop (`1366x768`, `1920x1080`), mobile (`390x844`), 200% zoom (`683x384`), no-JS baseline, 3 negative controls, and live `https://otohime.dev/projects` inspection (`6,417.9ms`). |

---

## 5. Independent Evidence & Negative Controls

Outside the SWE implementation report and existing test files, we wrote and executed an independent probe (`qa-probe-run-9262.mjs`) exercising positive user journeys across `/`, `/projects`, `/play`, and `/notes` plus 3 negative controls:

1. **Negative Control A (Pre-Hydration DOM Mutation Triggers React `#418` on `/projects`)**:
   - **Setup**: Intercepted `**/_next/static/chunks/*.js` matching `"daruma-root"` on `/projects`, waited for `.cartridge[data-paper-host]:not([data-paper-hydrated])` on `domcontentloaded`, prepended `<div class="paper-tools-premature-mutation">` directly into an unhydrated `.cartridge[data-paper-host]` (simulating the pre-`t-1678` behavior where `PaperLayer` / `Kame` mutated unhydrated `PaperHost` articles before the Daruma chunk hydrated), and released the Daruma chunk.
   - **Observed**: `pageerror` immediately captured `Minified React error #418` (`caught418 === true`), whereas the unmutated `/projects` load with `[data-paper-hydrated="true"]` gating produced `0` `pageerror`s and hydrated all `11/11` visible cartridges cleanly.
2. **Negative Control B (Accessible Heading Duplication Without `aria-hidden="true"`)**:
   - **Setup**: Inspected `main h1` on `/` (`"Otohime"`), computed accessible text with `.riso-visual[aria-hidden="true"]` intact (`"Otohime"`), then removed `aria-hidden` from `.riso-visual` and recomputed accessible text.
   - **Observed**: Accessible text doubled to `"OtohimeOtohime"` when `aria-hidden` was removed, proving that `.riso-source` + `.riso-visual[aria-hidden="true"]` + CSS `::before`/`::after` pseudo-elements on `.riso-char` (with `0` extra `.riso-plate` DOM spans and `viewTransitionName === "none"` on `.riso-anchor`) is what keeps screen-reader output single-copy while rendering 3 visual plates.
3. **Negative Control C (Strict History-Index Rejection of Two-Parent Merge `a62c6356893c` vs. Pass on Linear `72e3657983fd` + `createHydrationRegistry` Subscriber Settlement)**:
   - **Setup**: Programmatically invoked `indexAt` and `checkHistory(..., { strict: true, rev })` from `scripts/history-index.ts` against prior failed delivery `a62c6356893c4080714795d11599469b55f9aa2e` (two-parent merge) and current delivery `72e3657983fd5862e8037ea4b5afc840c342d6af` (single-parent linear commit), and exercised duplicate `reg.mark(hostA)` calls before `reg.mark(hostB)` plus late `reg.wait()` subscription on `createHydrationRegistry()`.
   - **Observed**: `checkHistory` rejected `a62c6356893c4080714795d11599469b55f9aa2e` (`ok: false`, `message: "does not match git at its own head 96682e3cb1; run npm run history:index"`) and accepted `72e3657983fd5862e8037ea4b5afc840c342d6af` (`ok: true`, `message: "matches git and trails HEAD by 0 commits"`). Duplicate `mark(hA)` calls did not prematurely fire `earlyCalls` (`0` until `mark(hB)`, then `1`), and late `wait()` after settlement fired synchronously (`lateCalls === 1`).

---

## 6. Bounded Task-Manager, Plan-Manager, & GitHub Actions History

### Task-Manager Bounded History Scan
| Status | Pages Read | Rows Read / Total | Completeness | Relevant `t-1678` Tasks & Fingerprints |
| :--- | :--- | :--- | :--- | :--- |
| `RUNNING` | `1` (`offset: 0, limit: 10`) | `4 / 4` (`100%`) | Complete (`100%`) | `59f8b92a-fb22-467f-b82c-40cd1d2db04d` (`run-9262`, QA `t-1678`, `agy-argon-high` / `gemini-4-argon` / `high`, worker `avietidol-z490`, `attempt: 2`). |
| `PENDING` | `1` (`offset: 0, limit: 10`) | `1 / 1` (`100%`) | Complete (`100%`) | `e606c9a6-75f1-41e1-9d61-91fd3c35322f` (`maintenance` reclaim on `avietidol-z490`, unrelated to `pm-268`). |
| `COMPLETED` | `2` (`offset: 0..10, limit: 10`) + direct `get_task` | `20 / 6,222` + all `t-1678` tasks (`100%` of `t-1678`) | Bounded global (`20/6,222`), `100%` complete for `t-1678` | `e3b65ffb-519f-4f42-a3af-385f56224197` (`run-9260` / `ver-3678`, `verify-runner`, `avietidol-mac-mini`, `sha: 72e3657`, `status: pass`); `8c73a365-9fce-4eb8-9579-6fdb30fdebf6` (`run-9259`, SWE `t-1678`, `codex-sol-6-1-high` / `gpt-6.1-sol` / `high`, `avietidol-mac-mini`, `attempt: 4`, delivered `72e3657`); `a6144249-747e-4826-b5eb-3669410a4431` (`run-9254`, QA `t-1678`, `agy-argon-high` / `gemini-4-argon` / `high`, `verdict: fail`, `cause: code` on `a62c635`); `eb70d25a-ac1e-4449-8386-d3f039299a9e` (`run-9252` / `ver-3676`, `verify-runner`, `sha: a62c635`, `status: pass`); `c2e77f7b-b724-4da7-aba7-6b19904490d1` (`run-9250`, SWE `t-1678`, `codex-sol-6-1-high` / `gpt-6.1-sol` / `high`, delivered `a62c635`). |
| `FAILED` | `2` (`offset: 0..10, limit: 10`) + direct `get_task` | `20 / 1,176` + all `t-1678` tasks (`100%` of `t-1678`) | Bounded global (`20/1,176`), `100%` complete for `t-1678` | `bb71ce68-d17d-4dc9-b702-9a91ec383853` (`run-9257`, SWE `t-1678`, `codex-Spark-low` / `gpt-5.3-codex-spark` / `low`, `attempt: 3`, failed before retry on `codex-sol-6-1-high`); `8e9ae0a1-f0c8-49ed-9faf-3bd121d2b056` (`run-9247`, SWE `t-1678`, `codex-Spark-low` / `gpt-5.3-codex-spark` / `low`, `attempt: 1`, exited with `implementation_not_submitted`). Both superseded by `run-9259` (`72e3657`). |

### GitHub Actions CI & Live Production Deployment History
- **Scan Scope**: `2` pages (`50 / 526` workflow runs, `#477`–`#526`) read from `https://github.com/quiinthieu/otohime/actions?page=1` and `?page=2` plus detailed run inspection of `40555071055` (`#526`), `40554703084` (`#525`), `40552915182` (`#524`), `40548292541` (`#521`), and `40539710809` (`#518`).
- **Run `#521` (`40548292541`, commit `a62c6356893c4080714795d11599469b55f9aa2e`)**: Failed in `checks` after `37s` at `npm run history:index -- --strict` because `a62c635` was a two-parent merge commit (`defect-t1678-merge-commit-strict-history`).
- **Run `#525` (`40554703084`, commit `72e3657983fd5862e8037ea4b5afc840c342d6af`)**: **Passed `npm run history:index -- --strict`** (proving the single-parent linear commit fix resolved `defect-t1678-merge-commit-strict-history`) and passed all `t-1678` E2E tests (`riso-headings`, `kame`, `tactile-tear`, `daruma`), failing only at `e2e/hanafuda.test.ts:345` (`/Flipped Month 10 \(Maple\) card back: 645 commits/` vs `'Flipped Month 10 (Maple) card back: 660 commits...'`) because earlier commit `7ad719fc89d0` (`pm-293/t-1682`) updated `content/yearly-log.json` (`months["10"].commits: 660`) without updating the hardcoded `645 commits` regex in `e2e/hanafuda.test.ts:345`.
- **Run `#526` (`40555071055`, commit `68bde4aca8b7aa99fb92c374cc2e7e413be12778`, direct child of `72e3657983fd5862e8037ea4b5afc840c342d6af`)**: Parameterized `e2e/hanafuda.test.ts` to use `rawYearlyLog.months["10"].commits`, **passed both `checks` and `deploy` (`WORKFLOW_RUN_CONCLUSION_SUCCESS`, duration `21m 20s`)**, and deployed `68bde4aca8b7aa99fb92c374cc2e7e413be12778` (which contains `72e3657983fd5862e8037ea4b5afc840c342d6af` as its direct parent) to `https://otohime.dev/api/health`.
- **Live Production Verification (`https://otohime.dev`)**:
  - `GET https://otohime.dev/api/health` -> `200 OK`, `{"ok":true,"sha":"68bde4aca8b7aa99fb92c374cc2e7e413be12778"}`.
  - Ancestor check: `git merge-base --is-ancestor 72e3657983fd5862e8037ea4b5afc840c342d6af 68bde4aca8b7aa99fb92c374cc2e7e413be12778` -> exit code `0`.
  - Real Chrome navigation to `https://otohime.dev/projects`: `risoState: "printed"`, `anchorCount: 8` (`"Projects"`), `domPlateSpans: 0`, `beforeTransform: "matrix(1, 0, 0, 1, -1.04455, -2.0162)"`, `visibleCartridges: 11`, `allHydrated: true`, `allHaveControls: true`, `kameState: "swim"`, `liveErrors: []` (`0` console/page errors).

---

## 7. Defects & Deferred Checks

### Defects
- **Open Defects**: **None (`0`)**.
- **Resolved Prior Defect**: `defect-t1678-merge-commit-strict-history` (from QA `run-9254` on `a62c6356893c4080714795d11599469b55f9aa2e`) is **RESOLVED** in `72e3657983fd5862e8037ea4b5afc840c342d6af` (single-parent linear commit; `npm run history:index -- --strict --rev=72e3657983fd5862e8037ea4b5afc840c342d6af` exits `0`).

### Deferred Checks
- **None (`0`)**. Every contract check, negative control, CI gate, and live production check has been executed and verified now.
