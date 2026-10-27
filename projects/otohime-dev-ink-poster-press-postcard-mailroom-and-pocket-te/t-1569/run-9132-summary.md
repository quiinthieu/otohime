# t-1569 verification — run-9132

All four revised contract checks passed on 2026-10-27. No implementation changes were necessary: main already contains the verifier, production invocation, workflow guard and README section. This commit records fresh evidence rather than depending on another production deployment.

## Identities and scope

- Tested checkout: `6bea14de06678dd203e3fa38f08deb902633949e` on `main`.
- Existing verifier delivery: `d476bd941056b48c063dafd09417f394ce3ec3da`.
- Observed production SHA: `79f7813e939d92610a86540c71783c02973d737e`. `git fetch -q origin main` and `git merge-base --is-ancestor "$sha" origin/main` both exited 0. None of the fingerprinted verifier, e2e, lock or workflow files differ between that SHA and the tested checkout.
- Environment: macOS arm64, Node `22.23.3`, npm `10.9.9`; `npm ci` installed the locked dependencies. Actual Chrome `156.0.8078.48`, playwright-core `1.64.0`, sharp `0.35.5`. A real preflight imported playwright-core and sharp, launched Chrome, rendered a page, captured a PNG and decoded its 1280×720 dimensions. No replacement e2e command was set for the live probe.
- Agent: Codex, GPT-6 family as identified by the runtime instructions. An exact model identifier and effort setting are not exposed in this run; no prior run's Claude profile is attributed to this evidence.
- Executable/configuration/lock SHA-256 hashes: [fingerprints](artifacts/run-9132/fingerprints.txt).

## Verification

| Check | Observed result |
| --- | --- |
| `bash scripts/verify-deploy.sh --self-test` | Exit 0; 15 controls passed. Mismatched SHA and stale code deployment both exit nonzero and skip e2e. |
| `bash -n scripts/verify-deploy.sh && grep -q verify-deploy .github/workflows/ci.yml && node --test scripts/ci-workflow.test.mjs` | Exit 0; 14 tests passed. The guard requires the production invocation after `scripts/vercel-deploy.sh` with `EXPECT_SHA="$GITHUB_SHA"`. |
| `! BASE_URL=https://otohime.dev EXPECT_SHA=0000000000000000000000000000000000000000 VERIFY_TIMEOUT=20 bash scripts/verify-deploy.sh` | Exit 0 for the negation; verifier exit 1, observed the real served SHA and never reached e2e. |
| Live served-SHA probe, command below | Exit 0; health matched exactly on try 1; 12/12 real browser tests passed in about 84 seconds. |
| `npm test` | Exit 0; 2,408 passed, 0 failed, skipped or cancelled. |

The live positive command was:

```sh
sha=$(curl -fsS --max-time 15 https://otohime.dev/api/health | grep -oE '[0-9a-f]{40}' | head -n 1) &&
test -n "$sha" &&
git fetch -q origin main &&
git merge-base --is-ancestor "$sha" origin/main &&
BASE_URL=https://otohime.dev EXPECT_SHA="$sha" bash scripts/verify-deploy.sh
```

Full task probe outputs are saved under [artifacts/run-9132](artifacts/run-9132/); the project unit summary is saved there separately. The live checks demonstrated lazy press loading, actual WebGL ink pixels, layout/shuffle/seed behavior, 1080×1350 PNG export, reduced motion, SVG/Canvas fallback, context loss, terminal shortcuts/dialog/focus/navigation, and adventure persistence/stamp behavior.

## Evidence boundaries and remaining ownership

The local self-test uses a fake health server, temporary real Git history and an e2e marker; it proves orchestration and rejection, not a deployed feature. The separate live negative control exercises the real health endpoint. The live positive uses the actual public site, Chrome, playwright-core and sharp; WebGL uses SwiftShader, and fallback tests deliberately disable/lose WebGL. These results demonstrate the terminal and press delivered at the observed main SHA. There is no unavailable runtime capacity or queued replacement output claimed as delivery.

No defects were observed in this task's checks. No production deployment was triggered, and no claim is made that this report commit has deployed. This report-only commit is covered by `projects/**` in CI's paths-ignore. The existing production gate remains pinned to the production job's `GITHUB_SHA`; it is not weakened to accept whatever production serves.

CI run/job history was not queried or watched. FAILED/COMPLETED/current history counts and completeness are therefore uninspected, and no overall pipeline health or prior deploy repair is inferred. Per the stop-at-push contract, plan-manager owns subsequent green-gate/QA evidence at the submitted delivery SHA; any gate failure returns with its job ID. The production deployment implementation remains owned by pm-270/t-1605. There are no new deferred operator or capacity checks.

The referenced chief-of-staff extraction and `docs/claude/software-development.md` files are absent from this checkout (also absent from the sibling-workspace filename search). The present `AGENTS.md`, plan document and explicit revised task contract were followed. No Next.js code was written and no application build was needed for this evidence-only delivery.

Delivery identity is the commit adding this file (`git log -1 --format=%H -- projects/otohime-dev-ink-poster-press-postcard-mailroom-and-pocket-te/t-1569/run-9132-summary.md`). The exact delivery SHA is also written to the run's shared `artifacts/commits.txt` after commit creation and supplied as `git_sha` in the summary report.
