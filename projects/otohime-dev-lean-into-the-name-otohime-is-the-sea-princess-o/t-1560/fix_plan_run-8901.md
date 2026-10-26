# t-1560 fix plan (run-8901)

Cause: **code**. The delivered fix-cycle commit `8955310754f89cf6eb8ed6d1a9ac4bbeedabece2` breaks plan.commit_identity because its message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. 9420077 is now deployed (run 438, `/api/health` = bca260a at 12:26:35Z), so deployment no longer blocks t-1560. A recurring Vercel deploy stall remains as a pm-270 CI-lane defect (item 2).

Do not change `scripts/history-index.ts`, `scripts/history-index.test.ts`, `package.json` or `content/history.json`. They pass every contract check and every real-clone control (qa_report_run-8901.md).

## 1. Commit identity (t-1560, software engineer)

- Do not rewrite 8955310: force-pushing main is forbidden. Supersede it instead.
- Make one fix-cycle commit, report-only under `projects/otohime-dev-lean-into-the-name-otohime-is-the-sea-princess-o/t-1560/` (summary.md and commits.txt). Commit it as:
  `git -c user.name=Otohime -c user.email=quiinthieu@gmail.com commit -F msg.txt`
  `msg.txt` must have no `Co-Authored-By` line. Do not use a commit helper that appends attribution.
- In `t-1560/commits.txt` line 4 (the 8955310 entry), replace `<this commit>` with `8955310754f89cf6eb8ed6d1a9ac4bbeedabece2` and add `(identity defect: Co-Authored-By trailer, superseded by run-<next>)`. Add the new commit as line 5.
- Before pushing, run `git log -1 --format='%an <%ae>|%(trailers:key=Co-Authored-By,valueonly)'`. It must print `Otohime <quiinthieu@gmail.com>|` with nothing after the bar. Then check 0 hits from `git log origin/main..HEAD --format=%B | grep -c Co-Authored-By`.
- Restore the build-regenerated `content/history.json` before committing (`git checkout content/history.json`), so that ci.yml paths-ignore keeps the push out of the main queue.
- Proof required: the contract test command exits 0 and `npm run build` exits 0 on the lease, plus the two identity checks above.

## 2. Intermittent vercel deploy stall (environment, pm-270 CI/production lane; no t-1560 change, does not block t-1560)

- Failing step: `.github/workflows/ci.yml:228`, `- run: npx vercel@64 deploy --prebuilt --prod --archive=tgz`. In run 432 (40317243810, job 121558261874) it hung from 11:58:27 to 12:12:24Z until the job's `timeout-minutes: 15` (ci.yml:206) cancelled it. Run 414 hung in the same step for 14m10s. In the last green run of the same job, 422 (job 121548767451), the step took 23s. The production job is byte-identical between 422 and 432. The only ci.yml change between them is 2992401's checks-job timeout (ci.yml:31-32).
- Fix for the lane owner (pm-270), at ci.yml:228: put the deploy in a bounded retry, for example `for i in 1 2 3; do timeout 240 npx vercel@64 deploy --prebuilt --prod --archive=tgz && break; [ "$i" = 3 ] && exit 1; done`. Or add a step-level `timeout-minutes: 5` and a second attempt. Either way, one stalled upload no longer spends the whole 15m budget and cancels the deploy.
- Current state: run 438 (40319672622, bca260a) deployed at 12:24:37Z (`vercel deploy --prebuilt` took 20s), so 9420077 is live. No rerun is needed for t-1560. If a later production job stalls, run `gh run rerun <run-id> --failed`. The next main push that touches code also requeues the job.
- QA proof next time (t-1560): the identity checks from item 1 on the superseding commit; the contract command and `npm run build` exit 0; one depth-1 real-clone control; and `/api/health` still an ancestor-check pass for 9420077. The report-only commit will not redeploy, which is expected.

## Note (not a fix item)

At HEAD bca260a, `npm run history:check` exits 1: the fallback trails HEAD by 21 commits, against a MAX_LAG of 20. This is the designed staleness signal and fails no build. Do **not** refresh `content/history.json` in the identity commit, because that would requeue CI for a report-only fix. Refreshing the fallback with `npm run history:index` can ride along with the next code push.
