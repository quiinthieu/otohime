# t-1560 Build static history index: summary (run-8838)

Plan pm-256. Role: software engineer. Run profile: claude-opus-5-5 (Claude Code, macOS lease, git 2.54.0, node 22.23.3).

## What changed

- `scripts/history-index.ts` (new): a build-time indexer that writes `content/history.json`, holding the newest 200 non-merge commits (`MAX_ENTRIES`). Each entry has a 10-char sha, the committer date (ISO, UTC, to the second), `plan`/`task` split off a `pm-N/<tag>:` prefix, the subject (control characters stripped, capped at 100 chars), `files`/`added`/`removed` from `--numstat`, and the top 3 `areas` (top-level dir, `app/(group)`, or root file). The file also holds `head` (full sha) and `total` (all non-merge commits). No author names or emails are read.
  - **Full clone**: the index is built from git. The same history always gives the same bytes (fixed key order, one entry per line).
  - **Shallow clone**: if the clone still has the committed fallback's head, the commits since that head are spliced on top, and the result equals a full clone's byte for byte. Otherwise the fallback ships unchanged.
  - **No git**: covers a missing binary, no repository, an empty repository, or a source archive unpacked inside another checkout (a toplevel mismatch). The fallback ships unchanged. If no valid fallback exists, an empty index is written. An unparseable `git log` also falls back, so the build never fails.
  - `--check` fails (exit 1) on: a missing, malformed or over-bound file; non-canonical text; a head that is not in HEAD's history; content that differs from git at its own head; a lag of more than 20 commits (`MAX_LAG`). In a shallow or git-less checkout it validates the shape only and says so.
- `content/history.json` (new): the committed fallback, 200 of 401 commits, head 9ddd084, 42 KB.
- `package.json`: `prebuild` now runs the indexer after `ledger-fetch`. Adds `history:index` and `history:check`. `test` now includes `'scripts/history-index.test.ts'`.
- The contract's interface list names `scripts/peeks-index.ts` and `content/ledger.json`. Those files belong to Peeks and the Stamp Ledger, so they were not touched; the plan's `content/history.json` path is used instead (recorded as a decision).

## Evidence (this lease, delivery tree)

| check | result |
|---|---|
| `node … --test scripts/history-index.test.ts` | exit 0, 16/16 |
| `npm test` | exit 0, 2121 tests, 2121 pass |
| `npm run lint` | exit 0, 0 errors (the 10 existing warnings, none in touched files) |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; the prebuild logs `history:index: git (full history): 200 of 401 commits … unchanged` |
| `npm run history:check` | exit 0 when generated |

The tests use real git against throwaway repositories with pinned dates and isolated config. Shallow clones come from `git clone --depth` over `file://`. "No git" is covered by a nonexistent binary path, a plain directory, an empty repo, and a directory nested inside another repo.

**Negative controls (mutation)**:
1. Dropping the `lag > maxLag` condition fails test 13 (staleness).
2. Treating a shallow clone as full history fails tests 10 and 11.

Both were restored, and the suite was green again at 16/16.

## Boundaries and follow-ups

- CI (`checks`) and both Vercel deploy jobs use `actions/checkout` at depth 1, so their builds take the shallow path and ship the committed fallback. Production therefore shows history only up to the fallback's head, until someone runs `npm run history:index` (or any local build) and commits the result.
- Proposed follow-up, outside this task's interfaces: `fetch-depth: 0` on the deploy checkout and an `npm run history:check` step in CI.
- Rendering (Tamatebako, t-1561) is not part of this task. The deployed site is not checked by this role.

## Fix cycle (run-8850): flaky fixture repository

Run profile: claude-opus-5-5 (Claude Code, linux lease, git 2.43.0, node 22.23.3).

QA rep-5157 found that test 8 sometimes failed with `bad tree object HEAD` (git 2.54). Following fix plan rep-5158, `scripts/history-index.test.ts` now sets `GIT_CONFIG_COUNT=2` with `gc.auto=0` and `maintenance.auto=false` on `process.env` before it builds `GIT_ENV`. That one place covers `sh`, the fixture commit, `runScript`, and the `gitRunner` calls in the code under test, which inherit the environment. `scripts/history-index.ts` is unchanged. The build also refreshed `content/history.json` (head 3673c50, 200 of 408 commits).

| check | result |
|---|---|
| contract command, 10 runs in a row | 10/10 exit 0, 16/16 each |
| `npm test` (after `npm ci`; the lease had no `node_modules`) | exit 0, 2127/2127 |
| `npm run build` | exit 0, `history:index: git (full history): 200 of 408 commits` |
| `npm run history:check` | exit 0, trails HEAD by 0 |
| `npm run lint` / `npm run typecheck` | 0 errors (the 10 existing warnings) / exit 0 |

**Negative control.** With the default config, the flake does not reproduce on this lease's git 2.43: the reverted test failed 0 of 10 runs. A hostile inherited config was used instead: `gc.auto=1`, `gc.autoDetach=true` and `gc.pruneExpire=now`, passed through `GIT_CONFIG_*` env.
- The reverted test (HEAD's copy) failed **3 of 5** runs, always test 8, with `fatal: could not parse HEAD` / `… is not a valid object`.
- The fixed test failed **0 of 5** runs under the same environment, because its own settings override the inherited ones.
- `gc.auto=1` without `pruneExpire=now` gave 0 of 5 for both, so the aggressive prune is what exposes the race on 2.43.

**Not shown here.** The fix plan's item 4 (a deployed `/api/health` sha, or the id of a CI run carrying the fix) is not shown: `gh` is absent on this lease, and this role does not watch the pipeline. The fix commit is pushed to `main`, and plan-manager's green gate picks it up from there.
