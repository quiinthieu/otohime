# t-1611 activation handoff QA

**PASS for the fixture-tested activation integration scope authorized by esc-444.**
Live Ink ghosts fan-out and product delivery remain **UNPROVEN**.
QA run `run-9384`, 2026-10-28.

Delivery SHA: `4a1c8487fe46c254a92dad2b7f2699b5410023f9`.
Cited deployed application SHA: `7d2a49923ebaa4b709e954442729bb0c5617b8f9`,
independently observed through production `/api/health` and Chrome.
`git merge-base --is-ancestor 4a1c848 7d2a499` exits 0. Activation executables,
Worker sources/configuration and root package/lock bytes match across delivery,
deployed commit and initial QA base `4992aec82c18135f37279f973527789bed92c9c8` and final base
`53867bf2393c845d53cf47f1bf6b9150f52ca7ae`.
The exact-delivery green gate **ver-3721**, run **run-9366**, passes all five
contract commands. [Persisted gate and callback evidence](t-1611/run-9384/board-evidence.json)
binds the completed task-manager job `538fbad9-1478-4086-895d-b9d206ad701e`
to that gate; callback apply failures are zero. Its raw runner tail lists all
five successful commands and a locked `npm ci`. No product ingestion callback
or queued runtime applies to this handoff.

## Independent verification

Read the delivered source, fixture suite, CLI, fingerprint helper, deployment
workflow, [handoff](activation.md), standing rules and board contract/answer.
Esc-444 already directs credential-free implementation and explicitly permits
this integration scope. No repeated operator request, hosted mutation, workflow
dispatch or readiness polling is required. Secret names and deploy variable
metadata remain inaccessible: fresh GitHub API requests returned HTTP 403 rate
limit; Vercel authenticated configuration access is unavailable. These gaps do
not prove missing secrets. The source allowlist is `https://otohime.dev` and the
workflow requires `GHOSTS_DEPLOY_ENABLED=true`; hosted values are unverified.

Fresh root `npm ci` used unchanged `package-lock.json`, Node **22.23.3** and npm
**10.9.9**. All five commands passed at base 4992aec and again after a fast-forward to
53867bf, with unchanged delivered activation/package/lock bytes. The separate board green gate proves the exact
delivery tree, rather than substituting a newer unrelated SHA for it.

| Command | Fresh result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-activation.test.mjs` | exit 0; 9 passed |
| `node scripts/probe-ghosts-activation.mjs --fixture` | exit 0; 5 classifications |
| `TMPDIR=/tmp npm test` | exit 0; 2,654 passed, 0 failed/skipped |
| `npm run lint` | exit 0; 0 errors, 10 existing warnings |
| `npm run build` | exit 0; local non-secret Better Auth placeholders |

[Verification inventory and hashes](t-1611/run-9384/verification.json) and adjacent
bounded output tails retain results. The initial inherited-TMPDIR project run
had 2,649 passes and three Chrome-dependent failures; [failure evidence](t-1611/run-9384/initial-test-failures.txt)
is retained. The complete short-TMPDIR rerun passed 2,652 tests without application changes.
After main advanced to footer repair **53867bf**, all five checks passed again
(2,654 project tests). Only upstream changed application/verifier source.
Restored only this build's regenerated `content/history.json` from its pre-build
bytes. No generated output, certificate/private key or visitor captures are saved.

| Independent action | Result and boundary |
| --- | --- |
| Real delivered imports and adapter construction, two local HTTPS services, actual default Node fetch/parser | Positive control ready only for live QA; 18 fixed GETs, no cookie/auth headers or redirect follow |
| Change serving Worker version | `identity-mismatch` negative control |
| Add two reviewed same-fingerprint failures at another SHA beside queued replacement | `failed-deployment`; failures remain visible |
| Unread unrelated failure tail, redirect, oversized wire body | Each remains `missing-configuration` |
| Real production Home in Chrome 156.0.8078.47 | HTTP 200; observed optional config 200/null; layer off; zero sockets |
| Pocket hide, full navigation to `/ryugu`, return Home, enable | Preference persists across route roots and is restored |
| Separate reduced-motion Chrome context on `/ryugu` | Layer off; zero config requests, sockets and page errors |

The [HTTPS probe](t-1611/run-9384/independent-https.mjs) and [results](t-1611/run-9384/https-result.json)
exercise the real classifier, fingerprint calculator, manifest constructor and
HTTP adapter under the root lock. Only server/workflow/build metadata are fake.
They are independent of the shipped injected-fetch fixture suite; neither
Cloudflare nor Durable Objects execute in this proof. The [production browser probe](t-1611/run-9384/browser-fallback.mjs)
and [results](t-1611/run-9384/browser-result.json) use real Chrome/network with no
stubs, and modify only browser-local preference. Reused QA harness source from
run-9382 was inspected and executed afresh; its earlier summary is not the proof.
No model weights or additional executable assets apply to these Node tools.

## Deployment and bounded history

[Delivery CI 40656021869](https://github.com/quiinthieu/otohime/actions/runs/40656021869)
publicly reports **Success** (checks 122707137459; production 122715313603).
[Serving CI 40657712570](https://github.com/quiinthieu/otohime/actions/runs/40657712570)
also reports **Success** (production 122722587330).
[Worker run 40656021737](https://github.com/quiinthieu/otohime/actions/runs/40656021737)
at delivery reports **Skipped**, deploy job 122707176758, zero artifacts.
Skipped is not a Worker deployment. Serving Worker version, DO deployment
identity, hosted fingerprint and serving Next BUILD_ID remain unavailable.
App health SHA is independently observed; app-build provenance remains required.

Intended Worker fingerprint remains
`aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115`;
Worker lock `b49cf8d37759e18044b6e137747cd9f2a059c0c19515006f9a2db4e12f9e7bd7`;
configuration `72986fca62833fc14891e1c97a2517e94082666f7377a69b7e34f7348456c80d`.
The three activation executable/test hashes and root lock/package hashes match
the handoff inventory. These local identities are not presented as hosted proof.

[Fresh public history evidence](t-1611/run-9384/history.json) reads two pages
per FAILED and COMPLETED query, 25 rows/page, and one page each queued/in-progress
for Worker and app workflows. Only validated `is:` filters are counted: an
initial `status:` query silently returned unfiltered rows and was discarded.

| Scope | Counts and completeness at snapshot |
| --- | --- |
| Worker FAILED | 0 of 0; both pages empty, exhausted |
| Worker COMPLETED | 2 of 2; both skipped; page 2 empty, exhausted |
| Worker queued / in progress | 0 / 0; exhausted |
| Application FAILED | 50 of 159; older pages unread |
| Application COMPLETED | 50 of 561; older pages unread; overlaps failures |
| Application queued / in progress | 0 / 2: 40666479119, 40666892164; no waiting |
| Board pm-257 runs | 39 returned: 34 succeeded, 4 failed, 1 running; unpaginated endpoint gives no older-history completeness guarantee |
| Board t-1611 subset | 5 returned: 2 succeeded, 2 failed, 1 running; both failed saves are `push_not_on_main`, not executable failures |

[Selected run identities](t-1611/run-9384/selected-runs.json) and [bounded failure annotations](t-1611/run-9384/failure-evidence.json)
were read directly from public run/job pages. Raw failed job log API returned
403; full raw runner logs and older app history remain incomplete/inconclusive.
Observed annotations provide bounded command/server tails, not a complete log.
No relevant Worker failure is observed in its exhausted listing; this does not
establish execution in an account or deployment for which no artifact is available.

Repeated later failures remain real: CI **40662170532**, checks **122727615066**,
and **40664399593**, checks **122735129696**, report Footer walk's “expected 3 SVG
layers … found 4.” The latter binds app SHA `c1d4726e7a4c049ebeb971911f984fbbc0e355d6`,
build `MlgFbgSy6yeosyazKruQe`, Node 22.23.4 and Chrome 156.0.8078.47.
Compared with last green serving run 40657712570, `git log` and diff show no CI
configuration change. This is the post-delivery basket/verifier incompatibility
in `components/end-footer.tsx` and `scripts/walk-end.sh`, already owned by
**pm-274/t-1585**, fix plan **rep-5568**. Separate repairs **d0711b1** and **53867bf** now change
the verifier and regression coverage on main; local suite passes, but remote
replacement runs were unfinished at snapshot. Pending work does not erase those
failures. No t-1611 executable defect was observed or waived.

## Scope, remaining checks and save

| Claim | Status |
| --- | --- |
| Integration deployed | Application descendant containing delivery observed; Worker activation unproven |
| Waiting for capacity | No runtime/capacity dependency |
| Execution demonstrated | Actual Node adapter with fake HTTPS metadata; real hosted browser fallback |
| Product delivered | **No: live peer fan-out remains unproven** |

| Deferred check / exact id | Owner | Failure condition / next action |
| --- | --- | --- |
| Signed-in setup, **esc-444**, `cloudflare-credentials:otohime-ghosts` | Operator; daily digest | Execute activation.md's secrets/allowlist/workflow/Vercel redeployment chore; absent public Worker identities or unset endpoint prevents readiness |
| Artifact/history correlation, **t-1611** after esc-444 | QA/acceptance | Missing manifest/provenance/full relevant tails, identity mismatch or deterministic relevant failure prevents readiness |
| Two real browsers, **pm-257 acceptance** after esc-444 | Independent QA/acceptance | Drive Home and `/ryugu`: require peer ink/trails/decay, ripples, leaving/isolation, Pocket and reduced motion; absent peer output or rejected valid joins fails acceptance |
| Bad-origin negative control, same dependency | Independent QA/acceptance | Raw unapproved-Origin upgrade must be rejected; any accepted bad origin fails acceptance |
| Separate footer repair, **pm-274/t-1585**, rep-5568; **pm-269/t-1648**, d0711b1; **53867bf** | Those tasks' engineer/QA | Rerun actual failed Footer walk remotely; unfinished replacement does not close it |

Rollback is actionable in the handoff: unset Production `GHOSTS_ENDPOINT` and
redeploy configuration, disable future Worker deploys separately, and use a
reviewed Worker shutdown/rollback plus existing-session closure for immediate stop.
No unobserved live behavior is needed to accept this explicitly limited handoff.

Previous QA **run-9382** failed because `a3a151ff3f99cb3343a76eb101ac48b8a7ff7758`
was on its pushed branch but absent from main. This run uses a fresh-main task
branch and publishes its tested report to both the branch and main, preserving
that previous branch and unrelated work. No application source is edited.

Recorded run identity for QA run-9384 and delivery SWE run-9360:
`codex-sol-6-1-high`, model `gpt-6.1-sol`, effort **high**, from recorded flags.
Approach/scope decisions and the short-TMPDIR lesson are persisted on the board.
