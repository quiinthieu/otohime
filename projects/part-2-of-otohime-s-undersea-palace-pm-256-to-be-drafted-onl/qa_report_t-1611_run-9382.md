# t-1611 activation handoff QA

**PASS for the fixture-only activation integration scope authorized by esc-444.**
No Ink ghosts product-delivery claim. QA run `run-9382`, 2026-10-28.

Delivery: `4a1c8487fe46c254a92dad2b7f2699b5410023f9`.
Cited deployed application: `7d2a49923ebaa4b709e954442729bb0c5617b8f9`, observed
independently through production `/api/health` and again in Chrome.
`git merge-base --is-ancestor 4a1c848 7d2a499` exited 0. The activation scripts,
Worker, root package and lock have no diff between these trees. Board green gate
**ver-3721**, run `run-9366`, passes all five commands for delivery `4a1c848`.

## Contract and independent verification

Read the delivered diff and [activation handoff](activation.md), the board task
answer and the actual resolved esc-444 record. The resolution allows these
credential-free interfaces to pass while live execution stays unproven. It does
not waive observed defects. No new credential request, deployment dispatch,
external configuration mutation or readiness polling occurred.

All required commands ran in a detached worktree at the exact delivery commit,
on Node **22.23.3**, with its own fresh `npm ci` and unchanged root lock.

| Check | Result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-activation.test.mjs` | exit 0; 9 passed |
| `node scripts/probe-ghosts-activation.mjs --fixture` | exit 0; all 5 classifications |
| `npm test` | exit 0; 2,636 passed, 0 failed/skipped |
| `npm run lint` | exit 0; 0 errors, 10 existing warnings |
| `npm run build` | exit 0; production build completed |

The first QA build failed because a QA-created dependency symlink left the
Turbopack workspace root. Removing that symlink and installing the locked tree
inside the worktree resolved it without changing delivery source. Build logs
also contained the existing unset Better Auth secret/base-URL diagnostics; this
build still exited 0. No local build identity is presented as serving metadata.
Restored only the build-regenerated `content/history.json` from that worktree's
HEAD. The delivery worktree is clean.

The report branch starts from freshly fetched main `c1d4726e7a4c049ebeb971911f984fbbc0e355d6`.
Its project suite passed **2,650/2,650**, and lint including the new QA probes
passed with the same 10 warnings. [Verification and executable hashes](t-1611/run-9382/verification.json)
bind the activation files, package and locks to the delivery bytes.

Independent evidence goes beyond rerunning the supplied suite:

| Starting state / action | Observed result | Evidence |
| --- | --- | --- |
| Real shipped adapter/imports, two owned HTTPS services, genuine default Node fetch; synthetic public build/workflow bodies | Positive control ready only for live QA; 18 fixed GETs total, no cookie/auth headers or redirect follow | [Probe source](t-1611/run-9382/independent-https.mjs), [results](t-1611/run-9382/https-result.json) |
| Substitute wrong serving Worker version | `identity-mismatch` | Same HTTPS results |
| Two reviewed failures with the same executable fingerprint but different SHA, beside queued selected workflow | `failed-deployment`; pending replacement does not erase defects | Same HTTPS results |
| Unread unrelated failure tail; redirect; oversized wire body | Each becomes `missing-configuration` | Same HTTPS results |
| Real hosted Chrome 156.0.8078.47, Home, unset configuration | Page 200, actual config response 200/null, layer off; no WebSocket | [Browser source](t-1611/run-9382/browser-fallback.mjs), [results](t-1611/run-9382/browser-result.json) |
| Hide using Pocket, navigate to `/ryugu`, return Home and enable | Both routes load; persisted `ghosts=hidden` survives root navigation; enable removes key | Same browser results |
| New reduced-motion browser context on `/ryugu` | Mounted layer off, zero config requests, zero sockets; no page errors in either context | Same browser results |

The HTTPS services provide fake metadata, not Cloudflare execution. The actual
classifier, fingerprint helper, task-4 manifest constructor, TLS, fetch and body
parser execute without dependency replacements. Certificates/private test keys
remain outside git. Browser requests use real production with no network stubs;
only browser-local preference is changed and restored. No real visitor frames
or identities are captured. Peer ink, room isolation and live origin policy are
not inferred from the off path. An initial Chrome launch needed a short TMPDIR;
the saved reproducible probe supplies `/tmp`.

## CI, deployment and history

[Delivery CI 40656021869](https://github.com/quiinthieu/otohime/actions/runs/40656021869)
succeeded: checks **122707137459**, production **122715313603**. Serving application
CI **40657712570** also succeeded, production job **122722587330**.
[Worker workflow 40656021737](https://github.com/quiinthieu/otohime/actions/runs/40656021737)
at delivery completed **skipped**, deploy job **122707176758**. Skipped is not
deployed. No serving Worker version, DO deployment or serving Next BUILD_ID has
been supplied. Application SHA is independently observed; its separate build
artifact/provenance is still required for classifier readiness.

The unchanged intended Worker code/lock/config fingerprint is
`aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115`.
Worker lock hash is `b49cf8d37759e18044b6e137747cd9f2a059c0c19515006f9a2db4e12f9e7bd7`;
config hash is `72986fca62833fc14891e1c97a2517e94082666f7377a69b7e34f7348456c80d`.
These are local intended identities, not hosted proof. The three new activation
executable/test hashes and root package/lock hashes match the handoff inventory.
No model, weights or additional runtime assets apply to these Node-only tools.

Independent public GitHub scan: two pages per FAILED and COMPLETED query, 20
records/page, plus one 20-record page each for queued/in-progress, separately for
`ghosts.yml` and `ci.yml`. [Sanitized API records and bounded failure tails](t-1611/run-9382/ci-evidence.json)
retain exact ids, timestamps, limits and next-page signals.

| History | Read / completeness |
| --- | --- |
| Worker FAILED | 0 of 0; exhausted |
| Worker COMPLETED | 2 of 2, both skipped; page 2 empty, exhausted |
| Worker queued / in progress | 0 / 0; exhausted |
| Application FAILED | 40 of 158; additional pages remain |
| Application COMPLETED | 40 of 560; additional pages remain; overlaps FAILED |
| Application queued / in progress | 0 / 1 at snapshot; current run 40664399593, no waiting performed |
| Selected jobs | All jobs read for delivery Worker/CI, serving CI and three later failed runs |
| Raw logs | Latest failed job log endpoint HTTP 403; public command-tail annotations for three failures read, explicitly bounded/truncated |

Worker workflow listing is complete at this observation, but no successful
deployment/artifact exists in it. Broader application history and full raw logs
are **incomplete and inconclusive**, not a zero-failure claim. No runtime job,
queue, product ingestion callback or persisted visitor store belongs to this
task; the board's green verification is the persisted integration result.

Known separate regression remains visible: later CI runs **40658669258**,
**40660939463**, **40662170532** repeatedly failed Footer walk, jobs
**122715901437**, **122723501115**, **122727615066**, with “expected 3 SVG layers,
found 4.” Compared with last green **40657712570**: CI configuration has no diff
or intervening config commit. Independent source diff shows post-delivery commit
`f7f55edfe4d10062cdb25704aa95d83f03b4ef83` adds a basket SVG in
`components/end-footer.tsx`; `scripts/walk-end.sh:288` still requires three.
This is a real separate code/verifier incompatibility, not waived by the newest
pending run. It is already assigned to **pm-274/t-1585**, whose QA failed in
**rep-5567**, fix plan **rep-5568**; board task is running. Activation delivery
touches neither file, its own CI passed, and the deployed app predates the
basket. No t-1611 defect observed. Do not read this integration pass as a claim
that current main's entire CI is green.

## Boundaries, ownership and remaining acceptance

| Claim | Status |
| --- | --- |
| Integration deployed | App descendant containing delivery observed; Node activation tools independently executed locally; Worker deployment unproven |
| Waiting for capacity | No; no queued runtime or capacity dependency |
| Execution demonstrated | Actual activation adapter with synthetic HTTPS metadata and real hosted fallback user path |
| Product delivered | **No. Live peer fan-out unproven.** |

| Deferred check / id | Owner | Trigger and failure condition |
| --- | --- | --- |
| Signed-in GitHub/Cloudflare/Vercel setup, **esc-444**, fingerprint `cloudflare-credentials:otohime-ghosts` | Operator, retained daily digest | Complete handoff's secrets/allowlist/workflow dispatch/Vercel config redeploy. Missing public Worker/artifact identities or unset endpoint prevents live readiness |
| Historical Vercel access chore **esc-427**, `vercel-ci-access:otohime-production` | Operator | Existing delivery ancestry and production CI now observed; this does not establish owning-account/configuration access or Worker activation |
| Artifact and history correlation, **t-1611** after esc-444 | QA/acceptance | Read actual manifest, serving app-build provenance and complete relevant attempt/failure evidence. Mismatch, unread evidence or deterministic relevant failure prevents readiness |
| Two independent real browsers, **pm-257 acceptance** after esc-444 | Acceptance engineer / independent QA | Drive Home and `/ryugu` now; require peer ink/trails/decay, local ripples, isolation/leaving, Pocket persistence and reduced motion. Missing peer output or invalid valid-origin joins fails acceptance |
| Bad-origin live negative control, same dependency | Acceptance engineer / independent QA | Unapproved-Origin raw upgrade must be rejected; any accepted bad origin fails acceptance |
| Footer assertion repair, **pm-274/t-1585**, rep-5568 | That task's engineer/QA | Reconcile basket semantics and footer verifier, rerun the actual failed gate; a pending unrelated run cannot close it |

Handoff includes actionable setup and rollback: unset Production
`GHOSTS_ENDPOINT` and redeploy configuration; disable future deploys separately;
review Worker rollback/shutdown and existing-session closure for immediate stop.
No live claims or external mutation are needed to accept this tested handoff.

Recorded identities: this QA **run-9382** is `codex-sol-6-1-high`, model
`gpt-6.1-sol`, effort **high**, from its recorded `profile_flags`, not current
role defaults. Delivery SWE **run-9360** records the same model/high profile.
Decisions and the Turbopack worktree lesson were recorded on the board.
