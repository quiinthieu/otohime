# t-1568 Make CI checks green on main: summary (run-8758, claude-opus-5-5)

## Cause
Every `checks` step up to the signed-in motion probe was green on main (ea80ff0). The two footer steps after it
were red on every run, so `production` (needs: checks) never ran:
- **Footer walk** (`scripts/walk-end.sh`): 58 ok, 7 failed. Every site page had "expected 3 SVG layers, found 4".
- **Footer Chromium probe** (`scripts/probe-end.mjs`): 160 ok, 9 failed. The 7 routes failed the same SVG count.
  The Tab walk ended on a new link, so focus never left the footer, and the no-JS svgCount was 4.

The cause is 5cd6ee0 (pm-256/t-1559). It added `<div data-end-waterline>` as the footer's last child: one
aria-hidden wave `<svg>` and `<a href="/ryugu" data-end-ryugu>`. The two footer scripts were not updated. Both
steps run only in CI after e2e, so the change's own tests (unit and e2e) passed.

A second, intermittent failure: in `e2e/ryugu.test.ts` "while the page is hidden the loop stops, and it comes back"
failed 1 in 2 full runs and 1 in 6 isolated runs. It counted frames in a fixed 400 ms window, which on SwiftShader
measures frame rate, not resumption.

## Fix (no CI step removed or weakened)
- `scripts/walk-end.sh` and `scripts/probe-end.mjs`: the scene still has exactly 3 aria-hidden SVG layers. New
  checks: the waterline is present and is the footer's last element, with exactly 1 aria-hidden wave and its link
  to `/ryugu` (walk: also the `site.end.below` copy, a single link, and nothing of the footer below it). The Tab walk
  expects `ryugu` as the last stop after Back to top, and then focus must leave the footer. The no-JS scene count
  excludes the waterline.
- `e2e/ryugu.test.ts`: resumption is now proven by the fish swimming again (only the sea's loop moves them),
  followed by more than 5 frames, each with a 5 s bound. The live-sea test waits, also bounded, for its 15 frames.
  The hidden-phase assertions (no more than 1 frame, fish unmoved over 600 ms) are unchanged.

## Evidence (macOS lease, Node 22.23.3, Next 16.4.2; Postgres 17-alpine in docker on :5432 as the CI service)
Env as in CI: `CI=true GITHUB_ACTIONS=true GITHUB_SHA=<HEAD>`, plus the job's DATABASE_URL, BETTER_AUTH_*, BASE_URL.
Final clean pass in CI order on a fresh, empty database (tree = this commit's code):

| step | result |
| --- | --- |
| npm ci, lint, typecheck | exit 0 (lint 0 errors, the same 10 pre-existing warnings) |
| npm test | 2037/2037 pass |
| ask:check, drizzle-kit check + db:generate (no migration diff) | exit 0 |
| build, db:migrate | exit 0; `/api/health` = `{"ok":true,"sha":"<GITHUB_SHA>"}` |
| test:e2e (glob `e2e/**/*.test.ts` includes pocket-terminal and ink-press) | 75/75 pass |
| probe-motion-signed-in.sh | 356 ok, 0 failed |
| walk-end.sh, EXPECT_SHA=GITHUB_SHA | 65 ok, 0 failed (before: 58/7) |
| probe-end.sh, EXPECT_SHA=GITHUB_SHA | 169 ok, 0 failed (before: 160/9) |

Repetition and negative controls:
- The ryugu hidden/live pair passed 12 of 12 times after the fix (before: 1 of 6 failed).
- Ryugu with the page left hidden (`hide = true` kept) fails with "the fish did not swim again". A raf-only wait
  passed this control, because other code calls requestAnimationFrame too, so that version was rejected.
- The walk footer check on real `/notes` HTML passes. With the waterline stripped it fails ("missing the
  waterline"). With the link retargeted it fails ("missing the waterline link to /ryugu").
- The probe-end checks were red before the fix and green after it, on the same build.

## Boundaries
- Real: Next build and `next start`, Postgres 17, Playwright Chromium and Chrome, every CI command.
- Not observed: the GitHub Actions run itself. The repo is private and this lease has no `gh` or token. Linux
  runner timing was not reproduced.
- Not done here: the deploy and the live `/api/health` sha check (task 3, plan-manager's green gate).

# Fix cycle: run-8852 (claude-opus-5-5)

## Why the gate was red
The gate failed on both 3351f78 and the plan sha with the same error: `curl: (22) ... 500` and
`ECONNREFUSED 127.0.0.1:5432`. Its e2e item ran a bare `next start` and curled `/api/health`. That route queries
Postgres, and the verify runner has no Postgres on :5432 (in ci.yml it comes from the job's `services:` block).
This is an environment problem, not a code defect. The contract now names the repo's own runners, which start their
own throwaway database: `scripts/e2e.mjs` without BASE_URL, and walk-end/probe-end with SKIP_BUILD=1.

Negative control: `next start` with DATABASE_URL at localhost:5432 and nothing listening there gives
`/api/health` = 500 with `ECONNREFUSED 127.0.0.1:5432`. This reproduces the gate's failure, so the database the
runners start is what makes the server healthy.

## What was still red: a flaky peep-box e2e (new on main in 28d4542, pm-264/t-1590)
On 28d4542 every step was green the first time (e2e 110/110). After rebasing onto 4a87fc4 the full e2e run failed
at `e2e/peep-box.test.ts:225`, where the eye has not moved after "Look right" + Enter. Repeated against one
server, the file failed 3 of 6 runs, at both 390 and 1366.

Cause: `activate()` waited only for `[data-peep-controller]` to mount. The controls do nothing until the effect has
set `control.current` and the IntersectionObserver's first callback has set `running`, which is what
`data-running="true"` marks. An Enter pressed in that gap is dropped (`look()` returns early), `settle()` passes at
once and the eye is still at neutral. Ruled out: the pointer source (only the activation click's pointermove was
seen). Any extra round trip before Enter hid the failure (12/12 pass).

Fix: pm-264/t-1590 landed b80d942 with the same diagnosis while this run was pushing. Its `activate()` waits for
`data-running="true"` and `data-source="pointer"`, adds failure diagnostics and also steadies the touch-pan test.
This run had written the same wait (10/10 after the fix, and the wait timed out as a negative control when the box
cannot run). It took b80d942's superset unchanged instead of a conflicting duplicate. Independent check of b80d942
on its own build and a throwaway database: the peep-box file passed 10 of 10 runs (before: 3 of 6 failed).

## Result on the final tree (main b80d942 + this commit; macOS lease, Node 22.12.0, Next 16.4.2, nothing on :5432)

| step (CI order) | how | result |
| --- | --- | --- |
| npm ci, lint, typecheck | as in CI | exit 0 (lint: 0 errors, pre-existing warnings only) |
| npm test | as in CI (now includes scripts/ci-workflow.test.mjs) | 2160/2160 pass |
| ask:check | as in CI | up to date |
| drizzle-kit check, db:generate, `git status db/migrations` | as in CI | no schema changes, no diff |
| npm run build | BETTER_AUTH_SECRET placeholder | exit 0 |
| db:migrate + test:e2e | `SKIP_BUILD=1 npm run test:e2e` (embedded Postgres 17, migrations, next start) | 110/110 pass, exit 0 |
| probe-motion-signed-in.sh | SKIP_BUILD=1 (its own docker Postgres), on 28d4542 | 356 ok, 0 failed |
| walk-end.sh | SKIP_BUILD=1 (embedded Postgres) | 67 ok, 0 failed |
| probe-end.sh | SKIP_BUILD=1 (docker Postgres) | 171 ok, 0 failed |
| probe-end.sh, docker stubbed to fail, on 28d4542 | SKIP_BUILD=1, `docker` shim exits 1, so the embedded Postgres is used | 171 ok, 0 failed |

The e2e glob `e2e/**/*.test.ts` includes `e2e/pocket-terminal.test.ts` and `e2e/ink-press.test.ts`. Both ran:
"nothing of the terminal loads with the page; / brings its chunk and opens an accessible dialog" and
"the press loads lazily in a small chunk, prints a WebGL2 poster ..." passed, along with their other tests.

This commit changes only `projects/**`, which ci.yml's new `paths-ignore` (2eaada2) keeps out of the main queue.
The checks and production run for main come from b80d942, which touches `e2e/`.

The build's prebuild step rewrites `content/history.json` (the history index, by design). That file was reverted
and not committed.

## Boundaries
- Real: Next build and `next start`, embedded Postgres 17 and docker Postgres 17, Playwright Chromium.
- Not observed: the GitHub Actions run (private repo, no `gh` or token on the lease) and Linux runner timing.
- Not done here: the deploy and the live sha check (t-1569).
