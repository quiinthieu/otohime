# t-1559 run-8820: making the gate assert, and where delivery stands

## What changed
- `app/(ryugu)/_lib/wiring.test.ts` (picked up by the `app/(ryugu)/_lib/*.test.ts` glob already in `npm test`).
  It reads `package.json` and asserts that `npm test` runs every `app/(ryugu)/_lib/*.test.ts` (found on disk),
  `lib/urashima.test.ts` and `lib/motion.test.ts`, and that `npm run test:e2e` runs `e2e/ryugu.test.ts`. A negative
  control proves the glob matcher can return false. Mutation: dropping `'app/(ryugu)/_lib/*.test.ts'` from
  `scripts.test` fails it with `npm test never runs app/(ryugu)/_lib/isolation.test.ts`. So `npm test` exiting 0 now
  implies the palace's tests ran.
- Lint and build stay `expect=exit0` by contract. Their positive assertions for QA: lint `0 errors`, build route
  `○ /ryugu`.

## Verification (local, Linux, node v22.23.3, Google Chrome with SwiftShader)
- `npm test`: exit 0, 2099/2099 (3 new).
- `npm run lint`: exit 0, 0 errors (10 pre-existing warnings).
- `npm run build`: exit 0, `○ /ryugu`.
- `npm run test:e2e` (embedded Postgres, `next start`): 91 tests, 90 pass, 1 fail. The failure is
  `e2e/kame.test.ts` "keyboard hold threshold..." (pm-259/t-1573, not this task). All 9 `e2e/ryugu.test.ts`
  tests passed.
- `e2e/ryugu.test.ts` alone, 3 runs: 9/9 each time. `e2e/kame.test.ts` alone, 2 runs: 8/8, then 7/8 with a different
  test failing ("swimming, accelerated 45s idle..."). Kame's tests are flaky.

## CI and production (GitHub public HTML; raw job logs need a token, so they are unread)
- "E2E against next start" failed on 40282630815 (5cd6ee0), 40287860475 (3351f78), 40294920931 (320a07f),
  40295803050 (15fd171) and 40296784613 (4059b63).
- 40297827219 (ee1f6ce) passed every job, production included. Its app code is identical to 15fd171's, so the E2E
  failure is flaky, not deterministic. Local evidence points at kame.test.ts, but which test failed in CI is unread.
- Runs 40297944292..40302065388 were cancelled by main's serialization. 40302228872 (ff527a1) was waiting when read.
- otohime.dev/ryugu returned 200 and /api/health reported sha ee1f6ce (it contains 5cd6ee0). This was one read of
  current state, not QA proof.
- The rescued QA probe (task-rescue/b3128d45..., qa-run-8761.mjs) sets a 5 s default timeout for `goto /notes`. A cold
  production /notes took 2.3 s by curl and 0.5 s warm, so a 5 s budget for a full browser load is tight. That is a
  probe budget, not a product defect, and QA has to judge it.

## Open, owned elsewhere
- Flaky `e2e/kame.test.ts` (pm-259/t-1573). It can fail main's E2E step and so block production deploys for every plan.
