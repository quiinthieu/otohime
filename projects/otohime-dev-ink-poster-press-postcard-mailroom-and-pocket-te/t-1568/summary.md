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
