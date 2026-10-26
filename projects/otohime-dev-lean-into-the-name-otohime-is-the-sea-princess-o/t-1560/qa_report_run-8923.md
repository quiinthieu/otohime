# QA report: t-1560, run-8923

**Verdict: pass.** Cited sha: delivery `2cd4aef` (green gate pass). The live deployment is `fd99b92`, an ancestor of `2cd4aef`, which contains every t-1560 code commit.

Run profile: claude-opus-5-5 (Claude Code, quality_engineer). Lease: macOS (Darwin 27.2.0, arm64), Apple Git 2.54.0 (Apple Git-157), node 22.12.0, `npm ci` first (the lease had no node_modules). Checkout: main at `591c28e`.

## Delivery and deployment

| item | evidence |
|---|---|
| delivery sha | `2cd4aef` (report-only: `t-1560/summary.md`, `commits.txt`) |
| code shas | `b0befb6` (indexer), `543ba68` (fixture gc fix), `9420077` (fallback refresh) |
| live `/api/health` | `fd99b92fedd82b7953df5b6c414c9bfa339fc974` at 12:43:10Z and again at 12:45:54Z |
| deploying CI run | run 439, id 40322791706, `fd99b92`, success. Checks job 121571723005 green (12:28:27–12:40:28Z). Production job 121577051485 green: `vercel build --prod` 40s, `vercel deploy --prebuilt` 25s |
| `git merge-base --is-ancestor <sha> fd99b92` | b0befb6, 543ba68, 9420077, 8955310: all yes. 2cd4aef: no (expected) |
| `2cd4aef` vs deployed | `fd99b92` is an ancestor of `2cd4aef`. `git diff fd99b92 2cd4aef` is empty for `scripts/history-index.ts`, its test, `package.json`, `content/history.json` and `.github/`. The non-`projects/**` diff is only pm-255's ask-tier probe files (`9cb3833`). |
| why 2cd4aef is not live | It touches only `projects/**`, so `ci.yml` `paths-ignore` (since `2eaada2`) never queues it. Run 441 (id 40324619745, `591c28e`, contains 2cd4aef) was `pending` behind run 440 (`9cb3833`, in progress) at 12:45:54Z. I did not wait for it (no-idle rule). |

CI history scan: anonymous API, page 1 (`per_page=30`), runs 412–441 out of `total_count` 422. Older pages unread. In that window: successes 422, 438, 439; failure 428 (footer probe, owned by pm-270 and covered in run-8875); the rest cancelled by main concurrency. I could not read raw job logs (gh has no session), so I could not see whether vercel's build saw a full or a shallow clone in production.

## Commit identity (plan.commit_identity)

`git log -1 --format='%an <%ae>|%(trailers:key=Co-Authored-By,valueonly)'` on every `pm-256/t-1560` commit on main (9 commits):

- All 9 have the author `Otohime <quiinthieu@gmail.com>`.
- Only `8955310` has a trailer (`Claude Opus 5.5 <noreply@anthropic.com>`). This is the negative control: the check does detect a trailer. `commits.txt` line 4 marks it as superseded by `2cd4aef`. It stays in main's history because force-pushing main is forbidden (fix plan run-8901).
- `2cd4aef` prints `Otohime <quiinthieu@gmail.com>|`, with nothing after the bar, and its body has 0 matches.
- `a795bf2` (the prior QA commit) has one body match. It is prose that quotes the defect, not a trailer.

No author.txt artifact was supplied.

## Contract verification (at 591c28e, same indexer files as 2cd4aef)

| check | result |
|---|---|
| contract test command, 3 runs | 3/3 exit 0, 16/16 pass each time |
| `npm test` | exit 0, 2207/2207 |
| `npm run build` | exit 0, `history:index: git (full history): 200 of 449 commits`; regenerated `content/history.json` restored with `git checkout` |

## Independent real-clone controls (file:// clones of main at 591c28e, outside the worktree)

| clone | indexer output | result |
|---|---|---|
| full | `git (full history): 200 of 449`, exit 0, 42,585 bytes | second run byte-identical (determinism) |
| depth 1 | `fallback (shallow clone): 200 of 414 … unchanged`, exit 0 | byte-identical to the committed fallback |
| depth 30 (does not hold fallback head fe0dd82, 35 commits back) | `fallback (shallow clone) … unchanged`, exit 0 | ships the fallback, never a cut-off history |
| depth 38 (holds fe0dd82) | `spliced (shallow clone holding the fallback's head): 200 of 449`, exit 0 | byte-identical to the full clone |
| depth 1 copy with `PATH=/nonexistent` | `fallback (git history unavailable)`, exit 0 | fallback unchanged |
| `git archive HEAD` extract (no .git) | `fallback (git history unavailable)`, exit 0 | byte-identical to the committed fallback |

Bounded: 200 entries (MAX_ENTRIES) out of 449 total. Each entry has a sha, a UTC date, plan/task prefix, subject, file and line counts, and at most 3 areas.

## Negative controls on `--check`

| state | exit |
|---|---|
| fresh index at HEAD | 0 (lag 0) |
| line-6 (first entry) subject tampered | 1 (`does not match git at its own head`) |
| tamper reverted (re-indexed) | 0 |
| committed fallback (head fe0dd82) checked at HEAD | 1 (`stale: 35 commits behind HEAD (at most 20)`) |
| committed fallback checked at its own commit | 0 (lag 6) |

## Observations (not t-1560 defects)

- The committed fallback now trails main by 35 commits, more than MAX_LAG 20. This is the designed staleness signal. No build, CI job or prebuild runs `--check`, so nothing fails. When the deploy checkout is depth 1, production ships this fallback, so the Tamatebako changelog lags until someone runs `npm run history:index` and commits the result. Owner: Tamatebako (pm-256 task 3) or product owner. Failure condition: Tamatebako shows a history whose head is older than the deployed sha by more than the product accepts.
- No app code reads `content/history.json` yet; Tamatebako is task 3.

## Real/fake boundary

Everything above used the real indexer on real git clones of this repo, with the real `npm test` and `next build`. The test suite's internal fixtures are synthetic repos; my clone controls are separate from them. Not observed: raw vercel build logs (whether production indexed a full or a shallow clone), and the deploy of 591c28e by run 441. Neither blocks this contract, because the indexer files are identical between fd99b92 and 2cd4aef.
