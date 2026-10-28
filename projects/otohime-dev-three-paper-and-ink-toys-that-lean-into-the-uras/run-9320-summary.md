# pm-269/t-1648 · run-9320 · Project delivery CI repair

Follow [fix plan run-9285](fix_plan_t-1648_run-9285.md). The previous
report-only delivery `ee40277` was filtered out of the main workflow; a green
ancestor did not establish its deployment. This delivery changes the workflow
and its matching deployment-verifier policy, preserving the working Bottle UI,
team-scoped API readiness, credentials and production gates.

Main pushes now use ordered `paths: ["**", "!**.md", "projects/**"]`. Project
summaries, architecture updates and artifacts trigger full checks and production;
unrelated Markdown remains filtered. Existing per-run checks and serialized
production concurrency remain intact. The workflow fixture checks report-only,
mixed and code paths; its same assertion rejects the historical ignore filter,
a missing project inclusion and an incorrectly ordered inclusion. The new tests
failed against the unchanged configuration (49 passed, 3 failed) and pass after
repair (52/52).

`verify-deploy.sh` now rejects a served ancestor when an undeployed change is
under `projects/**`, including Markdown. Only unrelated Markdown retains the
older-build exemption. Its real-shell self-test uses temporary Git history,
local HTTP health and an E2E marker: the undeployed project report fails before
E2E, a served descendant containing it passes, and unrelated Markdown still
passes. All 24 assertions pass. A separate extracted-function control executes
the actual `serves` helper against real Git history: current source rejects the
undeployed report (exit 1), while restoring the old project exemption accepts it
(exit 0). This is local policy proof, not hosted workflow execution.

## Fresh verification

The six exact Bottle commands and the deployment fixture run through
`node scripts/verify-bottle-contracts.mjs ../../shared/artifacts/run-9320/retry-1`,
which validates named positive evidence and rejects silent, missing, skipped
or otherwise incomplete receipts. All seven commands and their receipt negative
controls pass:

| Contract | Result |
| --- | --- |
| Bottle layout and picker tests | 12/12 |
| Repository `npm test` | 2,617/2,617, no skips |
| Lint and typecheck | Exit 0; zero errors, 10 existing warnings |
| Gate closure | Certified; actual locked imports and Postgres binaries |
| Production Bottle browser | 14/14 |
| CI-mode footer walk and Chromium probe | 65 walk and 176 probe assertions |
| Deployment fixture | 63/63 |

All three required viewports (1366×768, 768×1024, 390×844) preserve the 44px
minimum, positive scene and top-border clearance with default/24px/32px labels
and settled 200% root text. Minimum border clearance is 2.40625px; normal scene
gap is 4px; root scaling grows the default target from 44px to 45.796875px.
Both historical CSS mutations fail the same containment helper. Stage/copy
alignment, music TV clearance and state stability remain passing. Footer/Pocket
gesture-only loading, safe deliberate Visit, Escape focus return, legacy Tab
order, bounded shared history, blocked storage, real pending-only Postgres
suggestions, offline/429 resilience, reduced motion and no-JS baseline pass.
Bootstrap is 1,634 gzip bytes; lazy panel/CSS is 4,966 bytes; CLS is 0.
Bottle build: `pN-JVGG7yPq8S-PFFnr7p`; footer build: `Ahf9ltWjvwaftBezN-5GN`;
Chrome: 156.0.8078.47. The lazy JS/CSS SHA256 values remain
`e4b166ce41b6aa0e4172bf530d9dd20593d3a6f0fffa02a896fe9b48567ea167`
and `f16c4d552e8f62e4858d07bc747b97b16b181f80512f6f220fc3ceb01a362be2`.

The tested base is freshly fetched main
`a6297cb2631d0173dcc442f9617878b6d5a76825`, a descendant of `ee40277`.
Current executable fingerprint (relevant source, lock and configuration) is
`6048c0543f45cf69f165cd32978567b4a75442a344920c8ef528477a131d8691`.
Per-file hashes, complete local logs, gate receipts, the history sample and
`commits.txt` are in the lease's shared artifacts directory
(`shared/artifacts/run-9320/`; final receipts under `retry-1/`). Generated build output, generated content history,
binaries and dependency changes are excluded from this commit. These are fresh
receipts for the current fingerprint; previous SHA receipts are not reused.

Execution uses Node 22.23.3 on Linux x64 after `npm ci`, locked Next 16.4.2,
React 19.3.0, Playwright Core 1.64.0, pg 8.23.1 and embedded Postgres
17.10.0-beta.17. Installed Next's lazy-loading guide was read before editing.
Gate closure imports the actual locked modules and executes/checksums the
PostgreSQL 17.10 binaries. Real boundaries include Next production builds/start,
migrated disposable Postgres, Chrome, local HTTP, Git, Bash and child processes.
Browser edge responses, storage failures and historical CSS are explicit
fixtures. Fake Vercel CLI/vendor API/token controls prove orchestration and
fail-closed handling, not hosted authorization. No live suggestion or external
Visit is submitted.

## History and handoff

Persisted run profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`,
worker `avietidol-z490`, account `codex-main`, fleet runner. Bounded global coding
history reads FAILED offsets 0/3, limit 3 (6/118), COMPLETED offsets 0/3, limit 3
(6/1321), and RUNNING (2/2). Global history is incomplete; completed samples
include unrelated canaries. Raw failed task `a24064eb` shows a successful branch
push followed by `push_not_on_main`; its delivered callback (one attempt) agrees
with persisted failed run-9319 and zero callback-application failures. Raw
completed task `dbf26ede` shows successful branch and main pushes of `8af6a17`;
its delivered callback (one attempt) agrees with succeeded run-9314 and zero
application failures. Neither unrelated executable proves Bottle recovery.
Prior delivery task `89302606` has a raw tail ending in the `ee40277` summary and
successful runner exit, COMPLETED/delivered/one attempt, and succeeded run-9281
with summary rep-5492 and zero application failures. Its old workflow filter
differs from this delivery. Unread pages, earlier raw log bodies and callback
transport internals remain inconclusive.

Local execution is demonstrated by the fresh gates. No capacity or operator
wait is used. Hosted integration and product delivery remain unproven in this
SWE run; no pipeline or deployed endpoint is watched. Plan-manager/CI owns the
push-triggered full main workflow for the delivery SHA (new workflow/job ids
unobserved), requiring green checks and production, explicit team/project-bound
API READY and exact-SHA health, plus served ancestry containing this delivery
and `ee40277`. Any red job, non-READY/refused API or ancestry mismatch fails.
Independent QA owns a fresh served-SHA Footer/Pocket walkthrough at 1366×768 and
390×844, default/24px/32px text and settled 200% root scaling, lazy/CLS budgets,
Visit/focus/history/pending-suggestion resilience, and the live unauthenticated
admin-API 401 negative control. Any identity mismatch or contract regression
fails. The historical path-filter defect is not declared recovered in hosted
execution until that complete green gate and deployed QA pass.

## Publication retry

The initial tested commit `15c0f3f` pushed successfully to
`pm-269-t-1648-run-9320`, but main advanced and rejected the forward-only main
push. `git pull --rebase origin main` preserved incoming Notes delivery
`43b3f78`/`a6297cb` without conflicts. The rebased implementation is
`53109d374b910d219c826fdbb5c03548bf9588b8`; every task command, workflow fixture
and ancestry self-test was rerun, with all results passing as shown above.
The final fingerprint additionally includes the current Notes source and site
content; no dependency or lock change was needed. Final local builds embed
`53109d3`; this subsequent documentation update changes no fingerprinted
executable path. The initial receipts remain separate and are not substituted
for these post-rebase results.

The retry publishes `pm-269-t-1648-run-9320-r1` and advances main without
force-pushing the original branch. A second focused task-prefixed documentation
commit records these changed identities/results because repository rules
prohibit amending without a request. Delivery SHAs are saved in both
`shared/artifacts/run-9320/commits.txt` and `shared/artifacts/commits.txt`.
Hosted checks and served delivery ancestry remain assigned to plan-manager/QA
as above; the run stops at its tested push.
