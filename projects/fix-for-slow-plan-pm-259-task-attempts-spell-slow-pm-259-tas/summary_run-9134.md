# t-1661 · Local certification passed; main delivery exhausted retries (run-9134)

**Delivery status: infrastructure failure.** Four main pushes were rejected despite three normal rebases and full retest rounds. No main delivery or deployment is claimed. The source is preserved on `task-rescue/pm-270-t-1661-run-9134`; actual publication receipt and SHA are in shared artifacts and the summary report. See `artifacts/run-9134/push-outcome.json` and `main-push-attempts.json`.

Registered the CI probe annotation, streamed heading and main-lane closure suites in `npm test`. Preserved the rescued `main-lane-closure.test.mjs`: executable shell TMPDIR normalization controls, suite-registration mutations, desk/gesture guards, actual Kame predicate, real Chromium ledger geometry, callback-flushed child stream limits, and the optional-config HTTP/console negative control.

Preserved landed desk, Kame, ledger and stream-drain implementations. Task prose uses shorthand names not present in `0b349dc`: the actual desk uses `settledTape`/`scrollIntoViewIfNeeded`, observed React props and wide-handle `touch-action:none` (stacked mode auto). Their real behaviors and 120px swipe assertions remain intact. No assertion was weakened or quarantined.

Resumed at `3e205ed` on `main`, with two unpublished rescue commits above `8d42a87`. The previous run failed four concurrent main push attempts despite green retests; rescue publication was preservation only. Kept its tests and historical artifacts. Dropped only build-generated `content/history.json` drift and consolidated the rescued commits into a single explicitly Otohime-authored/committed delivery commit. No initial checkout or rebase was performed.

## Verification

All commands passed on one unchanged executable fingerprint, `33a81b7d8c1a3adaea63aede9d2a880b72b696b01115ea9321cf85901517373f`. See [artifacts/run-9134/rebase-3/verification.json](artifacts/run-9134/rebase-3/verification.json) for exact argv, durations and production build IDs; [artifacts/run-9134/rebase-3/fingerprint.json](artifacts/run-9134/rebase-3/fingerprint.json) binds repository bytes including package lock/config and test fixtures. Generated history and plan artifacts are excluded explicitly. Complete command logs accompany that manifest. `build-artifact-identity.json` separately hashes the final isolated-footer build manifests/chunk trees and generated history; earlier E2E build IDs are recorded per command.

| Command | Result | Duration |
| --- | --- | --- |
| closure-green | pass=26, fail=0, skipped=0 | 1.595s |
| unit | pass=2462, fail=0, skipped=0 | 17.264s |
| lint | exit 0 | 8.545s |
| typecheck | exit 0 | 1.57s |
| gate-closure | exit 0 | 3.553s |
| e2e-1 | pass=181, fail=0, skipped=1 | 389.221s |
| e2e-2 | pass=181, fail=0, skipped=1 | 388.301s |
| e2e-3 | pass=181, fail=0, skipped=1 | 382.786s |
| footer | exit 0 | 76.797s |

The three production E2E repetitions are serial, each with a fresh production build, Docker Postgres and real installed Chrome. Their sole pre-existing skip is the opt-in `EVIDENCE` print artifact test. Isolated footer verification uses a separate build/server and embedded Postgres, running unmodified walk and Chromium gates in CI mode through a temporary Chrome exec launcher. Lint retains ten existing warnings with no errors. Gate preflight imports the locked modules and constructs/exercises the actual Postgres runtime/binaries.

Fake boundaries are explicit: TMPDIR controls fake dependency commands while executing the full shell; the isolated Kame predicate supplies a fake page/clock; the config route-body unit fixture substitutes Next request context/runtime env. Ledger and HTTP console controls run in real Chrome, stream controls use real Node children, and production E2E uses the actual app/database/browser with its existing individual network/camera fixtures. Negative controls reject removed TMPDIR normalization, a 49-character off-by-one, clobbered custom paths, missing suite registration, missing fixture guards/gesture endpoints, frozen time, a non-overflowing sheet, nonzero children, and a real HTTP 404 console error.

## Independent context and limits

One bounded public Task 1 read at `4c9f325055c6da83fbe12afe6ffeb5858efd2a89` returned all four check runs and all four annotation pages, with no pagination links. Checks and production succeeded in run `40432734832`; its only annotation was an unrelated lint warning. No deterministic Footer/Motion error required a new probe fix.

Read bounded history: 10 of 116 failed main runs, 10 of 470 completed main runs, and zero current in-progress/queued runs at the initial read. These scans are incomplete for overall repository history. Inspected raw public annotations for failed production job `121981152892` (run `40439524623`: Vercel `User not found` and served-SHA mismatch), and job states for subsequent successful checks/production in run `40441825381`. Runner logs returned HTTP 403, so missing raw history remains inconclusive. The historical deploy failure remains named; later success is not proof of universal recovery. Deployment helpers are outside this task's scope and unchanged.

Actual board run metadata: `codex-sol-6-1-high`, `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-mac-mini`; see `artifacts/run-9134/run-metadata.json`. Runtime versions are in `dependencies.txt` (Node 22.23.3, Next 16.4.2, locked playwright-core 1.64.0, Chrome 156.0.8078.48). Both `9ddd084` and `c6d09f0` ancestry checks passed; source diff is package registration plus the closure test.

Execution demonstrated: local locked production builds, unit/negative controls, three full browser repetitions, isolated footer gates. Integration deployed: not observed for this delivery. Waiting for capacity: none. Product delivered: pending CI and independent live QA. Plan-manager owns t-1661's green gate and checks/production plus independent health/build-sha/ancestry certification at the pushed SHA. Fail if a required gate fails or the deployed build omits the delivery or required ancestors. This SWE run stops after push and summary; it does not watch CI or query live production.

Delivery SHA and push receipt are recorded in the lease's shared `artifacts/commits.txt`; the summary tool receives the exact pushed SHA. Historical `run-9120` evidence is retained as historical, not substituted for this run's verification.

## Delivery retries

Selected verification round: `rebase-3`. Every rejected main push was followed by a normal `git pull --rebase`, inspection of incoming paths, and all nine task commands again, including three serial production E2E builds and isolated footer gates. Previous passing logs remain historical and are not reused as certification. The selected round's executable fingerprint and logs are the final local evidence.

- Retry 1: rejected `2e7db12aed9e44177d000baa25f402f051a5d5bb`; rebased onto `20035357a972dbc94c7fbc08b45753cc3f8e1b78`. Details: `artifacts/run-9134/rebase-1/event.json`.
- Retry 2: rejected `91e7e3baff40f0b38cade7c1dbc25572dfdc826f`; rebased onto `f83c73f8d59d75aafe72c93cdea6f7ff924dc0dc`. Details: `artifacts/run-9134/rebase-2/event.json`.
- Retry 3: rejected `b36839a8ae6ac93cd63aabe0536b4d4e536f84ff`; rebased onto `cabb78bb430631a84855b3622d1906293bee977d`. Details: `artifacts/run-9134/rebase-3/event.json`.

Retry 1 integrated deployment-verifier dependency setup plus README and reports; its fake-only local self-test passed 19/19. Retry 2 integrated pm-259 CI crash diagnostics, deployment identity/fail-closed checks and associated tests; those upstream helpers are preserved. Retry 3 integrated the seasons probe's narrowly scoped tier-off discovery classifier and controls, without changing the desk/shared fixtures. This task's source changes remain package registration and the closure suite. The role stops at the eventual push receipt.

All four rounds of this run passed, including twelve full serial production E2E runs overall. Only the selected final round certifies the final combined executable fingerprint. Retry exhaustion is `cause=environment`, `classification=infra`, not a passing main delivery. The final documentation amendment changes only evidence; tested source remains unchanged. Plan-manager owns delivering the preserved code to main before CI/live QA. No pipeline polling or deployed-system checks followed any push attempt.
