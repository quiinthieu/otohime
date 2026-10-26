# t-1561 Open Tamatebako: QA report (run-8955)

Plan pm-271 (Ryugu Palace Experience, part 2). Role: quality engineer, run profile claude-opus-5-5 (Claude Code). The SWE delivery run-8935 was recorded as Opus 5.5.
Lease: macOS 27.0.1 arm64, node v22.23.3, Next 16.4.2 (Turbopack), playwright-core 1.64.0, Google Chrome 156.0.8078.48.
`npm ci` ran from package-lock.json (sha256 `2d0ec0be…1a8b`); the lease started with no node_modules.
Checkout: origin/main `9d0167a`, later `b8e1e2a`, both containing e3852eb.

**Verdict: fail, cause=environment.** The delivery `e3852eb` passes every contract check and every independent browser control on this lease. It is **not deployed**: production serves `542c620`, which does not contain e3852eb. The deploying run is queued in the serialized `main` pipeline behind another plan's run and cannot finish within this run's 15-minute waiting limit. The delivered code needs no change.

## Identities

| item | evidence |
|---|---|
| delivery | `e3852eb46f06192140c7ff292e78444c736e4467` "pm-271/t-1561: Open the Tamatebako over the changelog replay" |
| author / trailer | `Otohime <quiinthieu@gmail.com>`, no Co-Authored-By. This matches plan.commit_identity. No author.txt was supplied. |
| green gate | ver-3565, `gate=green sha=e3852eb status=pass` (npm test, lint, build all exit 0, run-8950) |
| red gate | ver-3564 at 1ca12d0. Build exit 1 with the Turbopack next/font error, on a lease path with a space (environment, see below) |
| on main | `git merge-base --is-ancestor e3852eb origin/main`: yes |
| live `/api/health` | `542c62068564fafaf7045560135064cbdb866f91` at 13:24:45Z and again at 13:31:04Z |
| `git merge-base --is-ancestor e3852eb 542c620` | **no**: 542c620 is 10 commits behind e3852eb |
| live `/ryugu` | 0 matches for "Tamatebako" or "changelog replay" in the served HTML |

## CI history (anonymous REST API and public Actions page, runs 435–449, main)

| run | id | sha | state |
|---|---|---|---|
| 444 | – | 542c620 | success (the live deploy) |
| 445 | 40328273755 | 5577ec5 (before e3852eb) | **failure** (read 13:33Z): checks 121591253790 success 13:11:42–13:29:38Z. Production 121600218178 failed at step 8 "Deploy and verify the served sha" (13:31:07–13:31:18Z), annotation `vercel deploy: Error (inspect exited 1) https://otohime-rcix516b1-otohime.vercel.app`. This is the first real run of pm-270/t-1605's `scripts/vercel-deploy.sh`. |
| 446 | 40328785684 | **e3852eb** | cancelled, replaced as the pending run (designed: `ci.yml:14-24`, one pending run per group) |
| 447 | 40329228348 | acd85de | cancelled, same reason |
| 448 | 40330037984 | ec59663 | cancelled, same reason |
| 449 | 40330477897 | 0740594 (contains e3852eb) | pending at 13:25:44Z, **in_progress** at 13:33Z. It will run the same deploy step. |

Scan limits: these are the 15 newest main runs read from the Actions page. The API was rate-limited (60/h, anonymous), so I read run details only for 445–449. Older pages are unread. I did not read raw job logs (no gh session). No run containing e3852eb has executed yet, so there is no FAILED history for this executable.

## Contract verification (this lease, origin/main 9d0167a ⊇ e3852eb; t-1561 files identical to e3852eb)

| check | result |
|---|---|
| `npm test` | exit 0, 2229/2229. Includes all 8 tamatebako tests (867–874) and the isolation exception test (841) |
| `npm run lint` | exit 0 (0 errors, 10 warnings, none in t-1561 files) |
| `npm run build` in place | exit 1, `next/font/google queries have exactly one entry` from `app/(structures)/layout.tsx`'s Caveat font. This is a known environment defect, also present on clean main (global lesson). |
| `npm run build` from an APFS clone at `/tmp/qa8955` with a clean `.next` | exit 0. `history:index: git (full history): 200 of 471 commits`. `○ /ryugu` static |
| `SKIP_BUILD=1 node scripts/e2e.mjs --test e2e/ryugu.test.ts` (own embedded Postgres) | exit 0, 12/12, including the 3 new Tamatebako tests (keyboard, touch, reduced motion + smoke control). This is the SWE's own script: corroborating, not independent. |

## Independent evidence (`qa_run-8955/probe.mjs`, real Chrome against `next start` of the clone build)

The probe compares the rendered page with `git show` in the repository, not with content/history.json. It uses different keys from the SWE's e2e: Space to open, PageUp/PageDown.

| check | result |
|---|---|
| box shut, `aria-expanded=false`; Space opens it | ok |
| visible note: "A changelog replay. … not rebuilt" | ok |
| one `role=slider` named "Scrub back through the changelog", 200 positions | ok |
| PageDown 199→179, PageUp forward | ok |
| **every one of 200 positions**: leaf sha → `git show` committer date (UTC), subject, and `aria-valuetext` containing the subject | 0 mismatches over 200 distinct commits. 9 subjects are shown capped with "…" (the t-1560 indexer cap, test 2213). |
| paper ages at every step back: `data-age` strictly up, and computed background/ink/inset-shadow/foxing differ | 0 steps failed; blue channel never rises; oldest = age 1, "old and foxed" |
| no page errors | ok |
| **empty history** (separate clone: `content/history.json` with `entries: []`, `next build` exit 0, `○ /ryugu`) | box opens, no scrubber, "The box is empty: this build carries no changelog to replay.", no page errors. The SWE run did not render this state in a browser. |

Negative controls:
- A full-mode probe against the empty build exits 1: no slider, so the probe can fail.
- Across the 200 walked positions, no leaf matched its neighbour's commit.
- My first probe version did not normalise subjects the way the indexer does: it kept the full subject and accepted only `pm-N/t-N` and `pm-N/run-N` prefixes. It reported 25 mismatches. All 25 were explained by the indexer's documented normalisation, so the comparison is sensitive to it. Logs: `qa_run-8955/probe-full.log`, `probe-empty.log`, `e2e-ryugu.log`.

## Observations (not fail conditions)

- In the empty state, the replay note reads "Each position is a real commit to otohime.dev, all 0 of its commits, with its own date and subject." It is cosmetic and accurate, but awkward. Owner: pm-271 product owner, optional copy task. Failure condition: none.
- The in-place build failure is environmental (darwin lease path with a space). A copied `.next` from a failed build makes a space-free clone fail the same way, so clear `.next` before using a clone.
- The SWE run's e2e timed the smoke only through the DOM. Under reduced motion the probe saw no smoke node (e2e test 12), which corroborates.

## Real/fake boundary

Real: `npm ci` from the lock, the real `npm test`, lint, `next build`, `next start`, Google Chrome, and the repository's git log. Fake: the server's DATABASE_URL points at a closed port (`/ryugu` is static and reads no database), and the empty-history build uses a hand-written index. Not observed: the production deploy of e3852eb, run 449's result and the live `/ryugu` Tamatebako.

## Deferred check

- **id:** t-1561 deployed-path check, waiting on CI run 449 (id 40330477897, sha 0740594) or any later main run containing e3852eb.
- **owner:** the next t-1561 QA run.
- **ready when:** `https://otohime.dev/api/health` `sha` contains e3852eb. Estimate: about 13:52Z, from run 445's 18-minute checks job plus about 2 minutes to deploy.
- **failure condition:** the deploying run fails, or live `/ryugu` lacks the box or does not match `git show`. See fix_plan_run-8955.md.
- **Pipeline defect beside it (not t-1561):** run 445's production deploy failed in pm-270/t-1605's new `scripts/vercel-deploy.sh` (`:85` inspect call, `:92` state parse). If run 449 fails the same way, the failure is deterministic and no delivery reaches production until pm-270 repairs the step. Owner: pm-270. Failure condition: run 449 production job conclusion=failure with the same `vercel deploy` annotation.
