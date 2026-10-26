# pm-276 research (run-9002): restore delivery on otohime main

## Summary

Three defects, all confirmed. Two are fixed by patches verified on this lease (saved beside this file as `end-test.patch` and `vercel-deploy.patch` under the lease's shared/artifacts); the third is split between an in-repo guard and a fleet-side change that otohime cannot make.

1. **Checks job red since 5dcfe98.** `npm test` fails one test on ubuntu-24.04: `lib/end.test.ts` test 11 ("walk-end.sh, probe-end.sh and CI checks wire the footer verification suite and handle unset, empty and long TMPDIR"), at the stubbed-npm BASE_URL case, `130 !== 1`. Cause: the fixture inherits the runner's `CI=true`, and since 5dcfe98 `scripts/probe-end.sh:211` skips every installer when CI is set and `google-chrome` is on PATH, so the stub `npm` is never reached, the real probe runs, and execFile's 10 s SIGTERM becomes exit 130 through the script's trap. Reproduced here on macOS with `CI=true` and a fake `google-chrome` first on PATH; shapes without CI or without chrome pass, which is why every lease and node:22 container was green. Runs 452 to 458 (40334420077 through 40340641001) all fail at checks step 10 and skip production.
2. **Production job red even when the deploy lands.** `scripts/vercel-deploy.sh:102-114` turns any non-zero `vercel inspect --wait` into `::error` and exits before the health check, and c1b26f1's fixture pins that ("failed inspect stops before health even for a matching sha"). Upstream `vercel inspect` exits 1 only for readyState ERROR/CANCELED or an uncaught CLI error (scope lookup, deployment fetch, 429), so a Ready deployment can still exit 1. Runs 445 and 449 did exactly that while 0740594 went live.
3. **Commit identity.** This lease (billie-mac, capability `commit-identity`) exports `GIT_AUTHOR_NAME=Claude Code`, `GIT_COMMITTER_NAME=Claude Code`, both emails `noreply@anthropic.com`, and env beats `git -c user.*`. In the last 60 main commits: 38 are Otohime <quiinthieu@gmail.com> on both fields, 17 are noreply@anthropic.com on both, 3 are authored otohime@users.noreply.github.com, 1 is otohime@example.invalid, and 23 carry a Co-Authored-By trailer. Two code commits waiting to deploy (ae6573a, 9d65d9c) carry trailers.

Live now: `/api/health` serves 0740594; `/api/guestbook` returns 404 HTML. Nine code commits on main are undeployed: ae6573a, c121b20, c1b26f1, 658f6fc, 9ada4e1, c0368d1, 9d65d9c, d476bd9, 5dcfe98.

## 0. Ownership map (read this first)

Three plans now point at the same 21-line test fix. The board state as of 14:40Z:

| File | Live owner | pm-276 action |
|---|---|---|
| `lib/end.test.ts` | pm-273/t-1612, status fixing, fix cycle 2, fix_plan rep-5271 names exactly this change; pm-275 research rep-5269 proposed the same patch | Do not touch. The verified patch is `end-test.patch` for that SWE to use. |
| `scripts/vercel-deploy.sh`, `scripts/vercel-deploy.test.sh`, `.github/workflows/ci.yml` | pm-270/t-1605 (ready, at its gates) holds the footprint; pm-275 (drafting) recommended a different rewrite | pm-276 owns the served-sha gate (patch verified here). Sequence behind t-1605 or have t-1605 absorb it; do not open a third version. |
| npm test annotations in ci.yml | nobody | pm-276 |
| commit identity guard in ci.yml | nobody (658f6fc guards guestbook paths only) | pm-276, author-only on code paths, trailers as ::warning |
| fleet export of GIT_AUTHOR_*/GIT_COMMITTER_* and push refusal | build-worker (mono-v2) | idea filed from this run; out of otohime's reach |

Order of events that unblocks every otohime QA: pm-273's fix push lands the test fix (checks green), then the first green checks run still ends in a red production job unless the vercel-deploy patch is on main by then. Both can ride one push if pm-273's SWE is pointed at `vercel-deploy.patch` too, but that crosses t-1605's footprint; the cheaper call is to let pm-276's task land right after.

## 1. Checks job: mechanism, proof, fix

`lib/end.test.ts:319-339` runs `scripts/probe-end.sh` in BASE_URL mode against a local 200 server with a stub `npm` first on PATH, inheriting `process.env`, under `execFile(..., { timeout: 10_000 })`. It asserts exit 1 and `RESOLVED_TMPDIR=...` on stdout, which only the installer branch prints.

`scripts/probe-end.sh:211` (5dcfe98): `if [ -n "${CI:-}" ] && command -v google-chrome; then unset PW_PREFIX ... else npm i playwright ...`. On the runner CI is `true` and `/usr/bin/google-chrome` exists, so the stub is bypassed and `node scripts/probe-end.mjs` launches Chrome against the stub server until the 10 s bound; `trap 'exit 130' INT TERM` gives 130.

Reproduction on this lease (darwin arm64, node 22.12, no real Chrome):

| Shape | Result on unpatched file |
|---|---|
| `CI=true`, fake `google-chrome` on PATH | not ok 11, `130 !== 1` |
| no CI, no chrome (macOS lease) | 11/11 |
| `CI=true`, no chrome (node:22 container) | 11/11 |

Patch (`end-test.patch`, 21 lines, test only, probe scripts unchanged): `delete ciEnv.CI` in the stub-npm loop, plus one runner-branch case with a fake `google-chrome` and a fake `node` (exit 7) asserting `# browser: runner Google Chrome 999.0.0.0 ...`, no `RESOLVED_TMPDIR`, and the hand-off to `scripts/probe-end.mjs`. Results on the patched file: 11/11 in all three shapes. Mutation control: re-enabling CI inheritance makes shape A fail again. No unit test executes `probe-motion-signed-in.sh` (lib/motion.test.ts only reads it), and the full `CI=true npm test` here had no other failure (2315/2315 before the patch, because this lease has no google-chrome).

Readability without sign-in: `scripts/e2e-annotate.mjs` already exists for the E2E step. Running the red shape with `--test-reporter=./scripts/e2e-annotate.mjs --test-reporter-destination=stdout` beside the tap reporter produced `::error file=lib/end.test.ts,line=226,title=E2E failed%3A walk-end.sh...::AssertionError ... 130 !== 1` and a `## E2E failures` section in `$GITHUB_STEP_SUMMARY`. Wiring it into the `npm test` step (or `package.json`'s test script under `GITHUB_ACTIONS`) with the title prefix made generic ("Test failed:") makes every future red checks job name its assertion on the public run page.

## 2. Production job: mechanism, fix, why option 2a

Script flow today: bounded `vercel deploy --no-wait` (300 s), bounded `vercel inspect --wait --timeout 6m --logs` (420 s), on non-zero one plain `inspect` re-read, then `fail` with the status-field state and both outputs, never reaching the health poll. Upstream `packages/cli/src/commands/inspect/index.ts`: exit code is `exitCode(readyState)` (1 only for ERROR/CANCELED), `getScope` handles only NOT_AUTHORIZED/TEAM_DELETED and rethrows the rest, `getDeployment` is uncaught; any thrown error prints `Error: ...` and exits 1. Runs 445 (40328273755) and 449 (40330477897) failed both inspect calls with the pre-c1b26f1 word-grep reporting "Error", while the alias moved to the new deployment. The exact CLI message is behind a GitHub sign-in and no lease has a Vercel token (run-8982: api.vercel.com 403 missingToken), and it does not need to be known.

Patch (`vercel-deploy.patch`, 121 lines, verified `# all checks passed`, 35 checks, perl bounded fallback):

- `fail`'s escaping becomes `escape()`, shared with a new `warn()` that prints `::warning title=vercel deploy::...`.
- After a non-zero inspect: `warn "<state> (inspect exited N) <url>; deciding by the served sha<diagnostic>"`; if the status field says Error/Canceled/Cancelled, `fail` as before; otherwise set `HEALTH_ATTEMPTS=$HEALTH_ATTEMPTS_UNVERIFIED` (default 42 x `HEALTH_POLL_DELAY` 10 s = 7 min, the readiness budget inspect did not spend) and continue.
- The final health `fail` appends `; <inspect note><diagnostic>` so a red job still shows both outputs.
- Fixture: hang-inspect with the sha served exits 0 with the ::warning and no ::error; hang-inspect with another sha fails after 3 (test-scoped) attempts naming `Building after 2s`; diagnostic-inspect and unavailable-inspect pass with the sha served and keep the escaped diagnostic in the warning; new `unavailable-stale` fails with both diagnostics; errored deployment still never reaches health; upload, healthy, other-sha, unreachable and missing-sha cases unchanged.

Why not pm-275's synchronous `vercel deploy` plus long health poll: it re-opens the blocking-deploy hang that run 40311256064 showed (850 s with no health check) and that `--no-wait` was introduced for, and it throws away c1b26f1's diagnostic capture. Option 2a changes the verdict rule only. `ci.yml` needs no change; the 18-minute production timeout covers 2 min setup, 5 min upload bound, 7 min readiness (inspect or health), and the verify step.

## 3. Commit identity

Observed: this run's env (plan with no commit_identity) exports Claude Code/noreply@anthropic.com for author and committer. c0368d1 (pm-273, worker avietidol-z490, profile codex-sol-medium) has author otohime@users.noreply.github.com with committer quiinthieu@gmail.com, so the agent or its CLI set `--author`/config while the committer env was right: an export alone does not stop that. 0b1a1b9 and 6ca9652 are pm-260 planning commits with the platform default author; they only break a repo-wide expectation.

What otohime can do: generalise the 658f6fc step. For every commit in the push range that touches a non-report path (anything outside `projects/**` and `*.md`), require author and committer `Otohime <quiinthieu@gmail.com>`; print `::warning` for a Co-Authored-By trailer. Trailers must stay a warning until the fleet stops adding them, or ae6573a-style pushes go red on the day the pipeline is finally green. Unit-test the step's shell as a function in `scripts/` against a git fixture (as `scripts/ci-workflow.test.mjs` and `verify-deploy.sh --self-test` do).

What only the fleet can do (mono-v2 build-worker): export `GIT_AUTHOR_NAME/EMAIL` and `GIT_COMMITTER_NAME/EMAIL` from the plan's commit_identity on every lease of that plan (and a repo default for plans without one), strip `Co-Authored-By` from the agent CLI's commit template, and install a lease `pre-push` hook that refuses a push whose range contains a commit with another author/committer or a Co-Authored-By trailer. Filed as an idea (repo mono-v2) from this run.

## 4. Done criteria and how QA reads them

- One main push whose checks job and production job are both green: read `https://github.com/quiinthieu/otohime/actions/runs/<id>` (status and annotations) and `/job/<id>` (per-step `data-conclusion`) anonymously.
- `https://otohime.dev/api/health` reports a sha that **contains** 658f6fc (`git merge-base --is-ancestor 658f6fc <live>`), never an exact match: the pending-run replacement and paths-ignore make exact shas unreachable.
- `GET https://otohime.dev/api/guestbook` returns 200 JSON `{entries,nextCursor}` (404 HTML today).
- pm-273's next QA cites that live sha.

## 5. Tasks for the product owner (build contracts)

**T1 (pm-276): production job decides by the served sha.** Apply `vercel-deploy.patch` to `scripts/vercel-deploy.sh` and `scripts/vercel-deploy.test.sh`. Footprint overlaps pm-270/t-1605; sequence after it or edit t-1605. Verification: `bash scripts/vercel-deploy.test.sh` prints `# all checks passed`; its output has 35 `ok -` lines; `npm test` exit 0; the pushed run's production job green and `/api/health` containing the push sha by ancestry.

**T2 (pm-276): red checks jobs name their test publicly.** In `.github/workflows/ci.yml` run `npm test` with the tap reporter to stdout plus `scripts/e2e-annotate.mjs` to stdout when `GITHUB_ACTIONS` is set (or add the reporters in `package.json`'s test script guarded by env), and make the annotation title prefix generic. Verification: a unit test in `scripts/` that runs the reporter on a failing in-memory test and asserts one `::error file=...,line=...` line and one `### ✗` summary section; `scripts/ci-workflow.test.mjs` asserts the checks step references the reporter.

**T3 (pm-276): commit identity guard.** Generalise the 658f6fc step as in section 3, author/committer hard for code paths, trailer as ::warning, with a git-fixture test. Verification: the fixture test passes for an Otohime commit, fails for noreply@anthropic.com on a code path, passes with a warning line for a trailer, passes for a report-only commit by any author.

**Not pm-276:** `lib/end.test.ts` (pm-273/t-1612 fix cycle, patch provided).

## 6. Evidence index

- Red runs: 452 40334420077 (9d65d9c), 453 40335459968 (c0368d1), 454 40337993898 (9ada4e1), 455 40338754295 (658f6fc/3c3772b), 456 40339124232 (c1b26f1, job 121628642183), 457 (c121b20), 458 40340641001 (ae6573a, job 121634081296): checks step 10 failure, annotations "Process completed with exit code 1" and the lint warning; production skipped. Last green checks: 449 40330477897 at 0740594, whose production job failed on inspect.
- Local reproduction: `CI=true PATH=/tmp/fakechrome:$PATH node --test lib/end.test.ts` gives `not ok 11 ... 130 !== 1`; patched file 11/11 in shapes A, B, C; mutation control fails A.
- `CI=true GITHUB_ACTIONS=true npm test` on the clean tree here: 2315/2315 (no chrome on this lease).
- Deploy fixture: `bash scripts/vercel-deploy.test.sh` on the patched scripts: 35 ok, `# all checks passed`.
- Live: `/api/health` = `{"ok":true,"sha":"074059495faf4bee48e8f655584dfd4487089b41"}`; `/api/guestbook` 404.
- Upstream: https://raw.githubusercontent.com/vercel/vercel/main/packages/cli/src/commands/inspect/index.ts
- Board: pm-273 t-1612 fixing (rep-5270/5271), pm-275 drafting (rep-5269), pm-270 t-1605 ready with the deploy footprint.
- Artifacts on lease billie-mac: shared/artifacts/answer.md, end-test.patch, vercel-deploy.patch (/shared is not writable on this lease). Working tree restored clean; nothing pushed.
