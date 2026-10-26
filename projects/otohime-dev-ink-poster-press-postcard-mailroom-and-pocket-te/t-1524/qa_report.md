# t-1524 Ink Poster Press: QA report (run-8719, claude-sonnet-5-5)

Verdict: pass for delivery sha 76141f15bf32d0ee90b402f3a1f373734caf126b (main = origin/main, clean tree).
Deployed-site proof is NOT established (see Deferred).

## Identity
- Author of 76141f1: Otohime <quiinthieu@gmail.com>; 0 Co-Authored-By trailers. Matches plan.commit_identity. No author.txt in the delivery.
- Green gate supplied: gate=green sha=76141f1.

## Independently re-run on this lease (macOS, fresh `npm ci`)
| check | result |
| --- | --- |
| npm ci | exit 0 |
| npm test | 1968 tests, 1968 pass, 0 fail |
| npm run typecheck | exit 0 |
| npm run lint | exit 0, 0 errors, 10 pre-existing warnings |
| npm run build | exit 0 |
| e2e/ink-press.test.ts (scripts/e2e.mjs: embedded Postgres + next start, real Chrome, SwiftShader) | 6/6 pass |

## Negative control
Removed the reduced-motion gate in components/ink-press.tsx (`!reduced.matches` in running() and `reduced.matches ? DRY_MS : 0`), rebuilt, re-ran the e2e:
test 4 (reduced motion: no rAF from the press chunk) failed, the other 5 passed. File restored with git checkout, rebuilt, tree clean.
(A first attempt with sed did not apply on macOS and was discarded as invalid; the control above used real edits.)

## Real/fake boundaries
Real: production build and server, Chrome, WebGL2 via SwiftShader, canvas pixels sampled via sharp, downloads, Postgres (embedded). WebGL absence and context loss are simulated in-page (getContext override, WEBGL_lose_context).
Not covered: hardware GPU, Safari/iOS, mobile DPR 3.
History: no queue/job executable applies to this task; nothing to scan, completeness N/A.

## Deferred / unproven
- Live https://otohime.dev/play returns 200 but has no "press-heading" section, so the deployed build does not yet contain 76141f1. 76141f1 is an ancestor of origin/main (merge-base check ok); deployed sha not readable here (gh unauthenticated).
  Owner: acceptance. Check: rerun e2e/ink-press.test.ts with BASE_URL=https://otohime.dev after the main CI/Vercel run for 76141f1 is green.
  Fails if: /play still lacks the press after that run is green (cause=environment, deploy pipeline in .github/workflows/ci.yml).
