# t-1564 · Restore the deployment checks gate (run-8822, fix cycle after QA run-8813)

Base: ff527a1 at claim; delivered on b0befb6 after two rebases (one rejected push). Run: software_engineer, Claude Opus 5.5 (`claude-opus-5-5`), macOS lease on the avietidol mac mini. This run follows [fix_plan_run-8813.md](fix_plan_run-8813.md).

Real/fake boundary: every result below comes from a real production build, real Chrome or Chromium, and a real Postgres (embedded). The only fakes are two node:test fixture files in lib/e2e-runner.test.ts. Nothing was deployed, and CI on the delivery commit is left to the green gate and QA.

## CI history read (bounded)

- Source: unauthenticated GitHub API, `actions/runs?branch=main&per_page=100` page 1. That is **100 of 383** runs: 46 failure, 36 cancelled, 16 success, 1 in progress and 1 pending. Older pages were not read.
- I read job steps for six runs: 40263545741 (last green before the outage), 40295803050, 40296784613, 40297827219, 40298672101 and 40299753926.
- Since delivery 15fd171 the checks job has gone **3 red, 2 green**, all red runs failing at "E2E against next start":

  | Run | Commit | Result | E2E step time |
  | --- | --- | --- | --- |
  | 40295803050 | 15fd171 | red | 232 s |
  | 40296784613 | 4059b63 | red | 194 s |
  | 40297827219 | ee1f6ce | green | 256 s |
  | 40298672101 | 0a32605 | red | 225 s |
  | 40299753926 | f9afe0e | green | 219 s |

  Failure and success take about the same time, so a quick assertion fails, not a timeout.
- Raw job logs (e.g. `actions/jobs/121493560349/logs`) return **403**. The **check-run annotations are public**, but they only carry "Process completed with exit code 1", at log line 602/603. The CI assertion itself is still **unread**.

## What this commit changes

### 1. The failed assertion becomes public on the next red run (diagnostics, fix plan item 1)

- `scripts/e2e-annotate.mjs` is a node:test reporter. For each failed test it emits an `::error file=…,line=…,title=E2E failed: <test>::<assertion>` annotation. Those are readable without a token through `check-runs/{id}/annotations`. It also appends a bounded section to `$GITHUB_STEP_SUMMARY`.
- `scripts/e2e.mjs` adds the reporter beside TAP only when `GITHUB_ACTIONS=true` and no reporter was given. In its own-server mode, a failed suite prints the last 80 lines of the server log before cleanup.
- `.github/workflows/ci.yml`, E2E step:
  - `next start` writes to `$RUNNER_TEMP/next-start.log`.
  - `npm run test:e2e || status=$?` keeps the status.
  - On failure, the step summary gets the commit, `.next/BUILD_ID`, Node, google-chrome version, CPU count and the server's last 80 lines, and the step ends with `exit "$status"`.
  - The job keeps bash `-eo pipefail`, and production still `needs: checks`.
- Regressions in lib/e2e-runner.test.ts:
  - A failing fixture under `GITHUB_ACTIONS=true` yields exactly one annotation with file, line 4, an escaped title and message, plus a summary section, and the TAP output and exit 1 are kept.
  - Negative control: the same run outside Actions writes neither.
  - The workflow step's status handling is pinned.
  - Mutation check: with the reporter unwired, the annotation test fails.

### 2. Reproduced defect: the Kame keyboard-hold threshold raced a flowing clock

- **Reproduction (Linux container):** Ubuntu 24.04, Node 22.23.3, Playwright Chromium headless shell 1248, 4 CPUs, production build, embedded Postgres, `GITHUB_ACTIONS=true SKIP_BUILD=1 npm run test:e2e`. Before the fix: 91/91, then **90/91 twice**, both failing at `e2e/kame.test.ts:90`: `Expected "actual" to be strictly unequal to: 'pet'`. The new reporter's step summary captured it.
- **Diagnosis:**
  - Playwright's `clock.install()` keeps time flowing with real time until `clock.pauseAt()`, per `playwright-core/types/types.d.ts` Clock.
  - The test pressed Space and then ran `runFor(499)`. Real round-trip time added to the fake clock and crossed `PET_MS` = 500, so Kame was already petted at the "not yet" check.
  - The component (`components/kame/companion.tsx`, `setTimeout(…, PET_MS)`) is correct. The test's assumption was wrong.
- **Repair:**
  - I wrote the repair as a clock pause before the threshold check, keeping both thresholds: not petted at 499 ms, petted at 500 ms.
  - The same pause landed on main concurrently in **9ddd084 (pm-259/t-1583)** while this run was working. After the rebase my duplicate was dropped, so this commit keeps 9ddd084's pause.
  - **This commit adds the negative control only.** The test resumes the clock, waits 50 real ms, runs the same `runFor(499)`, and Kame is already petted. Then it pauses the clock again for the rest of the test, as 9ddd084 has it.
- **After the fix:** with my identical pause on the pre-rebase tree, the container passed **3/3 full runs (91/91 each)**, and macOS passed `e2e/kame.test.ts` 7 of 8 times. The one failure is the separate hydration error below. The rebased tree's results are in the verification table.
- **Correlation:** Kame landed in dd21add. Every E2E failure since 15fd171 is at the same app, test, lock and workflow identity (QA's fingerprint.json). This is the strongest reproduced candidate for those CI failures. Whether it was *the* CI assertion stays unproven until a red run's annotation can be read.

## Checked and not repaired

- **Ryugu "Page already revealed" candidate (pm-256/t-1559):** not reproduced.
  - On macOS Chrome 156.0.8078.48: 0/20 errors in a focused urashima hop from /work (`pageswap vt=true`, `pagereveal vt=true` every time), 10/10 runs of e2e/ryugu.test.ts clean, and 2 full E2E runs at 91/91.
  - In the container: 6 full E2E runs with no Ryugu failure.
  - A likely mechanism: React's view-transition rejection handler (react-dom-client.production.js, around line 15880) ignores only the exact message "Transition was aborted because of invalid state". A longer Chromium message would be reported as an uncaught error. This is unconfirmed, so no source change was made.
  - It stays open with owner pm-256/t-1559. Failure condition: any `Page already revealed` page error in e2e/ryugu.test.ts.
- **New observation: React #418 hydration mismatch (args HTML) on /projects:**
  - Seen once in `e2e/kame.test.ts` "real shared Web Audio purr…" on macOS (1 of 8 file runs, host load 9–12).
  - Not reproduced afterwards: 0/20 isolated purr runs, 0/60 /projects loads with and without the fake clock, and 0 in 6 container runs. The minified error does not name the component.
  - Owner: t-1564's gate, in coordination with pm-259/t-1573 (Kame). Failure condition: `errors/418` in any E2E annotation.
- **40277523350 / 2a58479 footer failure:** the log returns 403 and the annotation only says exit code 1. It is inconclusive, as before. The footer walk (67/0) and matrix (171/0) pass at this tree.
- **author.txt of task 8d0933c1:**
  - `task_manager_get_task` returns only the manifest entry (44 bytes, sha256 7694250f…5ada), with no bytes.
  - 64 candidate author-line encodings do not hash to it.
  - The 15fd171 git author and committer are Otohime <quiinthieu@gmail.com>, with no Co-Authored-By trailer.
  - The bytes stay unverified.

## Verification at the delivery tree (b0befb6 + this commit, Node 22.23.3; all seven rerun after each rebase)

| Command | Result |
| --- | --- |
| `npm test` | 2123 pass, 0 failed/skipped |
| `npm run lint` | exit 0 (0 errors, 10 existing warnings) |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 |
| `SKIP_BUILD=1 bash scripts/walk-end.sh` | 67 ok, 0 failed |
| `SKIP_BUILD=1 bash scripts/probe-end.sh` | 171 ok, 0 failed |
| `SKIP_BUILD=1 npm run test:e2e` | 102/102, including the Kame negative control (102 tests after 9ddd084 added kame-fetch) |

The Linux container figures above are extra evidence, not contract commands. My container and the repro servers and databases were removed by PID. The embedded database directories are gone.
