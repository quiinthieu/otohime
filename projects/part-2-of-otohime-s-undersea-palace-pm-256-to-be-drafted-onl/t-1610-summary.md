# t-1610 — Browser proof and dark deployment preparation

Run `run-9276`, software engineer. Delivery branch `pm-257-t-1610`; the delivery SHA is recorded by
Plan Manager's `git_sha` and the runner's `artifacts/commits.txt` (this document is part of that commit).
Observed run profile from `plan_manager_get_run`: `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`.

The dedicated `test:ghosts` command uses real Chrome contexts, real production Next, actual canvas drawing
and sampled pixels, with the existing bounded fake WebSocket fan-out. It covers both rooms, anonymous
membership/leave, finite normalized coordinates and movement throttling, trails/ripple decay, host-cookie
separation, preference/reload/storage propagation, motion, visibility/offline cleanup, three-attempt failures,
full rooms and disabled configuration. The disabled-paint negative control leaves the application counter
positive but fails the same independent pixel assertion. No real cookie values or visitor frames enter evidence.
Visibility/online events and disabled configuration are injected; Chrome media emulation, transport,
localStorage, browser contexts and rendering are real. This is local execution demonstrated, not hosted acceptance.

The local E2E runner owns fake startup and teardown; external BASE_URL requires explicit fake configuration.
CI keeps the fake alive through every later browser/motion/footer probe and cleans it in an always-run step.
The first case resets records as well as every case's teardown. Existing runner fixtures were updated to supply
this new transport dependency, preserving their build/concurrency/reporting negative controls. Riso's existing
disabled-config console case now supplies its disabled response explicitly, preserving every error assertion
while the shared server is configured for the fake. Native-send timing is measured over the driven path
with a bounded 20ms endpoint tolerance: the policy clock is sampled before serialization, while independent
instrumentation observes the later native call. Exact 100ms policy boundaries retain their injected-clock tests.

The main-only, serialized Worker job supports dispatch and path-filtered pushes through one disabled-by-default
job. It performs locked install, typecheck, actual local workerd tests and dry-run before the credential-bearing
deploy step. Fixtures execute its shell commands against explicit npm/Wrangler stand-ins, including missing-secret,
disabled, verification-failure and version-output controls. Public artifacts bind the exact Worker version to
code/lock/configuration hashes; /version obtains the serving id from the real runtime metadata binding. The app
SHA and Next BUILD_ID have a separate CI artifact, captured after the camera verifier's rebuild. Read-only probe
fixtures independently reject stale Worker and application identities, and verify no upgrades/mutations occur.

All required verification passed. Full command output and initial failure tails are retained in this run's shared artifacts; no generated build output is committed.

## Boundary and follow-up

No Cloudflare deployment, credential/configuration mutation, production browser check or operator action was
needed in t-1610. No hosted Worker version/deploy id exists for this delivery. `GHOSTS_DEPLOY_ENABLED` remains
an explicit repository opt-in and the application independently requires `GHOSTS_ENDPOINT`. Integration deployed:
unproven. Hosted product delivered: unproven. Waiting for capacity: no. Local execution: demonstrated.

Hosted FAILED/COMPLETED/current workflow history was not queried (0 remote attempts inspected; completeness
unknown, therefore inconclusive). There is no product job queue or ingestion callback for this feature. Own test
history is captured completely in artifacts, including raw failure tails. No pipeline is watched after the push,
as required by the SWE role contract. Plan Manager owns CI/green gate and independent deployed QA. Task t-1611
owns the later activation dependency/operator chore and exact deployment identity; it must fail live acceptance
on fingerprint/version mismatch, denied-Origin acceptance or missing two-browser live fan-out. Local fixtures
cannot discharge that follow-up. No deployment/QA result is inferred from another SHA.

The pre-existing `content/history.json` modification is preserved and excluded from the delivery. The repository
owner identity check runs with injected author/committer overrides removed; no unrelated work is attributed.

## Verification and identity

| Command | Result |
| --- | --- |
| Required workflow-fixture command | 57 passed |
| npm test | 2,587 passed |
| npm run lint | Exit 0; 10 pre-existing warnings, no errors |
| npm run build | Exit 0; repeated by both self-owned browser commands |
| TMPDIR=/tmp npm run test:ghosts | 8 passed |
| TMPDIR=/tmp npm run test:e2e | 222 passed |
| npm run typecheck | Exit 0 |
| Worker npm ci / typecheck / test:local / bundle:check | Exit 0; 18 actual workerd tests; real Wrangler dry-run |
| Isolated Riso disabled-config console control | 1 passed; all negative controls preserved |

Environment: Node v22.23.3, Chrome 154.0.8037.57, locked Wrangler 4.152.0.
Final local app SHA marker: `dev`; Next BUILD_ID: `vE3E8rhmGI63_FcSlizto`.
The marker is intentionally local, not a claim that a pushed SHA was deployed.
Proof executable fingerprint: `649e5fd78b0ccdc94c7a71ba7ee364adc907a28491abd589e0955ccf61cfffa5` (file list/hashes in artifacts/proof-fingerprint.json).
Worker code+lock+configuration fingerprint: `aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115`
(per-file hashes in artifacts/worker-fingerprint.json). Public metadata is in artifacts/verification-identity.json.

Test history is complete for the captured runs: the initial full browser run was 220/222 (inherited fake
records and a 30,000ms disabled-config console timeout); the next was 221/222 (the overly precise adjacent
native-send instrumentation assertion); the final run is 222/222. Initial project tests exposed five related
runner-fixture/closure failures, repaired before the final 2,587/2,587 run. Earlier focused proof failures and
the successful reruns are retained, as is the intentional red preflight metadata control.
The final fingerprint identifies the repaired proof; earlier intermediate tree fingerprints were not retained.
No observed deterministic defect remains in the final verified scope.

Deferred checks: actual CI/green-gate run ids are not yet available at this pre-push boundary; Plan Manager
owns their creation and any failing command returns this task. Hosted deployment id and live acceptance
remain unavailable under successor t-1611, owned by its SWE/operator and independent QA/acceptance.
Those checks fail if credentials/configuration cannot activate the declared build, identities disagree, or
two real hosted browser contexts cannot exchange/render/clear ink with the denied-Origin control intact.
There is no capacity deferral or queued product-output claim.
