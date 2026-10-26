# t-1606 QA, run-9070

Verdict: **fail, cause=code**. The desk contract is implemented and execution is demonstrated. Required deployed delivery of **52ec0904d93171262d262a21c0d61cf27d3ae8e2** is not established. Independent production HTTP and browser reads serve **4b8278a46fe27151dd115e31e0bba2a9b18ac0cf**; `git merge-base --is-ancestor 52ec090 4b8278a` exits 1. A passing local gate cannot replace that ancestry requirement.

The live SHA does contain the earlier swipe implementation 0b349dc, report delivery 3ae76a4 and plan prerequisite 9ddd084 (three independent ancestry checks exit 0). Earlier integration is deployed; acceptance of the explicitly requested resumed delivery 52ec090 remains blocked.

Evidence is in [qa_run-9070](t-1606/qa_run-9070/). No application source, application threshold, breakpoint, Kame/Ryugu test or CI workflow was changed by QA. Reports and independent diagnostic scripts are saved on `qa/pm-270-t-1606-run-9070`.

## Contract and execution

`git log -- e2e/desk.test.ts` identifies implementation 0b349dc and resumed delivery 52ec090. The helper scrolls the tape into view, compares geometry across two animation frames, hit-tests its centre, waits for data-dragging after the first movement beyond 6px and for removal after release, and includes the pure helper's default maximum 40-event trace in failed gesture assertions. The wide control retains its 120px expected drop; phone/narrow/tablet retain no-drag checks. The notebook's controlled clock is confined to its full-motion fixture; swipe clocks remain real. There is no quarantine or desk application repair.

Fresh local verification on checkout **5abaebc70f9f4efb627fe9a0e7db81717dc77533**, containing delivery 52ec090:

| Check | Result |
| --- | --- |
| npm ci | exit 0, committed lock |
| exact trace helper unit command | 5/5 pass |
| npm run lint and npm run typecheck | exit 0; 10 existing lint warnings |
| npm test | 2346/2346 pass |
| exact production E2E loop | 3/3 exit 0; each 169 pass, 0 fail, 1 existing skip out of 170 |
| separate complete footer probe | 168 pass, zero fail, EXPECT_SHA=dev for the local production build |
| lint including saved QA probes | exit 0 |

The first footer probe deliberately remains in the evidence: using remote-mode defaults against a local `dev` build rejected all 18 build identities (150 other checks passed). Explicitly setting EXPECT_SHA=dev corrected the QA invocation; it does not establish a production SHA. This invocation error is separate from the unresolved real CI footer failure.

Independent browser path: `independent-desk.mjs` does not call the delivered swipe(), browser fixture or gesture helper. Three fresh wide contexts each persist x=0.425 after a real 120px CDP touch drag over a 960px desk and retain it after reload. This passed against both the local production server and the live site; the latter reports the old deployed SHA above. A coarse-pointer tablet keeps x=0.3 and writes no desk layout, and a deliberately inverted expectation is rejected. This independent probe uses reduced motion and real clocks; the full suite supplies the full-motion controls.

A second negative control runs a temporary copy of the delivered desk test with tablet `drags: true`. It fails exactly at the observable dragging precondition and prints pointerdown and pointermove with the tape target and coordinates. The temporary copy was removed. Its exit 1 is expected evidence, not a failing delivered test. See `delivered-trace-negative.log`.

Preflight constructs real locked Playwright/Chrome, pg.Client and the Drizzle adapter, imports the trace helper, and executes SELECT 1 against the migrated throwaway Docker Postgres. Real production Next/React/CSS/assets, DOM, CDP touches, database and migrations are exercised. Deliberate doubles are the notebook browser clock, existing suite network fixtures, footer DOM mutations, and the isolated clock diagnostic. None proves a third-party service or deployed ancestry.

## Independent CI and production evidence

Public GitHub APIs, check-runs and job annotations were read directly, outside the engineer's proof summary:

| Run / SHA | Checks | Production | Evidence |
| --- | --- | --- | --- |
| [40372282006 / 4b8278a](https://github.com/quiinthieu/otohime/actions/runs/40372282006) | 121745878013 success | 121752200080 success | last green run of the same checks job; independently served production SHA |
| [40378894466 / 52ec090](https://github.com/quiinthieu/otohime/actions/runs/40378894466) | 121769441639 failure | 121774463039 skipped | E2E failure, e2e/kame.test.ts:100, “a flowing clock adds real time to runFor”; swim != pet |
| [40380026935 / 5abaebc](https://github.com/quiinthieu/otohime/actions/runs/40380026935) | 121773440006 failure | 121780019832 skipped | Footer Chromium probe exit 1; public annotation does not name the internal assertion |

`git log 4b8278a..52ec090 -- .github/workflows/ci.yml` and the equivalent range through 5abaebc are empty. The committed lock, CI configuration, Kame test and footer probe script hashes match across all three identities. Desk and footer regression tests differ at 52ec090; the footer component and Bottle implementation differ at 5abaebc. `source-fingerprints.json` records these comparisons. This is a source comparison, not a claim of identical CI build artifacts or Chrome versions: raw CI identity tails are unavailable.

The Kame assertion is an actual code defect in its fixture premise. `clock-control.mjs` independently isolates locked Playwright 1.64.0 in real Chrome: with 50 wall-ms followed by runFor(499), a 500ms timer remained unfired in 2/3 trials, and fired in 1/3 on the same environment. One more virtual ms reliably fires it; 150 wall-ms also passes. Installed clock source `_runWithDisabledRealTimeSync` pauses real-time synchronization around runFor; the short wall interval is not guaranteed to have been accumulated. This is a diagnostic with a fake browser clock, not proof of a Kame application defect. It explains why the immediate test assertion can fail without a runner outage. We conservatively retain cause=code rather than infer environment from an unrelated red check.

The latest footer failure is separately unresolved. The exact current source passes 168 local footer checks, so its CI root cause cannot be inferred from its generic exit annotation. It remains a delivery blocker; local success, unrelated pending work or future retries do not waive it.

## History, identities and limits

History uses two pages of 20 for each filter: 40/452 completed main CI runs (9 success, 17 failure, 14 cancelled), and 40/108 failed main runs. These sets overlap. queued, in_progress, pending, waiting and requested filters each return zero. This is bounded metadata coverage, not exhaustive history. Detailed jobs were read for the three runs above; public failure annotations were read for the two red jobs. Raw job-log requests for both red jobs and the last-green job return HTTP 403 “Must have admin rights to Repository”; a public step-log fallback returns 404. The remaining failed-history raw logs are unread and inconclusive. No assertion is made that the entire lane is clean.

The persisted board gate **ver-3605**, run-9066, is green for **52ec090** with all four contracted verification items passing. Independent board reads show verification run-9066 succeeded and the gate was ingested; delivery run-9065 succeeded. GitHub's persisted check-runs separately show the delivery's checks failed and production skipped. The empty legacy commit-status collection says pending, so it is not used as a pipeline verdict. No callback transport changes are part of this task; callback transport logs were not read.

`executable-fingerprint.json` covers 843 tracked source/configuration/lock/asset files, excluding generated history and report files, SHA-256 **2da70df9fbf0295758c5ebfab0c8a91bb72c175b3dfe5a92c91cf68c85ceecf0**. Relevant per-file identities, three local build IDs, artifact snapshots for builds 2 and 3, and generated-history digests accompany the logs. The first build was replaced before an artifact snapshot was captured; only its build ID and complete test log are retained. Build 2 was captured during execution and includes runtime cache files. The final build 3 snapshot was captured after server cleanup: 3108 files, build ID `hNeshaJFtchlA2UL2O5sE`, artifact SHA-256 `2fd7a5c8bfb0187f0b6cf6d815a9096c049ce7a31637942b8855a4c06510578f`. CI artifact hashes and browser versions are unobserved because raw logs are restricted; source-equivalent historical runs are not claimed to be binary-equivalent. No external model artifacts are used by the swipe executable.

Local runtime: macOS arm64; Node 22.23.3 installed outside the checkout to satisfy Node 22 and the contracted flags (host default was 22.12.0); npm ci lock; Next 16.4.2; playwright-core 1.64.0; Chrome 155.0.8059.86; Docker 29.6.2; postgres:17-alpine digest `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`.

Recorded QA profile: **codex-sol-6-1-high**, **gpt-6.1-sol**, **high**, run-9070 attempt 2, fleet billie-mac, task-manager a70403e1-d4fc-4944-8233-2ee4127908b3. Delivery run-9065 records the same profile on avietidol-mac-mini; verification run-9066 is the verify role on avietidol-z490 and has no agent profile exposed. Historical Claude runs are not attributed to this profile. See `run-profile.json` and `ingestion-state.json`.

The requested chief-of-staff extraction document and docs/claude/software-development.md are absent from this checkout (including tracked-name search). AGENTS.md, plan.md, and installed Next CLI and Playwright guides were read. No rule was invented for the missing documents.

## Delivery and deferred checks

Integration on main: yes. Local execution demonstrated: yes. Integration deployed containing 52ec090: **no**. Product delivered under this contract: **no**. Waiting for capacity: **no**; the observed runs are terminal, with no queued or active run in the bounded current snapshot.

1. **Kame fixture repair**, owner pm-258/t-1564 engineer with pm-270 coordination; exact failed run/job 40378894466/121769441639, e2e/kame.test.ts:98-100. Failure condition: short wall-time delay is treated as guaranteed virtual elapsed time and `swim != pet` blocks E2E. Repair observable clock synchronization, retain 499/500ms boundary checks, and invoke CI on demand after the repair.
2. **Footer CI diagnosis**, owner pm-269/t-1588 engineer and pm-270 integration; exact failed run/job 40380026935/121773440006. Failure condition: current Footer Chromium probe exits nonzero. Read its restricted raw tail/summary using the existing authorized CI account and identify the assertion before changing code. Local 168/168 is insufficient to dismiss the red job.
3. **Deployed acceptance**, owner pm-270 acceptance, source delivery 52ec090 and skipped production jobs 121774463039/121780019832. Failure condition: no green checks+production successor, live build-sha omits delivery, or deployed wide swipe/stacked negative control fails. A successor SHA must pass `git merge-base --is-ancestor 52ec090 <live-sha>` and be read independently through health and meta. No soak, future quota reset or passive polling is requested.

See [fix_plan_run-9070.md](fix_plan_run-9070.md). Decisions and the clock lesson are recorded on pm-270.

All three fresh complete production suites pass. Suite durations: 405.307s, 391.933s and 402.415s. The one existing skip is “evidence: every root hydrated under each colored run”. Both desk stacked/wide controls pass in all three suites. Full logs are retained, including terminal carriage returns; HTML-derived annotation text is whitespace-normalized. Only the generated content/history.json is restored after its measured hash is saved.
