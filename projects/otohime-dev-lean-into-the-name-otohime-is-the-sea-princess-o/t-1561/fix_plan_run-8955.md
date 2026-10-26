# t-1561 fix plan (run-8955)

**Cause: environment.** The Tamatebako delivery at `e3852eb` is correct: every contract check and independent control is green (qa_report_run-8955.md). What is missing is a production deploy that contains it. `/api/health` serves `542c620` (13:24:45Z and 13:31:04Z), and 542c620 is 10 commits behind e3852eb.

## Why it is not live

- e3852eb's own CI run, 446 (id 40328785684), was cancelled before it started because a newer push replaced it as the pending run of `ci-refs/heads/main`. That is the concurrency at `.github/workflows/ci.yml:14-24`. Runs 447 (acd85de) and 448 (ec59663) went the same way.
- Run 449 (id 40330477897, sha 0740594, which contains e3852eb) is **pending** behind run 445 (id 40328273755, 5577ec5). Run 445's `checks` job took 18 minutes (13:11:42–13:29:38Z) and its `production` job started at 13:29:40Z. Run 449 cannot deploy before about 13:52Z, past this run's 15-minute waiting limit.

## Comparison with the last green run of the same job

The last green production deploy is run 444 (542c620). Two CI configuration commits sit between 542c620 and e3852eb/0740594:

- `5577ec5` (pm-270/t-1605):
  - `ci.yml:79` adds `bash scripts/vercel-deploy.test.sh` to checks.
  - `ci.yml:237-238` replaces `vercel deploy --prebuilt` and the health curl with `scripts/vercel-deploy.sh` (bounded upload and readiness, then `/api/health` must report `$GITHUB_SHA`).
  - The production timeout went 15 → 12 minutes.
- `ec59663` (pm-249/t-1569):
  - `ci.yml:81` adds `bash scripts/verify-deploy.sh --self-test` to checks.
  - `ci.yml:241-242` adds the "Verify the deployed sha, terminal and press" step (`EXPECT_SHA="$GITHUB_SHA" bash scripts/verify-deploy.sh https://otohime.dev`).
  - The production timeout went 12 → 18 minutes.

**Observed at 13:33Z: run 445's production job 121600218178 failed.** Step 8, "Deploy and verify the served sha" (`ci.yml:237-238`), ran 13:31:07–13:31:18Z (11 s). Its annotation reads `vercel deploy: Error (inspect exited 1) https://otohime-rcix516b1-otohime.vercel.app`. `/api/health` still serves 542c620 (13:33:35Z), so that deployment never went live. The deployment URL is behind Vercel SSO and the raw job log needs a GitHub session; I could read neither.

This is the first real run of `scripts/vercel-deploy.sh`. The last green production job, run 444, used the old synchronous `npx vercel@64 deploy --prebuilt --prod --archive=tgz` step. Run 449 (the one carrying e3852eb) runs the same new step, plus ec59663's verify step, so a deterministic failure there would keep e3852eb, and every other delivery, off production. I have one observation, not yet a repeat.

Two points in the script to check first (owner pm-270, task t-1605; t-1605 had `qa: skip`, so no QA saw a real deploy):

- `scripts/vercel-deploy.sh:85` runs `npx vercel@64 inspect "$url" --wait --timeout 6m --logs`, which exited 1 within about 10 s of the upload. Combining `--wait`, `--timeout` and `--logs` on `inspect` has never run against real Vercel; the fake-npx test only fakes it. Check it with `npx vercel@64 inspect --help` on 64.x, and rerun it by hand on the failed URL with a token.
- `scripts/vercel-deploy.sh:92` takes the first `error|ready|…` word *anywhere* in the second inspect's output (`grep -Eiow … | head -n 1`). A CLI message such as "Error: unknown or unexpected option" reads as deployment state "Error", so the annotation may not be the deployment's real state. Parse only the `status` line.

How the pipeline runs again: if run 449's production fails with the same annotation, the fastest reversible repair is for pm-270 to put back run 444's step at `ci.yml:237-238`. That is `npx vercel@64 deploy --prebuilt --prod --archive=tgz`, followed by a sha-asserting health check, keeping `ci.yml:241-242`'s verify step, until the script's inspect call is fixed. Then push that change to main; that code push queues a fresh run that deploys e3852eb as well. Re-running only the failed job of run 449 from the Actions page also deploys 0740594, once the step is fixed or if the failure was transient.

Neither CI change touches t-1561 files.

## Change

- **No change to t-1561 files.** The 11 files of e3852eb (`app/(ryugu)/_components/tamatebako.tsx`, `_lib/tamatebako.ts` and its test, `ryugu/page.tsx`, `ryugu.css`, `e2e/ryugu.test.ts`, …) stay as they are.
- **No push to `main` to "kick" CI.** A push only replaces the pending run (`ci.yml:14-24`). This QA run's own report commit is `projects/**` and `**.md` only, so `ci.yml:10-12` `paths-ignore` never queues it. Run 449, or any later main run, deploys e3852eb.

## If run 449 (or the next deploying run) fails

Read its job annotations first.

- **Failure in `production` at `ci.yml:238` (`scripts/vercel-deploy.sh`)** with `::error title=vercel deploy::<state> <url>`: that is pm-270/t-1605's deploy script. Run 445's production job 121600218178 already failed this way once, so a second failure makes it a repeated, deterministic defect. Apply the repair above (`scripts/vercel-deploy.sh:85` and `:92`, or restore run 444's step at `ci.yml:237-238`), then push the change to main or re-run the failed job. Owner: pm-270.
- **Failure at `ci.yml:242` (`scripts/verify-deploy.sh`)** after a successful deploy, on the terminal or press e2e: that is pm-249/t-1569's step. The site is already live at that point, so re-read `/api/health` before treating it as a t-1561 problem. Owner: pm-249.
- **Failure in `checks` inside `npm test` or the e2e step on a `tamatebako` / `ryugu` test**: that is t-1561 code. Start from the annotation's file:line in `e2e/ryugu.test.ts:284-394` or `app/(ryugu)/_lib/tamatebako.test.ts`. On this lease the same tests pass: 12/12 e2e, 8/8 unit.

## Proof the next QA run must show

1. The `https://otohime.dev/api/health` `sha` passes `git merge-base --is-ancestor e3852eb46f06192140c7ff292e78444c736e4467 <sha>`. Cite the CI run id that deployed it, and that it succeeded.
2. Run `BASE_URL=https://otohime.dev REPO=<checkout at the deployed sha> node projects/otohime-dev-lean-into-the-name-otohime-is-the-sea-princess-o/t-1561/qa_run-8955/probe.mjs` (TMPDIR=/tmp; the probe must live in the repo tree). Its expected output is PASS: every live scrubber position matches `git show`, and the paper ages at every step. On production the index may be the committed fallback if Vercel's clone is shallow, so the head may lag the deployed sha. Record the lag. It is not a t-1561 failure unless the leaves fail to match git.
3. Live reduced-motion open: no `[data-smoke]` node (as in `e2e/ryugu.test.ts` test 12, against BASE_URL=https://otohime.dev).
