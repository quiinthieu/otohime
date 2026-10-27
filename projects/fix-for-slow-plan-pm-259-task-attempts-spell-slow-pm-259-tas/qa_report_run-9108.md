# t-1606 QA — run-9108

Verdict: **fail, cause=code**. The desk contract and the two delivered fixture repairs pass fresh local checks and independent controls. Acceptance of delivery **c6d09f0067cb3f3ea77a75b723edc72918013c24** is withheld: its main CI **40423130342**, checks **121922175659**, failed Footer Chromium probe; production **121928589865** was skipped. Independent health, page meta and browser reads serve **baec1f88e602e9ad50ebecb9827a476f939495af**. `git merge-base --is-ancestor c6d09f0 baec1f8` exits **1**. This is an unresolved verifier/delivery failure, not evidence that the repaired child or ledger test is wrong. The prescribed conservative classification is code because the CI assertion is unread and no environmental cause is established; this is not a board-only authority precondition.

Evidence: [t-1606/qa_run-9108/](t-1606/qa_run-9108/). All new files are QA diagnostics/reports under projects. No application source, test source, lock, workflow, threshold, breakpoint or quarantine was changed by QA. Temporary mutations are made outside the checkout and removed. Generated history is hashed and restored before committing.

## Fresh verification

Tested checkout: **51f57816b949aeac95677fad249938bb826ee53e**, containing c6d09f0. `git diff c6d09f0 HEAD -- ':!projects' ':!content/history.json'` is empty. Relevant source/lock/configuration/assets fingerprint: **9671b952549b1c6bc2cd4e54775a8855ecb375c14b6f0e7619ba3402732c4c68**, 1,017 tracked files excluding projects and generated history. This is source identity, not CI binary identity. Per-file hashes are in source-fingerprint.json; each full production invocation has its own BUILD_ID, generated-history digest and artifact hash manifest in build-N.json.

| Command / observation | Result |
| --- | --- |
| npm ci | exit 0, committed lock |
| Contract trace helper command | 5/5 pass |
| npm run lint; npm run typecheck | exit 0, 10 existing lint warnings |
| npm test | 2,374/2,374 pass |
| Exact three-repeat production E2E loop | 3/3 exit 0; each 179 pass / 0 fail / 1 existing skip (180 total) |
| Real child fixture, original cap | exit 0 |
| Real child fixture, cap mutated to 2M | expected exit 1 at the exact over-bound assertion |
| Independent local ledger path | scrollWidth 756/clientWidth 348; actual scrollLeft 200; missing-minimum negative control 348/348 and scrollLeft 0 |
| Independent local and live desk paths | three wide 120px drags persist after reload; tablet, narrow and off-tape controls commit no layout and reject the positive drag expectation |
| Delivered desk/clock negative mutations | both expected exit 1 with the precise dragging/clock assertion; actual pointerdown/pointermove trace present |
| Supplemental local Footer equivalent | 171 pass / 0 fail; complete same-artifact local probe, EXPECT_SHA=dev |

The E2E command is the contract's fail-on-first-error loop, with a fresh production build and migrated disposable Docker Postgres for each invocation. Full logs, not just final tails, are retained. The existing unrelated skip is “evidence: every root hydrated under each colored run”. Incomplete invocations are never counted as passes. Final counts and durations are in verification.json.

The board independently returns green gate **ver-3618**, verification run **run-9106**, status pass for **c6d09f0**, with all four contract items passing. That gate is persisted evidence but does not replace QA's fresh execution or a deployed containing commit.

## What the changed fixtures prove

Hunk review of c6d09f0 confirms that lib/gate-closure.test.ts now waits for stdout.write's callback before child exit, retains all 200,000 under-cap characters, and requires exactly the final 1,000,000 characters of a 1.2M payload, without its head. The actual realRunChild implementation is unchanged. child-control.py copies the actual test and actual runner into a disposable directory. A deliberate KEEP_CHARS=2M change fails specifically at “output over the bound is cut to the bound”, 1200000 versus 1000000; restoring the original runner passes, including missing-binary and timeout/process-group assertions. These are real Node subprocesses, not a fake child port. The previously observed output-loss premise has been repaired, rather than waived by a passing retry.

The ledger test waits for visible, nonzero scroller/sheet measurements and equal geometry in consecutive animation frames, with a 10-second observed-time bound and a maximum 40 retained samples. It records viewport, widths, minimum, font and ready state in its unchanged no-page-overflow and internal-scroll assertions. It does not wait for expected overflow as readiness. The new real-browser controls show delayed visibility after hydration and reject a missing 46rem sheet minimum. QA's separate independent-ledger.mjs uses actual scroll movement as an additional observation; it neither calls settledLayout nor assertPhoneLayout. Removing the minimum prevents actual scrolling and rejects the overflow expectation. No CSS or application change is used to make this pass. The old source's opaque intermittent ledger failure is distinguished from this changed fixture, not retained as an unchanged defect.

Review of git log and current desk source confirms tape scrolling, two-frame stable bounds and hit testing, observable data-dragging after movement beyond 6px and removal on release. The pure trace defaults to at most 40 pointer records, and wide/narrow/tablet failures carry it. The page recorder is separately bounded at 400. The original 120px drop and stacked no-drag assertions remain. ink-desk.tsx is unchanged; there is no evidence requiring an application gesture repair.

The clock mutation exercises an isolated browser timer fixture, not Kame application behavior; the actual Kame path passes in all three complete production suites. The desk mutation changes only the tablet expectation and fails with actual pointerdown/pointermove tape-target trace lines.

The fresh independent-desk.mjs calls neither the delivered helper nor its recorder/formatter. Local and live runs each use three new wide contexts; music moves 30% to 42.5% on the 960px desk and persists after reload. Tablet, narrow and deliberately missed-tape contexts stay at 30%, store nothing and reject an inverted positive expectation. The live observations all identify baec1f8. The first live navigation failed before gestures with net::ERR_NETWORK_CHANGED; its log is retained separately from the passing retry. It is not counted as a successful gesture.

## CI, live APIs and limits

| Run / build source | Checks | Production |
| --- | --- | --- |
| [40423130342 / c6d09f0](https://github.com/quiinthieu/otohime/actions/runs/40423130342) | 121922175659 failure; E2E succeeds in 510s, motion succeeds in 173s, Footer fails in 74s | 121928589865 skipped |
| [40420670837 / baec1f8](https://github.com/quiinthieu/otohime/actions/runs/40420670837) | 121914004901 success; E2E 501s, motion 171s, Footer 71s | 121920454023 success; deploy/sha 39s, final live terminal/press 85s |

Required comparison precedes attribution: both checks jobs use GitHub-hosted ubuntu-24.04, runners GitHub Actions 1000000876 and 1000000874. `git log baec1f8..c6d09f0 -- .github/workflows/ci.yml scripts/probe-end.sh scripts/probe-end.mjs scripts/probe-browser.mjs scripts/vercel-deploy.sh` is empty. Lock, workflow and probe hashes match. Only ledger and child tests differ outside projects. No runner image/browser artifact hashes are available from the private log; source equality cannot establish binary equality or an outage.

The failing job's public annotation says only “Process completed with exit code 1”; its check output has null summary/text. Raw logs return **403, Must have admin rights to Repository**. The public job page confirms the failed step; the attempted step-log URL returns 404. No root assertion is inferred from those unread logs. The workflow does retain a job summary, but it is not exposed in these public reads. Eight exact-job log requests across delivery and last green returned 403, including skipped jobs; three additional sampled historical failed-job requests also returned 403. This is a documented access boundary, not a successful raw-log inspection.

Independent live Footer execution completes **167 pass / 1 fail**: its aggregate zero-console-error check sees **net::ERR_NETWORK_CHANGED on /icon.svg**. This lease also had the initial failed desk navigation. That is a specific observed browser/network error, not proof of the CI failure's cause. The live Footer run and any later local pass remain separate observations; neither erases the unread CI red. No error filter, quarantine or fixed delay is added.

Independent HTTP receipts identify served baec1f8 in /api/health and /desk meta. Ancestry excludes c6d09f0 but includes original swipe **0b349dc012c0591ded5f82d28d0cf3395b71567c** and prerequisite **9ddd084**. All **26/26** JS/CSS assets discovered in that page were fetched and hashed, limit 40; completeness applies only to the discovered set. A fresh final read at live-final.json still serves baec1f8 and again fails delivery ancestry (exit 1). No unobserved CI build/artifact identity is invented.

POST workflow_dispatch for main was attempted and returned **401 Requires authentication**, no job created. No GitHub API token or GitHub tool is available in this lease. QA does not generate a dummy code push, manually deploy production, wait for quota, or poll a nonexistent job. Existing platform CI integration owns recovery. Own builds/tests are active work, not capacity waiting.

## Bounded history, ingestion and attribution

GitHub snapshot at history-observed-at.txt: completed pages 1–2 at 20/page read **40/464** (12 success, 23 failure, 5 cancelled); failed pages 1–2 at 10/page read **20/114**. The union is **40 unique runs**, correlated into **22** relevant source/lock/configuration fingerprints. All five queued/in_progress/waiting/pending/requested filters explicitly total **0**. Traversal is incomplete. Metadata does not prove that all failed assertions were read or repaired.

Three further failed jobs were read independently: **40409123749/121874634016** fails Footer with only exit 1; **40405893755/121871360439** fails deployment health for 9d3f746 while serving 98ff28c; **40395335524/121826753100** fails the Bottle scene-area assertion at e2e/bottle-ui.test.ts:104. Their sources and histories are kept distinct from the new child/ledger repair; the Bottle correction already landed upstream and is not reapplied. Historical raw assertions beyond the public annotations remain inconclusive.

Task-manager project-wide coding_task pages at offsets 0/5, limit 5, read **10/71 FAILED** and **10/1266 COMPLETED**. This includes other plans/repos; it is not complete t-1606 history. RUNNING returns current **fc2ac555-25a5-4fcc-ad30-d6b189dff186** and **b6ec5208-4c82-48f8-a6ea-75ba8d8a09b0**. PENDING returns an empty payload without a numeric total. The prior failed task a70403e1-d4fc-4944-8233-2ee4127908b3 returned 446 raw tail lines; the final 80 are retained and its final runner failure inspected: it proves push_not_on_main for its feature-branch evidence. Earlier truncated history is inconclusive.

SWE task **6002a5a7-1af8-4933-a036-7987c8e7f8f8** and verification task **7c5e37a0-d0d0-4281-a8ad-a7c8c8c356c8** are persisted COMPLETED, callbackState=delivered, callbackAttempts=1. Board run-9103 and run-9106 are succeeded, callback_apply_failures=0. The green gate is ingested. This run's callback can only settle after exit and remains unproven.

Recorded agent identities: SWE run-9103 attempt 4 is **claude-opus-high / claude-opus-5-5 / high**, fleet avietidol-z490. This QA run-9108 attempt 5 is **codex-sol-6-1-high / gpt-6.1-sol / high**, fleet avietidol-z490. Verify run-9106 is a shell gate on avietidol-mac-mini, not an LLM profile. Git author metadata is separate; evidence is committed with the README-required Otohime identity. Requested standing documents were found and read in /data/build-worker/repo/mono-v2; installed Next CLI/Playwright guides and this checkout's AGENTS.md/plan.md were also read.

## Real/fake boundary and delivery state

Real: Linux x64, Node 22.23.3, npm ci lock, Next 16.4.2 production build, Playwright Core 1.64.0, Chrome 154.0.8037.57, real CDP touches, actual browser DOM/storage/scrolling, migrated Docker Postgres 17-alpine and real subprocesses. preflight.mjs imports the real locked schema, pg/Drizzle, trace helper, browser and Better Auth adapter, constructs a schema-aware adapter and initializes auth.$context with empty stderr. Its construction-only DB object makes no query; the production suites exercise the actual application/database wiring. runtime.json includes Chrome executable and Postgres image digests. No model is used by the desk; full-suite camera asset/model manifests and hashes are retained separately.

Doubles: browser viewport/touch/media emulation; the delivered notebook/browser clock; existing suite audio, network and camera-lifecycle fixtures; unit verdict-port fakes; deliberate temporary test/runner mutations and browser CSS perturbation. No fake runtime is offered as proof of real dependency construction, desk behavior or deployed delivery.

Integration on main: **yes**. Execution demonstrated: **yes, to the scopes above**. Integration deployed containing c6d09f0: **no**. Product delivered under the requested acceptance contract: **no**. Waiting for capacity: **none**. Passing live old-build gestures do not establish delivery of this requested commit.

Deferred/open checks, with owner and failure condition:

- **pm-270/t-1604 CI investigator, coordinating pm-269/t-1588:** delivery **40423130342/121922175659** and prior Footer **40409123749/121874634016**. Failure: Footer exits nonzero or its exact original assertion remains unread. Preserve the raw assertion before a source repair; emit public failure annotations at .github/workflows/ci.yml:179-199 so an inaccessible summary does not hide future diagnostics. The icon network error above is not assigned to CI without proof.
- **pm-270/t-1605 integration:** delivery c6d09f0, skipped production **121928589865**, dispatch attempt 401. Failure: no green containing checks/production successor, live health/meta omit c6d09f0, or final live path/ancestry fails. Recovery uses existing workflow_dispatch or a real owned repair push, not a report-only dummy commit or manual Vercel deploy.
- **pm-270 acceptance/t-1604:** plan-level signed-in motion remains **173s**, above its 120s criterion. A successful step does not satisfy that duration target; the task's desk evidence cannot waive it.
- **plan-manager:** final run-9108/task **fc2ac555-25a5-4fcc-ad30-d6b189dff186** ingestion. Failure: non-COMPLETED task, undelivered callback or nonzero callback apply failures after exit. No waiting/watch/queued job is claimed as proof.

See [fix_plan_run-9108.md](fix_plan_run-9108.md). Decisions and a lesson are recorded on pm-270.
