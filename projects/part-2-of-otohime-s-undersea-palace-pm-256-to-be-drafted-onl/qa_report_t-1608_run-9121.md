# t-1608 QA — run-9121

**FAIL, cause=code.** Delivery **ebbb06d09e6030f6a56b323247e879efdb76fcb6** has a passing
Plan Manager green gate (**ver-3624**, run-9119), but fails the repository's existing browser gate.
Disabled `/api/ghosts` produces Chromium resource-error console messages that the Riso suite rejects.
The required application deployment is also absent. No application, test-suite or CI source was edited by QA.

Recorded QA profile: **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, account codex-main,
fleet worker avietidol-mac-mini. Source run-9116 records that same profile/model/effort. These are persisted
run records and flags, rather than current role defaults. Claim and explicit decisions were recorded.

## Defect and deployment

**G9121-1 — existing E2E gate rejects disabled ghost configuration.**

- Trigger: open Home with `GHOSTS_ENDPOINT` unset in a real production Next server and Chrome.
- `ghosts/canvas.tsx:20` fetches `/api/ghosts`; the actual route correctly returns the contract-required
  empty no-store 404. Chromium emits `Failed to load resource: ... 404 (Not Found)` for that URL.
- `e2e/riso-headings.test.ts:21` collects every error console message. Assertions at **87, 110 and 155**
  therefore reject this newly introduced request, even though heading behavior and canvas fallback work.
- GitHub delivery workflow [CI #487](https://github.com/quiinthieu/otohime/actions/runs/40433812567),
  checks job **121957596650**, records **E2E against next start: failure**. Captured native annotations
  identify the first two Riso assertions; later motion and Footer checks were skipped. The captured job
  snapshot was finishing cleanup, not terminal success. No green native CI result is claimed.
- Independent local reproduction: **3 failures / 5 tests**, same resource messages and exact assertions,
  using the repository's own Riso suite against the locked production build. Raw TAP and server tail are
  retained in [riso-e2e.log](t-1608/run-9121/riso-e2e.log). The independent browser probe also records the
  exact console URL on **both** routes of the unset-endpoint server.

This is a delivered integration defect, not an environment or authority failure. The mandatory 404
contract and the existing console gate need an explicit, narrowly tested reconciliation. The
[fix plan](fix_plan_t-1608_run-9121.md) preserves that response and rejects unrelated errors.

Independent public Chrome observation at the timestamp in [public-results.json](t-1608/run-9121/public-results.json):
Home and `/ryugu` return 200 with served meta SHA **4c9f325055c6da83fbe12afe6ffeb5858efd2a89**;
`/api/health` returns 200, `ok:true`, and that SHA. Both pages lack the ghost layer.
`git merge-base --is-ancestor ebbb06d09e6030f6a56b323247e879efdb76fcb6 4c9f325055c6da83fbe12afe6ffeb5858efd2a89`
exits **1**. The old site's `/api/ghosts` is its ordinary HTML 404 (33,369 bytes, public cache header),
which cannot establish the new route's fallback. The public probe deliberately fails its delivery-ancestry
assertion after collecting both pages and APIs. This is absent deployment evidence, not a claim that
the old site runs the defective client. [Raw public observation](t-1608/run-9121/public.log).

## Local checks and independent execution

Fresh root `npm ci` succeeded on Node **22.23.3**, macOS/arm64. Actual installed versions are Next **16.4.2**,
React/ReactDOM **19.3.0**, playwright-core **1.64.0**, and Chrome **156.0.8078.48**. Production compilation,
typechecking, route import, React canvas construction, native 2D context and browser WebSocket construction
all ran in that locked environment. The actual Next route returns configured JSON/200 and unset empty/404
from the **same build** under different runtime environments, both with `Cache-Control: no-store`.
The Next request boundary is real in these HTTP checks; it is substituted only in the delivered unit test.

| Check | Observed result |
| --- | --- |
| Exact focused client/config command | 16/16 pass |
| `npm test`, including final evidence tree | 2,399 pass, zero failures/skips |
| `npm run lint` | exit 0; 10 existing warnings, no errors |
| `npm run build` | exit 0; `/api/ghosts` classified dynamic |
| Existing `e2e/ryugu.test.ts`, real production server | 12/12 pass |
| Existing `e2e/riso-headings.test.ts`, real production server | 2 pass, **3 fail** |
| Independent public delivery-ancestry probe | **fails**, served commit excludes delivery |

Build output includes existing unset Better Auth build-time warnings; the browser servers use an explicitly
public local auth fixture, not real credentials, and their error logs are empty. Generated history was restored
after building; no generated application content is included in this QA change.

[Independent browser probe](t-1608/run-9121/browser.mjs) does not reuse the supplied SWE browser script:

- Two isolated contexts per room exchange real peer pixels, brush trails and local/remote ripple arcs;
  a third context in the other room has zero peer pixels. Presence reads `1 here` only for the same room.
- Both body-portalled overlays measure `(0,0,960,720)`, stay decorative and `pointer-events:none`, have
  no focusable descendants, cap DPR at 1.5, and resize their backing buffers with the viewport.
- Pixel counts shrink to a static tip after fading; canvas clears stop while idle. Departure removes
  presence and tip pixels. Native pointer movement is normalized and respects the 100ms send floor.
- Pointer and keyboard controls work. Initial reduced motion creates zero sockets/pixels. A media change
  closes a live socket and clears marks. Real offline/online changes close/resume transport. The visibility
  listener is exercised using a **synthetic** `document.hidden` transition, not an OS backgrounding claim.
- Unset configuration is awaited as an actual 404 before accepting `off`, with zero sockets/pixels. Full
  mode terminates after one attempt. Upgrade refusal and loss after visible drawing terminate after
  three attempts with zero remaining pixels. Refusal-console messages are expected fault-injection evidence.
- **Negative control:** suppress native `stroke`/`fill` on this canvas. Arc calls still occur, but pixels
  stay zero and the same visible-ink assertion rejects the result. A counter alone cannot prove rendering.

Results and raw observations: [browser-results.json](t-1608/run-9121/browser-results.json),
[browser.log](t-1608/run-9121/browser.log). Local browser execution uses the **Node fake fan-out server**,
not a hosted Cloudflare Worker. The unchanged Worker/DO was not redeployed or reconstructed in this task.
No real visitor frames, cookies, personal identities, secrets or binary artifacts were retained.

Probe history is explicit: the first departure assertion raced membership publication against the next paint;
the revised check awaits actual zero pixels. A supplemental run hit a skipped overlapping theme
ViewTransition when controls were activated rapidly. Its raw failure is retained separately; final control
checks await actual transition completion and still reject all page errors.

**G9121-2 — pre-existing overlapping theme transitions.** A separate native-browser baseline probe
reproduces the same AbortError on public **4c9f325**, with **zero ghost layers**, by synthetically activating
the actual theme button twice in one event turn. `components/theme-toggle.tsx:71` attaches `finally` to a
rejectable `finished` promise without consuming its rejection; that file is unchanged by the delivery.
[Baseline code and evidence](t-1608/run-9121/theme-baseline.mjs),
[result](t-1608/run-9121/theme-baseline.json). This establishes a pre-existing control defect, not a new
ghost failure or an environment excuse. **t-1610 SWE/QA** owns tracking the broader browser regression;
failure condition: rapid theme activation still emits an unhandled skipped-transition rejection. Its repair
is outside this task's ghost/layout non-goals and remains open; serialized-control proof does not waive it.

## Identity and history limits

Local Next BUILD_ID: **yOIaHIx7bJjmqEMhtbxiW**. Independently recomputed executable code+lock+configuration
fingerprint: **93c27bf76da4d48eb0838a2fbc80884c2c595c6fc98c846225de4174f0657950**, matching the delivery.
Root lock SHA256: **9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b**.
[fingerprint.json](t-1608/run-9121/fingerprint.json) names all inputs, real installed versions, compiled route
and canvas chunk hashes, and build manifest hashes. Local build meta SHA is `dev`; git source/fingerprints
identify its delivery. Configured and disabled runtime boundaries are recorded separately. There are no
ghost-specific model/data assets. No hosted Worker version/hash is inferred from application readiness.

Task-manager scan: two pages, limit **10**, offsets **0/10**, each for FAILED and COMPLETED:
**20/1,145 FAILED**, **20/7,000 COMPLETED**. Initial current snapshot reads **10/11 RUNNING** and
**0/0 PENDING**. A later offset-10 current read is empty with total 6: the population changed, so the
combined snapshot is **non-atomic and incomplete**. No matching ghost failure was found in those windows;
older unread history is inconclusive. [Task history](t-1608/run-9121/task-history.json).

Explicit identity lookups supplement the bounded window:

- SWE run-9116 / task **e63ac27e-ea91-4016-b607-01eb3d41ba9d**: COMPLETED, callback delivered once,
  persisted succeeded run, delivery SHA and rep-5373. **1,047** runner-tail lines read.
- Green run-9119 / task **905c7af9-72c5-43f4-ba3f-8ea14a8853d2**: COMPLETED, callback delivered once,
  persisted succeeded run and ver-3624: all four contract items pass at `ebbb06d`. **55** lines read.
- Failed unrelated run-9109 / task **7e3c8ba6-7fb6-4af7-95f0-998bb05d4e9f**: FAILED, callback delivered
  once; **1,057** raw runner-tail lines read. Tail identifies Lanyard `push_not_on_main` and rescue commit
  `90b623b`, not this ghost executable. No ghost defect is inferred from that different fingerprint.

Selected raw tails and persisted ingestion identities are in [ingestion.json](t-1608/run-9121/ingestion.json).
The APIs provide bounded tails, not proof of full transcript coverage. This feature has no product runtime
queue or ingestion callback; those callback checks concern the delivery/gate orchestration only.

GitHub scan: two pages each, **10/page**, **20/126 failed**, **20/245 successful**, plus **2 in progress**
and **0 queued** in the captured current snapshot. All 40 historical SHAs were compared with this exact
code+lock+config fingerprint: **zero match**. Current #487 does match and has the observed E2E defect;
pending work cannot waive it. Historical #484 failed Footer Chromium; preceding green #483 succeeded.
Both use ubuntu-24.04, and CI/probe configuration history between their SHAs is empty. Their raw job logs
return **HTTP403**, so the historical underlying assertion remains unread and environment attribution
would be unjustified. Public API later hit HTTP403 rate limit; no polling continued. Captured annotations
plus the independent local raw reproduction establish the present defect without inventing missing logs.

## Delivery boundaries and repair owners

- **Execution demonstrated:** configured local production UI, actual browser/canvas/socket construction,
  independent pixel/negative-control evidence and passing palace regression suite, with the console defect above.
- **Integration deployed:** **not for t-1608**; observed production is `4c9f325`, ancestry exit 1. QA cannot pass.
- **Waiting for runtime capacity:** none. No queued job is offered as execution or delivery proof.
- **Product delivered:** no. Configured hosted fan-out is not observed; local fake proof does not establish it.
- **G9121-1 owner:** successor SWE repair for **t-1608**. Failure condition: any original contract check or
  repository browser gate remains red, or unrelated console/resource errors become ignored. Re-run CI on push
  and repeat independent deployment ancestry/public route checks before QA can pass.
- **t-1609:** persisted Pocket hide preference/cross-tab behavior; not shipped by this task. Fail if hidden
  preference permits sockets/drawing or fails persistence in that successor's delivery.
- **t-1610:** maintained exhaustive two-browser automation and deployment workflow. Fail if its negative
  control accepts invisible/cross-room marks or fails to run in the required CI environment.
- **t-1611:** hosted Worker activation and credential/deployment chores only when that dependency is reached.
  Fail if real same-room rendering, denied-origin protection or app/Worker identities disagree. No activation
  escalation or hosted deployment id exists in this run. No operator action is needed to fix this CI defect.

Standing sources absent from the working tree were recovered with `git show` from the local platform
repository at **f1c5b0f22df35ea818a9a8d4f095f6d1d117bc04**. Installed Next connection, route-handler and
lazy-loading guides were read. QA reports/evidence are saved under this plan folder; source remains unchanged.
