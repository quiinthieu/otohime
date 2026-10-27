# t-1661 · Local certification passed; main delivery exhausted retries

**Delivery status: infrastructure failure.** Four main pushes were rejected as non-fast-forward despite three normal rebases and full retest cycles. The tested one-commit change is preserved on `task-rescue/pm-270-t-1661-run-9120`; main delivery and product delivery are incomplete. See `artifacts/run-9120/push-outcome.json`.

Registered `ci-probe-annotate.test.mjs`, `probe-end-stream.test.mjs`, and the new `main-lane-closure.test.mjs` in `npm test`, preserving the concurrently added console-error tests. The final task code diff is limited to `package.json` and the new test file. Landed desk, Kame, ledger, gesture-trace, and gate-closure implementations and assertions remain unchanged.

Closure controls execute the full signed-in shell with fake dependency commands, checking unset/empty/49+/48-character/custom TMPDIR behavior and rejecting missing normalization, an off-by-one limit, and clobbered custom paths. They execute the actual gesture trace, Kame predicate, ledger sampler in Chromium, and callback-flushed stdout/stderr child runner, with negative controls and mutation-tested fixture guards. Suite registration rejects removal of any required entry.

Fresh initial footer execution reproduced two console failures from disabled ghost configuration returning HTTP 404. Concurrent upstream commit `a958913` fixed browser discovery with `/api/ghosts?probe=1`, preserving the direct route's intentional disabled 404. This delivery preserves that API contract and drops the superseded local shared-config change. Its browser regression executes the actual GET body with only Next request context/runtime env substituted: the optional probe is successful JSON null, while the direct 404 must still fail the unfiltered console assertion. No application route or error classifier is changed by this task.

## Final verification

Every contract command exited 0 after the third rebase. [verification.json](artifacts/run-9120/verification.json) names complete logs under `artifacts/run-9120/rebase-3/`.

| Contract | Final result |
| --- | --- |
| Closure and gesture contracts | 26 passed; zero failures/skips |
| `CI=true npm test` | 2,438 passed; zero failures/skips |
| Lint, typecheck, gate closure | Passed; 10 existing lint warnings, zero errors |
| Full production E2E serial run 1 | 181 passed / 0 failed / 1 existing evidence-only skip; 397.6938s |
| Full production E2E serial run 2 | 181 passed / 0 failed / same skip; 371.3488s |
| Full production E2E serial run 3 | 181 passed / 0 failed / same skip; 384.6362s |
| Isolated CI-mode footer verification | Walk 65/65; Chromium probe 170/170; zero console/page errors |

Each E2E repetition rebuilt production and started a fresh real Docker Postgres. All required desk/Kame/ledger checks and the incoming real production ghost-route tests executed each time. The existing skip is the opt-in `EVIDENCE` output test in `e2e/print-runs.test.ts`. Footer verification used its own real embedded Postgres/build/server and a local exec launcher for installed Chrome, with no browser download.

## Executable identity and proof boundaries

Final tested tree: `8689702`, based on `6bea14d`. Final [fingerprint](artifacts/run-9120/rebase-3/fingerprint.json): SHA-256 `ffb8fd3c21475783e380d506d7faa2ab722b47f31db8afd28396afffbf5b05cd`, binding relevant code, config, lock and fixtures, unchanged throughout the final verification round. Verification JSON records local build ID and generated history hash. The final commit amendment adds only evidence. Both `9ddd084` and `c6d09f0` are ancestors, with explicit Otohime author/committer identity and no co-author trailer. The original generated history delta is preserved outside the commit.

Actual run metadata read from plan-manager: `codex-sol-6-1-high`, `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-mac-mini`. Node 22.23.3; Next 16.4.2; locked playwright-core 1.64.0; Chrome 156.0.8078.48. Real locked module imports and Postgres binaries passed gate preflight.

Fake boundaries: shell dependency commands, the isolated Kame predicate's page/clock, and Next request context/runtime env for the isolated GET fixture. Ledger geometry and HTTP controls use real Chrome; stream controls use real Node processes. Full E2E uses the production app/database/browser, retaining individual camera/network fixtures. The incoming production GET test also executes the real Next request context. This is local execution proof; delivery deployment is not observed.

One bounded public read of Task 1 commit `4c9f325055c6da83fbe12afe6ffeb5858efd2a89` returned all four check runs and all four annotation pages, with no pagination links. Checks and production succeeded in run `40432734832`; preview/cleanup were skipped. The only annotation was an unrelated lint warning, with zero probe errors. Saved raw responses are complete for that returned check set; they do not establish all repository CI history. The initial local footer failure log is complete.

## Push retries and handoff

Pushes of `4f75d12`, `44dd526`, and `cf28af0` were rejected as non-fast-forward. All three normal rebases were followed by every verification command, including three fresh serial full E2E runs and isolated footer verification. The first incoming commits were report-only. The second included Lanyard and ghost code, so its executable fingerprint is distinct and earlier passing logs are historical evidence, not final certification. The third rebase incorporated provider-test/probe-shell fixes and QA reports. Original logs, `initial-verification.json`, `rebase-1/verification.json`, and `rebase-2/verification.json` retain earlier attempts separately. The final retry is based on `6bea14d`; all contract commands were rerun on this tree.

`commits.txt` is written to the lease's shared artifacts after committing. No capacity deferral is needed. Local execution is demonstrated; integration deployment and product delivery remain pending. Owner: plan-manager's t-1661 green gate and independent QA at the pushed delivery SHA. Fail certification if checks/production fail or independent health/build-sha reads do not identify a deployed descendant containing the required ancestors. The SWE run stops at push, without pipeline polling or deployed-system checks.

The final main attempt `4e6a32c522c6739042e5103da35f65137e866bd1` was also rejected. Retry budget is exhausted; there is no force-push or further idle retry. This is `cause=environment`, reason `git_push_non_fast_forward_retries_exhausted`, as specified by the role contract. Plan-manager owns delivering the preserved commit to main before CI/live QA certification. Rescue publication preserves work and does not satisfy the main acceptance criterion.
