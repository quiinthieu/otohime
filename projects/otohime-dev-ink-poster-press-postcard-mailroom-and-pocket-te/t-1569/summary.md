# t-1569 Verify the deployed sha and features: summary (run-8944, claude-opus-5-5)

Delivery commit: **ec59663fb25baedcc03addff0a0649358a3f0c2e** on main.

## What changed
- `scripts/verify-deploy.sh BASE_URL EXPECT_SHA` (or the same names as env vars):
  1. It polls `BASE_URL/api/health` until `sha` equals the full 40-hex `EXPECT_SHA`. The bound is
     `VERIFY_TIMEOUT` (default 300 s, capped at 590 s), with a try every `VERIFY_INTERVAL` (10 s).
  2. It then runs `e2e/pocket-terminal.test.ts` and `e2e/ink-press.test.ts` through `scripts/e2e.mjs` with
     `BASE_URL` set.

  Exit codes: 1 for a sha that never matches, a non-200 answer, nothing listening, or a failing e2e; 2 for bad
  arguments (`EXPECT_SHA=dev`, no `BASE_URL`).
- `--self-test` runs the script against a local node fake `/api/health`, with a stand-in e2e set through
  `VERIFY_E2E_CMD`. It has 10 checks. The negative control is a mismatch: it must exit nonzero, name the sha
  it saw, and never reach the e2e. The other checks cover a positive match, positional args, a sha flipping
  mid-poll (stale for 2 requests), HTTP 500, nothing listening, a failing e2e, and the two exit-2 refusals.
  Each case must finish within 30 s, which shows the poll is bounded.
- `.github/workflows/ci.yml`:
  - checks: runs `bash scripts/verify-deploy.sh --self-test` after `vercel-deploy.test.sh`.
  - production: a new step `EXPECT_SHA="$GITHUB_SHA" bash scripts/verify-deploy.sh https://otohime.dev` runs
    right after `bash scripts/vercel-deploy.sh`.
  - production `timeout-minutes` goes from 12 to 18.
- `scripts/ci-workflow.test.mjs` (outside the declared interfaces; it is the existing guard for this workflow):
  production must run verify-deploy after the deploy with `EXPECT_SHA=$GITHUB_SHA`, must not use a bare
  `curl .../api/health`, and checks must run the self-test.
- README → Deploying documents the script.

## Scope note
pm-270/t-1605 (5577ec5), which landed during this run, had already replaced the bare health curl with
`scripts/vercel-deploy.sh` (it also checks the health sha). I left that script unchanged and added the
terminal/press proof after it (decision recorded).

## Evidence (macOS lease, Node 22, real Google Chrome via playwright-core)
| check | result |
|---|---|
| `bash scripts/verify-deploy.sh --self-test` | 10 ok, 0 failed, about 15 s (after the rebase too) |
| mutation: the sha comparison replaced by `true` | the self-test goes red (8 ok, 2 failed: the negative control and the "names the sha" check) |
| `bash -n scripts/verify-deploy.sh && grep -q verify-deploy .github/workflows/ci.yml` | exit 0 |
| `npm test` (includes ci-workflow.test.mjs) | 2229 pass, 0 fail, before and after the rebase |
| ci-workflow test negative control: verify step swapped for a bare health curl | `not ok 6`; restored, ok |
| `npx eslint scripts/ci-workflow.test.mjs` | clean |
| real probe vs https://otohime.dev, live sha 9cb3833 | sha matched on try 1; e2e 11 pass, 1 fail (ink-press, tests 1-7; the log was overwritten, so the exact test is unknown). Production switched to 542c620 within the next 5 minutes, so the run probably overlapped a deploy cutover. Not proven. |
| real probe vs otohime.dev with stale EXPECT_SHA 9cb3833 after prod moved to 542c620 | exit 1 after 300 s, 25 tries, "last got sha '542c620…'" (a real-world negative control) |
| real probe vs otohime.dev, live sha 542c620, twice | exit 0; health on try 1; 12/12 e2e pass (press 6, terminal 6); about 108 s |

## Not yet proven (owned by plan-manager QA, after CI)
- The contract's live probe `EXPECT_SHA=$(git rev-parse HEAD)` against otohime.dev for ec59663. It needs the
  CI run for ec59663 to pass `checks` and deploy. If HEAD has moved on to a report-only commit
  (paths-ignored, never deployed), the probe must use the delivery sha or the live sha that contains it.
- That the production job's new step passes on the GitHub runner (Chrome present, about 2 minutes). It fails
  if the job is red at "Verify the deployed sha, terminal and press".
- The one unattributed e2e failure in the first live run, which may be a flake around deploy cutover.
