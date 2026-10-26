# t-1523 Terminal text adventure: QA report (run-8723, claude-sonnet-5-5)

Verdict: pass for delivery sha 1417dd8b2e49d503daa4e012524b6622458064a2 (main = origin/main, clean tree).
Deployed-site proof is NOT established (see Deferred).

## Identity
- Author of 1417dd8: Otohime <quiinthieu@gmail.com>; 0 Co-Authored-By trailers. Matches plan.commit_identity. No author.txt.
- Green gate supplied: gate=green sha=1417dd8. `git merge-base --is-ancestor 1417dd8 origin/main` ok (origin/main == 1417dd8).

## Independently re-run on this lease (macOS, fresh `npm ci`)
| check | result |
| --- | --- |
| npm ci | exit 0 |
| npm test | 1989 tests, 1989 pass, 0 fail |
| npm run typecheck | exit 0 |
| npm run lint | exit 0, 0 errors, 10 pre-existing warnings |
| e2e/pocket-terminal.test.ts (scripts/e2e.mjs: production build, embedded Postgres, real Chrome) | 6/6 pass, incl. reload-mid-walk resume + stamp in `stamps`, and private mode (setItem throws: still wins, note once) |

## Negative control
Disabled the stamp write in lib/adventure.ts saveProgress (`if (false) storage.setItem`) and ran lib/adventure.test.ts: 14 pass, 1 fail (the "winning puts the stamp in the terminal's list" test). File restored, tree clean.

## Real/fake boundaries
Real: production build/server, Chrome, localStorage, embedded Postgres. Fake: in-memory/throwing StoreLike in unit tests; Storage.prototype.setItem override in e2e private-mode test.
History: no queue/job executable applies; nothing to scan, completeness N/A.

## Deferred / unproven
- BASE_URL=https://otohime.dev run of the same e2e: tests 1-4 (existing terminal tests, even the "/" dialog) time out, so the live site does not yet serve the Pocket Terminal at all; the deployed build predates the terminal tasks. Deployed sha unreadable here.
  Owner: acceptance. Check: rerun e2e/pocket-terminal.test.ts with BASE_URL=https://otohime.dev after the main deploy of 1417dd8 is green.
  Fails if: the terminal/adventure is still absent after that deploy is green (cause=environment, deploy pipeline in .github/workflows/ci.yml).
