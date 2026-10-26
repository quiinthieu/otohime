# t-1560 Build static history index: QA report (run-8901)

Plan pm-256. Role: quality engineer. Run profile: claude-opus-5-5 (Claude Code, linux lease `avietidol-Z490-GAMING-X`, node v22.23.3, git 2.43.0, `npm ci` from the committed lockfile, exit 0). This run re-verifies fix cycle run-8891 (delivery commit 8955310, fix plan rep-5191, cause=environment).

**Verdict: fail, cause=code.** The history indexer passes every contract check and every independent control. It is now deployed: at 12:26:35Z `https://otohime.dev/api/health` returned `bca260a26e5cf56d574dbebde34c0ee6cc0fc565`, and `git merge-base --is-ancestor 9420077 bca260a` and `… 8955310 bca260a` both succeed. Run 438 (40319672622) deployed it, and every step of both its checks and production jobs is green. One defect blocks a pass:

1. **Commit identity (code).** `8955310754f89cf6eb8ed6d1a9ac4bbeedabece2`, the run-8891 delivery commit and the green-gate sha, ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. plan.commit_identity requires author `Otohime <quiinthieu@gmail.com>` and **no** Co-Authored-By trailer. The author is correct, but the trailer alone is a failure. 8955310 is the only one of the 14 `pm-256/` commits on main with a trailer. b0befb6, 543ba68, 9420077, 96be45a, 4a87fc4 and 01c5e0a are all clean.

Observed beside it, owned by the pm-270 CI lane and not by t-1560: **an intermittent `vercel deploy --prebuilt` stall.** Run 432's production job 121558261874 (a8717d8, contains 9420077) hung in `npx vercel@64 deploy --prebuilt --prod --archive=tgz` from 11:58:27 to 12:12:24Z and was cancelled ("exceeded the maximum execution time of 15m0s"). Run 414 hung in the same step for 14m10s. Runs 422 (23s) and 438 (20s) completed it. That is 2 stalls in the last 4 production jobs.

## Identities

- Delivery commits for t-1560: indexer `b0befb6d438d04d0c7541acffc0c51618fcad148`; gc-off fixtures `543ba68fb184a73232fe16e532afb31590a05e73`; refreshed fallback `9420077d06f4dec23585d543b548d5f7b49640b7`; report-only fix cycle `8955310754f89cf6eb8ed6d1a9ac4bbeedabece2` (with the trailer).
- The delivery evidence has no author.txt. Authorship was read from `git log --format='%an <%ae> %(trailers:key=Co-Authored-By)'`.
- Green gate: `gate=green sha=8955310 status=pass`. Both contract items exited 0 (16/16, build `200 of 433`).
- Tested tree: `origin/main` = `bca260a26e5cf56d574dbebde34c0ee6cc0fc565`, which contains 9420077 and 8955310. Since 9420077, `scripts/history-index.ts`, `scripts/history-index.test.ts` and `content/history.json` are byte-unchanged. `package.json` differs by one line, pm-270's test glob.

## Contract verification (this lease, at bca260a)

| check | result |
|---|---|
| `node --experimental-strip-types … --test scripts/history-index.test.ts`, 5 runs in a row | 5/5 exit 0, 16/16 each |
| `npm test` | exit 0, 2168/2168 |
| `npm run build` | exit 0. Prebuild: `history:index: git (full history): 200 of 435 commits`. 200/200 static pages, `/ryugu` static |
| `npm run history:check` on the committed fallback at HEAD | **exit 1**, `stale: 21 commits behind HEAD (at most 20)`. This is the designed staleness signal (see below) |

The build rewrote `content/history.json` in the lease, as prebuild does on a full clone. QA restored the file from git and did not commit it.

## Independent controls (real `file://` clones of otohime at bca260a, not the suite's fixtures)

| scenario | result |
|---|---|
| `--depth 1` clone | `fallback (shallow clone): 200 of 414 … unchanged`, byte-identical to the committed file (sha256 `d26ae474…`) |
| `--depth 3` clone (fallback head fe0dd82 not present) | fallback shipped unchanged, never a cut-off history |
| `--depth 22` clone (holds fe0dd82) | `spliced (shallow clone holding the fallback's head): 200 of 435`, byte-identical to the full clone |
| full clone, indexed twice | the same sha256 both times (`01024569…`), equal to the lease's build output |
| `git archive HEAD` (no `.git`) | `fallback (git history unavailable)`, exit 0, byte-identical to the fallback |
| no git on PATH (depth-1 clone, PATH = node only) | `fallback (git history unavailable)`, exit 0 |
| `--check` at b80d942 (lag exactly 20) | exit 0, `matches git and trails HEAD by 20 commits` |
| **negative:** at b80d942, rewrite the subject of line 6 (first entry) to `tampered` | exit 1, `does not match git at its own head fe0dd82eb8`. Restored, it exits 0 |
| **negative:** `--check` at bca260a (lag 21) | exit 1, `stale: 21 commits behind HEAD (at most 20)` |

Real/fake boundary: the suite's git repos are synthetic fixtures. Every row of the controls table runs the real indexer with real git 2.43 and node 22.23.3 on real clones of otohime. The fixture-flake revert control (forced detached gc) was not repeated, because no t-1560 code has changed since runs 8850 and 8858 reproduced it on this lease type.

**Lag note (not a t-1560 defect).** The committed fallback (head fe0dd82, 200 of 414) now trails HEAD by 21, and `--check` correctly reports it. Neither `prebuild` nor CI runs `--check`, so the build stays green. Production checks out at depth 1 (ci.yml:216, `actions/checkout@v7` default), so the deployed Tamatebako shows history through fe0dd82, 21 commits stale. The bound works as designed. Running `--check` in CI or using `fetch-depth: 0` on the deploy checkout is a follow-up outside t-1560's interfaces, already noted in rep-5151.

## Pipeline and deployment (GitHub Actions public HTML; anonymous API returned 403 rate-limited, `gh` absent, raw logs need a token)

Scan: pages 1–2 of `ci.yml` runs on `main`, runs 389–438 (50 runs). Older pages were not read and count as inconclusive. Page 1 (414–438) had 1 success (422), 1 failed (428), 21 cancelled, 1 running (432 at 12:07Z) and 1 waiting (438). Page 2 (389–413) had 2 successes (394, 405), 9 failed and 14 cancelled. Step times come from the public job pages (`<check-step data-conclusion data-started-at data-completed-at>`).

| run | id | sha | state |
|---|---|---|---|
| 414 | 40311256064 | 3673c50 | production: `vercel deploy --prebuilt` stalled 11:08:41–11:22:51Z, cancelled at 15m (from rep-5190) |
| 422 | 40314442551 | 0abec76 | **last green production.** Job 121548767451: `vercel build --prod` 35s, `deploy --prebuilt` **23s** (11:35:29–11:35:52Z), health green. This is what production serves |
| 428 | 40315924641 | 2992401 (first with 9420077) | failed: Footer Chromium probe (from rep-5190) |
| 432 | 40317243810 | a8717d8 (contains 9420077) | checks job 121553540394 **all green** (11:45:46–11:57:07Z, including the Footer Chromium probe, so 428's probe failure did not repeat). Production job 121558261874: pull, `vercel build --prod` (39s, runs the indexer), `db:migrate` green, then **`vercel deploy --prebuilt --prod --archive=tgz` 11:58:27–12:12:24Z cancelled**, `exceeded the maximum execution time of 15m0s`. Health step skipped |
| 433–437 | … | … | cancelled (a newer push replaced each pending run) |
| 438 | 40319672622 | bca260a (contains 9420077 and 8955310) | **success, deployed.** Checks job 121564758332: all steps green, 12:12:29–12:22:58Z (lint, typecheck, test, build, migrate, E2E, motion probe, footer walk, Footer Chromium probe). Production job 121569349661: `vercel build --prod` 33s (runs the prebuild indexer, which takes the depth-1 fallback path), `db:migrate` 3s, **`vercel deploy --prebuilt` 20s** (12:24:17–12:24:37Z), health curl green at 12:24:39Z |

**Comparison with the last green run of the same job.** Between 0abec76 (run 422) and a8717d8 (run 432), `.github/workflows/ci.yml` changed only in 2992401: the checks job's `timeout-minutes` went from 20 to 35. The production job (ci.yml:202-229) is byte-identical. The non-doc diff is `lib/ink-lab*`, `lib/print-runs*` and `content/history.json`. None of these changes the deploy upload. The prebuilt build already passed in 39s, and the stall is in Vercel's upload or finalize, inside a step that has no step-level timeout or retry. It happened in 2 of the last 4 production jobs (414 and 432 stalled; 422 and 438 finished in about 20s). That makes it an intermittent, repeated pipeline defect, owned by the pm-270 CI/production lane, not by t-1560.

## Deployment outcome in this run

| time (UTC) | observation |
|---|---|
| 12:08:04 | `/api/health` → `0abec76` (lacks 9420077) |
| 12:10:43 | run 432's production job still `In progress` in `vercel deploy` |
| 12:12:44 | job 121558261874 cancelled at 15m. `/api/health` → `0abec76` |
| 12:24:39 | run 438 production health step green |
| 12:26:35 | `/api/health` → `bca260a26e5cf56d574dbebde34c0ee6cc0fc565`. It contains b0befb6, 543ba68, 9420077 and 8955310 |

User path: no app code reads `content/history.json` yet (`grep -rl history.json app components lib` finds nothing). Its consumer, Tamatebako, is task 3 and has not been built. t-1560's deployed product is therefore the production build's prebuild index, and that ran green inside run 438's `vercel build --prod`. The live `/ryugu` returns 200 and, as expected, contains no history entries.

## Deferred checks

- **D1 (owner: software_engineer, next t-1560 fix cycle; verified by quality_engineer):** a superseding commit authored by `Otohime <quiinthieu@gmail.com>` with no `Co-Authored-By` trailer. Failure condition: any new pm-256 commit whose `%(trailers:key=Co-Authored-By)` is non-empty.
- **D2 (owner: pm-270 CI/production lane):** a bounded retry or step timeout on ci.yml:228 `vercel deploy --prebuilt`. Failure condition: a third production job cancelled at 15m inside that step. This does not block t-1560.

Fix plan: [fix_plan_run-8901.md](fix_plan_run-8901.md).
