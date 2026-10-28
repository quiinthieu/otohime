# Production activation handoff

Plan pm-257 · task t-1611 · run-9360 · 2026-10-28

**Credential-free activation integration is implemented. Live fan-out is UNPROVEN.
Product delivery is pending independent real-browser QA and acceptance.**

## Operator outcome and configuration boundary

Escalation **esc-444**, fingerprint `cloudflare-credentials:otohime-ghosts`:
the decider answered that signed-in GitHub/Cloudflare/Vercel setup cannot be
done now; proceed with fixture-tested implementation only. This supersedes
run-9337's parked/deferred implementation narrative. The operator chore stays
in the daily digest. Do not create/guess credentials, repeat the request,
dispatch a deploy, mutate hosted settings or poll the readiness probe.

The prior task-start inspection returned HTTP 403 for repository secret names,
`GHOSTS_DEPLOY_ENABLED`, workflow metadata and the first history page. Vercel
authentication/project linkage was unavailable. No values were requested or
printed. This is an access gap, not proof secrets are missing or production is
disabled. This resumed run intentionally makes no hosted request under the
operator outcome. Production configuration remains unverified.

Workflow history: **0 readable records**. FAILED, COMPLETED and current counts
are **unknown**; pagination and raw failure/runner tails are unavailable.
History is incomplete and inconclusive. No executable defect is established or
waived by those absent observations. There is no product queue/ingestion callback.
No capacity wait or runtime submission applies.

## Actionable operator chore

Operator owns the following when signed-in setup becomes possible. Use the
already-pushed [task-4 workflow](https://github.com/quiinthieu/otohime/blob/f2e1adfe1d04969255429a617bd4c8e6fceecf40/.github/workflows/ghosts.yml)
and [deployment runbook](https://github.com/quiinthieu/otohime/blob/f2e1adfe1d04969255429a617bd4c8e6fceecf40/ghosts/README.md#deployment-and-operator-handoff).
The [current activation interface/runbook](../../ghosts/README.md#activation-evidence-interface-t-1611)
adds the classifier and read-only probe contract.

1. Install/verify repository secrets `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN` with least-privilege Worker/DO deploy permissions in
   the owning account. Never send values in chat, artifacts or reports.
2. Retain `ALLOWED_ORIGINS=https://otohime.dev` in Worker configuration.
3. Enable **Ink ghosts Worker**, set repository variable
   `GHOSTS_DEPLOY_ENABLED=true`, and dispatch once on main. Retain the public
   `ghosts-build-<source-sha>-<run-id>/ghosts-build.json` artifact, including
   workflow run id, Worker source SHA, serving version id and per-file hashes.
4. Set Vercel **Production** `GHOSTS_ENDPOINT` to
   `wss://<dedicated-worker>.workers.dev/ghosts` and redeploy production
   configuration. Retain the independent app deployment's `app-build.json`
   (`appSha`, `nextBuildId`) and its deployment provenance.
5. Supply only public deployment/configuration identities to QA. QA reads
   bounded paginated failed, completed and current history plus raw failure
   tails, recording access/pagination completeness and correlating by executable
   fingerprint. Missing/truncated history stays inconclusive.

The escalation's platform readiness probe is GET `https://otohime.dev/api/ghosts`,
status 200, body containing `wss://`. **Do not poll it in this SWE run.**
A readiness 200 is configuration evidence only and cannot establish fan-out.

## Executable identities and proof boundary

The task-4 Worker is unchanged. Recomputed locally with
`node ghosts/worker/scripts/fingerprint.mjs` under the root locked environment:

| Identity | Value / boundary |
| --- | --- |
| Local Worker code + lock + configuration SHA-256 | `aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115` |
| Worker package-lock SHA-256 | `b49cf8d37759e18044b6e137747cd9f2a059c0c19515006f9a2db4e12f9e7bd7` |
| Worker wrangler.jsonc SHA-256 | `72986fca62833fc14891e1c97a2517e94082666f7377a69b7e34f7348456c80d` |
| Hosted Worker workflow run / deployed source SHA | **Unavailable** |
| Serving Worker version id | **Unavailable** |
| Durable Object deployment identity | **Unavailable**; Worker version is not a separately observed DO deployment |
| Serving Worker fingerprint | **Unavailable**; local hash is not hosted evidence |
| Serving application SHA | **Unavailable** |
| Serving Next BUILD_ID | **Unavailable**; never substitute a local build or SHA |
| Live fan-out | **UNPROVEN** |

Worker fingerprint covers source/shared protocol/policy/room, Worker package,
lock and configuration. The classifier also recomputes the manifest's per-file
hash aggregate and compares it to the intended checkout's Worker fingerprint.
Manifest workflow run/source must match the successful **Ink ghosts Worker**
main run; `/version` must match version/fingerprint/service. App health SHA
must separately match the app-build artifact. Next BUILD_ID is reported from
that artifact only, and QA must independently establish its deployment provenance;
health does not expose serving BUILD_ID. An unrelated newer SHA proves neither
executable. The CLI intentionally leaves DO deployment identity null.

New executable inventory: `scripts/lib/ghosts-activation.mjs`,
`scripts/probe-ghosts-activation.mjs`, `scripts/ghosts-activation.test.mjs`,
and root `package.json` test registration, all bound by the pushed delivery
commit in the run's summary/commits artifact. Root `package-lock.json` is unchanged.
These new verifier files are separate from the Worker fingerprint. No Worker
adapter, client, assets, lock or production configuration changed.

| Local activation executable / locked dependency inventory | SHA-256 |
| --- | --- |
| `scripts/lib/ghosts-activation.mjs` | `930ca3cbd400545f7c8fa95478c352dc08ba561309de23de5eb6c34852cf6409` |
| `scripts/probe-ghosts-activation.mjs` | `e384993a2d72a39de6e50997efc6c3dc583fce0a83f465c40349a7a5c8938841` |
| `scripts/ghosts-activation.test.mjs` | `2914c8505e0baa85954fc1b667d030bcbb66600bc0e9d479ac9ffa4de030ee87` |
| Root `package.json` | `8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd` |
| Root `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |

## Integration verification and read-only contract

The pure classifier receives injected HTTP/workflow metadata. It returns
`disabled`, `missing-configuration`, `failed-deployment`, `identity-mismatch`
or `ready-for-live-QA`, with stable reasons, sanitized identities and history
counts. Known relevant failures take priority over replacements or off metadata;
missing/unread/truncated evidence cannot be ready. Turning off future Worker
deploys alone cannot prove the serving layer is disabled. Every result retains
`liveExecution: "UNPROVEN"` and `productDelivered: false`.

The default CLI/`--fixture` imports and executes the real classifier/fingerprint
code under the locked root Node environment, with synthetic manifests, workflow
metadata and HTTP responses only. Tests construct the actual read-only adapter
with injected fetch/Response objects, assert only fixed GET paths with no
credentials/redirects/upgrades, and detect deliberately mismatched serving hashes
as a negative control. They cover failed replacements, wrong workflow/source,
bad endpoint/rooms, app mismatch, incomplete history, malformed/oversized bodies
and offline access. They do not prove a hosted Worker or live socket behavior.

Verification commands (all required at the delivery tree):

```sh
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/ghosts-activation.test.mjs
node scripts/probe-ghosts-activation.mjs --fixture
npm test
npm run lint
npm run build
```

Local results on Node **22.23.3**, following a fresh root `npm ci`: all five
commands exited 0. Activation fixtures: **9 passed**; CLI: **5 classifications
passed**; project suite: **2,636 passed, 0 failed, 0 skipped**; lint: **0 errors,
10 existing warnings**; production build: **passed**. The actual classifier,
fingerprint helper and HTTP adapter import/construct in this locked environment;
they need no external package/runtime assets beyond Node and the hashed Worker
source/config inventory. No Worker executable changed or new local workerd/live
execution is claimed. The local Next build is not a serving production identity.

QA/acceptance owns opt-in `--live --evidence /path/to/public-activation.json`.
It makes bounded read-only GETs to app config/health and Worker version; it
does not deploy, upgrade sockets or persist raw responses. It is an identity
readiness check and is not independent two-browser proof. SWE ends at its tested
push; the platform owns CI and the green gate. No live checks are run by SWE.

## Deferred live acceptance and rollback

| Check / exact dependency | Owner | Failure or missing evidence |
| --- | --- | --- |
| Signed-in setup, esc-444 | Operator; daily digest | Secrets/config/deployment metadata remain inaccessible; no hosted run/version/DO id supplied |
| Artifact/history identity, esc-444 then t-1611 live handoff | QA/acceptance | Missing manifest/provenance/tails/pages, mismatch, or known deterministic failure prevents readiness |
| Two-browser live behavior, pm-257 acceptance after esc-444 | Independent QA/acceptance | On Home and `/ryugu`, drive movement/clicks now; require actual peer ink, trails/decay and ripples; leave/room isolation, Pocket persistence and reduced motion must work |
| Denied-Origin live negative control, same dependency | Independent QA/acceptance | One raw upgrade from an unapproved Origin must be rejected; accepted bad origin or denied valid joins fails acceptance |

No raw real visitor frames may be saved. Rerunning these fixture scripts is not
independent evidence. Integration is demonstrated locally; integration deployed,
real live execution and product delivery are **not established** by this report.
No quota or pending replacement can waive an observed deterministic defect.

Rollback: unset Vercel Production `GHOSTS_ENDPOINT` and redeploy its production
configuration. Optional `/api/ghosts?probe=1` then returns JSON null; direct
`/api/ghosts` returns 404. Set `GHOSTS_DEPLOY_ENABLED=false` separately to stop
future deploys. Existing pages can keep sockets until reload and Worker/DO
resources are not deleted. For an immediate server stop use a reviewed Worker
rollback/disable operation and close existing sessions; deploying empty
`ALLOWED_ORIGINS` denies new joins, but does not itself close existing sessions.

Rescue handling: retained the prior operator chore, provenance/rollback and
independent-QA requirements. Superseded the old unresolved/parked narrative with
esc-444's outcome and implemented the formerly deferred scripts. Excluded the
rescue's generated `content/history.json` WIP and preserved it in the original
checkout; no unrelated content is part of this delivery.

Actual run profile: `gpt-6.1-sol`, high effort, from run-9360's recorded flags.
CI is not watched and no delivery CI result is claimed.
