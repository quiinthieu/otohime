# t-1569 fix — run-9135

## What failed

Gate at `8d42a87` failed only "live probe at the served sha". `/api/health` matched `79f7813` exactly on try 1. Then both e2e files died with `ERR_MODULE_NOT_FOUND: playwright-core`, because the gate checkout had no `node_modules` and none of the contract's commands run `npm ci`. This run's lease started the same way (no `node_modules`), so the failure reproduced here.

## Change

`scripts/verify-deploy.sh` now runs a preflight between the health match and the e2e:
- It imports `playwright-core` and `sharp` for real (`VERIFY_E2E_DEPS`). If either fails, it runs `npm ci --no-audit --no-fund` once (`VERIFY_INSTALL_CMD`), imports again and exits 1 before the e2e if one still fails.
- If no browser launches (CHROME_PATH, then Chrome, then Playwright's Chromium, in the e2e's own order), it installs Playwright's Chromium once and exits 1 before the e2e if a browser still does not launch.
- In CI production, `npm ci` has already run, so both checks pass and nothing is installed.

The self-test gains 4 controls (19 in total):
- negative: a dependency that never imports runs the install once, exits nonzero, skips the e2e and is named;
- positive: dependencies that import run no install and reach the e2e.

Mutation: replacing `preflight` with `true` turns 2 controls red. The README section describes the preflight.

## Verification (macOS arm64, Node 22.23.3, playwright-core 1.64.0, sharp 0.35.5; the live probe started without node_modules)

| Check | Result |
| --- | --- |
| `bash scripts/verify-deploy.sh --self-test` | exit 0, 19 ok |
| syntax + grep + `node --test scripts/ci-workflow.test.mjs` | exit 0, 14/14 |
| live negative control (all-zero EXPECT_SHA, 20 s) | negation exit 0; saw `79f7813`; e2e not reached |
| live probe at served sha `79f7813e939d92610a86540c71783c02973d737e` (on origin/main) | exit 0: exact match on try 1; preflight ran `npm ci` (517 packages); 12/12 e2e |
| `npm test` | 2408/2408 |

Logs: [artifacts/run-9135](artifacts/run-9135/). Fake boundary: the self-test uses a fake health server and stand-in e2e/install commands. The live runs use the real site, real npm install, Chrome, playwright-core and sharp. CI history was not inspected and nothing was deployed. The production deploy belongs to pm-270/t-1605.
