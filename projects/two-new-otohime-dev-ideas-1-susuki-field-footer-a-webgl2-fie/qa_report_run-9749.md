# t-1766 QA — run-9749

**Verdict: fail. Cause: code.** Susuki's unguarded NetworkInformation listener subscription breaks three existing Save-Data browser fixtures. `components/susuki-field.tsx:290` calls `connection?.addEventListener(...)` when the connection object contains only `saveData`. React catches the TypeError and removes the page's content. Cleanup has the corresponding unguarded method at line 300. No application source was changed by QA.

Delivery: **ec7e171e1ae5fc68e0a68e133ded9ea145c611a6**. Independently observed deployed commit: **ce7f635652de107a44d2ee5e27f7377596d662cd**, from production health and the HTML build-sha on both `/` and `/projects`. `git merge-base --is-ancestor ec7e171 ce7f635` exits 0. Persisted green gate **ver-3876**, verification **run-9739**, native task **e3c4e495-167a-4567-94ac-b4e7eb407873**, passes both contract commands for ec7e171. That gate does not cover the three older failing suites.

## Reproduced defect and independent control

The real locked production-build runner executed `e2e/kame.test.ts`, `e2e/kame-fetch.test.ts` and `e2e/peep-box.test.ts`: **33 tests, 30 pass, 3 fail, zero skipped**, exit 1. Failures match the native delivery CI annotations:

| Existing test | Observable failure |
| --- | --- |
| `e2e/kame.test.ts:186` | Enable Kame companion never appears after the Save-Data effect crash |
| `e2e/kame-fetch.test.ts:184` | Enable paper corners never appears after the same crash |
| `e2e/peep-box.test.ts:647` | `#press-heading` disappears; scrollIntoView times out |

[qa-save-data-run-9749.mjs](qa-save-data-run-9749.mjs) independently runs against production, outside the supplied SWE proof and older E2E scripts. It sets the exact existing capability fixture `{ saveData: true }`, captures the React console error `TypeError: s?.addEventListener is not a function`, and observes **zero footer elements**. The control substitutes `Object.assign(new EventTarget(), { saveData: true })`: **no errors and one intact footer**, with Susuki in static mode. [Raw diagnostic evidence](qa-save-data-evidence-run-9749.json) includes the deployed health SHA and actual stack in field chunk `3onrwr-vuz1mb.js`.

The connection objects are explicitly synthetic capability fixtures. This does **not** establish that native Chromium's real NetworkInformation lacks EventTarget methods. It establishes a delivered integration regression against existing suites, independently reproduces its effect in the deployed React/WebGL executable, and identifies the exact source call. Susuki's own Save-Data test supplies listener stubs, which concealed this compatibility gap. An increased CI timeout cannot fix the crash.

Two initial diagnostic attempts were QA setup errors: the first checked footer absence before hydration; the second listened only for `pageerror`, while React reports this caught effect failure through `console.error`. The final diagnostic waits for the actual console TypeError and passes its reproduction/control assertions. Its exit 0 means the **defect was demonstrated**, not that the product passed.

## Positive execution evidence

Fresh `npm ci` installed the unchanged lock. Real Next imports, production build/start, migrated embedded Postgres, browser GL program/shader/buffer/texture construction, baked fox atlas creation, draws/readPixels, native pointer/touch input and WEBGL_lose_context restoration all ran. There is no separate inference processor, remote model, GPU queue or downloaded field asset.

The task branch began at freshly fetched main `463f3c8` and later fast-forwarded to fresh main `ce7f635`, preserving the sibling Shelf delivery and Senko test repair. The task executable fingerprint did not change. Both required contract commands were rerun after that fast-forward.

| Check | Result |
| --- | --- |
| Required Susuki + Bottle command, fresh production build | **21/21 pass**, zero failed/skipped; initial and final runs |
| `TMPDIR=/tmp npm test` | Initial **2,785/2,785**; final **2,792/2,792**, zero failed/skipped; seven new upstream Shelf tests explain the increase |
| `npm run typecheck` | pass |
| `npm run lint` | pass, 13 existing warnings, zero errors |
| `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | pass, local_controls=pass, failures=[]; its external_evidence remains inconclusive |
| Local `SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh` | **67 ok, 0 failed** |
| Local `CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh` | **177 ok, 0 failed** |
| Production `BASE_URL=https://otohime.dev` Susuki suite | **7/7 pass**, zero failed/skipped |
| Production footer walk / browser probe | **65 / 174 ok**, zero failed; remote mode omits local-server lifecycle assertions |
| Existing Kame / Kame Fetch / Peep-box suites | **30/33 pass, 3 fail**; retained defect, not retried away |

The Susuki suites verify real ink pixels, cursor/scroll uniforms, on-demand fox and input cancellation, four seasons/themes, single-frame zero-rAF fallbacks, context loss/restoration, offscreen/hidden lifecycle, accessible decorative exclusion, five SVGs, last waterline, clickable controls and **0 px** footer/Bottle geometry shift.

[Independent framebuffer probe](qa-probe-run-9749.mjs) and [evidence](qa-evidence-run-9749.json) hold wind time constant while leaving real GL rendering and native mouse input active. At deployed ce7f635, `/` contains **165,270** ink pixels and cursor input changes **269,762** bytes; `/projects` contains **165,276** pixels and changes **239,426** bytes. All four actual shader tints differ; real footer clicks navigate to `/work`. Negative control: clearing the actual framebuffer returns exactly zero nonzero bytes. Both normal-capability routes have zero page errors.

Real/fake boundary: rendering, imports, shaders, texture creation, context loss, database execution and pointer/navigation are real. Controlled fixtures include reduced-motion media emulation, Save-Data/no-WebGL objects, visibility events, preserved drawing buffers and frozen wind time. The existing harness's Ghosts fake and Bottle network fixtures do not prove those external services. Normal browser success does not waive the plain-object fixture crash.

## Build, author and run identities

Runtime: Node **22.23.3**, npm **10.9.9**, Next **16.4.2**, React **19.3.0**, Playwright Core **1.64.0**, embedded-postgres **17.10.0-beta.17**, Chrome **156.0.8078.73**. Initial local build ID `BGe6y8DlEEVsYJLf7KXcT`; final `q1w_VsKLpzw3TqhRv7ZA2`. Local health uses `dev`; local identity is bound by Git/source/lock/build fingerprints, not claimed as a deployed SHA.

The ordered 11-file code/lock/config/test fingerprint defined in task-2-evidence.md is **d469a1021086e1fe1d017447f2188fb56374d7767cfaf54e4429d321ab7a5737**, identical at delivery ec7e171 and QA ce7f635. It covers both field components, EndFooter, Susuki/ink/seasons models, globals.css, probe, Susuki E2E, lock and Next config. Lock SHA-256: **9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b**. Actual local field chunk `12qgltjgzy1gg.js` and independently fetched production field chunk `3onrwr-vuz1mb.js` both hash to **5ca02dfa389bb4c1055229019d254b2dc447eff5ad2dd7e5735319091ec1ff16**. Shaders and fox atlas are embedded in this artifact; there are no external model hashes to omit.

Git identifies delivery ec7e171 as **Otohime <quiinthieu@gmail.com>**, with no Co-Authored-By trailer. Native delivery task **e3050401-3675-4cbe-a2de-88c807a38c56** advertises `author.txt`, **44 bytes**, SHA-256 **7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada**. Read the actual collector source from the local mono-v2 mirror at `f1c5b0f22df35ea818a9a8d4f095f6d1d117bc04`, `servers/task-manager/scripts/run-agent.sh:533`. Its canonical expected bytes, `Otohime quiinthieu@gmail.com\ntrailers: none\n`, are exactly 44 bytes and hash to that manifest digest. **Advertised author content matches** the required identity/no-trailer value cryptographically. REST download returned 403 insufficient privileges; downloaded artifact bytes are not claimed read. [Platform evidence](qa-platform-run-9749.json) preserves this distinction.

Recorded QA and delivery run-9726 profile: **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, account **codex-main**, fleet worker **avietidol-mac-mini**. Verification run-9739 uses shell, not an LLM. These are actual run records, not current role defaults. Installed Next server/client and lazy-loading guides were read. No graph tool is available; relevant source was inspected directly. The requested chief-of-staff and software-development standing-rule files are absent from this checkout.

## Native CI, bounded history and ingestion

Read actual failed [delivery CI 40817421327](https://github.com/quiinthieu/otohime/actions/runs/40817421327/job/123261664083), checks **123261664083**, ec7e171: E2E exits **124** and annotations name all three failing selectors above. [Successor CI 40817663407](https://github.com/quiinthieu/otohime/actions/runs/40817663407/job/123262439242), checks **123262439242**, 1e38239, also exits **124** and reproduces the Peep-box timeout. Their Node is **22.23.4**, Chrome **156.0.8078.47**. Read the public bounded command/server tails and individual assertion annotations, rather than only their statuses. Server tails are not copied into this report because they include ephemeral test reset links.

Compared with the last preceding green same-workflow [40816776255](https://github.com/quiinthieu/otohime/actions/runs/40816776255), SHA 903e6b1, checks **123259575831**, production **123267598842**. `git log 903e6b1..ec7e171 -- .github/workflows/ci.yml scripts/e2e.mjs` is empty. The current workflow has a 960s E2E command at `.github/workflows/ci.yml:175`, but reproducible assertion crashes establish **code**, not an environment-only timeout diagnosis. Later running workflows do not clear them. The main branch is therefore **not claimed globally green** by this QA report.

Task-manager scan: project `plan-manager`, type `coding_task`, FAILED and COMPLETED each at offsets **0, 20**, limit **20**. Read **40/142 FAILED**, **40/995 COMPLETED**, **0 PENDING**, **5/5 RUNNING** at that snapshot. The plan list returned **23 runs**, all **seven t-1766 rows**, including this run. The six finished task records and raw tails were read: three failed publications, two completed SWE records (one vacuous red-gate preflight), and the completed green verification. `run-9680` is a complete 29-line no-agent preflight, not feature proof. `run-9739` has 45 complete runner lines. The other four raw captures omit 2,942 / 3,062 / 2,993 / 3,222 earlier lines; exact counts and terminal evidence are in qa-platform-run-9749.json. **Full historical assertions remain inconclusive.**

Every finished relevant native task has callbackState=delivered with one attempt; persisted plan runs agree with native completion/failure and have callback_apply_failures=0. In particular, run-9742 persisted FAILED despite its successful feature-branch push: the raw runner ends `push_not_on_main` at bcd013a. This QA publishes its reviewed evidence to its task branch and main without force, resolving that prior run failure cause. Callback payload internals remain unread.

GitHub inspection covered the first **25 unfiltered** UI run IDs and **10 success-filter** IDs, then the two failed jobs and last green run above. API pagination is rate-limited (403); raw annotations expose only bounded tails. No claim of complete CI history is made.

## Delivery state and follow-through

**Integration published/deployed: yes. Execution demonstrated: yes. Waiting for capacity: no. Required product delivery accepted: no, while the reproducible Save-Data integration defect remains.** Normal live output is observed; neither a future pipeline nor a queued job substitutes for the failed compatibility requirement.

| Exact item | Owner | Required result / failure condition |
| --- | --- | --- |
| `pm-299/t-1766/SUSUKI-SAVEDATA-9749` | t-1766 software engineer, then quality engineer | Repair lines 290/300, add basic Save-Data mount/unmount coverage; fail if console error, missing footer, extra static frames or rAF ticks occur |
| `CI/40817421327` and `CI/40817663407` | repository CI / t-1766 software engineer | Push the repair to trigger CI; run all three implicated suites and full E2E; fail on any assertion or timeout; do not mask it by extending the timer alone |
| `t-1766/history-completeness` | QA / platform evidence owner | Omitted raw assertions, API pages and callback payloads remain unread; absence of further failures is inconclusive |
| `run-9749/final-callback` | plan-manager/task-manager | After agent exit, persist this failed QA and fix plan; failure is missing/failed ingestion or another publication guard rejection |

No operator action, runtime queue, dated watch or capacity deferral is needed. Only QA scripts, reports and sanitized evidence are changed. The generated content/history.json was restored using the contract's authorized command. The separate fix plan gives exact source changes and on-demand verification.
