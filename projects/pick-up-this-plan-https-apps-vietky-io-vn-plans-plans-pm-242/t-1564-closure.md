# t-1564 · Closure on its own footprint (run-8997)

Base: origin/main 6ca9652 at claim (2026-10-26T14:26Z). This run follows the current t-1564 build contract: close with evidence, hand each remaining red run to its owner. It does not follow [fix_plan_run-8849.md](fix_plan_run-8849.md)'s desk edits. e2e/desk.test.ts and ink-desk.tsx are non-goals owned by pm-270/t-1606, which landed 0b349dc on that path. That choice is recorded as a scope_adjusted decision.

Run: profile `claude-opus-high`, model `claude-opus-5-5`, effort `high`. These come from the run's own flags (`--model claude-opus-5-5 --effort high`). Runner: fleet worker `avietidol-mac-mini`, darwin, Node v22.23.3, `npm ci` from the lockfile.

**No application, test, script or workflow source changed in this run.** No annotation names a new assertion in this task's footprint (see below), so this commit adds only this file.

## 1. Landed t-1564 repairs on main, with their regressions

| Repair | Commit | Where on main (6ca9652) | Regression |
| --- | --- | --- | --- |
| E2E files run one at a time | 15fd171 | `scripts/e2e.mjs:35` puts `--test-concurrency=1` before the caller's args, so a later flag still wins | `lib/e2e-runner.test.ts:58`. Its negative control: an explicit `--test-concurrency=2` makes the spans overlap. Removing the flag fails the serial assertion (15fd171's summary). |
| Public failed-test annotations and step summary | 841ca69 | `scripts/e2e-annotate.mjs` (`::error file=…,line=…,title=…`, `## E2E failures` in `$GITHUB_STEP_SUMMARY`). `scripts/e2e.mjs` adds it only when `GITHUB_ACTIONS=true` and no reporter was given. | `lib/e2e-runner.test.ts:71`: one annotation with file, line 4, escaped title and message, plus a summary section, with TAP output and exit 1 kept. Negative control: outside Actions there is no annotation and no summary file. |
| CI E2E step keeps the server log and the identity, and exits with the suite status | 841ca69 | `.github/workflows/ci.yml:123-143`: `next start` writes to `$RUNNER_TEMP/next-start.log`, `status=$?`, and on failure the summary gets commit, BUILD_ID, node, chrome, CPUs and the last 80 lines, then `exit "$status"` | `lib/e2e-runner.test.ts:119` pins the step |
| Kame flowing-clock negative control | 841ca69, beside 9ddd084's pause | `e2e/kame.test.ts:90` pauses the clock; `:96-102`: on a resumed clock, 50 real ms beside `runFor(499)` already pets Kame, then the clock is paused again | It is itself the control |
| Footer probe: the rAF budget waits for scrolling to go quiet, plus a throwaway database for the walk and probe | 15fd171 | `scripts/probe-end.mjs` `scrollQuiet()` and the "rAF negative control" check; `scripts/e2e.mjs --serve-db` | `lib/end.test.ts:256-259` pins the wait. `lib/e2e-runner.test.ts:129` covers `--serve-db`. |
| Footer waterline (three scene SVGs plus the waterline last, Tab walk ends at the waterline link) | **3351f78 (pm-249/t-1568)**, not 15fd171 | `scripts/probe-end.mjs:509-555` and `:1805-1833`; `lib/urashima.test.ts:107` | 15fd171's message says the waterline checks were repaired concurrently by 3351f78. `lib/end.ts` has no waterline code: the waterline lives in the footer component and is pinned by `lib/urashima.test.ts`. |

Every commit above is an ancestor of origin/main: `git merge-base --is-ancestor <c> origin/main` exits 0 for 841ca69, 15fd171, 9ddd084 and 3351f78. Nothing was re-implemented.

## 2. Deployment by ancestry

At 2026-10-26T14:27:56Z:

- `https://otohime.dev/api/health` returned `{"ok":true,"sha":"074059495faf4bee48e8f655584dfd4487089b41"}`.
- The rendered `<meta name="build-sha">` on `/` carries the same sha.
- The live sha is 0740594, "pm-268/t-1600: Add Pocket print-run controls and commands". It is 27 commits behind origin/main.

| Command | Exit |
| --- | --- |
| `git merge-base --is-ancestor 841ca69 0740594…` | **0** |
| `git merge-base --is-ancestor 15fd171 0740594…` | **0** |
| `git merge-base --is-ancestor 3351f78 0740594…` (waterline) | 0 |

Both t-1564 deliveries are deployed. 0740594 went live even though its production job reported `inspect exited 1` (see 40330477897 below).

## 3. Failed main runs since 841ca69, read from public annotations

**Source and completeness.** The anonymous REST API (`actions/runs`) returned **403** (rate limit). I therefore read the public HTML at `github.com/quiinthieu/otohime/actions?query=branch:main+is:failure`:

- **4 of 4 pages**: 98 distinct failed runs out of the "98 workflow runs" the filter reports. The failure listing is **complete**.
- **9** failed runs are at or after 40310239199 (841ca69). For each of the 9, I read the run page's annotations and the failing job's step table (`check-step data-conclusion`).
- Cancelled runs (concurrency replacement) are not failures and are not counted.
- Raw step logs need sign-in and were not read.

| Run | Checks job (other job) | Head sha | Failing step | Actual assertion / annotation | Owner |
| --- | --- | --- | --- | --- | --- |
| 40310239199 | 121530268639 | 841ca69 | E2E against next start | `e2e/desk.test.ts#L576`: `AssertionError: the swipe dragged music: 0.3 is not 0.425` at `near (desk.test.ts:181)` ← `desk.test.ts:597` | pm-270/t-1606 |
| 40315924641 | 121549479127 | 2992401 | Footer Chromium probe | Only "Process completed with exit code 1"; the probe has no annotator, so no readable assertion | pm-270/t-1604 (probes, checks budget) |
| 40328273755 | production 121600218178 (checks green) | 5577ec5 | vercel deploy | `vercel deploy Error (inspect exited 1) https://otohime-rcix516b1-otohime.vercel.app` | pm-270/t-1605 |
| 40330477897 | production 121613136055 (checks 121601102988 green) | 0740594 | vercel deploy | `vercel deploy Error (inspect exited 1) https://otohime-8vfgwc6u4-otohime.vercel.app`; 0740594 is nevertheless live | pm-270/t-1605 |
| 40334420077 | 121613911206 | 9d65d9c | Run npm test | Only "Process completed with exit code 1"; `npm test` has no annotator | pm-271/t-1562 (see below) |
| 40335459968 | 121615705387 | c0368d1 | Run npm test | Only exit code 1 | pm-271/t-1562 |
| 40337993898 | 121624630579 | 9ada4e1 | Run npm test | Only exit code 1 | pm-271/t-1562 |
| 40338754295 | 121627307850 | 3c3772b | Run npm test | Only exit code 1 | pm-271/t-1562 |
| 40339124232 | 121628642183 | c1b26f1 | Run npm test | Only exit code 1 | pm-271/t-1562 |

Readable assertions: **3 of 9** (the desk swipe and the two Vercel deploys). The other **6 of 9** are **inconclusive**: their annotation carries only the exit code. Every run also carries the lint warning annotation (`qa_run-8460/probe.mjs#L2 'resolve' is defined but never used`). It is a warning, not a cause.

**The `npm test` class is new since the contract was written.** Main has been red at `Run npm test` on every code push since 9d65d9c (13:52Z). Two things point away from this task's footprint:

- Here `npm test` at 6ca9652, which differs from c1b26f1 only by `projects/**`, passes 2269/2269.
- `npm test` under the CI job's environment passes too. I set `GITHUB_ACTIONS=true`, `CI=true`, `GITHUB_STEP_SUMMARY`, `RUNNER_TEMP`, `GITHUB_SHA`, and the workflow's `DATABASE_URL`, `BETTER_AUTH_URL`, `BASE_URL` and `BETTER_AUTH_SECRET`. Result: 2269/2269, exit 0. So the CI red is **not reproduced** on darwin even with the Actions env, and the raw runner log stays the only way to name the test.

  pm-271/t-1562's QA run-8975 had already recorded this red at its delivery 9d65d9c. Its fix plan (`projects/otohime-dev-lean-into-the-name-otohime-is-the-sea-princess-o/t-1562/qa_run-8975/fix_plan.md`) assigns identifying the failing test, from the signed-in job log, to t-1562's fix-cycle engineer. It names 5dcfe98, d476bd9 and 9d65d9c as the suspect commits.

Nothing in this task's footprint changed between the last green `npm test` (40330477897 at 0740594) and the first red one (9d65d9c). `git diff --stat 0740594 9d65d9c` touches none of `scripts/e2e.mjs`, `scripts/e2e-annotate.mjs`, `lib/e2e-runner.test.ts`, `lib/end.ts`, `lib/end.test.ts` or `e2e/kame.test.ts`. Two of the changed files are pinned by tests in this footprint:

- `.github/workflows/ci.yml`: 5dcfe98 changed its timeouts, and `lib/e2e-runner.test.ts:119` pins the E2E step.
- `scripts/probe-end.sh`: `lib/e2e-runner.test.ts:130-135` pins its embedded-DB fallback.

Those pins are pure text matches that do not depend on the runner, and they pass on main here. So no annotation names a new assertion in this task's footprint, and no repair was made here.

## 4. Deferred checks

| Check | Run / job ids | Owner | Failure condition |
| --- | --- | --- | --- |
| Desk swipe | 40310239199 / 121530268639 | pm-270/t-1606. Its 0b349dc adds the swipe preconditions and gesture trace, and it is an ancestor of the live 0740594 (exit 0). Since then the checks job, E2E included, was green in 40328273755 (5577ec5) and 40330477897 (0740594), both of which contain 0b349dc. That is two clean runs on the new sources, not proof that the flake is gone. | `e2e/desk.test.ts:597` is red on a run whose sources include t-1606's change |
| Footer probe, motion installer stalls, checks budget | 40315924641 / 121549479127 | pm-270/t-1604 | "Footer Chromium probe" or a browser-probe step fails, or the checks job exceeds its 20-minute budget, on a run whose sources include t-1604's change |
| Vercel production deploy | 40328273755 / 121600218178; 40330477897 / 121613136055 | pm-270/t-1605 | The production job's `vercel deploy` step fails (`inspect exited 1`) or the served sha does not contain the pushed sha |
| `npm test` red in CI since 9d65d9c | 40334420077 / 121613911206; 40335459968 / 121615705387; 40337993898 / 121624630579; 40338754295 / 121627307850; 40339124232 / 121628642183 | pm-271/t-1562 (QA run-8975 fix plan) | "Run npm test" is red on a main run whose sources include t-1562's fix commit. If the signed-in log names a test in `lib/e2e-runner.test.ts`, it comes back to t-1564. |
| Ryugu "Page already revealed" | none in this window | pm-256/t-1559 | Any `Page already revealed` page error in an E2E annotation |
| React #418 on /projects | none in this window | pm-259/t-1573 | `errors/418` in any E2E annotation |
| Footer run 40277523350 / 121423322274 (2a58479) | 40277523350 / 121423322274 | none; historical, inconclusive | It predates the annotator, the raw log is 403/404 anonymously, and there is no readable assertion. The footer walk and matrix pass at main (below). |
| author.txt bytes of task 03c16ea7 / 8d0933c1 | none | none; inconclusive | The manifest is 44 bytes, sha256 7694250f…5ada. The public artifact fetch returns 404 and the bytes were not obtainable. The git identity of 841ca69, 15fd171 and this commit is `Otohime <quiinthieu@gmail.com>` with no co-author trailer. |

No wait for a green main run is part of this task. If this closure commit triggers a run at all, it touches only `projects/**`, which is paths-ignored.

## 5. Verification at origin/main 6ca9652 (locked environment)

Where it ran:

- An APFS clone at `/tmp/oto-8997` (`cp -cR`, then `rm -rf .next`), because the lease path contains a space and `next build` fails there (a known lease lesson).
- Node v22.23.3, after `npm ci`.

| Command | Result |
| --- | --- |
| `npm test` | exit 0, 2269 pass, 0 fail/skipped |
| `npm run lint` | exit 0 (0 errors, 10 existing warnings) |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 (201 static pages) |
| `SKIP_BUILD=1 bash scripts/walk-end.sh` | exit 0, 67 ok / 0 failed |
| `SKIP_BUILD=1 bash scripts/probe-end.sh` | exit 0, 171 ok / 0 failed |
| `SKIP_BUILD=1 npm run test:e2e` | exit 0: 134 tests, 133 pass, 0 fail, 1 skipped, in 295 s. The skip is pm-268's opt-in `e2e/print-runs.test.ts:214` `{ skip: !EVIDENCE }` evidence test, which predates this run and was not touched here. `e2e/desk.test.ts` passes here, at sources that include t-1606's 0b349dc. |

## Real / fake boundary

- **Real:** the production `next build` and `next start`, the embedded Postgres (`scripts/e2e.mjs`) for the walk, probe and E2E, the Chrome/Chromium these scripts drive, the live `otohime.dev/api/health` and page HTML, and the public GitHub Actions HTML.
- **Fake:** only the node:test fixture files inside `lib/e2e-runner.test.ts` (already on main).
- **Not done:** no deployment, no staging mutation, no raw CI log read (sign-in required), and no wait for a CI run.
