# Pocket preference QA · pm-257/t-1609 · run-9175

**PASS for t-1609's local/fake-transport scope authorized by the recorded esc-427 resolution.**
Cited delivery: **cce131daf5c5648830ffe50a7d756e8adc490d73**.
Green gate **ver-3646**, verifier **run-9174**, passes all four contract commands at cce131d.
No application, maintained test, Worker or CI source was edited by this QA run.

**Deployed SHA: e120461717f7e69c17d88f7512e776206d8fe664.**
`git merge-base --is-ancestor cce131daf5c5648830ffe50a7d756e8adc490d73 e120461717f7e69c17d88f7512e776206d8fe664`
exits **1**. Thus this preference integration is pushed, local execution is demonstrated,
integration deployed is **unproven**, and Ink Ghosts product delivered is **unproven**.
There is no capacity wait or product runtime queue. This scoped pass does not certify
production deployment or hosted fan-out. esc-427 explicitly directs that t-1609/t-1610
need no Vercel deployment and must retain that distinction; its full recorded resolution
is in [platform evidence](t-1609/run-9175/platform.json).

## Checks and independent user path

Fresh `npm ci` used the unchanged committed root lock. All declared commands passed:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test ghosts/pref.test.ts ghosts/client.test.ts` | 19 pass; zero fail/skip |
| `npm test` | 2,454 pass; zero fail/skip |
| `npm run lint` | exit 0, ten existing warnings, zero errors; repeated after adding QA probes |
| `npm run build` | exit 0; real Next compilation, types and 206 static pages |
| `TMPDIR=/tmp npm run test:ghosts-pref` | final complete rerun: four pass; zero fail/cancel/skip |

The first maintained browser run had **three pass and one cancellation**, at the
cross-tab test's 30-second deadline (`e2e/ghosts-pref.test.ts:179`). Its process exit
was 1 even though TAP's fail counter was zero. The exact unchanged case then passed
alone in 2.7 seconds; the complete unchanged suite passed in 26.8 seconds. Preserve
this unexplained intermittent observation **QA9175-TIMEOUT**; a passing retry does
not explain it. No deterministic preference failure was reproduced. Repeated timeout
or a reproducible cross-tab failure must reopen investigation at that line; t-1610
SWE/QA owns broader maintained browser automation. No timeout increase or weakened
assertion was used. All attempts remain in [verification](t-1609/run-9175/verification.json),
[initial browser log](t-1609/run-9175/browser.log),
[isolated log](t-1609/run-9175/browser-isolated.log) and
[complete rerun](t-1609/run-9175/browser-rerun.log).

The maintained suite establishes keyboard Enter/Space, touch, menu-only semantics,
`aria-pressed=true` meaning enabled, synchronous close/clear before the click returns,
reload/root navigation persistence, corrupt/denied storage fallback, initial/dynamic
motion/visibility/offline suppression and three-attempt exhaustion across toggles.
It checks Dive, Sea sound, Print run, Bottle and game controls remain present. Pure
tests additionally establish server-hidden snapshots, malformed storage policy,
same-tab synchronous subscribers, cross-tab clear/sessionStorage discrimination,
listener cleanup and inert cancelled callbacks across connection generations.

I newly authored and ran [an independent probe](t-1609/run-9175/independent.mjs),
separate from the supplied SWE proof script. It uses two separate Chrome processes,
actual compiled components, native WebSockets, actual localStorage events and native
2D pixel samples. Its [seven recorded cases](t-1609/run-9175/independent-results.json)
all passed with zero page/application-console errors:

| Starting state | Driven action | Observable result |
| --- | --- | --- |
| Home in two Chrome processes, palace in a same-origin tab | Move/click in Home | Peer receives actual ink pixels, independent of data attributes |
| Active ink and transports | Home Ghosts off | Same-click socket close and canvas clear; palace storage event closes its socket and clears; driven frames/pointers produce no paints/messages/config/socket work |
| Hidden stored choice | Full palace reload, then hydration/idle/frame turns | Zero configuration fetches and sockets before opt-in |
| Hidden palace | Enable through Home keyboard, then native cross-tab storage clear | Fresh anonymous identity; one connection per eligible transition; key=null clear restores palace eligibility |
| Connected palace | Browser motion emulation or actual browser-context offline, then restore | Clear/close and no suppressed work; one fresh connection on restore |
| Separate negative fixture | Block only application storage-listener registration, then Home opt-out | Native storage event arrives, palace remains on with zero closes; the ordinary expected-off assertion rejects it |

The independent negative control demonstrates that broken subscription wiring cannot
pass this check. The maintained suite also rejects a disabled-paint pixel control.
All controls change only self-owned browser fixtures, never production source/state.

## Runtime and build identity

[Preflight](t-1609/run-9175/preflight.json): Node **22.12.0**, npm **10.9.0**,
darwin/arm64, locked Next **16.4.2**, React/ReactDOM **19.3.0**, playwright-core
**1.64.0**, real Chrome **156.0.8078.48**. Real package imports succeeded; the
compiled request-time GET, React preference adapter, GhostSession construction,
dynamic canvas, WebSocket and 2D context executed in the production server/browser.
A fake runner is not the dependency proof. The relay alone is the local fake.
The changed executable is the app/client, not the unchanged Cloudflare adapter.
No hosted Worker construction, version, credentials or deployed fan-out is claimed.

Real/fake limits: native cross-tab storage, pointer actions and context offline are
real Chrome behavior. Motion is media emulation. The maintained visibility/offline
property changes are injected events, not physical device background/network tests.
Pure tests inject storage, sockets, clock and scheduler. Blocked storage preserves
only the current page's memory choice; reload/tab persistence is impossible when
the browser denies storage. No account/visitor data or product callbacks are involved.

The [26-path fingerprint](t-1609/run-9175/fingerprint.json) covers source, root lock,
config, both page mounts, API route, Pocket, fake and relevant tests:
**2a4e06d860e46b29c2c27c878d06da034a151f9af322e1ffd161c8990ac42df5**.
It matches cce131d 26/26; no inspected historical failed workflow matches this full
executable fingerprint. Older renderer behavior cannot certify the new preference.
Next BUILD_ID **mKBLbo_iRpdWEf68HN_2V**. Local static artifacts: 131 files,
aggregate **f50b8e92eaafc79f23acb6820b707fc552e67542994ee82fec5c205b85e24354**;
server app JS/JSON: 456 files, aggregate
**32fc69861c2045b02f05bf145c3a7aea331ea1f6ba1572fd25d6e923a67346a4**.
Per-file hashes are retained. No model assets are used. Public served asset hashes
are separate from this local build; historical build artifacts were unavailable.
The prebuild-generated history index was restored before committing QA evidence.

The installed Next client-boundary/lazy-loading guides and the standing instructions
were read. The two shared documents absent in otohime were read from the available
`/Users/avietidol/Library/Application Support/build-worker/repo/mono-v2` checkout.
The full runtime diff was read. Main advanced by **f4a3d0d3f82ff257f9c981a2551a2a0d3d930d22**;
its two QA documents and empty non-project diff were inspected before fast-forwarding.
The executable source/lock/config bytes remain identical to the tested delivery.

## Deployed API, CI and history

A separate [public Chrome/API probe](t-1609/run-9175/public-results.json), without
route interception, observed Home and palace HTTP 200, matching build metadata/health
e120461, quiet decorative off canvases, zero ink/sockets and **no Ghosts chip**.
Direct `/api/ghosts` is empty 404/no-store; `?probe=1` is 200 `null`/no-store.
This proves the existing dark fallback, not the new preference or active product.

Fresh native CI snapshot: workflow **40461166952** for cce131d is **in progress**;
public checks job id **122045871581**, no completed delivery result observed.
See [public snapshot](t-1609/run-9175/ci-delivery-public.json). A queued/running job
does not prove execution success or delivery. The board green gate above is independently
persisted and passed, not inferred from that native job.

Native latest inspected failed production job **122037570828**, workflow **40456936288**,
at e120461 has green checks **122032343083** and red Vercel inspection. Its public
annotation contains both CLI 64.7.0 `User not found` failures. The same production
job's last inspected green is **122000364994**, workflow **40445352898**, at a7da8e8,
also ubuntu-24.04. Git configuration log/diff between them was read: 7735e74 makes
inspect fail closed, f83c73f/d6221b7 improve diagnostics. Through delivery, **f08f670**
then requires VERCEL_ORG_ID and adds `--scope` to both inspect calls. That changed
pipeline fingerprint has no terminal hosted result in this snapshot; neither the
old red jobs nor the local fake CLI certify it. All ten attempted raw failed-job
log downloads returned **403 admin rights required**. Causality beyond the public
failure annotations is inconclusive; no invented credential remedy is asserted.

| Evidence source | Read | Limits/completeness |
| --- | --- | --- |
| Task-manager FAILED | 10 / 1,164 | 5/page, offsets 0 and 5; incomplete |
| Task-manager COMPLETED | 10 / 7,186 | 5/page, offsets 0 and 5; incomplete |
| Task-manager RUNNING / PENDING | 4 / 4; zero pending returned | 25-item bounded pages; non-atomic snapshot |
| Native failed / successful workflows | 10 / 133; 10 / 249 | 5/page, pages 1 and 2; incomplete |
| Native in-progress / queued workflows | 2 / 2; 0 / 0 | one 5-item page each |
| Native job-detail pages | 12 / 22 unique workflows | remaining ten returned rate-limit 403; incomplete |
| Raw failed native logs | 0 / 10 attempted readable | admin-rights 403; annotations read instead |
| Task-manager raw runner tails | SWE, gate, one failed runner | bounded tail API; not full archives |

The history JSON, annotations, denials and fingerprint comparisons are retained
under [run-9175](t-1609/run-9175/). No quota polling or idle waiting was used.
Unread pages/logs are inconclusive. The previously observed repeated production
inspection defect remains open beside the pending scoped repair; it was not waived
by the queue. Historical client 404-console failures predate the renderer repair;
their missing/new preference files are identified in the manifest rather than
misattributed to cce131d. Older footer failures' raw logs were unreadable, so no
claim of exhaustive baseline health is made.

SWE task **35f1dcbe-41b8-4128-8d7e-280b9d0b20ac** and verifier task
**2edb2244-8f91-4fc7-9b7a-dadea4e71144** are COMPLETED with callback delivered once.
Persisted runs run-9169/run-9174 are succeeded with zero callback apply failures;
the SHA-bound report and gate establish persisted ingestion beyond queue state.
Raw SWE tail includes the cce131d push and gate tail names all four passed commands.
Sampled failed runner **d8f818df-6d22-4a71-9ce8-6f409d3231dc** concerns a different
desk red-gate task at 2a35aac; its full returned 61-line tail shows passing tests
followed by a push guard/rescue, not a preference failure. Its callback was also
delivered once. These orchestration callbacks are not visitor/product output.

Recorded QA identity: **run-9175**, task **c9f6cb4d-762c-4deb-8a8e-d0a658af2765**,
profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, fleet
**billie-mac**, account **codex-main**. SWE run-9169 records that same actual
profile/model/effort on billie-mac; run-9174 is a shell verifier on
avietidol-mac-mini, without a model. Commit author text is not model attribution.

## Deferred evidence and defects

| Id | Owner | Outstanding check / failure condition |
| --- | --- | --- |
| esc-427; production workflow 40461166952 | Existing operator/CI owners; t-1611 QA | Served ancestry excludes cce131d, any scoped inspect/native check is red, or deployment lacks independent live proof. Existing access chore remains; no new credential action requested here. |
| t-1610; QA9175-TIMEOUT | SWE then QA | Investigate if the maintained cross-tab case at e2e/ghosts-pref.test.ts:179 times out again or produces a reproducible preference failure; retain this initial cancelled attempt. |
| t-1610; G9121-2 | Assigned SWE/QA | Prior baseline overlapping theme-activation rejection at components/theme-toggle.tsx:71 remains an assigned code defect; this run did not re-prove its repair. |
| t-1610 | SWE then QA | Missing or failing broader two-browser, full CI/fake lifecycle and dark deploy-workflow contracts. |
| t-1611 | SWE, QA, acceptance | Missing real hosted two-browser output, origin rejection, opt-out, matching app/Worker locks/config/version or deployment ancestry. Queued jobs and fake proofs cannot satisfy this. |

No new reproducible t-1609 product defect was observed. Remaining history and hosted
checks are explicitly unproven. Judgement calls, scoped acceptance and the timeout
lesson were recorded through plan_manager_record_decision. This pass accepts the
authorized preference implementation scope only.
