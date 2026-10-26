# t-1560 Build static history index: QA report (run-8843)

Plan pm-256. Role: quality engineer. Run profile: claude-opus-5-5 (Claude Code, macOS lease, node v22.12.0, git 2.54.0 Apple Git-157; `engines.node` is `22.x`).

**Verdict: fail, cause=code.** The contract asks for deterministic unit tests, but the contract's own test command is flaky on this lease. The indexer's behaviour passed every independent control. The delivery is not deployed.

## Identities

- Delivery sha: `b0befb6d438d04d0c7541acffc0c51618fcad148`. Author `Otohime <quiinthieu@gmail.com>`, no trailers, which matches plan.commit_identity. There is no author.txt in the evidence.
- Deployed sha: `https://otohime.dev/api/health` returns `{"ok":true,"sha":"ae4607dafc28c6f732fdb7ee2ff2f1c7953ed4d3"}`. `git merge-base --is-ancestor b0befb6 ae4607d` fails, so **the delivery is not deployed**.
- Green gate: ver-3532 (run-8842) passed at b0befb6.
- Lockfile: `npm ci` ran from the committed package-lock.json, exit 0.

## Contract verification (this lease, b0befb6, real git, real node)

| check | result |
|---|---|
| `node … --test scripts/history-index.test.ts` | **fail, then intermittent**: the first run exited 1 (15/16, test 8). Over 7 full-file runs, 3 failed. Each failure was test 8, `Command failed: git commit … error: bad tree object HEAD` from `fixtureRepo` (test.ts:56) |
| test 8 alone (`--test-name-pattern='capped at MAX_ENTRIES'`) | default config: 4 of 12 runs failed |
| `npm run build` | exit 0. Prebuild: `history:index: git (full history): 200 of 403 commits`. `/ryugu` prerendered |
| `npm run history:check` | exit 0: `matches git and trails HEAD by 2 commits` |

### Root cause (controlled experiment)

`GIT_ENV` (scripts/history-index.test.ts:38) isolates global and system config but leaves git's automatic maintenance on. While test 8 makes 205 rapid commits, `git commit` starts a detached `gc --auto` / `maintenance run --auto`. That repacks and prunes loose objects while the next commit reads HEAD's tree.

- A standalone replica of `fixtureRepo` (205 commits): with default config, 8 of 8 repos ended up packed by background maintenance. With auto-maintenance off, 0 of 8.
- Unmodified test 8, 8 runs each, interleaved:
  - Default: `0 0 0 0 1 1 1 0` (3 failed).
  - `GIT_CONFIG_COUNT=2 gc.auto=0 maintenance.auto=false` in the environment: `0 0 0 0 0 0 0 0`.

No code was changed for the experiment. Only git config was injected through environment variables that the test passes through.

## Independent behaviour checks (outside the SWE's proof; clones of this repo in /tmp)

| case | result |
|---|---|
| shallow `--depth=1` clone at b0befb6 | `fallback (shallow clone)`, exit 0, file byte-identical to the committed one (sha256 15439c39fb83), tree clean. `--check` exit 0 (shape only) |
| shallow `--depth=3` (holds fallback head 9ddd084) | `spliced`, 200 of 403. sha256 c315011ac216, **byte-identical to a full clone's index** |
| full clone, `PATH` without git | `fallback (git history unavailable)`, exit 0, unchanged |
| `git archive b0befb6` unpacked outside any repo | fallback, exit 0, unchanged |
| **negative control**: fallback with one subject altered, `--check --file=` | exit 1, `does not match git at its own head 9ddd0840d2` |
| **negative control**: 23 commits past the fallback head | `--check` exit 1, `is stale: 23 commits behind HEAD (at most 20)` |
| boundary: 20 commits past the fallback head | `--check` exit 0 |
| bound | 200 entries out of 401/403 total. No runtime consumer imports history.json yet (that is t-1561) |

Real/fake boundary: everything above used real git and real node, with no fakes. A full-clone `npm run build` rewrites the tracked `content/history.json`, which leaves the tree dirty (200 of 403 commits, head b0befb6). The script is designed to do this, and it is noted here, not treated as a defect.

## CI and deployment history (bounded)

I read the GitHub REST API runs list for `branch=main`, `per_page=40`: 40 of 393 runs, so the read is incomplete beyond that page. Counts: 21 failure, 15 cancelled, 2 success, 1 in progress, 1 pending.

- Run 40308983810 (b0befb6): `cancelled`. The run page says "Canceling since a higher priority waiting request for ci-refs/heads/main exists". This is concurrency supersession, not a red gate.
- Run 40307460821 (9ddd084): in progress.
- Run 40309492875 (0c4a25d, which contains b0befb6): pending.
- Latest success: 40306337481 (ae4607d), which matches production.

I read no raw job logs (gh has no session). Whether the deployment carrying b0befb6 is green is **inconclusive**.

## Defects

1. **D1 (code, blocks pass)**: the fixture repos in scripts/history-index.test.ts:38 leave git auto-maintenance on, which makes test 8 nondeterministic: 3 of 7 full-file runs and 4 of 12 single-test runs failed here.

## Deferred checks

- **Production contains the delivery.** Owner: the QA of the fix cycle. It fails if `/api/health` reports a sha for which `git merge-base --is-ancestor <fix-sha> <deployed-sha>` is false while the main CI run for that sha reports failure. Ids to check: 40309492875 (0c4a25d) or the fix commit's run.
- **Production shows only the fallback until it is refreshed.** CI and deploy use depth-1 checkouts, so production ships the committed fallback. This is the SWE's noted follow-up, outside this task's interfaces, and not a defect of this task.
