# Engineering delivery: pm-259/t-1583, run-9017

This run follows the [run-8998 fix plan](../fix_plan_t-1583_run-8998.md). Delivery `c1b26f1` failed CI at `npm test` in checks job 121628642183. Its raw log is behind sign-in, so the failing assertion was unreadable. The gate's own repository run failed separately on a macOS lease.

All fetch, Peek, Kame, peel, deploy-diagnostic and recovery code that has landed is unchanged. This commit changes only tests and the CI annotation step.

## Defects fixed

1. **CI-only `npm test` failure.** The failing case is `lib/end.test.ts` test 11, `130 !== 1`. pm-275 research (rep-5269) identified it, and this run reproduced it on a Linux lease with `/usr/bin/google-chrome` and `CI=true`.
   - Cause: the four stub-npm BASE_URL cases inherit `CI`. With CI set and Chrome on PATH, `probe-end.sh` takes the runner branch, never calls the stub npm, launches the real probe, and is killed by the 10 s bound.
   - Fix: those cases now unset `CI`. TMPDIR is resolved before the branch, so they still test what they were written for.
   - New coverage: one added case drives the runner branch on any host, using a fake `google-chrome` and a fake `node`. It expects exit 7, the `# browser: runner` line, no installer and the `probe-end.mjs` hand-off.
   - Negative control: putting `CI` back fails again with `130 !== 1` ([log](artifacts/end-negative-control.log)).
2. **Gate's macOS repository failure.** `scripts/history-index.test.ts` hit `bad tree object HEAD` at fixture commit 180, even with `543ba68`'s auto-maintenance isolation in place. gc thresholds rule auto-gc out as the cause; the real cause was **not observed** and cannot be reproduced on Linux.
   - Change: fixtures are now built by one `git fast-import` per repository (a single pack) instead of about 410 git subprocesses. Commits, files, dates and assertions are unchanged.
   - Result: the file runs in about 1.3 s instead of about 11 s, and five repeated runs pass ([log](artifacts/history-index-5x.log)). This narrows the failure window but does not prove a fix on that macOS host.
3. **Unreadable CI assertions** (fix plan step 1). The `npm test` step now tees its TAP output, with `pipefail` keeping npm test's own exit status. A step that runs only on failure (`scripts/tap-annotate.mjs`) turns each failing test into a public `::error` annotation and a step-summary section. A red run with no `not ok` line still gets a tail annotation.
   - An uploaded artifact would need sign-in, like the logs that returned 403, so annotations were chosen instead.
   - Tests: `lib/tap-annotate.test.ts` parses TAP from a real node:test run. Its negative controls are a parent that fails only because a subtest failed, a passing test, a crash with no TAP failures, and a missing file. It also checks the workflow wiring.

**Left to pm-275 t-1617:** the Vercel `inspect` verdict in `scripts/vercel-deploy.sh` (historical production job 121600218178). That plan has a dedicated synchronous-deploy and health-budget contract and was waiting on this run's paths. Until it lands, a green checks job can still lead to a red production inspect step, even though the upload goes live.

## Verification (final tree, base `5598e40`)

| Command | Result |
| --- | --- |
| Fetch/foundation (4 unit files) | 21/21 ([TAP](artifacts/foundation.log)) |
| `npm test` | 2318/2318, 0 skipped ([tail](artifacts/repository.log)) |
| `CI=true npm test` (Chrome on PATH, matching the runner) | 2318/2318 ([tail](artifacts/repository-ci.log)) |
| `npm run lint && npm run typecheck` | exit 0, 10 existing warnings ([log](artifacts/lint-typecheck.log)) |
| Production fetch/Kame/peel browser suite | 28/28, 0 skipped, build `jHm3sbxwthAiWPP0j6--r` ([log](artifacts/browser.log)) |
| `bash scripts/vercel-deploy.test.sh` | all checks passed (unchanged script) |

**Environment:** locked `npm ci` (package-lock sha256 `2d0ec0be…`), Node 22.23.3, Next 16.4.2, git 2.43.0, real Chrome via Playwright Core, embedded PostgreSQL with migrations.

**Real vs fake:**
- Fake: the Chrome, node and npm stubs in `lib/end.test.ts`, and the deploy-policy npx fixtures.
- Real: the browser suite measures actual turtle, proxy and source geometry, native input and the immobilized-turtle timeout control.

**Run:** profile `claude-opus-high`, model `claude-opus-5-5`, effort high.

## CI and deployment evidence

- **GitHub REST:** returned 403 (rate limit), so zero run records could be read and history is **incomplete**.
- **Run page 40339124232:** readable without sign-in, but it shows only the generic `Process completed with exit code 1`.
- **`/api/health`:** serves `074059495faf4bee48e8f655584dfd4487089b41`, which does not include `c1b26f1` or this delivery.

Details are in [ci-observation.json](artifacts/ci-observation.json).

## Status and what plan-manager owns

- Execution demonstrated: locally only.
- Integration deployed: not observed.
- Waiting for capacity: no.
- Product delivered: pending.

Plan-manager owns:
- the pushed-SHA checks and green gate;
- the production job once pm-275 t-1617 lands;
- served-SHA ancestry;
- independent live keyboard, pointer, CDP-touch and reduced-motion QA.

Any of these fails the task: a red checks job, a red production job, a new annotated unit failure, or a served SHA that does not contain this delivery.

Engineering ends at the push.
