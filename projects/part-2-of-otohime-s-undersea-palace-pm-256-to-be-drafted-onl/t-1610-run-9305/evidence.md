# t-1610 run-9305: fix-plan run-9298 evidence (local only)

Real boundaries: production `next build` / `next start`, real Chrome (`/usr/bin/google-chrome`),
local ghost fake (not a Worker). Node v22.23.3. CI result for the pushed SHA is not observed here.
Plan-manager QA owns the remote gate.

## Bottle geometry (fix plan steps 1–2)

- Mechanism observed: under `reducedMotion: "reduce"`, `.end-inner` has `transition-property: all`,
  `transition-duration: 1e-05s` (global reset, `app/(site)/globals.css` reduced-motion block). After an
  inline padding change, computed `padding-top` still read 60px on rAF 0 and 1 and reached 40px on rAF 2.
  The old `settle()` waited for font values plus two rAFs, which sits right on this boundary.
- Causal control: a 200ms `.end-inner` padding transition was injected into throwaway copies of the
  footer case at 768px. The old verifier (HEAD c328060) failed with `Missing expected exception: 2.5rem negative control`.
  The new verifier passed.
- Band negative control: a 2.5rem padding was injected before the baseline. The new readiness failed with
  `footer band never reached 3.75rem plus borders: {viewport, buildId, expected, observed{…innerPaddingTop:40,footerBorder:1,hairline:1}}`.
- This is a verifier-boundary repair with a demonstrated mechanism. It does not prove what the CI runner
  observed, because the remote job logs (403) contained no numbers. The 1px tolerance and the four fields are unchanged.

## CI budget (step 3)

checks 25→30m, E2E step 12→17m, inner `timeout --signal=TERM --kill-after=10s 900s`. The fixture in
`scripts/ci-workflow.test.mjs` shrinks the bound to 1s and asserts exit 124, one `::error` annotation
under 12000 chars, the BUILD_ID and the hung case's output. `lib/e2e-runner.test.ts` and the
`scripts/ci-workflow.test.mjs` fixtures needed an `npm` binary on PATH, because `timeout` cannot exec a shell function.

## Gates (this tree)

| command | result |
| --- | --- |
| workflow fixtures (ghosts-workflow + ci-workflow) | 60 pass, 0 fail |
| `npm test` | 2610 pass, 0 fail |
| `npm run lint` | exit 0 (0 errors, 9 pre-existing warnings) |
| `npm run build` | exit 0 |
| `TMPDIR=/tmp npm run test:ghosts` | 8 pass, 0 fail |
| `TMPDIR=/tmp npm run test:e2e` | 235 pass, 0 fail, 528s wall including build |
| focused `footer Bottle contains` (1366/768/390) | 3 pass |

Dropped: rescue commit 16c266c (only the build-regenerated `content/history.json`).
Deferred: hosted ghost activation stays with pm-257/t-1611. GHOSTS_DEPLOY_ENABLED and GHOSTS_ENDPOINT stay dark.
