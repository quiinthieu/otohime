# t-1559 QA — run-8752

Outcome: local execution demonstrated; deployment acceptance withheld pending CI log access. The operator-action exception applies: park without a fix cycle, then relaunch with the operator outcome. This is not a production pass. No application source was changed.

## Identities and executable correlation

- Delivery: `5cd6ee0102242f09f0f328fa5b786635d967b39c`, author **Otohime <quiinthieu@gmail.com>**, no Co-Authored-By trailer (verified from git). Delivery evidence has no author.txt.
- QA build: `ea80ff04cb180c97d9dcb4d13f2a8fc14acd479e`; build ID `HYc1zSVaA7tAbt9wRQrwF`. Delivery is its ancestor. Relevant palace/entry code, package.json, lock, Next config and CI workflow have no diff from delivery to QA build; intervening commits only changed other plans' documentation.
- Locked environment: macOS fleet `billie-mac`, Node `v22.12.0`, `npm ci`; Next `16.4.2`, React `19.3.0`, playwright-core `1.64.0`, embedded-postgres `17.10.0-beta.17`. Browser is installed Google Chrome using SwiftShader. Real production compilation, runtime imports, migrations, Next server, database and browser WebGL construction ran successfully; no fake processor/adapter substitutes.
- QA recorded profile: `codex-sol-6-1-high`, `gpt-6.1-sol`, effort `high`. Delivery run-8731: `claude-opus-high`, `claude-opus-5-5`, effort `high`. Earlier QA run-8747 and run-8749: `codex-sol-medium`, `gpt-6-sol`, effort `medium`; do not attribute their outcomes to today's profile.

SHA-256 executable inputs:

| Input | SHA-256 |
| --- | --- |
| package-lock.json | 2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b |
| next.config.ts | 10f96b09409416a6b8b4bdeacf739ddf2788ae900bf0bf3233ef3cead6b00046 |
| .github/workflows/ci.yml | 9dcff7a80fcf598df21d07c4f54e0f88c40a8bbb7dac8acb60f093c987a18a9f |
| app/(ryugu)/_components/sea.tsx | c6366da45fa9053d6430b47087555a199ac7b5789611adc0fb678a874a034f08 |
| app/(ryugu)/_lib/scene.ts | 60d23ea908ac817a2e9cbe74068d3693060f85f6fa4e68286fe5b7903462785a |
| app/(ryugu)/_lib/school.ts | 92976ce1bb73a0c14e15625ebe15581fc4a3fc8547ecd3f6e8481c229c9cec8b |
| app/(ryugu)/ryugu.css | 6d571785360c4c7234f68149eae1e0ce3528263fdcc2c2de57150a1497f005f3 |
| Built palace CSS .next/static/chunks/2cin_6hzxsgvy.css | 994193948a1661a8541f82c408d981fb8173fa0442c11bd46bd7852e49a5aae8 |

There are no model assets or new runtime services in this task. Build output and dependencies are not committed.

## Checks driven in this run

| Check | Result |
| --- | --- |
| npm test | exit 0; 2,037 passed, zero failed/skipped |
| npm run lint | exit 0; zero errors, 10 existing warnings |
| npm run build | exit 0; /ryugu prerendered static |
| npm run ask:check | exit 0; committed search index current |
| SKIP_BUILD=1 npm run test:e2e | exit 0; all 75 passed, including all 9 palace tests |
| Independent QA probe below | exit 0; 1 passed |
| Board green gate | ver-3503, pass for delivery 5cd6ee0 (all three contract checks) |

The full browser suite exercises keyboard urashima, typing into a form without navigating, Pocket Dive, touch footer entry, isolation/noindex, live swimming and pointer flight, hidden pause/resume, no-WebGL static rendering, and reduced-motion still rendering with no WebGL request. Its no-WebGL context and document.hidden are simulated; reduced motion is browser emulation. SwiftShader is real WebGL software rendering, not a physical mobile GPU. These boundaries are not production-device proof.

Independent evidence beyond the supplied SWE summary: [qa-run-8752.test.mjs](qa-run-8752.test.mjs), run using `SKIP_BUILD=1 node scripts/e2e.mjs --test projects/otohime-dev-lean-into-the-name-otohime-is-the-sea-princess-o/qa-run-8752.test.mjs`. It constructs a real WebGL context, calls the real WEBGL_lose_context extension and observes static caustics, hidden canvas and frozen fish afterward. It then disables JavaScript entirely and navigates through the real Pocket and touch footer anchors to the served palace with all nine fish and one stylesheet. Negative control: `/ryugu-qa-missing` returns 404, proving the server does not return the palace for arbitrary paths. This probe does not use the SWE getContext-null or hidden-document stubs.

## Production and CI evidence

Independent HTTPS requests at approximately 2026-10-26T07:40Z: [health](https://otohime.dev/api/health) returns 200 with `{"ok":true}` and no SHA; [palace](https://otohime.dev/ryugu) returns **404**. These reproduce the earlier run's live observations. **Deployed SHA is unknown**, so delivery ancestry cannot be established for production. It is not safe to label local build ea80ff0 as deployed.

[Delivery workflow 40282630815](https://github.com/quiinthieu/otohime/actions/runs/40282630815) at exact SHA 5cd6ee0 failed. [checks job 121439961884](https://github.com/quiinthieu/otohime/actions/runs/40282630815/job/121439961884) publicly identifies **E2E against next start**, exit 1. Production was skipped. Raw step logs say **Sign in to view logs**; they were not read. `gh` has no authentication and anonymous GitHub API returns rate-limit exceeded. Registered repo `otohime` has `ci_token=""` and `deploy_detection="none"`; the board's green gate is separate from this failed workflow.

Comparison before any environment attribution: last green [workflow 40263545741](https://github.com/quiinthieu/otohime/actions/runs/40263545741) at `c38f72a6e927800b363769a1de57ee2ceed69470` has successful checks (6m19s) and production (1m54s). `git log c38f72a..5cd6ee0 -- .github/workflows/ci.yml` and the matching git diff are empty. `git merge-base --is-ancestor 5cd6ee0 c38f72a` exits 1. The last successful deployment predates the delivery; it is not proof of the presently served commit. Without raw logs, neither environment nor a source-code root cause is established. Do not bypass the E2E gate or invent a source patch.

## Bounded history and ingestion

GitHub public Actions pages 1 and 2: **50 completed runs, 32 failure and 18 cancelled**. Separate `query=is:success` page 1: **25 success** (including the latest success above). Histories are bounded and globally incomplete; older pages and raw CI failures remain unread. No queued/in-progress run appeared in those 50 rows. Failures on unrelated SHAs are not proof of the same executable defect. The delivery's exact failure remains unresolved despite local success.

[qa-history-run-8752.json](qa-history-run-8752.json) records task-manager project `plan-manager`, limit 20, offsets 0 and 20: **40 FAILED, 40 COMPLETED**, plus **0 PENDING, 5 RUNNING** at offset 0. The scan found four pm-256 failed tasks (two QA attempts and two planning push failures), three completed tasks (red gate, SWE, green gate), and this running QA task. It is not complete global history. Relevant records' callback state is delivered; run-8749's full task metadata shows one delivered callback, and persisted plan-manager run has callback_apply_failures=0 and failed status. Green verification is persisted as ver-3503. Raw task-manager tail for run-8749 was read separately: model-capacity errors, exit 1 and no uncommitted work, not a product failure. That log endpoint is a truncated tail, not a full history read.

## Outstanding checks and ownership

| Item / exact id | Owner | Missing evidence / failure condition |
| --- | --- | --- |
| GitHub sign-in for checks job 121439961884, run 40282630815 | Repository operator | Make authenticated job logs available to the QA lease; raw failed assertion and server tail must be read. Do not ask for or commit a token in chat/files. |
| Diagnose/retrigger .github/workflows/ci.yml:76–80 | Relaunched t-1559 QA, then SWE if a defect is shown | Compare raw E2E failure with job 121382351223 of last green run 40263545741; name the actual source file/line before fixing. Restart the failed workflow on demand after correction/access, not by waiting for a schedule. |
| Production /ryugu and /api/health | Repository deployment owner; then t-1559 QA | Require 200 palace and an independently attested deployed SHA containing 5cd6ee0. Missing ancestry or continued 404 fails delivery. Current 404 is an observed delivery defect, not waived by pending access. |
| Mobile GPU/Safari | Plan acceptance owner | Physical-browser behavior remains untested; software WebGL and touch emulation are the current scope. |

Integration deployed: **not demonstrated**. Waiting for runtime capacity: **no**. Execution demonstrated: **yes, locally**. Product delivered to production: **no**. A future retry/watch cannot establish delivery or waive the failed delivery workflow.

The chief-of-staff extraction and docs/claude/software-development.md requested by the prompt are absent from this checkout; AGENTS.md and the installed Next route-group/CSS guides were read. No stand-in policy was invented. The person-only authentication rule requires an operator action and a parked report; no unsupported pass or speculative fix cycle should be issued while that chore is pending.
