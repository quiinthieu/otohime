# pm-259/t-1583 — run-8869 delivery recovery

Retain the rescued `checks` timeout repair in `868a37d268434b42ebd9813ef5692f1f383dea00`: 20 → 35 minutes, with every motion/footer gate, permission, concurrency rule and production dependency preserved. The workflow was compared exactly with its parent after replacing only the approved timeout/comment. Original fetch delivery `9ddd0840d22564330e6c2554a52591b178909a4c` is an ancestor. No application, dependency, binary or asset changes were needed.

The runner provided a clean `main` with the repair applied. No initial checkout or rebase was performed. The previous persisted run failure was `push_not_on_main`, despite a successful rescue push at `b3358e1`; that push preserved work but did not integrate it. This run publishes main normally and uses the required rebase/test retry policy on rejection. No rescued changes were dropped. The build-generated `content/history.json` change was restored to keep unrelated history content out of delivery. The absent standing policy documents were searched for in the checkout and git history; AGENTS.md, the supplied role contract and landed tactile/Kame/fetch/fix contracts were followed. Installed Next production and Playwright guides were read.

## Local verification

All four exact required commands passed:

- Fetch/foundation unit command: 20 tests, zero failures.
- `npm test`: 2,133 tests, zero failures.
- `npm run lint && npm run typecheck`: exit 0; ten existing lint warnings, zero errors.
- Production fetch/Kame/peel command: 27 tests, zero failures, after real database migrations, production build and Next server startup.

The exact historical desk swipe browser case also passed (1/1) on the same production build with `SKIP_BUILD=1`; see `artifacts/desk-regression.log`.

The browser tests measure initial turtle placement, arrival and return geometry and five-second cancellation. They exercise real mouse/keyboard/CDP grip input, native card-body scrolling, text selection, links, peel, Pet, desk and stamp gestures. The immobilized-turtle negative control cancels instead of reporting a successful return. Real locked imports, embedded PostgreSQL, Next/React, SVG rendering and browser inputs execute; injected clocks, preference/Save-Data fixtures and lifecycle events are synthetic controls. No fake runner substitutes for these dependencies.

Run profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, attempt 4, fleet worker `avietidol-mac-mini`. Node `v22.23.3`, Next `16.4.2`, React `19.3.0`, Playwright `1.64.0`, embedded PostgreSQL `17.10.0-beta.17`, Google Chrome `156.0.8078.48`, macOS arm64. Initial production build ID: `dl07YtUiT_q8eHlCpu5_y`. Exact file hashes and executable fingerprint are in `artifacts/identity.json`; command logs are beside it. Report-only commits do not change this executable fingerprint.

## Independent pre-push history evidence

Read five bounded main workflow history pages (100 per page): 405 unique runs at the first-page snapshot, exhausting that snapshot. Counts: 220 success, 90 failure, 93 cancelled, one in progress, one pending. A newly inserted run shifted a page boundary and yielded one duplicate, removed by run id. Newer concurrent events are outside this snapshot. The current run was `40314442551` / checks `121544039795`, pending replacement `40314790984`; neither is a passed gate. Named job records and the latest failure annotations were independently downloaded. No asynchronous executable queue, capacity prerequisite, model artifact or callback-ingestion history applies to this browser feature.

Cancelled delivery checks job `121521479367` lasted 20m19s; motion cancelled and later gates skipped. Last successful checks job: `121516259788` / run `40306337481` at `ae4607d`. The latest completed failure remains `121530268639` / run `40310239199` at `841ca69`: the public annotation shows `e2e/desk.test.ts:597`, music x=0.3 rather than 0.425. This distinct historical failure is retained; a local pass cannot erase it. The prior run's report describes its authenticated raw-log inspection and broader 110-browser/356-motion local passes; those are inherited evidence, not rerun claims.

This run's raw job-log requests for cancelled, failed and green jobs returned HTTP 403. The raw tails are unread here; precise installer root cause remains inconclusive beyond the prior report. No further application edit is inferred from an unavailable log. See raw-access records and job/annotation captures.

## Rebase verification

The first normal push was rejected because main advanced. `git pull --rebase` rebased the single repair onto `d7fae5ddd13d2265368c87f04b3874fd97763ebb`. Incoming changes were planning/evidence records and the generated history snapshot; all initially recorded executable, lock, workflow and test hashes remain identical. All four exact contract commands passed again: 20/20 foundation, 2,133/2,133 repository, lint/typecheck exit 0 with the same ten existing warnings, and 27/27 production browser tests after a fresh real build/server/database. Final required build ID: `D1WvpvkeoNQ9RWlAOYPz7`. See `artifacts/rebase1-*`; feature chunk hashes identify this build. The original desk-only reproduction above belongs to the initial build, whose feature sources are identical.

## Delivery boundary and follow-up

Engineering ends at the successful normal main push and summary submission. The exact pushed SHA is in plan-manager `summary.git_sha` and uploaded `artifacts/commits.txt`. Local execution is demonstrated. Deployed integration and product delivery remain unproven here; no live checks or pipeline watch occur after push. Runtime capacity deferral is not applicable.

Owner: plan-manager CI green gate and independent QA for `t-1583`, keyed to the pushed SHA. Require successful checks and production, deployed health/page-meta ancestry containing `9ddd084`, and a live fetch/native-input walkthrough. Failure conditions: timeout/cancellation, failed assertions (including the historical desk swipe), red/skipped production, missing ancestry/controls, fetch beyond five active seconds, changed source text/hrefs/geometry or broken native input. Queued or pending CI does not waive any observed defect. Existing skipped production job `121530267824` is not deployment evidence.
