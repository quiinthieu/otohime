# t-1560 Build static history index: QA report (run-8858)

Plan pm-256. Role: quality engineer. Run profile: claude-opus-5-5 (Claude Code, linux lease, node v22.23.3, git 2.43.0). This run re-verifies after fix cycle run-8850 (fix plan rep-5158).

**Verdict: fail, cause=environment.** The delivery at 543ba68 passed every check and control on this lease, and the CI checks job is green on a commit that carries the indexer. It is **not deployed**: production still serves ae4607d. The commit that carries 543ba68 (CI run 417) is queued in the serialized `main` pipeline behind another plan's run, so it cannot deploy within this run's 15-minute waiting limit. No code change is needed.

## Identities

- Delivery sha: `543ba68fb184a73232fe16e532afb31590a05e73` (fix cycle). Original delivery: `b0befb6d438d04d0c7541acffc0c51618fcad148`. Both, and the pm-256 QA commit 96be45a, are authored and committed by `Otohime <quiinthieu@gmail.com>` with no trailers, matching plan.commit_identity. There is no author.txt in the evidence.
- Green gate: `gate=green sha=543ba68 status=pass` (both contract items exit 0).
- Deployed sha: at 2026-10-26T11:10:50Z, `https://otohime.dev/api/health` returned `{"ok":true,"sha":"ae4607dafc28c6f732fdb7ee2ff2f1c7953ed4d3"}`. `git merge-base --is-ancestor 543ba68 ae4607d` fails (b0befb6 fails too).
- Lockfile: `npm ci` from the committed package-lock.json, exit 0. The lease started with no `node_modules`.

## Contract verification (this lease, 543ba68)

| check | result |
|---|---|
| `node … --test scripts/history-index.test.ts`, 10 runs in a row | 10/10 exit 0, 16/16 each |
| `npm test` | exit 0, 2133/2133 |
| `npm run build` | exit 0. Prebuild: `history:index: git (full history): 200 of 410 commits`. `/ryugu` prerendered, 200/200 static pages |

The build rewrote `content/history.json` in the lease, as prebuild does on a full clone. QA restored it and did not commit it.

## Independent controls (real `file://` clones of this repo at 543ba68, outside the SWE fixtures)

| scenario | result |
|---|---|
| full clone (`--no-local`), two runs | `git (full history): 200 of 410`, the same sha256 (`9448ad1a…`) both runs; 42,619 bytes; head 543ba68 |
| `--depth 1` clone | `fallback (shallow clone) … unchanged`, byte-identical to the committed file (head 3673c50, 408 total) |
| `--depth 3` clone (it holds the fallback's head 3673c50) | `spliced`, byte-identical to the full-clone output |
| `git archive HEAD` (no `.git`) | `fallback (git history unavailable)`, exit 0, unchanged |
| `PATH=/nonexistent` (no git binary) | `fallback (git history unavailable)`, exit 0, unchanged |
| shallow clone with `content/history.json` deleted | `empty (shallow clone, no valid fallback): 0 of 0`, exit 0: the build does not fail |
| `--check`, committed file in a full clone | exit 0, `matches git and trails HEAD by 2 commits` |
| `--check`, committed file in a depth-1 clone | exit 0, `well-formed (shallow clone: not compared with git)` |
| **negative:** `--check` after rewriting one subject | exit 1, `does not match git at its own head 3673c50630` |
| `--check` at a lag of 20 commits | exit 0 |
| **negative:** `--check` at a lag of 21 commits | exit 1, `stale: 21 commits behind HEAD (at most 20)` |

**Negative control for the fix.** Detached gc was forced through the environment: `GIT_CONFIG_COUNT=3`, `gc.auto=1`, `gc.autoDetach=true`, `gc.pruneExpire=now`.
- b0befb6's test file failed **3 of 6** runs, each time on test 8 (`fatal: could not parse HEAD`, `fatal: failed to write commit object`).
- 543ba68's test file failed **0 of 6** runs under the same environment.

Real/fake boundary: the git fixtures in the test suite are synthetic repos. Every row of the controls table runs the real indexer on real clones of otohime with real git and node. CI evidence comes from the public GitHub run pages; their raw logs need a token.

## Pipeline and deployment (GitHub Actions public HTML; the anonymous REST API was rate-limited, `gh` is absent)

Scan: page 1 of the runs list, CI runs 393 to 417. That is 25 of 417 runs; older pages were not read and count as inconclusive. 1 is in progress (414) and 1 is waiting (417). Of the 23 that are done, 2 completed successfully (394, 405), 5 failed (393, 398, 403, 404, 411) and 16 were cancelled.

| run | id | sha | state |
|---|---|---|---|
| 405 | 40306337481 | ae4607d | completed successfully, 11m56s. **Last green; this is production** |
| 409 | 40308983810 | b0befb6 (delivery) | cancelled (concurrency) |
| 411 | 40310239199 | 841ca69 | failed: `e2e/desk.test.ts#L576` ("the swipe dragged music: 0.3 is not 0.425", near() at L181, called from L597). This is not related to the history index |
| 414 | 40311256064 | 3673c50 (contains b0befb6, not 543ba68) | in progress at 11:10Z. The `checks` job is green in 10m44s, with no error annotations, and `production` is running |
| 416 | 40312088029 | 543ba68 (fix) | cancelled: "Canceling since a higher priority waiting request for ci-refs/heads/main exists" |
| 417 | 40312560588 | 45129f9 (contains 543ba68) | waiting: "This workflow is waiting for CI #414 to complete" |

CI config check: since the last green run, only 841ca69 (pm-258/t-1564) has changed `.github/workflows/ci.yml` between ae4607d and 543ba68. It sends the E2E step's output to a log and a step summary, and it keeps the exit status (`exit "$status"`). It does not change pass/fail. On `main`, the concurrency group `ci-refs/heads/main` (ci.yml:11-13) keeps one pending run and cancels older pending ones. That is why 416 was cancelled, and 417 inherits its delivery.

State: the integration is pushed (543ba68 is on `origin/main`). Execution is demonstrated locally, and in CI by run 414's green `checks` job, which runs `npm test` and `npm run build` on b0befb6's indexer at depth 1. The deployment is **waiting for capacity** in the serialized queue. The product is not delivered: production ae4607d contains neither b0befb6 nor 543ba68.

## Deferred checks

| id | owner | ready when | failure condition |
|---|---|---|---|
| CI run 40312560588 (#417, 45129f9), or the run for this QA report commit that replaces it as the pending run | GitHub Actions `main` queue, then the next t-1560 QA run | run 414 finishes, then about 12 minutes for the pending run | the pending run's `checks` or `production` job fails. If it fails at `e2e/desk.test.ts:597` (seen in run 411), that is a desk E2E defect for its owner, not t-1560 |
| production sha | next t-1560 QA run | `https://otohime.dev/api/health` `sha` passes `git merge-base --is-ancestor 543ba68 <sha>` | a newer green run deploys a sha that does not contain 543ba68, or `/api/health` stays at ae4607d after 417 completes successfully |

## Defects

None in the t-1560 delivery. One defect outside this task was seen: run 411's failure in `e2e/desk.test.ts` (pm-250/t-1534's test). If it recurs in run 417, it blocks this deployment.
