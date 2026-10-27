# t-1569 QA — run-9137 (verdict: pass)

Delivery sha a7da8e8 (on origin/main; author Otohime <quiinthieu@gmail.com>, no trailer). Deployed (served by https://otohime.dev/api/health): 79f7813e939d92610a86540c71783c02973d737e, an ancestor of origin/main (merge-base --is-ancestor ok). Reports-only commits after it are paths-ignored and never deploy.

Independent runs from a bare checkout (no node_modules) on macOS, model Sonnet 5.5:
- `verify-deploy.sh --self-test`: 19 ok, 0 failed (includes mismatch and stale-deploy negative controls, missing-dependency control).
- `bash -n`, grep verify-deploy in ci.yml, `node --test scripts/ci-workflow.test.mjs`: 14/14.
- Live negative control (all-zero EXPECT_SHA, 20 s): script exited nonzero, saw 79f7813, e2e not reached.
- Live probe at served sha: exact match try 1; preflight ran npm ci; e2e 12/12 (terminal dialog + press) against the real site.
Real/fake: self-test uses a fake health server; live runs use real site, npm, Chrome, playwright-core, sharp.
Not inspected: CI run history; production deploy belongs to pm-270/t-1605. Deferred checks: none.
