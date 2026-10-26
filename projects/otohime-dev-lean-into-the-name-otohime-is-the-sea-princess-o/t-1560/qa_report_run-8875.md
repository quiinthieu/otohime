# t-1560 Build static history index: QA report (run-8875)

Plan pm-256. Role: quality engineer. Run profile: claude-opus-5-5 (Claude Code, linux lease, node v22.23.3, git 2.43.0). This run re-verifies after fix cycle run-8864 (fix plan rep-5167, cause=environment).

**Verdict: fail, cause=environment.** The delivery passes every contract check and independent control on this lease. The t-1560 code is now live: at 11:36:05Z `https://otohime.dev/api/health` returned `0abec76d8145fb16f1a5e31cfe78898ff61819ff`, and that sha contains b0befb6 and 543ba68. The delivery sha 9420077 (the refreshed fallback) is **not** in the deployed commit. The first run that carried it, 428 (2992401), failed in its checks job at the "Footer Chromium probe" step. That step passed in run 422 eleven minutes earlier, and the diff between those two trees changes nothing that the probe or the app reads (see below). The next run that carries 9420077, 432 (a8717d8), started about 11:46Z and could not finish within this run's 15-minute waiting cap. No t-1560 code change is needed.

## Identities

- Delivery sha: `9420077d06f4dec23585d543b548d5f7b49640b7`, the run-8864 fix cycle. It has no code change: it refreshes the `content/history.json` fallback and updates summary.md and commits.txt. The code is in `543ba68fb184a73232fe16e532afb31590a05e73` (gc-off fixtures) and `b0befb6d438d04d0c7541acffc0c51618fcad148` (indexer). All three are authored by `Otohime <quiinthieu@gmail.com>`, and none has a `Co-Authored-By` trailer, which matches plan.commit_identity. The evidence has no author.txt.
- Green gate: `gate=green sha=9420077 status=pass` (both contract items exit 0, 16/16 tests, build `200 of 419`).
- Tested tree: `origin/main` at `d7fae5ddd13d2265368c87f04b3874fd97763ebb`, which contains 9420077. `scripts/history-index.ts`, its test and `package.json` are unchanged since 543ba68.
- Lockfile: `npm ci` from the committed package-lock.json, exit 0. The lease started with no `node_modules`.

## Contract verification (this lease, at d7fae5d)

| check | result |
|---|---|
| `node … --test scripts/history-index.test.ts`, 5 runs in a row | 5/5 exit 0, 16/16 each |
| `npm test` | exit 0, 2133/2133 |
| `npm run history:check` on the committed fallback | exit 0, `matches git and trails HEAD by 7 commits` |
| `npm run build` | exit 0. Prebuild: `history:index: git (full history): 200 of 421 commits` |

The build rewrote `content/history.json` in the lease, as prebuild does on a full clone. QA restored the file and did not commit it.

## Independent controls (real `file://` clones of otohime at d7fae5d, outside the SWE fixtures)

| scenario | result |
|---|---|
| `--depth 1` clone (`is-shallow-repository` = true) | `fallback (shallow clone): 200 of 414 commits … unchanged`, byte-identical to the committed file |
| full clone, indexed twice | `git (full history): 200 of 421`, the same sha256 both times (`69b994e5…`), 200 entries, head d7fae5d |
| `git archive HEAD` (no `.git`) | `fallback (git history unavailable)`, exit 0, byte-identical to the committed file |
| **negative:** `--check` after rewriting the first entry's subject | exit 1, `does not match git at its own head fe0dd82eb8`. Restored, it exits 0 |
| `--check` at a lag of 20 commits (13 empty commits on top) | exit 0 |
| **negative:** `--check` at a lag of 21 commits | exit 1, `stale: 21 commits behind HEAD (at most 20)` |

Real/fake boundary: the suite's git fixtures are synthetic repos. Every row of the controls table runs the real indexer, with real git and node, on real clones of otohime. The fixture-flake revert control (forced detached gc) was not repeated. Runs 8850 and 8858 reproduced it on this same linux / git 2.43 lease type (3/5 and 3/6 against 0/5 and 0/6), and no t-1560 code has changed since.

## Pipeline and deployment (GitHub Actions public HTML; `gh` is absent and job logs need a token)

Scan: page 1 of the `ci.yml` runs on `main`, runs 403 to 427. That is 25 of 427 runs; older pages were not read and count as inconclusive. At 11:30Z the page held 1 success (405), 3 failed (403, 404, 411), 19 cancelled, 1 running (422) and 1 waiting (427). Step timings come from the public job pages (`<check-step>` started/completed attributes).

| run | id | sha | state |
|---|---|---|---|
| 405 | 40306337481 | ae4607d | success. Production job 121520661524 took 1m51s: `vercel build --prod` 41s, `vercel deploy --prebuilt` **26s**. **This is what production serves** |
| 409 | 40308983810 | b0befb6 | cancelled (concurrency) |
| 411 | 40310239199 | 841ca69 | failed: `e2e/desk.test.ts#L576` desk swipe. Not related to t-1560 |
| 414 | 40311256064 | 3673c50 (contains b0befb6) | **cancelled by timeout.** checks 10m44s green. In production job 121537521859, `vercel build --prod`, which runs the prebuild indexer, **succeeded in 31s** and `db:migrate` succeeded. Then `npx vercel@64 deploy --prebuilt --prod --archive=tgz` ran from 11:08:41 to 11:22:51Z and was cancelled at the job's 15m limit (annotation: "The job has exceeded the maximum execution time of 15m0s") |
| 416 / 418 / 425 | 40312088029 / 40313401786 / 40315007042 | 543ba68 / 4a87fc4 / 9420077 | cancelled: a newer push replaced each pending run |
| 422 | 40314442551 | 0abec76 (contains 543ba68, not 9420077) | started 11:22:57Z. Every step of checks job 121544039795 was green by 11:32:58 (lint, typecheck, test, build, migrate, E2E, motion probe, footer walk) |
| 427 | 40315520146 | d7fae5d (contains 9420077) | waiting for 422 |

CI configuration: between ae4607d (last green) and 3673c50, only 841ca69 changes `.github/workflows/ci.yml`, and it touches only the checks job's E2E step. The production job (ci.yml:190-217) is unchanged. In 414 the indexer ran inside the real production build and passed. The stall was in Vercel's deploy upload, which took 26s in 405, so it is not caused by t-1560.

## Deployment outcome in this run

| time (UTC) | observation |
|---|---|
| 11:30:43 | `/api/health` → `ae4607d` (does not contain b0befb6, 543ba68 or 9420077) |
| 11:33:56 | run 422 checks job green, every step |
| 11:34:16–11:35:55 | run 422 production job 121548767451: `vercel build --prod` 35s (prebuild indexer ran on a depth-1 checkout), `db:migrate` 3s, **`vercel deploy --prebuilt` 23s**, health curl green |
| 11:36:05 | `/api/health` → **`0abec76d8145fb16f1a5e31cfe78898ff61819ff`**. `merge-base --is-ancestor`: b0befb6 yes, 543ba68 yes, **9420077 no**. `/ryugu` returns 200 |
| 11:33 | run 427 (d7fae5d) cancelled: "Canceling since a higher priority waiting request for ci-refs/heads/main exists" (push 2992401) |
| 11:36:00–11:45:40 | run **428** (40315924641, 2992401, contains 9420077), checks job 121549479127: lint, typecheck, test, build, migrate, E2E, motion probe and footer walk green. **"Footer Chromium probe" failed** (11:44:48–11:45:40, annotation `Process completed with exit code 1`, raw log needs a token). production skipped |
| 11:49:13 | `/api/health` still `0abec76`. Run 432 (40317243810, a8717d8, contains 9420077) running; 434 (0186092) waiting |

**Run 414's stall was transient.** The same `vercel deploy --prebuilt` step took 26s in 405 and 23s in 422, against 14m10s in 414, with the production job unchanged.

**Run 428's failure is not attributable to t-1560.** I compared the failing job with the last green run of the same job (422, 0abec76, where the footer probe passed at 11:33:56). `git diff --stat 0abec76 2992401 -- ':!projects'` shows only `.github/workflows/ci.yml` (2992401, pm-259/t-1583: checks `timeout-minutes` 20 → 35) and `content/history.json` (9420077's fallback refresh). Nothing in `app/`, `components/` or `lib/` reads `content/history.json`: only `scripts/history-index*.ts` reference it. The probe (`scripts/probe-end.sh`) covers footer routes and does not touch history. **Reproduction:** I ran `bash scripts/probe-end.sh` locally on a clean worktree at 2992401 (fresh `npm ci`, own build, embedded Postgres): 153 ok. Its 18 "not ok" lines are all `build-sha matches`, a local artifact: the walk script builds with a placeholder `GITHUB_SHA` while I passed the real `EXPECT_SHA`. Every functional check passed, including `network: zero unexpected external network requests` and `server.log contains no runtime errors`. So the CI failure did not reproduce on the failing tree. In my scan it is the first footer-probe failure: runs 403 and 404 failed in "E2E against next start", 411 in `e2e/desk.test.ts#L576`. The probe belongs to the footer work (pm-241), and pm-270 (a8717d8, "Plan the main CI and production lane fixes") is already planning main-lane CI fixes. If it fails again on 432 or later at the same step, it is a repeated defect for that owner, not for t-1560.

## Defects and deferred checks

- **No t-1560 defect.** The indexer is deterministic and bounded, `--check` catches tampering and lag above 20, and shallow or git-less builds ship the committed fallback without failing, both on this lease and inside the real production build (414 and 422).
- **Deferred: deploy of 9420077.** Owner: quality_engineer (next t-1560 QA run). Ids: CI run 432 (40317243810, a8717d8) or any later `main` run, all of which contain 9420077. Pass condition: `/api/health` sha `S` with `git merge-base --is-ancestor 9420077 S`, and that run's production job green. Failure condition: a run containing 9420077 completes production but `/api/health` does not change, or the probe/deploy step fails again at the same place, which makes it a repeated defect for the step's owner.
- **Observed, not t-1560:** run 428 "Footer Chromium probe" failure (not reproduced locally). Run 414 `vercel deploy` 15m stall (transient; 422 deployed in 23s).

