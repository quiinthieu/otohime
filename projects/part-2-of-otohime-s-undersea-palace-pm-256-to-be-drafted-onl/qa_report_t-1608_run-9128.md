# Ink cursors and console repair: independent QA

pm-257/t-1608, run-9128, quality_engineer. Delivery under review:
`a958913b6a17f2cefda59882dfbdfcb0cd01e453`. **FAIL, cause=environment**: native checks
pass, but production deployment failed and the live SHA excludes the delivery.
Operator action **esc-427** parks this task without a code fix cycle or retry.
Evidence directory: [run-9128](t-1608/run-9128/).
No application, maintained test-suite or CI source was changed by QA.

## Identity and verification

The persisted gate is **ver-3626**, run-9126, green/pass at `a958913`; all four contract
items pass. Independent local checks ran at that exact checkout after `npm ci`.
The actual QA profile is **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**,
from run-9128's recorded flags, fleet `billie-mac`, account `codex-main`. SWE run-9124
records the same profile/model/effort, fleet `avietidol-z490`; the verifier is shell,
not a model run. These are recorded run identities, not inferred current defaults.

| Check | Independent result | Evidence |
| --- | --- | --- |
| Exact focused client/config command | 16 pass, 0 fail | focused.log |
| `npm test` | 2,407 pass, 0 fail/skip | npm-test.log |
| `npm run lint` | exit 0; 10 existing warnings | lint.log, qa-lint.log |
| `npm run build` | exit 0; actual imports/types/assets; dynamic ghost route | build.log |
| Exact targeted Riso fix-contract command | 6 pass, 0 fail | riso.log |
| `TMPDIR=/tmp SKIP_BUILD=1 npm run test:e2e` | 181 pass, 0 fail, 1 existing skip | e2e.log |
| Separate two-browser pixel/lifecycle probe | pass, including a rejecting paint control | independent-results.json |
| Native checks job 121976229834 | completed/success | delivery-jobs-final.json |

The unchanged optional `APPEARANCE_EVIDENCE` test is the one skipped full-suite test.
Palace stylesheet, root isolation, CSS, hydration, controls and motion checks all pass.
Native [CI run 40439524623](https://github.com/quiinthieu/otohime/actions/runs/40439524623)
is bound to the full delivery SHA. Its checks include real CPU camera verification,
E2E, signed-in motion, Footer walk and Footer Chromium probe; all succeed. Production
job **121981152892** is the corresponding deploy, distinct from the checks job.

Local environment: Node **v22.12.0** (declared engine 22.x), npm **10.9.0**, locked Next
**16.4.2**, React/React DOM **19.3.0**, playwright-core **1.64.0**, embedded-postgres
**17.10.0-beta.17**, actual Chrome **156.0.8078.48**. This is a fresh root-lock install,
not a fake import environment, and is not claimed to be SWE's Node v22.23.3 environment.
The production browser constructs the actual dynamically imported React canvas,
GhostSession, native 2D context and WebSocket. The full suite separately constructs
real embedded PostgreSQL and applies real migrations before starting compiled Next.

Local Next BUILD_ID: **YjsPcZnv6_WHWct37IrSb**. The [fingerprint manifest](t-1608/run-9128/fingerprint.json)
records per-file code, lock, configuration and compiled static-asset hashes. Its source
aggregate is `0ef55308de4e7d3bed6593f52b59ff68a0774a254c5b4de62277dcc8e3c0510a` and
static-asset aggregate is `416bc5ecf30fdcd3ae02a56dd4414bc24e00c7baf409afd114804b3dae6f3af8`.
The manifest specifies the hash procedure; no model assets are used by this renderer.
Local BUILD_SHA metadata defaults to `dev`, so local provenance uses the exact git
checkout and file/build hashes rather than that metadata. Nine of the prior QA's 12
source hashes match; upstream's optional probe changed the route/canvas, and test
registration changed package.json. The lock and rendering/lifecycle policy match.

## Independent user path and negative control

[independent.mjs](t-1608/run-9128/independent.mjs) is a separate QA probe, outside the
supplied SWE summary and maintained tests. Two independent Chrome processes open
Home and /ryugu, with one context in each process per room. The real runtime route
supplies the local fake endpoint; there is no browser config interception.

| Starting state / action | Observed result |
| --- | --- |
| Two members in each room, then move one pointer | Observer pixels appear at normalized coordinates; membership alone paints nothing |
| Move through multiple points, then stop | Prior trail region has pixels (70 Home, 120 palace), fades after 700ms, tip remains; idle paint count stops |
| Click in each room | Immediate local and peer ripple regions contain pixels; both cumulative draw counters advance |
| Click in Home while palace is connected | Palace ripple count stays unchanged |
| DPR 2 viewport, then resize | Full viewport canvas at origin; backing DPR capped at 1.5 and responds to resize |
| Activate Home's actual Dive control | Navigation works and the former Home peer sees departure |
| Reduced motion initially and on live change | No initial config/socket/ink; turning reduction on closes and clears the connected layer |
| Browser offline, synthetic hidden event, unmount | Off/clear, eligible reconnection within the same budget, then no layer after leaving the page |
| Fake full / abnormal flap | Full terminates after 1 attempt; flap terminates after 3; both clear drawing |
| Actual production server restarted with unset env | Direct GET empty no-store 404; probe 200/null; usable quiet page, zero sockets/pixels/errors |

Negative control: suppress native canvas `stroke` and `fill` while leaving protocol,
events and scheduling operational. The draw counter advances to 2, but pixels stay
zero and the **visible-ink assertion rejects**. This proves why a counter alone does
not establish rendered output. Normal cases call the original native painter and
assert actual alpha pixels. Decorative layer/canvas are pointer-events:none,
aria-hidden, with no aria-live; passive observation leaves controls usable.

The compiled-route E2E starts actual Next with valid `wss` and malformed query-bearing
runtime endpoints, without a rebuild or substituting `connection()`. It checks direct
200 JSON versus empty no-store 404 and both optional probe forms. Riso's real browser
controls reject an unrelated 404, same-path 500, same-text application console.error
and pageerror. Pure policy/collector tests use injected clocks, sockets and event
values; the full browser suite uses some fulfilled negative HTTP responses. Hidden
visibility is synthetic. The fan-out server is local fake transport sharing room
policy; this does not re-prove the hosted Cloudflare adapter accepted under t-1607.

The first QA harness bootstrap wrongly used DB-backed `/api/health` without a DB:
Next was ready, but `select 1` got ECONNREFUSED at localhost:5432. This was a harness
setup error, corrected by probing the actual ghost route; its raw error log is
retained. The migrated full-suite server passes independently. A lesson and the
scope decision are recorded; no application change concealed this error.

## History, ingestion and outstanding ownership

Fresh bounded task-manager history: FAILED **20/1,149**, COMPLETED **20/7,089**,
limit 10 at offsets 0 and 10; current RUNNING **5/5**, PENDING **0/0**, limit 10 at
offset 0. Fresh GitHub workflow history: failed **20/127**, successful **20/247**,
10/page at pages 1 and 2; in-progress **1/1**, queued **0/0** at page 1. Samples are
non-atomic and **history completeness is false**. Forty historical GitHub SHAs were
compared with this manifest; none has the full current fingerprint. Successful older
SHAs do not certify this executable, and unread history is inconclusive.

Earlier failed CI **40433812567**, checks **121957596650**, is now terminal/failure.
Its fresh raw annotations name the disabled-config Riso resource-error assertions.
The previous successful checks **121971457991** in run **40438060093** are at
`ea79432`; failed and green jobs use ubuntu-24.04, with runner names 1000000880 and
1000000882 respectively. `git log ebbb06d..ea79432 -- .github/workflows/ci.yml
scripts/e2e.mjs` is empty. No runner/environment cause is asserted. GitHub raw log
download returns **403** for historical and delivery jobs; annotations and fresh
local raw logs are readable, missing remote raw tails remain inconclusive.

Delivery task **6c1ca935-6a57-469d-b1ff-8d83a123c092** and verifier task
**90b5551f-8342-40f7-b204-0c620c185d83** are COMPLETED, callback **delivered once**;
persisted PM runs succeeded with callback_apply_failures=0. PM stores the matching
delivery report and gate ver-3626. Delivery raw runner tail reads 1,161 lines with
**2,841 earlier lines truncated**; verifier raw log reads all **55** lines. The former
tail includes the actual a958913 main push; the latter binds the checkout and four
passing commands. An unrelated sampled failed task
**0d9749c4-86af-41ea-b8ff-52596bb8ba62** has a raw tail showing model-at-capacity before
any delivery; it is not evidence against this renderer. See ingestion.json and
unrelated-failed-runner.json for retained boundaries. This UI feature has no product
job queue or ingestion callback; the callbacks above are delivery orchestration.

G9121-1 is repaired: all original assertions remain, expected disabled resource
errors reconcile only with exact response evidence, and negative controls remain
failures. No new t-1608 defect is observed. **G9121-2 stays open**: the historically
independent pre-ghost native-theme overlap reproduction still applies to unchanged
components/theme-toggle.tsx:71. **t-1610 SWE/QA** owns the repair/follow-up; fail if
rapid double activation emits an unhandled skipped-transition rejection. This run
does not claim to resolve that baseline defect by a green ordinary-navigation suite.

**t-1609 SWE/QA** owns persisted Pocket hide/storage propagation; reject its delivery
if reload, other-root navigation or same-origin tabs fail to preserve opt-out.
**t-1610 SWE/QA** owns maintained two-browser/deploy automation and comprehensive
failure controls; reject missing proof or changed isolation/console gates.
**t-1611 SWE then QA/acceptance** owns hosted activation and live two-browser/bad-origin
proof bound to Worker version/code+lock+config and app identity. There is no activation
escalation or hosted Worker deployment/version id yet because that dependency is not
reached. Fail product acceptance if live fan-out/opt-out/denied-origin checks fail or
identities cannot be bound. A future queue entry or credential chore cannot certify
product delivery. No capacity wait or timed soak is involved. The distinct Vercel
access operator action below was reached during this task's production deployment.

## Final deployed evidence and verdict

Native checks **121976229834** are green; production **121981152892** is terminal
**failure**, at `Deploy and verify the served sha`, 02:54:46–02:57:07 UTC. Its raw
failure annotation includes CLI **64.7.0 / Node 22.23.3**, two inspect failures
`Error: User not found`, and health still reporting the predecessor. The immutable
deployment URL is `https://otohime-olrgoztc7-otohime.vercel.app`; an independent GET
of its health returns **302 Vercel Authentication**, so its executable remains
unproven. Production logs also return GitHub **403**. We do not infer whether the
token, owning account, CLI scope or deployment promotion is the underlying cause.

Before choosing environment, compare the **same production job**: last green
**121977078467**, workflow **40438060093**, SHA `ea79432`, runner
`GitHub Actions 1000000884`; failure **121981152892**, workflow **40439524623**,
SHA `a958913`, runner `GitHub Actions 1000000885`. Both labels are **ubuntu-24.04**.
Pull/build/migrate succeed in both; only the failed deploy/served-SHA stage differs.
The git log and diff between their SHAs for `.github/workflows/ci.yml`,
`scripts/vercel-deploy.sh`, `scripts/verify-deploy.sh` are empty (saved). This is an
explicit vendor/account lookup failure beside independently green executable checks;
it is not a claimed renderer defect or a board-only authority condition. Missing raw
logs limit deeper attribution, not the observed failed deployment or wrong live SHA.

The final independent public browser run observes Home and /ryugu **200**, metadata
and real DB-backed health SHA **ea79432eb9bf23f40a18586eb91408ba1a585288**.
`git merge-base --is-ancestor a958913 ea79432` exits **1** on each route. The actual
direct route is empty no-store **404**, probe is **200/null**, and the canvas remains
off/count0/draws0/no pixels, no sockets or console/page errors. Public static asset
status, byte counts and hashes are recorded per root in public-results.json. The
deployed Next BUILD_ID is not exposed by the current metadata/API; it is unavailable,
and the local BUILD_ID is not substituted for it. The predecessor's good fallback
does not establish deployment of the submitted repair.

Status boundaries: **delivery integration not deployed**; **execution demonstrated
locally with real Next/Chrome and fake transport**; **no capacity queue/wait**;
**hosted product not delivered**. The failed deployment remains an observed defect
beside green checks. [The fix plan](fix_plan_t-1608_run-9128.md) names the exact
configuration binding and re-entry command. **esc-427**, fingerprint
`vercel-ci-access:otohime-production`, is owned by the Vercel/GitHub operator:
restore existing CI access and rerun the failed deployment. Readiness is HTTP200
`https://otohime.dev/api/health` containing the full a958913 SHA. The resumed t-1608
QA must reject missing deployed ancestry, red native checks, wrong runtime fallback
or failed negative controls. No operator polling or speculative code repair occurs.

Publication recovery: the first evidence push was rejected fetch-first. `git pull --rebase`
integrated **79f7813e939d92610a86540c71783c02973d737e**, which changes cassette
probe/test code and a project report. All ghost files, both page mounts, palace
root, root package/lock, Next config and repaired Riso tests match a958913 exactly.
On the rebased checkout, `npm test` passes **2,408/2,408**, zero failures/skips
(rebase-npm-test.log). The added cassette regression accounts for the extra test.
No operator/deployment polling occurred during this required save-work recovery.
