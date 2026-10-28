# t-1610 delivery recovery — run-9277

Role: software engineer. Observed profile: `codex-sol-6-1-high`; actual flags select
`gpt-6.1-sol`, reasoning effort `high`, runner `fleet`, worker `billie-mac`.
This report supplements the historical run-9276 report; its old build ids and results
are not evidence of this run's build.

## Delivery and scope

The preceding run's code was already complete. Its task-manager failure was
`push_not_on_main: HEAD 0a6755b77bb8 is not on origin/main`, despite a successful
feature-branch push and summary `rep-5488`. The raw runner tail confirms the wrapper
then created rescue commit `8f85ecb`, containing only generated `content/history.json`.
The callback was delivered in one attempt; Plan Manager persisted the failed run
with `callback_apply_failures=0`. This was a delivery failure, not a browser failure.

The feature implementation from `0a6755b77bb824c67b186f955496dbfd118469ac` is retained:
real Chrome pixel proof, bounded/reset fake, transport ownership and CI lifecycle,
dark deployment workflow and fixtures, exact Worker version/fingerprint metadata,
separate application build metadata, and operator setup/read-only proof/rollback docs.
This retry also repairs two callers of the strict external-server guard: production
read-only Terminal/Press probes now use serial native Node tests with CI annotations,
and the documented Docker entrypoint owns explicit fake startup/configuration/cleanup.
Actual-shell fixtures cover both. The existing Making-of test now drives scrolling
from current stage geometry after active content reflows, then waits for exactly
the final progress it already asserted. No feature behavior or browser expectation
was dropped. Only the generated history
snapshot is excluded from the net delivery. The original rescue history is retained
on its task branch; the main delivery is a clean squash with the required subject
prefix, without reset, amend, rescue rebase or force push.

Task branch: `pm-257-t-1610-delivery-run-9277`; integration branch: `main`.
The pushed delivery SHA is recorded in Plan Manager's `git_sha` and shared
`artifacts/commits.txt`, avoiding a self-referential SHA in this committed report.

## Verification

All commands use checksum-verified official Node `v22.23.3` (system Node `v22.12.0`
lacks an API used by an existing test). Root and Worker dependencies use their
unchanged locks. Chrome is `156.0.8078.48`; Next is `16.4.2`; Wrangler is `4.152.0`.

| Check | Result |
| --- | --- |
| Required workflow fixture command | 59 passed after caller fixes |
| `npm test` | 2,589 passed after caller fixes |
| `npm run lint` | Exit 0; 10 existing warnings, no errors |
| `npm run build` | Exit 0; both browser commands also build production Next |
| `TMPDIR=/tmp npm run test:ghosts` | 8 passed |
| `TMPDIR=/tmp npm run test:e2e` | 222 passed on the final fresh production build |
| `npm run typecheck`, sequential rerun | Exit 0 |
| Worker `npm ci`, `typecheck`, `test:local`, `bundle:check` | Exit 0; 18 real workerd tests and real Wrangler dry-run |
| `node scripts/probe-ghosts.mjs --fixture` | Exit 0; credential-free identity contract |
| `bash scripts/verify-deploy.sh --self-test` | 22 passed; local fixtures only |
| Full Making-of file after geometry correction | 4 passed; unchanged final-state assertions |

One extra typecheck initially raced the ghost harness's replacement of `.next`
and failed TS2307 for generated `routes.js`. It passed when rerun after that harness
finished. Both attempts are preserved; no executable change or weakened assertion
was needed. Initial workflow/project counts were 57/2,587; the added caller fixtures
raised them to 59/2,589, all passing. The production caller fixture first reproduced
the real fake-configuration refusal and then passed success/failure paths with and
without CI annotations. The Docker lifecycle fixture was red before fake ownership
and green afterward, using the real fake and extracted shell without Docker. No full
Docker engine run is claimed. The first full browser run was 221/222: Making-of
sampled `0.999` after waiting for `>=0.99` but asserting `1`. An exact wait passed
in isolation but the second full run was again 221/222, timing out at that wait.
Three fresh browser diagnostics showed active-content reflow moving the stage top
about 53px while its height stayed 3,024px. The driver reused initial geometry,
landing about 3px short at sampling; progress stayed `0.999` until a new scroll
event. Merely waiting was insufficient. Using the existing measured mid-state
for the end target fixes the driver; all four Making-of cases pass together.
No application animation or exact-state expectation was changed. Both full failures,
the misleading isolated pass, and raw geometry traces are retained. The third full
run passed 222/222 with no skipped cases. No observed deterministic defect remains
in the final verified scope.

The final 52-file proof code/lock/configuration fingerprint is
`37532f637d3faaaf6bb7a0b595e1c13fcb8c9f5e6feaa422e3f7aebb5f0876c7`.
Its inventory and four explicit differences from rescued delivery `0a6755b` are in
shared `artifacts/proof-fingerprint.json`: the caller repairs, their fixtures and the
Making-of readiness wait. Actual ghost application/Worker code and both locks are
unchanged. The initial 46-file inventory, identical to `0a6755b`, is retained as
`proof-fingerprint-initial.json`; it does not identify the final proof runner.
The independent Worker fingerprint
is unchanged:
`aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115`.
Per-file hashes and local bundle/build identity are in `worker-fingerprint.json`
and `verification-identity.json`.

The final full-suite production server reported application SHA marker `dev` and Next
BUILD_ID `Sfk8CyCP9WHbzDIZodc6e`. Earlier full-suite BUILD_IDs were
`y-GXAMPAS7cc9OQQ5ymEb` and `uTOIC6TgBKpesLnpobXhm`; the failed exact-wait proof
fingerprint was `7124bda27d8c463ec3670970c9f4c07f1a23e651d7c0f1f5e1cdfd3e4c593516`
(matching inventory retained in `proof-fingerprint-second.json`). These identify
local builds and proof versions, not a hosted SHA.
No actual Worker deployment/version id was created by this task.

## Evidence boundaries and negative controls

The harness constructs real embedded Postgres, applies migrations, imports the
locked Next/Chrome dependencies, builds production assets and runs two independent
Chrome contexts on Home and `/ryugu`. Canvas drawing and backing-store pixel samples,
native WebSockets, storage events, auth-cookie host separation and media emulation
are real. Fan-out is the local bounded fake; visibility/online events and disabled
configuration are injected. Application cookie values are never evidence.

The painting negative control suppresses actual canvas paint while leaving the
application ripple counter positive; the same pixel assertion rejects it. Workflow
fixtures run the actual YAML shell against explicit npm/Wrangler stand-ins and reject
missing credentials, failed verification, absent/duplicate version ids and stale
Worker/application identities. They prove automation behavior without deploying.
Separate real local workerd tests construct the actual Worker and Durable Object
adapter/bindings, check `/version`, reject fake probe endpoints and exercise protocol
and privacy controls. Real dry-run compilation verifies required bundle exports and
absence of test hooks/logging/storage APIs. Fake results do not prove hosted fan-out.

## History, limitations and handoff

Bounded task-manager history reads inspected FAILED offsets 0 and 5 (10 of 106),
COMPLETED offsets 0 and 5 (10 of 1,325), and the sole current coding task, this run.
These global pages are partial. The returned plan SWE history contains nine runs;
t-1610 has the failed run-9276 and current run-9277. The prior raw log is a bounded
1,063-line tail, not a complete reconstruction of its local test history. Its runner
failure and persisted callback/run status agree. Shared `attempt-history.json` and
`prior-runner-tail.log` preserve the inspected evidence. Unread historical evidence
is inconclusive. This run's complete local command logs, including the generated-file
race and sequential recovery, are copied to shared artifacts before exit.

Integration deployed: unproven. Local execution: demonstrated. Waiting for capacity:
no. Hosted product delivered: unproven. There is no product job queue or ingestion
callback for this feature. No credential/configuration dependency was reached, and
no operator action was required. The Worker workflow remains gated by explicit
`GHOSTS_DEPLOY_ENABLED=true`; app activation independently requires `GHOSTS_ENDPOINT`.

CI/green gate: deferred to Plan Manager for `pm-257/t-1610/run-9277`; new CI/gate ids
are assigned after push. Failure condition: any failed declared command or deployed
build lacking the delivered proof/automation. No pipeline watch or deployed-system
probe is performed by this SWE run, per the explicit stop-at-push contract.
Hosted activation and independent live acceptance remain with successor `t-1611`,
owned by its SWE/operator and QA/acceptance roles. They must bind exact deployment
and application identities, inspect complete relevant hosted history, and fail on
identity mismatch, accepted denied Origin, missing real peer rendering/clearing,
or broken opt-out/failure controls. This task supplies no hosted deploy id and does
not claim those deferred checks passed.
