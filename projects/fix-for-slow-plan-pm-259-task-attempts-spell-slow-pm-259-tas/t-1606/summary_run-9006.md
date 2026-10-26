# t-1606 run-9006: green gate re-run (pm-270)

Why the gate failed: the green gate at 0b349dc failed `e2e x3`, with 117 pass, 1 fail and 1 skip out of 119 tests. The stored tail does not name the failing test. Its tail starts at test 103, and the desk tests (7 and 8) come before that, so the tail cannot show whether the desk was the failure.

What this run found on main 5598e40 (linux lease, google-chrome, `scripts/e2e-local.sh`, full `next build` and docker postgres:17-alpine):
- 136 pass, 2 fail, 1 skip. The two failures were `e2e/ink-radio.test.ts:39` and `e2e/pocket-terminal.test.ts:75`.
- Both come from c121b20 (pm-268/t-1601 Riso headings). Their assertions read raw heading HTML or textContent, which now include wrapper spans and an aria-hidden inked copy of the text.
- The desk tests 7 and 8 passed.

How it was fixed: I fixed the assertions locally (7719050, never pushed). On rebase, main 19f4264 already had an equivalent fix (5ad4906 pm-268/t-1600 and 74522bc pm-264/t-1590), so I dropped mine. No app code or desk code changed in this run. The t-1606 delivery is still 0b349dc (swipe preconditions and the bounded gesture trace).

Verification on 19f4264 (the tree this report is pushed onto):

| check | result |
|---|---|
| trace helper unit test | 5/5 pass |
| npm run lint && npm run typecheck | exit 0 (only the existing warnings) |
| npm test | 2320/2320 pass |
| e2e x3 (`bash scripts/e2e-local.sh`, full build each) | 3/3 exit 0, each 138 pass, 0 fail, 1 skip (`evidence: every root hydrated under each colored run`, another plan's test) |
| desk tests 7 and 8 (phone no-drag; narrow/tablet no-drag and the wide-desk control) | passed in all 3 runs on 19f4264, and in all 3 earlier runs on 5598e40 with the local fix |

Real and fake: the browser (Chrome via CDP touch), the production Next server and Postgres were all real. Nothing was faked.

Not proven:
- The CI-only desk flake from run 40310239199 was still not reproduced (0 of 6 local runs).
- Owner: QA and acceptance.
- Failure condition: a main "E2E against next start" failure in e2e/desk.test.ts. Its message now names the missing precondition and includes the pointer trace.

CI and deploy were not watched, per the role contract.
