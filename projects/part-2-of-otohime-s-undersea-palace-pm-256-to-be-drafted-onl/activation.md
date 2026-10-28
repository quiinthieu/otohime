# Production activation handoff

Plan pm-257 · task t-1611 · run-9337 · 2026-10-28

**Parked for operator action esc-444. Live execution is unproven; product delivery is pending.**
The platform resumes this task with the escalation outcome. Do not poll or treat
a readiness response as evidence of successful fan-out.

## Observed configuration boundary

At task start, requests for repository secret names, `GHOSTS_DEPLOY_ENABLED`,
the Worker workflow and its first ten runs all returned HTTP 403. No secret
values were requested or printed. This checkout has no GitHub API or Vercel
authentication, Vercel project link, or local Cloudflare/endpoint settings.
These observations establish an access gap, **not** absent repository secrets
or an explicitly disabled production feature. Vercel Production endpoint
configuration remains unverified. No hosted endpoint or browser was exercised.

Workflow history: zero readable records; FAILED, COMPLETED and current counts
are unknown. Pagination and raw failure tails are unavailable, so history is
incomplete and inconclusive. No executable defect is established or waived.
This feature has no product job queue or ingestion callback.

## Operator chore

Fingerprint: `cloudflare-credentials:otohime-ghosts`; escalation: **esc-444**;
outcome: recorded, unresolved at handoff. Operator owns configuration/deployment.

Use the already-pushed [task-4 workflow](https://github.com/quiinthieu/otohime/blob/f2e1adfe1d04969255429a617bd4c8e6fceecf40/.github/workflows/ghosts.yml)
and [deployment runbook](https://github.com/quiinthieu/otohime/blob/f2e1adfe1d04969255429a617bd4c8e6fceecf40/ghosts/README.md#deployment-and-operator-handoff).

1. Install or verify GitHub repository secrets `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN`, scoped to the selected account with least-privilege
   Worker/DO deployment permissions. Never send values in chat or artifacts.
2. Retain `ALLOWED_ORIGINS=https://otohime.dev` in Worker configuration.
3. Enable the **Ink ghosts Worker** workflow, set repository variable
   `GHOSTS_DEPLOY_ENABLED=true`, and dispatch it once on main. Retain its
   public `ghosts-build-<source-sha>-<run-id>/ghosts-build.json` artifact.
4. Set Vercel **Production** `GHOSTS_ENDPOINT` to
   `wss://<dedicated-worker>.workers.dev/ghosts` and redeploy production
   configuration. Retain the independent application `app-build.json` artifact.

Platform readiness probe: HTTP GET `https://otohime.dev/api/ghosts`, status
200, body containing `wss://`. This is configuration readiness only. If it
passes without manifests/version agreement, activation evidence stays incomplete.

## Public identities

Inspected source base: `5cd648d3d043e3be54163d5f8e9970737b69c44e`.
This documentation delivery changes no executable, lock or Worker configuration.
The source fingerprint from `node ghosts/worker/scripts/fingerprint.mjs` is:

| Identity | Value / evidence boundary |
| --- | --- |
| Local Worker code + lock + configuration SHA-256 | `aa87b9e3b4328f59801de5028120046f3c244f4f55e7e26d661b16d02b6a7115` |
| Worker package-lock SHA-256 | `b49cf8d37759e18044b6e137747cd9f2a059c0c19515006f9a2db4e12f9e7bd7` |
| Worker wrangler.jsonc SHA-256 | `72986fca62833fc14891e1c97a2517e94082666f7377a69b7e34f7348456c80d` |
| Hosted workflow run / deployed Worker source SHA | Unavailable |
| Serving Worker version / DO deployment identity | Unavailable |
| Serving Worker fingerprint | Unavailable; local hash is not hosted proof |
| Serving application SHA / Next BUILD_ID | Unavailable; do not substitute the source base or a local build |

The manifest's workflow run id, Worker source SHA, version id, fingerprint and
per-file hashes must agree with serving `/version`. Independently correlate
application `/api/health.sha` with `app-build.json.appSha` and its
`nextBuildId`. A newer unrelated SHA or configuration 200 proves neither.

## Resume and independent acceptance

SWE owns the resumed fixture-tested classifier in `scripts/lib/ghosts-activation.mjs`,
its tests and read-only CLI. They are deferred by the contract's prerequisite
branch, not implemented or fixture-proven by this handoff. Classify disabled,
missing configuration, failed deployment, identity mismatch and ready-for-live-QA
using injected metadata; local verification must never mutate production.

QA/acceptance owns independent two-browser live checks on Home and `/ryugu`:
drive movement and clicks, observe actual peer ink and decay, leave, test room
isolation, Pocket persistence and reduced motion. Send one denied-Origin upgrade
and require rejection as the negative control. Read bounded paginated failed,
completed and current deployments plus raw failure tails; correlate attempts by
fingerprint/version, and explicitly state completeness. Save no real visitor
frames. Missing identities, denied valid upgrades, accepted bad origins or absent
peer rendering prevent acceptance. Fake/local task-4 proof is not live evidence.

Rollback: unset Vercel Production `GHOSTS_ENDPOINT` and redeploy configuration;
set `GHOSTS_DEPLOY_ENABLED=false` to stop future Worker deploys. Existing pages
can keep connections until reload; endpoint removal does not delete DO resources.
For immediate server shutdown, use the runbook's reviewed Worker rollback/disable
operation and close existing sessions; empty `ALLOWED_ORIGINS` denies new joins.

Run identity: `gpt-6.1-sol`, high effort, from run-9337's recorded profile flags.
CI and independent deployed QA belong to the platform after SWE's tested push.

Local save checks on Node 22.23.3: `npm test` passed all 2,618 tests with
zero skips; `npm run lint` exited 0 (10 warnings); `npm run build` exited 0.
These checks cover the existing application and do not establish the deferred
activation classifier/CLI contracts. No new executable is delivered in this run.
