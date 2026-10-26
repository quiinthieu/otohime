# Research: the otohime main CI and production lane (pm-270, run-8877)

Submitted as rep-5185 (profile claude-fable-high, claude-fable-5-1, effort high). Read 2026-10-26 11:31Z-11:40Z from the public GitHub Actions API (job logs answer 403; the 60 calls/hour quota ran out 11:36Z), the local clone, task-rescue/pm-259-t-1583-run-8848 @ b3358e1, and https://otohime.dev. Not read: any raw job log, the Vercel deployment record for 11:08Z (needs VERCEL_TOKEN), the runner image version of any job.

## Headline: the lane is starved and flaky, not dead
- At 11:37:53Z `/api/health` and the `build-sha` meta served 0abec76 (run 40314442551, checks 11m17s, production 1m42s). 0abec76 contains 9ddd084, 841ca69 and ae4607d, so the idea's proof condition already held at 11:37Z. The previous success was ae4607d at 10:30Z: the lane stalled for 67 minutes.
- Judge deployment by ancestry of the live sha, not by one task's cancelled run.

## Numbers (100 most recent main push runs, 02:56Z-11:30Z, total 408)
cancelled 49, failure 43, success 6, pending 2. By pushed content: report-only 56 runs (31 cancelled, 18 failure, 5 success), mixed 30 (11/19/0), code-only 14 (7/6/1). A passing checks job takes 10-11 min (E2E 230-300 s, signed-in motion probe 171-180 s, footer probe 55 s); production ~1m50s. About 12 pushes per hour.

## Defect 1: motion-probe stall (run 40307460821, job 121521479367)
Step "Motion probe, signed in" ran 10:35:59Z-10:50:25Z (866 s) and was cancelled by the 20-minute budget; 171 s and 180 s in green jobs. run-8848 read the raw log: database readiness 10:35:59.9Z, first browser assertion 10:50:06.8Z. `scripts/probe-motion-signed-in.sh` does three things in between, output redirected to files: `npm i --prefix $WORK/playwright playwright@1.64.0`, `playwright install chromium --only-shell --with-deps` (apt-get update/install plus a CDN download), and the first sign-up fetch (bounded by a 10 s rate window). The stall is a hung npm registry, apt mirror or CDN; which one is not recoverable. `ubuntu-latest` is migrating to Ubuntu 26 (actions/runner-images#14748, 2026-10-19 to 2026-11-19), an uncontrolled variable for `--with-deps`.
Fix: the repo locks `playwright-core@1.64.0` and e2e launches the runner's Chrome with `chromium.launch({ channel: "chrome" })`. Make the probes do the same, keep the temp-prefix install only as a fallback when no Chrome is found, bound each remaining installer with `timeout` and print timestamps. Pin `runs-on: ubuntu-24.04`.

## Defect 2: Vercel production deploy hang (run 40311256064, job 121537521859)
checks succeeded 11:07:36Z; production: pull 13 s, build 31 s, migrate 3 s, then `npx vercel@64 deploy --prebuilt --prod --archive=tgz` ran 11:08:41Z until the 15-minute timeout (850 s). The step takes 26 s normally. No Vercel status incident 2026-10-25/26. The deployment's state is readable only with VERCEL_TOKEN.
Fix (bounded, self-diagnosing): `url=$(timeout 300 npx vercel@64 deploy ... --no-wait)`; `timeout 420 npx vercel@64 inspect "$url" --wait --timeout 6m --logs`; on failure emit `::error title=vercel deploy::<state> <url>`; retry the upload only if it created no deployment; health check asserts `"sha":"$GITHUB_SHA"`; production `timeout-minutes` 12.

## Defect 3: queue starvation and E2E failures
`concurrency` keeps one pending run per group and replaces it with each newer push; 56 of 100 pushes were report-only. Fix: `on.push.paths-ignore: ["projects/**", "**.md"]` (do not use `queue: max`). The deployed sha will lag main by report commits; judge by ancestry.
E2E: only 841ca69 (run 40310239199) has a readable assertion (the `::error` reporter was added in that commit): `e2e/desk.test.ts:597`, "the swipe dragged music: 0.3 is not 0.425". 0.3 is music's default x, so the drag was never committed (pointercancel or an early return in onPointerDown with `press.current` still set). The test passed on identical sources in 4 green runs: a timing flake. The t-1564 fix plan (fix_plan_run-8849.md) owns the repair: make `swipe()` observe its preconditions and keep a bounded event trace. The five earlier failures (15fd171, 4059b63, 0a32605, b73d93c, 9d0fba4) are unreadable; presumed the Kame `clock.install()` real-time flow fixed in 841ca69. Future reds: `GET /repos/quiinthieu/otohime/check-runs/<job id>/annotations`.

## Already in flight
- task-rescue/pm-259-t-1583-run-8848 @ b3358e1 raised `timeout-minutes` 20 to 35 (main now has 35 via 2992401); it does not explain the stall.
- pm-258/t-1564 owns the desk swipe helper repair.
- pm-259/t-1583 is deployed as of 0abec76.
