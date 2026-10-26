# t-1522 Pocket Terminal shell: QA report (run-8709, claude-sonnet-5-5)

Verdict: pass for the delivery sha 654c406a095c31dd9a03fae077953e141f89b171 (main = origin/main = 654c406, clean tree).
Deployed-site proof is NOT established (see Deferred).

## Identity
- Author of 654c406: Otohime <quiinthieu@gmail.com>; message has 0 Co-Authored-By trailers. Matches plan.commit_identity. (No author.txt in the delivery.)
- Green gate supplied: gate=green sha=654c406 (unit, typecheck+lint, build all pass).

## Independently re-run on this lease (macOS, fresh `npm ci`)
| check | result |
| --- | --- |
| npm ci | exit 0 |
| npm test | 1951 tests, 1951 pass, 0 fail |
| npm run typecheck | exit 0 |
| npm run lint | exit 0, 0 errors, 10 pre-existing warnings |
| npm run build | exit 0 |
| e2e/pocket-terminal.test.ts (scripts/e2e.mjs: embedded Postgres + next start on the fresh build, real Chrome) | 4/4 pass |

## Negative control
Removed the open-state `event.stopPropagation()` from components/pocket-terminal-loader.tsx, rebuilt, re-ran the e2e: tests 1 and 2 failed
("no key reached the document while open"), 3 and 4 passed (2 pass / 2 fail). File restored with git checkout and rebuilt; tree clean.
So the "keys stop at the terminal while open" check is not vacuous.

## Real/fake boundaries
Real: Next production build and server, Chrome, native <dialog>, localStorage, Postgres (embedded). No fakes in the browser path.
Not covered: audible sound cues (headless), iOS/Safari, screen-reader speech (ARIA attributes asserted only).
History: no job/queue history applies to this task (no executable submitted to a queue); nothing to scan, so completeness is N/A.

## Deferred / unproven
- Live https://otohime.dev: /notes returns 200 and /api/health ok, but running e2e/pocket-terminal.test.ts with BASE_URL=https://otohime.dev
  timed out in all 4 tests (dialog never appeared), so the live build does not yet contain the terminal. 654c406 was committed
  at 12:29 +0700 and this check ran at 12:43; the Vercel deploy runs from .github/workflows/ci.yml on main and I could not read its
  status (gh is not authenticated here) or the deployed commit. Not waited on (15-minute rule).
  Owner: acceptance. Check: rerun the same e2e with BASE_URL=https://otohime.dev, or `git merge-base --is-ancestor 654c406 <deployed sha>`.
  Fails if: the dialog still does not open on /notes after the main CI run for 654c406 is green, which would be a deploy/pipeline defect (cause=environment).
