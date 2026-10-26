# t-1560 fix plan (run-8875)

Plan pm-256. Role: quality engineer. Companion to [qa_report_run-8875.md](qa_report_run-8875.md).

**Cause: environment.** The t-1560 code (b0befb6, 543ba68) and the delivery 9420077 passed every check on this lease and in CI's checks job. In run 414, the real production build ran the indexer and passed in 31s. What is missing is a production deploy of a commit that contains 9420077.

## What is wrong and where

1. **Nothing in t-1560's files.** `scripts/history-index.ts`, `scripts/history-index.test.ts`, `package.json` and `content/history.json` stay as they are.
2. **The deploy queue.** `.github/workflows/ci.yml:11-13` (`concurrency: ci-refs/heads/main`, one pending run) cancelled the runs of 9420077 (425) and d7fae5d (427). The first run that carried 9420077, 428 (40315924641), failed at `.github/workflows/ci.yml:116-122` ("Footer Chromium probe", `scripts/probe-end.sh`). The same step passed at 0abec76 in run 422, and it passed locally at 2992401 (153 functional checks ok). No t-1560 line can change that outcome.
3. **Run 414's production timeout** was a stall in `npx vercel@64 deploy --prebuilt` (ci.yml:216), 14m10s against 23–26s in runs 405 and 422. It was transient.

## How the pipeline runs again

- Run 432 (40317243810, a8717d8) is already running and contains 9420077, and so does every later `main` run. Nothing needs to be pushed to start it.
- If 432 fails at "Footer Chromium probe" again: the failing job's annotations are public. Re-run the failed job (`gh run rerun 40317243810 --failed`, run by a role with a token), or let the next `main` push requeue it. A second failure at the same step is a repeated defect for the footer probe owner (pm-241 / pm-270 CI lane plan): file it against `scripts/probe-end.sh`, not t-1560.
- If a production job times out in `vercel deploy --prebuilt` again: re-run the failed job. A repeat stall is for the CI lane plan (pm-270), at ci.yml:194 (job timeout) or ci.yml:216 (the deploy command), not t-1560.


## Do not

- Change `scripts/history-index.ts`, `scripts/history-index.test.ts`, `package.json` or `content/history.json` for this. No t-1560 code is wrong.
- Push empty commits to kick the pipeline. Any push to `main` replaces the pending run, and the replacement still contains 9420077.

## Next QA proof

1. `curl https://otohime.dev/api/health` returns a sha for which `git merge-base --is-ancestor 9420077 <sha>` succeeds.
2. Cite the id of the CI run that deployed it, with its production job's `vercel deploy --prebuilt` step green.
3. Repeat the contract command and `npm run build` (exit 0), plus one real-clone control: depth-1 output byte-identical to the committed fallback.
