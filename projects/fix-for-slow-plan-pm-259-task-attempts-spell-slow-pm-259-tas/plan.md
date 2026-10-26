# Main Lane Throughput (pm-270)

Fix for slow plan pm-259: otohime's main CI and production deploy lane delivers too rarely, so every plan's QA records cause=environment against it. Evidence is in [research_run-8877.md](research_run-8877.md).

## State at planning time (2026-10-26)
- The lane is starved and flaky, not dead: main HEAD de8ee71 was ahead of the live sha 0abec76 only by commits that are mostly report-only. The idea's proof (a main run with green checks and production whose live sha contains 9ddd084) held at 11:37Z from run 40314442551, before any change here. This plan therefore targets throughput and reliability, not a rebuild.
- `.github/workflows/ci.yml` on main already has `checks.timeout-minutes: 35` (pm-259/t-1583, 2992401). That number was a guess (the 14-minute stall is three silent installers), so task 2 removes the stall and restores a measured budget.

## Decisions
1. Report-only pushes (`projects/**`, `**.md`) are excluded with `on.push.paths-ignore`. `queue: max` is rejected: with ~12 pushes/hour and 11-minute checks it builds an unbounded backlog that deploys older shas after newer ones. Generated files (`content/history.json`, `public/ask-index.json`) stay in scope. Deployed sha will lag main by report commits; QA judges by `git merge-base --is-ancestor <delivery> <live sha>`.
2. The motion/footer probes drop the three network installers in CI and use the repo's locked `playwright-core@1.64.0` with the runner's Chrome (`channel: "chrome"`), as `e2e/` already does. The temp-prefix install stays as the local fallback, wrapped in `timeout`. Runner pinned to `ubuntu-24.04` until 26.04 is run deliberately. Each browser step gets a step-level `timeout-minutes` so a stall names its step instead of cancelling the whole job.
3. The Vercel deploy is bounded and self-diagnosing; the health check asserts the sha. Reading the 11:08Z deployment in the dashboard needs a person and is not a prerequisite: task 3 raises it as an advisory `operator_action` (fingerprint `vercel-dashboard-read:otohime-2026-10-26T11:08Z`) at its start, and its work does not wait on it.
4. The desk swipe flake (e2e/desk.test.ts:597) is repaired by making the helper observe its preconditions, following pm-258's fix_plan_run-8849.md. No assertion is quarantined unless the trace proves an environmental cause.
5. No task waits for a soak or natural run. Each proves its claim now with a fake `npx`, a script run, or a local build. The live proof (a main run after the fix, live sha containing 9ddd084) is acceptance's: read from the public jobs API and `https://otohime.dev/api/health`, not from a summary.

## Tasks
1. **CI: report-only pushes stop entering the main queue** (`.github/workflows/ci.yml`): `paths-ignore`, `runs-on: ubuntu-24.04` for checks and production, comment on the one-pending-run behaviour.
2. **CI: probes use locked playwright-core and the runner's Chrome** (`scripts/probe-motion-signed-in.{sh,mjs}`, `scripts/probe-end.{sh,mjs}`, `.github/workflows/ci.yml` budgets): shared `scripts/probe-browser.mjs` loader; installers only as local fallback, bounded by `timeout` with timestamps; step-level `timeout-minutes`; checks budget back to 20 with a comment citing measured steps.
3. **CI: bound and diagnose the Vercel production deploy** (`.github/workflows/ci.yml`, new `scripts/vercel-deploy.sh` and its test): `--no-wait`, `inspect --wait --timeout`, one upload retry, public `::error`, sha-asserting health check, production budget 12 min. Shell test with a fake `npx` proves a hang fails within the bound.
4. **E2E: desk swipe observes its preconditions** (`e2e/desk.test.ts`): tape in viewport, `[data-dragging]` set after the first move, cleared after touchEnd, bounded event trace in the failure message; if pm-258 already landed the same change, only verify and add what is missing.

Order: tasks 1, 2, 3 and 4 touch disjoint code except `ci.yml` (1, 2, 3), so 2 and 3 depend on 1 to avoid merge conflicts on the same file; 4 is independent.

## Proof (acceptance, not a task)
A main push after tasks 1-3 whose checks and production jobs both succeed, with the signed-in motion probe step under 120 s and the deploy step under 90 s in the public jobs API (`/repos/quiinthieu/otohime/actions/runs/<id>/jobs`), and `curl https://otohime.dev/api/health` returning that run's sha (which contains 9ddd084). Negative control: a push that only adds a file under `projects/` creates no run (`actions/runs?branch=main`).
