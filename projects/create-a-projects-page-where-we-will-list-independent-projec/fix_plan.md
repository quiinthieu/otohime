# Fix plan: t-1018 not deployed (run-6006)

Cause: **environment**. The code needs no change. e097b14 passes every step of
the CI `checks` job locally, e2e included (see [qa_report.md](qa_report.md)).
Production has not deployed any push to main since 6456dd7 (about 16:31Z),
and `.github/workflows/ci.yml` has not changed since then.

## What is wrong

The `CI` workflow on main has not finished `production` for d5a6575, 6b9f21a
or e097b14. A normal run took about 4 minutes. Without Actions access, the
step that stopped cannot be named from the outside. These are the
candidates, in order of likelihood:

1. **Runs queued behind a stuck run.** `.github/workflows/ci.yml:11-13` puts
   every main push in the group `ci-refs/heads/main`, with
   `cancel-in-progress: false`. If one run waits on a runner (`runs-on:
   ubuntu-latest`, lines 30 and 148) or on Actions minutes, the runs behind
   it keep queueing.
2. **The `production` job fails on a secret.** `VERCEL_TOKEN` or
   `DATABASE_URL_UNPOOLED` might have expired. The job reads `VERCEL_TOKEN`
   at `.github/workflows/ci.yml:151` and `DATABASE_URL_UNPOOLED` at line 170.
   It migrates at lines 168-170 and deploys at line 171.

## Steps

1. Open https://github.com/quiinthieu/otohime/actions?query=branch%3Amain.
   Find the run for `e097b14` and the step that is pending or red.
2. If it is queued or pending with no runner: cancel the stuck older run
   (d5a6575 or 6b9f21a). The main group then moves on to e097b14. If Actions
   minutes or billing are exhausted, restore them, then "Re-run all jobs" on
   e097b14.
3. If `production` is red on `vercel pull`, `vercel deploy` or `db:migrate`
   with an auth error: rotate `VERCEL_TOKEN` or `DATABASE_URL_UNPOOLED` in
   Settings → Secrets and variables → Actions, then "Re-run failed jobs".
4. If `checks` is red: compare the failing step with the last green run
   (6456dd7). The code and config are identical, so look for a runner image
   or service-container change (`postgres:17-alpine`, line 34). Re-run.
5. Ready when `curl -s https://otohime.dev/projects` returns 200 and contains
   "Nothing on the bench yet". QA then cites the deployed sha (it must contain
   e097b14) and the green run.

Lasting fix for visibility: give QA job pods a read-only GitHub token
(`actions:read` on quiinthieu/otohime), so they can read run status directly
instead of inferring it from the production site.

## Still open at 18:02Z (run-6018)

The cause, the files and the steps above are unchanged: `/projects` is still
404 and `/` still serves the 6456dd7 console. Re-raised as the operator
action `sign-in-required:ci-provider:quiinthieu-otohime` with the same ready
probe (`https://otohime.dev/projects`, 200, body contains "Nothing on the bench
yet"). The probe relaunches QA as soon as a person re-runs CI on main.
