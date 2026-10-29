# t-1766 — Susuki footer delivery evidence

## Save-Data compatibility repair — run-9762

Branch `pm-299-t-1766-run-9762` starts at freshly fetched main
`3977e52e3ecd5cc27082d6aae4fc976fd34c03dd`, which already contains the complete
Susuki implementation and the published `fix_plan_run-9749.md`. No recovered
implementation was dropped or duplicated. This repair follows that fix plan:
the connection type permits optional event methods, and subscription **and
cleanup** guard the methods themselves. Full NetworkInformation/EventTarget
objects continue to receive real `change` subscriptions. The older Kame,
Kame Fetch and Peep-box Save-Data fixtures and all their assertions remain unchanged.

The expanded Susuki suite covers a plain `{ saveData: true }` object and a real
`EventTarget` control. Both render a nonblank single static frame with zero
ambient rAF, retain visible page/footer content, and produce no console/page
errors across input and client navigation. Real connection events switch
static → live → static. Instrumentation forwards to real browser methods and
proves one old GL program is deleted and the departed connection listener is
removed, leaving only the new footer's listener. A post-cleanup event cannot
redraw the old canvas. Next's Cache Components retains hidden route DOM using
Activity; tests verify effect cleanup and the visible replacement rather than
requiring DOM disconnection.

### Verification and executable identity

| Check | Result / complete worker capture |
| --- | --- |
| New plain-object regression against the pre-repair production executable | **0/1**, canvas removed during mount; `negative-before-fix.log` |
| Five targeted suites, fresh production build, then final fixture rerun using that build | Final **56/56**, zero failed/skipped; `targeted-final.log` (33 older checks including nested tests, 23 Susuki/Bottle) |
| Exact contract Susuki/Bottle command, including another fresh production build | **23/23**, zero failed/skipped; `required-final.log`; generated history restored by the contract's command |
| Complete native `SKIP_BUILD=1 TMPDIR=/tmp npm run test:e2e` | **282/282**, zero failed/skipped; **833.80 seconds** wall time; `full-native.log` |
| `TMPDIR=/tmp npm test` | **2,792/2,792**, zero failed/skipped; `unit.log` |
| `npm run typecheck` | Pass; `typecheck-final.log` |
| `npm run lint` | Pass, zero errors, 13 existing unrelated warnings; `lint-final.log` |
| `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | Certified, `local_controls=pass`, `failures=[]`, external evidence inconclusive; `closure.log` |
| `SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh` | **67 ok**, zero failed; `walk.log` |
| `CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh` | **177 ok**, zero failed/errors; `probe.log` |

Worker captures and `commits.txt` are in `shared/artifacts/` outside the checkout;
per-run captures are in its `run-9762/` directory. No raw server logs, reset
links, binaries, generated build output or dependency changes are committed.

`npm ci` installed the unchanged lock. Actual runtime: Node **22.23.3**, Next
**16.4.2**, React **19.3.0**, Playwright Core **1.64.0**, embedded Postgres
**17.10.0-beta.17**, Chrome **156.0.8078.73**. The persisted run records the
actual fleet profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort
**high**, worker **avietidol-mac-mini**. Installed client/lazy-loading and
Cache Components/Activity guides were read. The chief-of-staff extraction and
`docs/claude/software-development.md` remain absent; no code graph tool or RTK
configuration is available in this run.

Initial verified production build ID: **rxzVNM7VGs9VLSHxslmEm**. Ordered task fingerprint
(same file list and SHA-256-of-ordered-hash-lines algorithm as the original
record below): **b583efe3ffc6db8173b23531faa16dc48812241e7dd2ab8eae52989c8a3e2062**.
Actual field chunk `.next/static/chunks/1xl0eq5fzmjvh.js`: SHA-256
**a39e2102548f08a5592327d1fe407ffbc357f728e228f3941df15ee9bb50b352**.
Lock SHA-256 remains **9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b**.
`executable.json` binds all source/test hashes, build, chunk and installed versions.
The complete failure-free native suite finished below the existing 960-second
command limit, so CI timing/configuration is unchanged. This local measurement
does not predict the remote runner's runtime or establish a green CI result.

Execution is real production Next import/build/start, migrated embedded
Postgres, browser GL adapter/shader/buffer/texture/fox-atlas construction,
instanced draws and framebuffer reads, native input and actual GL context
loss/restoration. Basic-object/Save-Data/no-WebGL/visibility capabilities are
explicit fixtures; the EventTarget subscription is real. Existing Ghosts/Bottle
network fixtures do not establish third-party services. Static GL ink is
**214,176 pixels**, one draw and zero rAF; Canvas2D is **75,838 pixels**, zero
GL calls/rAF. All original season, fox, pointer/scroll, accessibility, links,
five-SVG, waterline and zero-geometry-shift assertions remain. The real-framebuffer
negative control clears ink to exactly zero and observes drawing resume.

Two intermediate captures are retained rather than concealed: `targeted-initial.log`
passed **51/56**, failing five new cleanup fixtures that incorrectly required
DOM disconnection; `required-e2e.log` passed **22/23**, with one new test comparing
frames before navigation against frames after a legitimate hide/resize. The
final fixtures use actual disposal/listener evidence and snapshot the old
canvas after cleanup, before dispatching the event being tested. Product code
was unchanged during these fixture repairs.

### Fresh-main integration

Main advanced during verification with the independent Ink Departures feature.
A normal fast-forward brought `de21b2f064d73255970443844e3b1c0075e1f611` into
the uncommitted task branch without dropping or duplicating any work. All task
changes remain confined to Susuki source/tests, this evidence, and native
input setup in two existing test files described below. The new production build ID
is **d44Wfv0nEdvhue9bY-LXo**; the Susuki fingerprint and actual emitted field
chunk hash above are unchanged. `pre-integration-executable.json` retains the
initial build identity; `executable.json` describes this integrated build.

Both exact contract commands were rerun on this base: **23/23** Susuki/Bottle,
**2,794/2,794** units, types/lint pass (13 unrelated warnings), and certified
closure with external evidence inconclusive. Captures use `integrated-*.log`.
The final full native rerun passes **292/292**, zero failed/skipped, in
**842.39 seconds** (`integrated-native-final.log`), below the unchanged 960s
command limit. The integrated HTTP walk passes **67/67** (`integrated-walk.log`).
The final browser probe passes **177/177**, with zero hydration, console, page,
network-attribution or local server errors (`integrated-probe.log`), using
Playwright's Chromium **156.0.8078.4**. No observed local defect remains.

The first integrated full run found two additional Kame Fetch setup failures:
the Peek hover wait and the drag-proxy wait, at checks 119/123. The new upstream
board is above the project cards. A real Chrome diagnostic measured the first
card at **y=1351.703125** and grip at **y=1389.703125** in an **860px** viewport;
`elementFromPoint` at the original pointer target returned **null**. Revealing
the card moved it to **y=351.703125** and the actual Peek opened. The test-only
repair in `e2e/kame-fetch.test.ts` reveals the card/grip **before** measuring
native input coordinates. All hover, proxy, cancellation, geometry and negative
assertions remain. The focused real-browser rerun passes **2/2**
(`kame-focused.log`); `kame-geometry-diagnostic.json` retains the offscreen
negative control and revealed positive result. This is an explicitly recorded
test-scope extension following concurrent upstream integration, not a change
to Kame, Departures, `/shelf`, or another product route.

That integrated capture completed **289/292**, with those two failures and a
late `tactile-tear.test.ts` geometry fixture failure: keyboard focus legitimately
scrolled the offscreen card from **y=1351.703125** to **y=180.703125** after its
baseline was recorded. The baseline now follows focus, before the peel action;
all geometry, margin, reload, route cleanup and native-link assertions remain.
Its focused real-browser rerun passes **1/1** (`tactile-focused.log`). Both test
extensions were recorded through plan-manager. No capability fixture or
assertion was weakened. The complete failed capture is retained, and the final
full native rerun includes both corrected files.

The final combined executable/regression fingerprint is
**e73eb20793a1b5e28772785299e23cb4e0f59b05bc5232e24e8da99dedf56765**: append
`e2e/kame-fetch.test.ts`, then `e2e/tactile-tear.test.ts`, to the ordered hash
list above. The manifest retains the unchanged Susuki core fingerprint as
`susuki_core_fingerprint`. Both the field chunk and locked environment remain
identical through these fixture-only corrections. Final typecheck/lint pass
after both corrections (`integrated-typecheck-final.log`, `integrated-lint-final.log`).

### Publication retry 1

The first normal main push of `e8ffbc51470be6470d6f2d8e8187c639322c9396`
was rejected as fetch-first. The authorized `git pull --rebase origin main`
preserved every change above **b241fd1873f9431ed7a0c859272d1844c731b07c**;
the retained repair is **838eb9305ac90bfb9eb13ce55545092ae8b8818a**.
No force push, reset, stash, amendment or dropped work was used.

The intervening upstream commits change **tests, CI/Vercel configuration and
evidence**, with no application, library, lock or Next config changes. They
independently convert four older Save-Data fixtures to real EventTargets,
synchronize Pachinko's normal-record drain, and change CI to a 1200s command,
22m step and 35m job. They also disable Vercel's automatic Git deployment.
Those upstream changes are preserved and are not attributed to this repair.
The plain-object Susuki regression remains explicit and passing; replacing it
with an EventTarget would conceal the compatibility boundary and was not done.
Earlier statements about the older fixtures and 960s budget describe the
pre-retry integration, not these subsequently inherited changes.

Both exact task gates passed again after rebase: **23/23** Susuki/Bottle from a
fresh production build, **2,795/2,795** units, types/lint and certified local
closure. Captures are `retry1-{required,unit,typecheck,lint,closure}.log`.
The affected five browser suites pass **56/56** (`retry1-targeted.log`), the
changed Pachinko scenario passes **1/1** (`retry1-pachinko.log`), and the footer
HTTP walk passes **67/67** (`retry1-walk.log`). The final retry browser probe
passes **177/177**, with zero hydration, console, page, unexpected network or
local server errors (`retry1-probe.log`). The complete **292/292** native result
above applies to identical application sources/lock and real field bytes,
with the then-current fixtures; it is **not** represented as a full run of
the subsequently revised upstream fixtures. Focused retry execution covers
those revised fixtures and the changed CI regression tests.

Retry build ID: **VCdkz0WZcWow8r7k8Rugh**. The Susuki core fingerprint and field
chunk hash above remain identical. `retry1-executable.json` records the new
test/config boundary: extended fingerprint
**25c3c31c0fe5bee4e919c088c542cf691474cd4b284b0963a6ab6143285936a7**,
adding the other changed browser files, CI workflow/test and `vercel.json` to
its ordered source-hash manifest. An additional task-prefixed evidence commit
is required to preserve these post-rebase results without amending the repair.

### Publication retry 2

Retry 1's normal push at `4a2756dfc8007012bf733ec9ce164aa36a2ee07e` was also
rejected as fetch-first. A second authorized rebase preserved both task commits
above **d88c1bfb00834a88a341b77bd0ee5465de3bd74d**. The intervening source change
only preserves `SKIP_BUILD` for CI's camera verifier, with corresponding CI
regressions and evidence; there is still no application/library/lock/Next
configuration change. This upstream camera wiring is retained, not claimed as
this task's implementation or separately accepted camera execution.

Both exact task gates pass again: **23/23** Susuki/Bottle, **2,798/2,798** units,
types/lint and certified local closure (`retry2-*.log`). Footer walk passes
**67/67** and the browser probe passes **177/177**, zero runtime/console/page/
hydration/unexpected-network errors. Retry build **WAmTEWvgt8qLKKWkGV14E** is
bound by `retry2-executable.json`, fingerprint
**00d1a36d87269745eaa2926cf9573625de3220864c2b5dd3dc886a07e1f4cb8a**.
The complete native and affected
browser proofs above retain the same application and fixture sources; the new
CI build-reuse behavior is covered by the updated project unit checks. No
application or old fixture defect is waived by a pending publication.

### History and handoff limits

This run independently read two task-manager pages per terminal status (limit
10, offsets 0 and 10): **20 of 143 FAILED**, **20 of 1,006 COMPLETED**, plus
all **3 RUNNING** jobs at that snapshot. The unpaginated plan list had **26**
runs, including eight t-1766 records. Native raw tails for run-9726 (1,009
lines; 2,993 omitted), run-9742 (780; 3,222 omitted), and run-9749 (759; 3,243
omitted) were read. They confirm the successful original main publication,
run-9742's later `push_not_on_main` failure, and the published code-defect QA.
All three native callbacks are delivered in one attempt; persisted plan runs
have `callback_apply_failures=0`. Run-9749 is a completed agent execution with
a persisted **failed/code QA report**, not a passing acceptance result.
Callback payload internals and omitted raw history remain **inconclusive**;
`history-summary.json` records the bounded scan. Old CI failures **40817421327**
and **40817663407** belong to the old executable and are not erased by this repair.

Local execution is demonstrated; runtime capacity is available. This SWE run
does not observe a repair deployment or claim product acceptance. Per the
stop-at-push contract, **plan-manager** owns repair-SHA CI/green-gate continuation
(`t-1766/CI-green-gate`), and **quality_engineer** owns deployed ancestry and
basic-object/EventTarget acceptance (`t-1766/deployed-QA`). Any failed job,
timeout, excluded repair ancestry, removed page, console error, extra static
frame or ambient static rAF fails those checks. New pipeline/deployment IDs
are unobserved before push and are not invented. Platform owns final callback
ingestion for `run-9762`; a missing/failed report application fails that handoff.
No operator chore, capacity deferral, CI polling or deployed check is used.
Decisions and lessons, including Activity retention, were recorded through
plan-manager. Owner identity is checked before every task-prefixed commit;
the post-push summary and artifact `commits.txt` bind its immutable delivery SHA.

## Publication retry and browser synchronization regressions — run-9726

The runner supplied recovered HEAD `8cf342d023452b7fd76cc7e90e8536163363907e`
on local `main`, with implementation `f288c44c6bb0f9c7921bd2c5fb8757a409726ade`
already rebased above `377dfe09193ff6d0aa3ab4fd02d339749485a19e`.
After fetching, this run created `pm-299-t-1766-run-9726` at that HEAD without
another initial rebase. Both task commits and all unrelated upstream work are
preserved. No source, tests, or plans were dropped. Only the generated
`content/history.json` was restored using the contract's explicit command;
its pre-build contents were backed up in worker artifacts.

Fresh browser execution found a real test synchronization defect: the test's
`uScrollBoost > .01` predicate could observe the boost from `scrollIntoView`
before the subsequent requested scroll event arrived. The event trace shows
initial scroll at y=2711, pointer input, a fox trigger, then the requested
scroll at y=2621 while the fox was trotting. The product correctly cancelled
the fox, leaving `uFox=-1` and phase `done`. The initial suite failed 20/21;
a focused diagnostic run reproduced the same failure. The regression now
awaits the native event for its requested scroll before checking the uniform
and triggering the fox. No cancellation behavior or assertion was weakened.
Temporary diagnostic instrumentation was removed after saving its trace.

The initial full footer probe passed 176/177 checks. Its blocked-storage
Konami fixture positioned the whole tall footer, then typed without focusing
or revealing the console. EndStage subscribes to keys only while its own
stage intersects. The fixture now focuses the mascot, centers the actual
stage, observes `data-active=true`, and uses the existing bounded badge
settling helper. Storage remains blocked and the real keyboard, unlock,
LCD and zero-error assertions remain intact. This is a browser setup repair;
product source is unchanged. The initial failure is retained in `probe.log`.

| Local verification | Result / worker artifact |
| --- | --- |
| Fresh production build, real migrated embedded Postgres and Susuki/Bottle E2E | Initial build passed; initial suite 20/21 (`e2e.log`), focused diagnostic 0/1 (`fox-debug.log`), final suite **21/21**, 0 failed/skipped (`e2e-fixed.log`, reuses that production build) |
| `TMPDIR=/tmp npm test` | **2,784 pass**, 0 failed/skipped before and after both fixture repairs (`unit.log`, `unit-fixed.log`) |
| `npm run typecheck` | Pass before and after both repairs (`typecheck-final.log`) |
| `npm run lint` | Pass before and after both repairs; 0 errors, 13 unrelated warnings (`lint-final.log`) |
| `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | Certified before and after repairs; `local_controls=pass`, `failures=[]`; external evidence inconclusive (`closure-final.log`) |
| `SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh` | **67 ok**, 0 failed (`walk.log`) |
| `CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh` | Initial 176/177 (`probe.log`); final **177 ok**, 0 failed, zero page/console/hydration errors (`probe-fixed.log`) |

Worker artifacts are under `shared/artifacts/run-9726/`. Fresh production build
ID: `yimUpH2uMA8XN9ox7WckF`. Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`,
React `19.3.0`, Playwright Core `1.64.0`, embedded-postgres `17.10.0-beta.17`,
and E2E Chrome `156.0.8078.73` were actually used. The footer probe uses
Playwright `1.64.0` Chromium `156.0.8078.4`. Installed versions were
checked against the unchanged lock; the contract permits the supplied
`node_modules`. The installed Next server/client and lazy-loading guides were
read. This fleet run uses profile `codex-sol-6-1-high`, model `gpt-6.1-sol`,
reasoning effort `high`, as recorded by plan-manager.

The unchanged production field chunk `.next/static/chunks/12qgltjgzy1gg.js`
has SHA-256 `5ca02dfa389bb4c1055229019d254b2dc447eff5ad2dd7e5735319091ec1ff16`.
The ordered code/lock/config/test fingerprint defined below is now
`d469a1021086e1fe1d017447f2188fb56374d7767cfaf54e4429d321ab7a5737` because
of the two browser fixture repairs. Its predecessor was
`e8391b38fb8be6554832b0c4b09a13b5faae00b13e4ba943c0b9521d436f5fa0`;
production source, shaders and baked fox atlas are unchanged. Both hash lists
are in worker artifacts, correlating execution across recovered commit IDs.

Final browser observations: live ink **214,242 pixels**; reduced motion and
Save-Data **214,176 pixels**, one draw and **zero Susuki rAF callbacks**;
Canvas2D fallback **75,838 pixels**, zero GL draws and zero rAF callbacks.
The real GL uniforms prove pointer/scroll response, four seasonal tints and
the same-draw fox instance; native touch, context loss/restoration, clickable
controls, five SVGs, last-child waterline and **0 px** geometry shift pass.
The negative control clears the actual framebuffer and observes exactly zero
ink pixels before rendering resumes. Shader imports/compilation/linking,
adapter construction, local atlas creation and the production server are real.
Save-Data/no-WebGL capability and document-visibility fixtures are explicit;
the existing Ghosts/Bottle network fixtures do not prove third-party services.

History inspection: unfiltered SWE list has **10 rows: 4 failed, 4 succeeded,
2 running**. The API exposes no pagination cursor. For this task, `run-9680`
has a complete 29-line no-agent `red_gate_already_green` capture; `run-9686`
and `run-9696` have truncated raw logs, so full historical completeness is
**inconclusive**. Their actual task-manager tails show successful branch
pushes followed by `push_not_on_main`; the latter also shows the rejected
main pushes. Both persisted task-manager callbacks are `delivered`, one
attempt each; persisted plan-manager statuses are `failed` with matching
markers and `callback_apply_failures=0`. This follows callback outcomes
through persisted ingestion but does not inspect internal callback payloads.
`history-summary.json` in worker artifacts records IDs, counts and boundaries.

Local execution is demonstrated. Publication is bound to the pushed SHA in
the summary and `run-9726/artifacts/commits.txt`; deployment and independent
product acceptance remain unproven. No capacity/operator prerequisite is
pending. Deferred checks `t-1766/CI-green-gate` and `t-1766/deployed-QA` belong
to plan-manager and its quality engineer; failure is any failed job or deployed
acceptance assertion on the delivery. Pipeline/deployment IDs are unobserved
under the stop-at-push contract. No pipeline is watched or deployed system
checked. The missing chief-of-staff and software-development documents remain
absent; available standing rules and the explicit task contract apply.

## Publication recovery — run-9696

The recovered implementation commit is
`2537166b546dc9803cfadf584a5fae413bc32b4d` (original delivery
`3726e97953168205b9df128ddb57bc8fdf39682d`). This run fetched main
`573b70e9de539096f3f9e296fe075307b3fe288f`, retained the recovered commit
without another rebase, and created `pm-299-t-1766-recovery-run-9696`.
The previous run's persisted failure was
`push_not_on_main: HEAD 3726e9795316 is not on origin/main`; its feature
branch push succeeded, but that alone did not meet the runner's delivery check.
This recovery therefore publishes the verified task branch and fast-forwards
main using ordinary pushes. Commits are made on the task branch, not main.
Main advanced during verification to `250705f2345c8cb77d03a5ed9d53d36494f0470e`
with a paper-controls fix (`tactile.css` and its browser regression). If the main
push is rejected, the contract requires `git pull --rebase origin main`, full
task verification again, and up to three normal push retries. The captures in
this section identify the first recovery build; the submitted summary and worker
artifacts bind any subsequent retry build and final delivery SHA.

No implementation or test work was dropped. The unrelated Shimi/inkblot paths
listed in the rescue prompt are already on main and remain untouched. The only
discarded working-tree change is the generated `content/history.json` from the
required production build, restored with the contract's explicit command.
The additional recovery commit records verification and durable commit evidence;
it preserves the original task-prefixed implementation commit.

Fresh `npm ci` used the unchanged lock. Runtime: Node `v22.23.3`, npm `10.9.9`,
Next `16.4.2`, Playwright Core `1.64.0`, Chrome `156.0.8078.47`. The current
run's recorded profile is `codex-sol-6-1-high`, invoked with model
`gpt-6.1-sol` and `model_reasoning_effort="high"` on the fleet runner.
Installed Next server/client and lazy-loading guides were read. The two missing
standing-rule documents noted in the original record are still absent.

Fresh production build ID: `_5g6oNWKI7e11sLZb4r-2`. The ordered executable
fingerprint described below remains
`e8391b38fb8be6554832b0c4b09a13b5faae00b13e4ba943c0b9521d436f5fa0`.
The emitted field chunk remains `.next/static/chunks/12qgltjgzy1gg.js`, SHA-256
`5ca02dfa389bb4c1055229019d254b2dc447eff5ad2dd7e5735319091ec1ff16`.
Thus verification is tied to the same executable, rather than an unrelated
evidence-only SHA. Production imports, shader compilation/linking, local fox
atlas creation, GL adapter construction and real embedded-Postgres migrations
all executed successfully in this locked installation.

| Fresh check | Command | Result |
| --- | --- | --- |
| Susuki and Bottle browser suites | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/susuki.test.ts' 'e2e/bottle-ui.test.ts'` | 21 tests, 21 pass, 0 fail, 0 skipped; includes fresh production build/start |
| Project tests | `TMPDIR=/tmp npm test` | 2,736 tests, 2,736 pass, 0 fail, 0 skipped |
| Types | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0; 0 errors, 11 existing warnings outside this task's files |
| Gate closure | `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | certified; `local_controls: pass`, `failures: []`; external evidence inconclusive |
| Footer walk | `SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh` | 67 ok, 0 failed |
| Footer browser probe | `CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh` | 177 ok, 0 failed; includes idle-loop, overlap, navigation and negative controls |

Fresh browser output demonstrates actual GL pixels and shader uniform updates,
the same-draw fox instance and immediate input cancellation, all four live season
tints, clickable links/Bottle/mascot, five SVGs, waterline ordering and **0 px**
geometry shift. Static results were:

```text
{"renderer":"real WebGL2","inkPixels":214538,"browser":"156.0.8078.47"}
{"fallback":"reduced","pixels":214484,"calls":1,"ticks":0}
{"fallback":"save-data","pixels":214484,"calls":1,"ticks":0}
{"fallback":"no-webgl","pixels":85737,"calls":0,"ticks":0}
# tests 21
# pass 21
# fail 0
# skipped 0
```

Real/fake boundaries remain as documented below: WebGL2, rendering, context loss
and restoration, input and database execution are real; missing WebGL2,
Save-Data and document visibility are deliberate capability/event fixtures.
The negative control clears the real framebuffer and asserts exactly zero ink
pixels, then observes resumed actual draws. This is local SWE execution proof,
not independent deployed QA or a production delivery claim.

History inspection used the plan's SWE run list (no pagination/cursor is exposed
by that tool): 8 rows, comprising 3 failed, 3 succeeded and 2 current runs at
inspection. This task's history is `run-9680` (succeeded), `run-9686` (failed),
and `run-9696` (current). A literal `completed` filter returned no rows, so the
unfiltered list was read to find actual `succeeded` records. The complete 29-line
`run-9680` runner capture says `red_gate_already_green`, with no agent started;
that is not proof of the missing feature. The prior `run-9686` raw capture is
truncated (4,648 earlier lines omitted), so full raw historical completeness is
inconclusive. Its persisted status/failure marker agrees with the publication
tail supplied in this task; `callback_apply_failures` is 0 in the three task run
records. Callback payloads/ingestion internals and remote CI history were not
available through this evidence and are not claimed proven.

No observed local defect remains in the verified executable. CI, global green
gate, deployment and independent product acceptance remain unproven here.
Plan-manager owns these deferred checks for `pm-299/t-1766` and `run-9696`, bound
to the delivery `git_sha` in the submitted summary; any failed job or acceptance
assertion returns this task. There is no runtime-capacity deferral or operator
prerequisite. Per contract, this run stops at push without watching a pipeline
or exercising a deployed system. See `run-9696/artifacts/commits.txt` for the
retained commit and recovery-commit resolver.

## Original implementation record — run-9686

Run `run-9686`, role `software_engineer`, plan `pm-299`. Task branch:
`pm-299-t-1766-susuki`, based on freshly fetched main
`2cc4b041a506d36bcf264c10b6f46fdcebacfb71`.

The server footer mounts a client loader and an absolute, inaccessible canvas
backdrop before the waterline. A single instanced strip draw renders segmented
blades and the optional four-pose fox atlas. The atlas is baked locally from
Canvas2D paths; there are no remote image/model assets or new dependencies.
The adapter owns passive input, seasonal uniforms, session persistence,
intersection/visibility scheduling, static fallbacks, context restoration,
adaptive blade count and resource disposal. EndStage's probe counters exclude
only the separate Susuki ambient callback, using a production-stable literal.

## Locked executable and execution boundary

- Installation: `npm ci`, unchanged package lock. Node `v22.23.3`, npm `10.9.9`,
  Next `16.4.2`, Playwright Core `1.64.0`, Chrome `156.0.8078.47`.
- Actual run invocation: Codex CLI, `gpt-6.1-sol`, reasoning effort `high`.
- Real production `next build` and `next start`, throwaway embedded Postgres 17
  with real migrations, real Chromium WebGL2 shader compilation/linking,
  instanced draws, framebuffer reads and `WEBGL_lose_context` loss/restoration.
- No fake renderer. Save-Data and missing WebGL2 are explicit browser capability
  fixtures; document visibility uses a property/event fixture. Native touch is
  dispatched through Chromium CDP. The existing e2e harness uses its Ghosts fake
  endpoint and Bottle tests use their declared network fixtures; those do not
  prove third-party services.
- Production build ID: `Ec1Db3USfDHQAflvEdlkx`.
- Field chunk: `.next/static/chunks/12qgltjgzy1gg.js`, SHA-256
  `5ca02dfa389bb4c1055229019d254b2dc447eff5ad2dd7e5735319091ec1ff16`.
- Package-lock SHA-256:
  `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`.
- Executable fingerprint: SHA-256 of ordered `sha256sum` output for
  `components/susuki-field.tsx`, `components/susuki-field-loader.tsx`,
  `components/end-footer.tsx`, `lib/susuki.ts`, `lib/ink-particles.ts`,
  `lib/seasons.ts`, `app/(site)/globals.css`, `scripts/probe-end.mjs`,
  `e2e/susuki.test.ts`, `package-lock.json`, `next.config.ts`:
  `e8391b38fb8be6554832b0c4b09a13b5faae00b13e4ba943c0b9521d436f5fa0`.
  This binds the code, baked atlas/shaders, configuration, tests and lock,
  independently of subsequent evidence-only commit metadata.

## Verification with positive assertions

The final browser rerun reused the freshly built executable with `SKIP_BUILD=1`.
All commands ran locally before commit/push. The build itself passed TypeScript
and prerendering; no existing server was reused.

| Check | Executed command | Observed result |
| --- | --- | --- |
| susuki-and-footer-e2e | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/susuki.test.ts e2e/bottle-ui.test.ts` | 21 tests, 21 pass, 0 fail, 0 skipped: seven new Susuki tests and 14 Bottle tests |
| footer-walk-and-unit | `TMPDIR=/tmp npm test` | 2,696 tests, 2,696 pass, 0 fail, 0 skipped |
| TypeScript | `npm run typecheck` | type generation and `tsc --noEmit` pass |
| Lint | `npm run lint` | 0 errors, 11 existing warnings outside changed files |
| Gate closure | `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | `local_controls: pass`, `failures: []`; its external evidence remains inconclusive |
| Footer HTTP/structure walk | `SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh` | `walk: 67 ok, 0 failed` |
| Footer browser probe | `CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh` | `probe: 177 ok, 0 failed` |

The build-generated `content/history.json` was restored to its original contents
using the contract's `git checkout -- content/history.json`. No generated build
output, lock changes, binary assets or unrelated source changes are delivered.

The seven Susuki browser tests assert these outcomes:

1. Real instanced ink, pointer/scroll uniforms and fox cancellation: initial
   framebuffer contains **214,538 ink pixels** (alpha > 8), with 34 strip vertices
   and a bounded blade instance count. Pointer velocity and scroll boost reach
   the actual GL uniforms. Fox activation adds one instance to the same draw;
   pointer input immediately removes it and consumes the session. Hiding the
   backdrop changes footer/stage/Bottle bounding boxes by **0 px**. Exactly five
   SVGs remain and the waterline is the last footer element.
2. All four live season mutations change actual `uTint` values; a theme mutation
   changes them again. Canvas and backdrop are `aria-hidden`, contain no focusable
   controls, and accept no pointer hit testing. Every footer anchor passes native
   click actionability; an actual link click, Bottle modal activation and mascot
   click also succeed.
3. Reduced motion: one static WebGL draw, **214,484 ink pixels**, **0 ambient rAF
   ticks**, including after mouse, scroll, fox trigger and touch release input.
4. Save-Data: the same one-draw, nonblank, zero-callback result.
5. No WebGL2: one Canvas2D frame, **85,737 ink pixels**, zero GL calls and zero
   ambient rAF ticks.
6. Offscreen/hidden stop, live motion preference changes, actual context loss
   with `preventDefault()`, stopped callbacks while lost, and restoration to live
   drawing. **Negative control:** clearing the real framebuffer yields exactly
   zero ink pixels, then a subsequent actual draw resumes. Blank output cannot
   pass the nonblank predicate.
7. Native mobile touch produces a gust only during contact and clears both the
   exposed gust and actual pointer uniform on release. DPR is capped at 1.5.
   The attribute hook starts the fox, touch cancels it, and reload preserves the
   consumed session lock.

The complete footer browser probe also passes idle-loop/overlap checks,
keyboard/touch interactions, reduced motion, light/dark contrast, no-JavaScript
links, hydrated navigation, and its own corrupted-link and network-attribution
negative controls. Its final output includes:

```text
ok - negative control: verifyCanonicalLinks rejects a corrupted canonical footer href (/broken-play !== /play)
ok - negative control: after reload, the same verifyCanonicalLinks assertion passes
ok - errors: zero hydration errors across all contexts
ok - errors: zero console errors or page errors across all contexts
ok - network: zero unexpected external network requests from footer pages
probe: 177 ok, 0 failed
```

## Attempt history, limits and handoff

Five retained complete browser-suite captures were read for counts and failed
assertions: 19/20 (cursor fixture offscreen), 20/20 (before touch extension),
20/21 (native pan cancelled the pointer), 20/21 (post-release compatibility input
cancelled a newly triggered fox), and final **21/21**. Their failure tails point
to the relevant cursor/touch waits. Tests now reveal the canvas, observe held
contact before moving below pan slop, and start the fox before testing native
input cancellation. Application review also fixed lingering touch gusts and
unnecessary static touch-release redraws. An earlier build/typecheck attempt
found missing TypeScript annotations and lint found a `this` alias; both were
fixed and subsequent build/type/lint passed. The initial build log was overwritten,
so these retained captures are **not a complete historical CI/job record**.

The final source fingerprint above has no remaining observed local defect.
There are no pending local jobs after verification. No remote FAILED/COMPLETED
history, CI pipeline, callbacks, deployed system or global green gate was read;
remote history completeness is **inconclusive**. Local execution is demonstrated;
production integration/deployment and product acceptance are **unproven here**.
This is an SWE delivery report, not independent QA.

Deferred checks: plan-manager owns CI/green gate and deployed QA for `t-1766`
following the pushed delivery SHA in the summary report. A failed CI job or
failed deployed acceptance assertion returns this task for a fix. Pipeline/job
IDs do not exist in the evidence available before push and are not invented.
Per the role contract, this run stops at push and does not watch CI/deployment.
The platform-owned `expect=exit0` strings remain unchanged; the named assertions,
counts and negative controls above provide the positive verification evidence.

The referenced chief-of-staff document and `docs/claude/software-development.md`
are absent in this checkout; available `AGENTS.md`, local Next documentation and
the explicit task contract were followed. Decisions and the canvas-visibility
lesson were recorded through plan-manager during the run.
