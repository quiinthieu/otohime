# t-1562 · Fix plan · run-8975

**Cause: code.** CI run #452 (`40334420077`, job `checks` `121613911206`) on the delivery 9d65d9c failed at step 9 `Run npm test`. The last run with checks, #449 (`40330477897`, job `121601102988`) at 0740594, passed `npm test`. Between the two, `.github/workflows/ci.yml` changed only timeouts (5dcfe98: job `timeout-minutes` 35→20 plus per-step 8-minute bounds on the three browser probes, none on `npm test`). So the pipeline is not the cause. The regression came in with code commits 5dcfe98, d476bd9 or 9d65d9c.

## Steps

1. **Read the failure.** This needs a signed-in `gh`: run `gh run view 40334420077 --job 121613911206 --log-failed | grep -B2 -A30 '^not ok'`. Then fix the named test or code:
   - If it is in `app/(ryugu)/_lib/ambience.test.ts`, `lib/palace-sound.test.ts` or `app/(ryugu)/_lib/wiring.test.ts:22`, it belongs to this task. Fix it there, together with `app/(ryugu)/_lib/ambience.ts` or `lib/palace-sound.ts` as needed.
   - If it is in `scripts/probe-browser.test.mjs` or `scripts/ci-workflow.test.mjs` (5dcfe98, pm-270/t-1604) or `lib/e2e-runner.test.ts:122-124` (a ci.yml step text pin), fix that file at the named line. Note in the commit that it unblocks t-1562.
   - If the log shows a flaky timeout and `gh run rerun 40334420077 --failed` goes green, record that. Then make the test deterministic at the line the log names rather than relying on the rerun.
   - Locally, `npm test` at 9d65d9c passes 2261/2261 on darwin, on linux/arm64 and on linux/amd64 `node:22` with a depth-1 checkout (QA run-8975). Reproducing it needs the runner log, not another local run.
2. **Commit identity (D3).** Make the fix commit with `GIT_AUTHOR_NAME=Otohime GIT_AUTHOR_EMAIL=quiinthieu@gmail.com GIT_COMMITTER_NAME=Otohime GIT_COMMITTER_EMAIL=quiinthieu@gmail.com git commit` and **no** `Co-Authored-By` trailer. The lease's env otherwise wins over `git -c`. Do not rewrite 9d65d9c or 239a4e6, because that would need a force-push. The new code commit becomes the delivery sha. Write `t-1562/author.txt` with `git log -1 --format='%an <%ae>%n%(trailers)' <sha>` so QA can cite it.
3. **Run the pipeline again.** Push a commit that touches code (anything outside `projects/**` and `*.md`; report-only pushes are paths-ignored). If the change is test-only and lands on another path, `gh run rerun <new run id>` also works. Watch only that run's `checks` and then `production` jobs. Do not wait on other plans' runs.
4. **Delivered when:** `checks` is green; `production` deploys; `curl https://otohime.dev/api/health` returns a sha with `git merge-base --is-ancestor <new delivery sha> <live sha>` exit 0; and `curl https://otohime.dev/ryugu` contains `Sea sound: off`. A failing `scripts/vercel-deploy.sh` `inspect exited 1` (runs #445, #449; pm-270) is reported beside this, not waived.

## Verification for the fix cycle

`npm test`, `npm run lint` and `npm run build` must exit 0 (the build from a space-free APFS clone with `.next` removed). The CI run on the new delivery sha must be green, and the deployed sha must contain it.
