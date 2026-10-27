# pm-269/t-1648 · run-9171

Repair the production verification defect by requiring the configured VERCEL_ORG_ID before upload and passing --scope to both Vercel inspection calls. Preserve the existing token, upload/readiness bounds, fail-closed inspection and exact top-level JSON SHA health assertion. No credential changes. The Bottle implementation from e120461 remains unchanged, including its 3.75rem reserved header, rem label, 44px targets and lazy panel.

The new scope-sensitive fixture reproduces unscoped User not found, accepts scoped Ready and exact-SHA health, checks waiting and diagnostic argument lists, rejects missing team before upload and keeps scoped identity failures or unsuccessful waits closed even when the diagnostic re-read is Ready. Against the old script, six named checks fail (deployment-red.log). The updated script passes all 54 assertions. The fixture uses fake npx/Vercel, real bounded Bash/perl child processes and real local HTTP health responses. Real Vercel CLI 64.7.0 inspect help constructs successfully and advertises --scope; this preflight makes no authorization/deployment request.

## Positive verification

Run node scripts/verify-bottle-contracts.mjs <artifact-directory> from the repository root. This promotes the old archived verifier into a reusable script. Each receipt requires positive named tests/counts in addition to exit0. Internal negative controls reject empty output, renamed/skipped TAP cases, uncertified closure, missing TypeScript output and missing/failed deployment assertions. The board's six exit0-only expectations are insufficient as acceptance evidence; the receipts supply the positive assertions. Static analysis certifies lint/types only and cannot claim a runtime product assertion.

| Gate | Positive result |
| --- | --- |
| Layout and picker | 12 passing named tests, both historical CSS negative controls |
| Repository suite | 2,448 passing tests, no skips, named workflow/footer controls |
| Lint and typecheck | ESLint, Next route generation and tsc execute; zero errors, ten existing warnings |
| Closure | Certified real runner, locked imports/Postgres binaries, named controls and matching fingerprints |
| Production Bottle browser | 14 passing cases; production Next, migrated disposable Postgres and real Chrome |
| Isolated footer | 65 walk and 170 Chromium assertions; navigation, TV clearance and <=1px stability |
| Deployment fixture | 54 passing assertions, including scoped inspection and fail-closed negative controls |

All 1366x768, 768x1024 and 390x844 geometry cases pass default/24px/32px labels and settled 200% root scaling, with footer top-border containment, scene clearance and actual target growth. The same helper rejects historical -2.4rem scene overlap and 2.5rem padding protrusion. Browser coverage retains both entries, safe deliberate Visit, Escape focus return, legacy Tab order, bounded history/blocked storage, inert pending Postgres suggestion insertion, offline/429 retry, reduced-motion cancellation and no-JS. Bootstrap 1634 gzip bytes, panel/CSS 4966 bytes and CLS 0. Chunk hashes and measured geometry are in browser.log. Real browser/build/database execution is demonstrated locally; pool/network/error/storage/historical-style cases are explicit fixtures. No real external-site visit or deployed API probe is claimed.

## Identity, history and handoff

Actual board profile codex-sol-6-1-high; model gpt-6.1-sol, effort high (run profile_flags), fleet avietidol-mac-mini, account codex-main. Node 22.23.3; locked Next 16.4.2, React 19.3.0, Playwright Core 1.64.0, embedded-postgres 17.10.0-beta.17. Read root AGENTS.md and installed Next lazy-loading guide. The two mono-v2 standing documents are absent, as plan.md already explains.

Relevant executable/lock/config hashes and versions are in executable.json; full command-log hashes, build IDs and required names are in verification.json. Bottle source/test/style hashes match run-9159; the deployment executable is changed, so earlier inspection failures cannot be cleared by an unrelated documentation SHA or this fixture alone. Generated content/history.json is restored before delivery. The pushed SHA is supplied by the board report and lease shared/artifacts/commits.txt to avoid a self-referential tracked SHA.

Bounded task-manager history: FAILED offsets 0/10 (limit10), 20/92; COMPLETED offsets 0/10, 20/1,428; RUNNING 3/3. Global history is incomplete. Read raw runner logs for run-9170 and sampled failed run-9161: run-9170 ended red_gate_already_green with agent CLI not started; persisted plan-manager succeeded with no reports and callback_apply_failures=0 agrees. Run-9161 failed an unrelated pm-270 push guard despite green tests and created a rescue branch. These are not live execution proof for this changed deploy verifier. Transport callback internals, unread historical pages and vendor raw logs are inconclusive; no global-green claim. Evidence is preserved in history.json, prior-runner.log and sample-failure-runner.log.

The operator supplied historical CI evidence: e120461 run 40456936288 checks job 122032343083 passed; production job 122037570828 deployed but failed inspect. That red production result remains an open pipeline defect until a new fully green production job proves this scope repair. This SWE run does not watch CI or access deployed endpoints. Plan-manager/CI owns the push-triggered workflow for the delivery SHA (no new workflow ID observed before push); fail on any red check, scoped inspect error or health SHA mismatch. QA owns independent deployed desktop/mobile footer/Pocket geometry, enlarged/root-scaled text, user paths and live API access negative control after green CI, including served ancestry from e120461. Acceptance remains pending on those checks. If explicit scope still returns User not found, raise the specified operator action with exact command, scope and deployment URL. No capacity wait or operator chore is needed locally.

Before push, git pull --rebase integrated origin/main e9b32bf (two pm-270 plan-only commits) without conflicts. All six exact task commands plus the 54-assertion deployment fixture are repeated on the rebased tree; the committed receipts/logs are the final runs. No force push.
