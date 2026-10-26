# t-1564 closure evidence — run-9018

The original t-1564 repairs are on main and deployed. **The seven-command acceptance condition is still unmet:** the footer walk and footer matrix have failures outside the permitted repair footprint; the radio E2E assertion failed at an earlier checked snapshot and its owner has since repaired it. This report preserves those defects and their owners; it does not claim that a passing earlier checkout makes the current delivery green.

This run changes only this report and text/JSON evidence under [t-1564-run-9018](t-1564-run-9018/). The previous run's observations remain available in [the d30d3c4 version](https://github.com/quiinthieu/otohime/blob/d30d3c402c77bc6286c6b7c29c1b05287e1fbd46/projects/pick-up-this-plan-https-apps-vietky-io-vn-plans-plans-pm-242/t-1564-closure.md).

## Run and source identity

- Run `run-9018`, task-manager `dd420d80-a953-490a-820a-aafd837869b4`, fleet worker `avietidol-mac-mini`.
- Actual profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, from this run's persisted flags: `--dangerously-bypass-approvals-and-sandbox --model gpt-6.1-sol -c 'model_reasoning_effort="high"'`.
- Initial checked main: `175a10b5ece64e3dff9a4688a479588b5f7bc771`. Integrated concurrent main `17bca22d109414873c566d676f63696907c2f2d4`, including its fixture/reporter repair, and reran all seven commands. Before committing, integrated `19f42646e2231cd909df6a2e73a513e11757e4ed`, including `74522bc`'s radio-test and CI-concurrency changes, and refreshed all seven again.
- Locked environment: `npm ci`, Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`, Playwright Core `1.64.0`, embedded Postgres `17.10.0-beta.17`. The browser matrix uses its wrapper's pinned Playwright `1.64.0` and Chromium `156.0.8078.4`; application E2E uses real Google Chrome `156.0.8078.48`.
- Verification ran in a space-free shared clone, `/tmp/otohime-9018`, rather than changing source to accommodate the lease path. [fingerprint.json](t-1564-run-9018/fingerprint.json) records the source SHA, lock/config/source SHA-256 hashes, Next BUILD_ID, and aggregate hashes of 122 static build assets. Local build-sha is honestly `dev` (the normal local default); it is not claimed to be a deployed build.
- The requested extraction and software-development policy files are absent from this checkout. Copies were found and read in `/Users/avietidol/gitlab-runner/builds/Zpm7A-f3s/0/kq.viet/mono-v2/`; the extraction was read in full. The installed Next env guide was read. The explicit current task contract controls source ownership and stopping at the push.

## Landed repairs and regression results

| Repair | Actual delivery | Current implementation and regression |
| --- | --- | --- |
| Serial E2E files | `15fd171` | `scripts/e2e.mjs:35` adds `--test-concurrency=1`. `lib/e2e-runner.test.ts:58` passes: real fixture spans do not overlap by default, while explicit concurrency 2 makes them overlap. In an isolated copy of the actual runner and test, removing the serial flag makes that regression fail (exit 1); restoring it passes (exit 0). [Mutation result](t-1564-run-9018/serial-mutation-control.json). Serialization was not introduced by 841ca69. |
| Public failed-test annotation and summary | `841ca69` | `scripts/e2e-annotate.mjs` emits escaped file/line/assertion `::error` commands and `## E2E failures` in `GITHUB_STEP_SUMMARY`. `lib/e2e-runner.test.ts:71` passes with real failing node:test fixtures, TAP and exit 1 preserved. Outside Actions, the same failure emits no annotation and creates no summary: the negative control passes. `17bca22` exposes shared formatting helpers for the unit annotator without changing the E2E default. |
| CI server log and identity | `841ca69` | `.github/workflows/ci.yml` retains next-start.log, suite status, commit, BUILD_ID, Node, Chrome and CPU identity plus bounded server tail; exits with suite status. `lib/e2e-runner.test.ts:119` passes. This is a source-wiring assertion, not execution of a GitHub job here. |
| Kame flowing-clock control | `841ca69`, alongside `9ddd084`'s pause | `e2e/kame.test.ts:90-104` keeps the paused 499/500ms boundary and the resumed-clock +50 real ms control. Both pass in the full real-browser E2E run. No Kame source or E2E change was made here. |
| Quiet-scroll rAF measurement and isolated footer DB | `15fd171` | `scripts/probe-end.mjs` waits for scroll quiet before measuring eyes frames. The rAF overlap negative control passes. `lib/end.test.ts` pins the wait; `lib/e2e-runner.test.ts:129` actually starts a migrated embedded DB, queries it, and proves SIGTERM cleanup. |
| Waterline scene count and final Tab stop | `3351f78` (pm-249/t-1568) | The waterline repair is concurrent with, not authored by, 15fd171. `scripts/probe-end.mjs` counts three scene SVGs separately from one waterline SVG and ends its Tab sequence at the Ryugu link. The Tab walk passes; failing route records still explicitly show scene=3, wave=1. `lib/urashima.test.ts:107` pins the final waterline component placement. `lib/end.ts` is pure console state and contains no SVG counter. The independent browser control removes/restores the waterline and excludes/restores its link from tab order, detecting both corruptions. |

All of `841ca69`, `15fd171`, `9ddd084` and `3351f78` are ancestors of checked main (exit 0). The footprint's unit and Kame regressions pass. The *entire* footer probes remain red for the separate heading integration described below; individual passing controls do not erase those failures.

## Deployment ancestry

Captured at `2026-10-26T14:54:47.977206Z`:

- GET [health](https://otohime.dev/api/health), HTTP 200: `074059495faf4bee48e8f655584dfd4487089b41`.
- GET `/`, HTTP 200: rendered `<meta name="build-sha">` has the identical SHA.
- `git merge-base --is-ancestor 841ca69 074059495faf4bee48e8f655584dfd4487089b41`: **exit 0**.
- `git merge-base --is-ancestor 15fd171 074059495faf4bee48e8f655584dfd4487089b41`: **exit 0**.
- Additional waterline ancestry, `3351f78` to the live SHA: exit 0.

[deployment-ancestry.json](t-1564-run-9018/deployment-ancestry.json) preserves the results. This establishes deployment of the original repairs, not of this evidence-only commit or the later heading/fixture changes. No production walkthrough, deployment mutation, CI watch or green-main soak was performed.

## Failed main history and actual public annotations

Capture window: 14:54–14:59Z, before `17bca22` landed. The anonymous API initially worked, then returned quota 403. Fallback public run HTML was read for **all 12/12 failed runs since 40310239199 (841ca69)**. The failure filter's **5/5 pages** list **101/101 distinct failed runs** across repository history; the interval is complete at capture. The independent API sample is 100/440 overall summaries, including the complete 49-run interval: **12 failures, 32 cancellations, 5 successes**. No current queued/in-progress run was present in that sample. Cancelled replacements are not counted as defects.

Annotations were read for **12/12** failed runs, with the actual assertion/message readable for **3/12** and generic exit-only evidence for **9/12**. There is **one failed E2E job in this interval, and its assertion was read (1/1)**. Generic exit messages are explicitly inconclusive. The eight later unit failures never reached E2E; they are not evidence of eight more desk/Kame failures.

| Run | Failed job | Head SHA | Failed step and actual annotation | Owner |
| --- | --- | --- | --- | --- |
| 40310239199 | checks 121530268639 | `841ca69` | E2E: `e2e/desk.test.ts#L576`, `AssertionError: the swipe dragged music: 0.3 is not 0.425`; stack at test line 597, helper line 181 | pm-270/t-1606 |
| 40315924641 | checks 121549479127 | `2992401` | Footer Chromium probe: `Process completed with exit code 1.` No readable assertion. | pm-270/t-1604 |
| 40328273755 | production 121600218178 | `5577ec5` | `vercel deploy: Error (inspect exited 1) https://otohime-rcix516b1-otohime.vercel.app` | pm-270/t-1605; successor delivery work pm-275/t-1617 |
| 40330477897 | production 121613136055 | `0740594` | `vercel deploy: Error (inspect exited 1) https://otohime-8vfgwc6u4-otohime.vercel.app` | pm-270/t-1605; successor pm-275/t-1617 |
| 40334420077 | checks 121613911206 | `9d65d9c` | Run npm test: exit 1 only | pm-275/t-1617; concurrent fixture fix `17bca22`, pm-259/t-1583 |
| 40335459968 | checks 121615705387 | `c0368d1` | Run npm test: exit 1 only | same |
| 40337993898 | checks 121624630579 | `9ada4e1` | Run npm test: exit 1 only | same |
| 40338754295 | checks 121627307850 | `3c3772b` | Run npm test: exit 1 only | same |
| 40339124232 | checks 121628642183 | `c1b26f1` | Run npm test: exit 1 only | same |
| 40340021768 | checks 121631950491 | `c121b20` | Run npm test: exit 1 only | same |
| 40340641001 | checks 121634081296 | `ae6573a` | Run npm test: exit 1 only | same |
| 40343322274 | checks 121643535744 | `5ad4906` | Run npm test: exit 1 only | same |

[ci-history.json](t-1564-run-9018/ci-history.json) stores full head SHAs, job/run links, exact annotation text, page counts and owner conditions. The raw job-log request for 121643535744 returned 403. Public job step tables were read where API quota prevented job lookup. No raw CI assertion is inferred from a generic exit code. [history-fingerprints.json](t-1564-run-9018/history-fingerprints.json) compares blob identities for the repair footprint, CI fixture branch, headings and desk, instead of treating unrelated new SHAs as fixes. Two historical Vercel error annotations beside a live alias do not establish the deployment's actual ERROR/CANCELED/READY state.

## Verification and independently observed defects

All seven commands were run on `175a10b`, `17bca22`, and final validation baseline `19f4264`. No implementation task was added by pm-277; ownership is retained rather than duplicated. The command/exit/source records and retained outputs are under [t-1564-run-9018](t-1564-run-9018/). Full final results are recorded in [verification.json](t-1564-run-9018/verification.json); the first snapshot's results are preserved separately and do not stand in for final validation.

| Command | Final result at `19f4264` |
| --- | --- |
| `npm test` | exit 0: 2,320 passed, 0 failed/skipped |
| `npm run lint` | exit 0; 0 errors, 10 existing warnings |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `SKIP_BUILD=1 bash scripts/walk-end.sh` | exit 1: 60 ok, 7 failed |
| `SKIP_BUILD=1 bash scripts/probe-end.sh` | exit 1: 159 ok, 12 failed |
| `SKIP_BUILD=1 npm run test:e2e` | exit 0: 139 tests, 138 pass, 0 fail, 1 pre-existing EVIDENCE-gated print-runs skip |

**Heading integration, owner pm-268/t-1601 (`c121b20`).** The seven footer route assertions and no-JS assertion read `#end-title.textContent` as `You've reached the end of the internet.You've reached the end of the internet.` instead of one sentence. Four desktop text-bounds assertions also fail (`textUnclipped=false`) because the newly added semantic `.riso-source` is intentionally clipped. The earlier local E2E failure on both 175a10b and 17bca22 in `e2e/ink-radio.test.ts:39` expected `Ink Radio` immediately inside `<h2>`; RisoText now inserts spans there. `74522bc` (pm-264/t-1590) subsequently bounded the regex to that heading while allowing its source spans; the final full suite passes 138/138 executed tests on the containing main snapshot (0 failures, 1 pre-existing opt-in skip). The radio mismatch is locally repaired; the footer failures remain. These are real, reproduced integration failures, not quota/capacity deferrals. The supplied gate's other E2E failures cannot be identified from its ending tail; they remain inconclusive rather than presumed repaired. This task's contract prohibits editing the affected heading/probe/test sources, so no revert, relaxed assertion or speculative repair was made.

**CI fixture branch, currently repaired by `17bca22`.** Before integration, on `175a10b`, a fake `google-chrome` first on PATH plus `CI=true` reproduced `lib/end.test.ts:334` in 1/1 attempt: `probe-end.sh BASE_URL (unset TMPDIR) should stop at stubbed npm`, **130 !== 1**. Its real Chrome branch bypasses stub npm and hits the fixture's 10-second bound. `17bca22` explicitly clears CI for installer cases and adds a separate fake-node/Chrome runner-branch control. The same local branch reproduction is rerun after integration, and passes 11/11 (exit 0), with its result retained in `ci-branch-after.log`. This explains a deterministic local defect but is not a substitute for unread historical CI assertions. The provisional earlier npm-red attribution to pm-271/t-1562 is superseded by pm-275/t-1617 ownership and the named concurrent repair.

After the first push was rejected, rebased onto `cd54d4b` (one concurrent `projects/**` report only). `git diff 19f4264 HEAD -- ":!projects/**"` lists **zero files**: executable, lock, configuration and test sources match the full seven-check snapshot. Reran `npm test` (2,320/2,320) and lint (exit 0), as required. [rebase-verification.json](t-1564-run-9018/rebase-verification.json) records the delta and exits. The footer failures remain explicitly unresolved.

## Deferred checks and failure conditions

| Deferred check | Run/job ids | Owner and failure condition |
| --- | --- | --- |
| Desk swipe | 40310239199 / 121530268639 | pm-270/t-1606: fails if `e2e/desk.test.ts:597` is red on sources including its `0b349dc` repair. A passing local run is not proof that an intermittent defect is gone. |
| Footer probe, motion installers, checks budget | 40315924641 / 121549479127 | pm-270/t-1604: fails if a probe fails or checks exceed their budget on repaired sources; historical assertion remains unread. |
| Vercel production | 40328273755 / 121600218178; 40330477897 / 121613136055 | pm-270/t-1605; successor pm-275/t-1617: fails if deploy fails or served SHA lacks the intended delivered code. Inspect annotation alone is not deployment state. |
| Historical npm-test reds | All eight unit run/job pairs in the annotation table | pm-275/t-1617, with `17bca22` from pm-259/t-1583: fails if unit step remains red on sources including that fix; any new annotated assertion must be assigned by its actual source. Historical assertions remain unread. |
| New footer heading / radio integration | Local 175a10b and 17bca22; supplied gate ver-3586, run-9009, task-manager 1527adf0-8941-4d2e-955d-5743acd0b45d (no GitHub job) | pm-268/t-1601 owns heading integration; pm-270/t-1604 owns footer harness paths; pm-275/t-1617 is the canonical delivery/matrix recovery owner per pm-277/run-9022 consolidation. Fails while the 7 walk checks, 12 matrix checks or ink-radio heading assertion remain red against sources containing the owner repair. No capacity waiver. The radio assertion's owner repair is `74522bc`; the two footer gates still require repair. |
| Supplied gate's remaining E2E assertions | ver-3586 / run-9009 / task-manager 1527adf0-8941-4d2e-955d-5743acd0b45d; 10 failures in its tail, actual assertions omitted | t-1564 evidence owner: compare readable full verifier output before claiming those other failures repaired. Locally reproduced assertions are reported separately. |
| Ryugu `Page already revealed` | No matching annotation in this captured interval | pm-256/t-1559: fails on any matching E2E page error. |
| React #418 on /projects | No matching annotation in this captured interval | pm-259/t-1573: fails on any matching E2E hydration error. |
| Historical footer | 40277523350 / 121423322274, `2a58479` | t-1564 evidence owner / pm-270/t-1604 footer owner: **inconclusive**, no readable assertion. The public job page was reread; generic exit evidence does not close it. |
| author.txt bytes | historical task 03c16ea7 / delivery task 8d0933c1 | t-1564 evidence owner: **inconclusive**, bytes not obtained. Manifest: 44 bytes, SHA-256 `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`. Git identity is checked separately and does not prove artifact bytes. |

## Platform history, callbacks and real/fake boundary

[platform-history.json](t-1564-run-9018/platform-history.json) records two 25-item FAILED pages (**50/1124**) and two COMPLETED pages (**50/6289**), plus **6/6 RUNNING** jobs. PENDING returned `{}` with no total; that is not asserted to be a complete queue read. Historical sampling is bounded and incomplete. The failed run-8808 runner tail was read: command exited 0, then platform `push_not_on_main` failed the task and saved its rescue branch. This is distinct from an application assertion.

Task-manager marks both delivery run-8997 (`bb080f7f-dfa9-445f-8ec9-288657cc07d3`) and verifier run-9009 (`1527adf0-8941-4d2e-955d-5743acd0b45d`) callbacks **delivered, one attempt**. Board get_task independently persists **ver-3586**, SHA `d30d3c4`, run-9009, fail, with the exact four passing/three failing commands. Delivery report rep-5272 persists. This follows the callback into stored verification; a 200-event global sample did not include the older callback event, so no event id is fabricated. This run's own future callback cannot be observed before exit.

- **Real:** npm's locked imports, production build/start, migrated embedded Postgres, pg client query, Google Chrome/Chromium, HTTP/page DOM, and public GitHub annotations. The extra local browser preflight passes 1/1, constructs the real embedded adapter and pg client and exercises waterline/tab-order corruption controls ([result](t-1564-run-9018/independent-footer.json)); no fake adapter establishes executability.
- **Fake:** only the existing unit fixtures, the explicitly labelled Chrome/node/npm branch stubs, and temporary browser DOM corruptions. These do not prove GitHub execution or deployed feature behavior.
- **Integration deployed:** original repair SHAs, by the recorded live ancestry.
- **Execution demonstrated:** the passing footprint controls and the final passing full E2E suite and the exact two failing footer gates. **Waiting for capacity:** none. **Product/acceptance delivered:** seven-green closure remains unproven while the named integration failures persist.
- No secrets or binaries are included. Synthetic reset-password tokens in retained logs are redacted; ANSI formatting and trailing whitespace are removed. The commit uses `Otohime <quiinthieu@gmail.com>` for author and committer, without a co-author trailer.
