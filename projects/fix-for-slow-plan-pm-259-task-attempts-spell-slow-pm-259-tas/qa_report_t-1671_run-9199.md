# t-1671 QA — run-9199

Verdict: **pass**. Delivery and deployed commit: **741f59c4b01e369a46bd4c8ee5a63116b32db17c** (`pm-270/t-1671: Authenticate deployment readiness and assert gate evidence`, author and committer `Otohime <quiinthieu@gmail.com>`). It supersedes the run-9184 `cause=environment` fail (production inspection `User not found (404)`, fix_plan_run-9184.md).

## Independent evidence (not taken from the SWE summary)

- **CI run [40476115672](https://github.com/quiinthieu/otohime/actions/runs/40476115672)** (push, `ci.yml`, head `741f59c`): conclusion **success**, read from the GitHub jobs API at 09:09Z.
  - `checks` job 122094641290: success, 08:48:41–09:05:23Z. `Motion probe, signed in` 09:01:12–09:04:03Z = **171 s** (≤240 s bound). `Annotate failed unit tests` skipped, as it should be when units pass.
  - `production` job 122101385195: success, 09:05:25–09:09:03Z. `Deploy and verify the served sha` success (09:06:45–09:07:24Z, the step that failed with the CLI user-bootstrap 404 on 7 earlier jobs); `Verify the deployed sha, terminal and press` success (09:07:24–09:09:01Z), so the final terminal/press step actually ran.
- **Live site**: at 09:05Z `https://otohime.dev/api/health` and `<meta name="build-sha">` on `/` both returned `741f59c4…`. At 09:28Z both return `103f0c5511d4590e66a8a83b1a35acfe870e7ca3` (a later pm-269 deploy). `git merge-base --is-ancestor` exits 0 for `741f59c`, `9ddd084`, `2eaada2`, `5dcfe98`, `e03cf1c`, `0b349dc`, `9d3f746`, `c6d09f0`, `4c9f325` and `4c64080` against both 741f59c and 103f0c5.
- **Browser user path**: headless system Chrome loaded `https://otohime.dev/desk` at 1280×800 and 390×844 touch; both report build-sha 741f59c, title `Desk · Otohime`, heading rendered, 0 page errors.
- **Negative control**: `MAIN_DELIVERY_REF=4c64080^` makes the verification[0] guard throw on the missing `scripts/main-lane-closure.test.mjs` registration (exit 1); the current ref exits 0. Report-only push `f7c135b` (projects/** only) has `total_count=0` ci.yml runs by head_sha (queue-filter control).
- **Green gate**: supplied `gate=green sha=741f59c status=pass` for all five items; this run re-ran them rather than relying on it.

## Local verification (QA checkout = f7c135b; `git diff 741f59c..f7c135b` touches only projects/**, so same executable fingerprint; `npm ci` locked, Node 22.23.3, system Chrome, Docker PostgreSQL)

| Item | Result |
| --- | --- |
| 1 delivery guard + `main-lane-closure.test.mjs` / `e2e-gesture-trace.test.ts` | exit 0; 26 tests, 26 pass |
| 2 `CI=true npm test` | exit 0; 2506 tests, 2506 pass, 0 skipped |
| 3 lint, typecheck, `check-gate-closure.mjs` | exit 0 |
| 4 `verify-bottle-footer.mjs` | exit 0; `probe: 170 ok, 0 failed` |
| 5 `bash scripts/e2e-local.sh` ×3 serial | exit 0 each; 187 tests, 186 pass, 0 fail, 1 skip each. The skip is the pre-existing `evidence: every root hydrated under each colored run`; no new skip or quarantine |

## Real/fake boundaries, history, identities

- Real: locked packages, Next 16.4.2 production build + `next start`, migrated Docker Postgres, system Chrome, the real GitHub Actions run and the real live site. Fake: Vercel API and token in `scripts/vercel-deploy.test.sh` / `lib/deployment-status.test.ts` (local HTTP); the real credential's authorization was exercised only by CI run 40476115672, which succeeded.
- History read is bounded and incomplete: ci.yml main push runs total 484 completed (129 failure, 241 success) from the count query; only the latest 6–8 runs were individually inspected. Earlier history is not reread and is inconclusive; the 7 earlier inspection failures (122009123224 … 122065192584) and later 40467472536/40468812796 remain recorded defects of the superseded script, not waived, and are cured here by a successful run on the new script fingerprint.
- SWE run-9192: profile `codex-sol-6-1-high` (gpt-6.1-sol, effort high). This QA: Claude Sonnet 5.5.
- Hand-offs unchanged and not claimed fixed: pm-270/t-1604 motion missing-guard negative control (`40464199853/122055594240`, line 438–465) and pm-269/t-1648 Bottle `sceneTop` drift (`40460769638/122044564423`). Both passed in this run's CI/E2E; one pass is not proof of elimination. Owner reopens on recurrence.
- Not proven here: Vercel dashboard logs for the original 11:08Z hang (decider waiver esc-419).
