# QA: pm-241 / t-1474 / run-8395

**Verdict: FAIL. Cause: code.** The eight specified contract commands pass,
the repaired TMPDIR path works on Linux, and the deployed footer passes its
matrix and independent visual/interaction review. An additional execution of
the actual CI signed-in motion probe fails with React #419 on mobile reduced
motion exits from the 403 page. A fresh independent reproduction confirms it.
Successful pending/replacement runs do not waive this observed defect.

## Identities and scope

- Delivery: **6b31607838c312e0942731b970249db005b1e179**, checked out exactly;
  QA branch `pm-241/t-1474-qa-run-8395`. No application source was changed.
- Deployed SHA: **61bbd2c871471f05191a63d1359b6d01a6ea5937**, observed in the
  Home build-sha meta and browser assertions. `git merge-base --is-ancestor
  6b31607838c312e0942731b970249db005b1e179
  61bbd2c871471f05191a63d1359b6d01a6ea5937` exited **0**.
- Green gate **ver-3336**, run **run-8382**, delivery `6b31607`, status pass;
  its eight items and raw verify-runner tail were read independently.
- Local production BUILD_ID **lYS45ssWS9Z4i6hFwHNbS**; Node **22.23.3**,
  npm **10.9.9**, Next **16.4.2**, Playwright **1.64.0**, Chromium
  **156.0.8078.4**, Linux. `npm ci` installed the exact lock before checks.
- Actual QA profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort
  **high**, fleet **avietidol-z490**, task
  **a9d3d5bc-7977-4e6b-9adb-950a82bd4bf7**. Corrected SWE run **run-8373**
  used **agy-argon-high**, **gemini-4-argon-high**, on avietidol-z490;
  flags record the high model variant without a separate effort flag.
  Original SWE was **run-8321**, not run-8357 (the latter is shell verify).
  These identities come from persisted run rows, not current defaults.
- Git author and committer for delivery: **Otohime <quiinthieu@gmail.com>**,
  no Co-Authored-By trailer. Task **9c0bae95-2c80-4284-a1c7-648f12a8cc62**
  lists `author.txt`, 44 bytes, SHA-256
  `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`.
  Artifact bytes remain unread: authenticated public retrieval returned 403;
  cluster service access/port-forward did not provide an authorized content
  path. Git identity matches; manifest-byte identity remains **inconclusive**.

Exact code/lock/config/build SHA-256 hashes, browser observations and CI job
steps are in [textual evidence](qa-t-1474-run-8395-evidence.json).
The footer shell, browser driver, walk and two components are identical between
delivery and deployed SHA. The shared CSS has a separate homepage boot change;
the lock adds the unrelated Anthropic SDK dependency. Those are different
executable fingerprints: exact-delivery results are not substituted with the
descendant's CI results. There are no model weights or generated image assets
in the footer. No binaries, screenshots, dependency folders or credentials are
committed.

## Executed checks

| Command / identity | Result |
| --- | --- |
| `npm test` | 1490 pass, 0 fail |
| `npm run lint` | exit 0; 0 errors, 9 existing unused-directive warnings |
| `npm run typecheck` | exit 0 |
| `GITHUB_SHA=6b31607838c312e0942731b970249db005b1e179 BETTER_AUTH_SECRET=<local fixture> npm run build` | exit 0; 181 static pages |
| `env -u TMPDIR SKIP_BUILD=1 PORT=4081 EXPECT_SHA=6b31607838c312e0942731b970249db005b1e179 bash scripts/walk-end.sh` | 67 pass, 0 fail |
| `env -u TMPDIR SKIP_BUILD=1 PORT=4083 EXPECT_SHA=6b31607838c312e0942731b970249db005b1e179 bash scripts/probe-end.sh` | 164 pass, 0 fail |
| `SKIP_BUILD=1 bash scripts/probe-motion.sh` | 510 pass, 0 fail |
| `SKIP_BUILD=1 APP_PORT=4085 bash scripts/e2e-local.sh` | 28 pass, 0 fail; real isolated Postgres and migrations |
| `SKIP_BUILD=1 PORT=4093 bash scripts/probe-motion-signed-in.sh` (additional CI regression) | **354 pass, 2 fail**, exit 1 |
| Fresh independent local footer driver on :4091 | 39 observations, 0 page errors |
| Deployed walk, `BASE_URL=https://otohime.dev EXPECT_SHA=61bbd2c871471f05191a63d1359b6d01a6ea5937 bash scripts/walk-end.sh` | 65 pass, 0 fail |
| Deployed browser probe, same BASE_URL/EXPECT_SHA | retry: 163 pass, 0 fail (remote omits local-server log check) |
| Fresh independent deployed footer driver | final run: 38 observations, 0 page errors |
| Fresh independent signed-in 403 reproduction on :4095 | **3/3 Dashboard cycles emit #419**, two errors each; zero server-log runtime errors |

The first remote probe timed out waiting for `/planisphere` load; a direct HTTP
fetch then succeeded, and a fresh full probe passed. The first independent live
walk reached 25 observations before `ERR_NETWORK_CHANGED` on `/music`; a fresh
attempt failed at initial navigation with the same transport error. After the
local signed-in run completed, the final fresh walk passed all 38 observations.
Earlier aborts are preserved as limits of those attempts, not reported as passes.
No timer polling or capacity/operator wait was used.

## Independent user-path and visual review

The [independent driver](qa-t-1474-run-8395.mjs) imports no author probe code.
Its own assertions and actual browser actions produce the following evidence.
Screenshots stayed in `/tmp/qa-8395/independent-local/` and were visually opened
for Home, desktop dark and mobile light. The final live screenshots use
`/tmp/qa-8395/independent-live-final/` and remain outside git.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Home at top | Scroll into footer; click Work, then Projects in footer | One visible footer below main after both group transitions; six correct hrefs, four contact lines, no overflow | Local and live observations, exact SHA assertions |
| Fresh local locked badge | Insert focused local textarea; type real Konami keys | Textarea receives `ba`; achievement stays false | Independent negative control; no server mutation |
| Locked Projects footer | Focus mascot; type reset then correct keys | Achievement true, storage flag `1`, full readout, pathname remains `/projects` | Local and live browser state |
| Unlocked Projects | Reload, toggle reduced motion | Badge restores; active motion unset and pupils `translate(0px, 0px)` | Local and live browser state |
| Footer keyboard focus | Enter on Back to top | scrollY <= 4 and focus on visible main#main | Local and live browser state |
| Music at desktop/tablet/touch mobile | Both themes x five accents | One unclipped footer below main, no horizontal overflow; accent and background recorded | 30 independent cross-product observations per run |
| Mobile collapsed customization | Focus summary and Enter; tap mascot | Disclosure opens; knobs exposed; readout changes and eyes stay still | Local and live observations |
| Visible Projects, settled | Measure 700ms idle with unfiltered rAF/interval wrappers | No additional callbacks or interval ticks | Independent instrumentation has no InkHero callback-source exemption |

The supplied production DOM matrix also passes all LCD states (including tenth
poke and achievement), reserved geometry, focus order, displacement scales,
initial/mid-press reduced motion, blocked storage, no-JS and all route isolation
checks. Its href negative control rejects `/broken-play`, reloads and passes
the same assertion. Both shell modes executed actual Playwright construction.
The document-hidden check dispatches a synthetic visibility event: native OS
background lifecycle is not thereby proven.

The save-point console, torn paper slab and signpost form a cohesive miniature
ending scene. Desktop keeps the scene and navigation balanced; mobile stacks
the scene, customization and copy with readable spacing. Ink silhouettes, LCD
rows, contact chips and footer signature are legible in both themes. No visual
source correction is warranted by this review. Both layout files place the
single footer inside their ViewTransition after main; README documents the
concept and repeatable commands; CI runs both footer checks on localhost.

## D1: streamed 403 fallback produces React errors

**Owner:** software engineer for t-1474. **Failure condition:** a signed-in
plain user at 390x844 with reduced motion loads `/admin/roles`, sees the locked
room and leaves via the sidebar; #419 page errors are observed during exits to
Projects and Dashboard in the CI probe. This is an unresolved code defect for
this QA gate, not an authority/capacity condition. Whether the footer introduced
it is unproven; the role contract requires cause=code when attribution is not
established. No claim of a new footer-specific rendering fault is made.

The independent [local reproduction](qa-t-1474-run-8395-repro.mjs) uses a fresh
real Postgres-backed app server and a new plain test account. Three repeated
403-to-Dashboard cycles each emit two #419 errors. [Sanitized evidence](qa-t-1474-run-8395-repro-evidence.json)
preserves errors and six response digests without cookies or full RSC payloads.
The HTTP 200 forbidden document includes `$RX("B:3",
"NEXT_HTTP_ERROR_FALLBACK;403",...)`. This confirms a deliberately aborted
server Suspense boundary. React describes #419 as server failure to finish a
Suspense boundary followed by client rendering ([official decoder](https://react.dev/errors/419)).
The pageerror callback records the current URL, so an error labelled Dashboard
does not by itself establish that Dashboard originally emitted the boundary.
Server stdout contains only ready/config messages. Do not suppress #419 globally
or call this an infrastructure outage.

## CI, deployment and history

- Exact delivery GitHub [run 40224228174](https://github.com/quiinthieu/otohime/actions/runs/40224228174):
  checks **121262610732** failed at **Motion probe, signed in**; footer step
  skipped; production **121263675897** skipped. Raw job log download is 403;
  annotations expose only exit 1. The local repro is independent of that unread
  stderr; it does not establish that the remote failure has the identical cause.
- Last preceding green inspected: [40216527659](https://github.com/quiinthieu/otohime/actions/runs/40216527659),
  SHA **d4cb19cdb4fd03e307b4af78127beae9010237e3**. Workflow git log/diff from
  that SHA to delivery adds only the footer step. Subsequent deployed green
  [40224969086](https://github.com/quiinthieu/otohime/actions/runs/40224969086)
  at **61bbd2c** has checks **121264982118** and production **121268021120**
  successful; workflow and signed-in probe are unchanged from delivery.
  No environment classification is justified by these observations.
- Production `/api/health`: HTTP 200, `{"ok":true}`. Live interactions and
  complete footer probe passed on the observed descendant. No production
  account, server data or shared infrastructure was modified by QA.
- [Bounded history](qa-t-1474-run-8395-history.json): FAILED **48/48**, offsets
  0/30 limit 30, complete and no pm-241 entries; COMPLETED **60/874**, same
  offsets, explicitly incomplete; RUNNING **4/4**, PENDING **4/4**, complete
  snapshots. Pending tasks belong to other plans and do not prove this delivery.
  All **11** pm-241 run records read; no recorded callback apply failures.
- Direct task and raw tail reads: corrected SWE
  **40852643-50b4-4a46-a782-ab00d8b326d2**, prior QA
  **d61b22aa-27f8-45cd-9ec1-40c3aaf5cf93**, green runner
  **286ac72b-3ffc-4a2c-a4a1-b592cf75f08e**, original SWE
  **9c0bae95-2c80-4284-a1c7-648f12a8cc62**: all COMPLETED, callback delivered,
  one callback attempt each, and persisted reports/gate reconciled. These
  tails are bounded; unread full logs are inconclusive. Raw failed task
  **f1bfa812-5256-4f67-836e-99f92417bcde** belongs to pm-209; get_task reports
  argument-list-too-long and log endpoint explicitly reports missing logs.
  No inference about footer health is drawn from unrelated failures.

## Real/fake boundary and delivery state

Real: npm locked imports, Next prerender/production servers, Chromium contexts,
Sharp processor construction and actual in-memory PNG encoding, Rough generator
construction, pg.Pool construction and live SQL via migrated Docker Postgres.
The footer adds no runtime adapter or external service. Unit TMPDIR cases use
a temporary npm stub only to expose normalized env and cleanup; actual local
and deployed browser runs prove the real Playwright dependency. Local editable
and href controls alter only isolated browser DOM. No fake proves product output.

**Integration deployed:** yes, descendant ancestry and live stamp checked.
**Execution demonstrated:** all eight contract suites and footer product path;
additional signed-in check fails. **Product delivered:** footer observed live,
but overall QA acceptance withheld for D1. **Waiting for capacity:** none.

| Deferred item / exact ID | Owner | Failure condition / required next action |
| --- | --- | --- |
| D1, t-1474; signed-in probe 354/2 and independent 3/3 | Software engineer, then QA | Correct streamed denial path; strict signed-in probe must pass, plus all eight commands; push correction to run CI |
| Raw job log 121262610732 | GitHub evidence access owner | 403 prevents matching remote stderr; do not claim that unread log diagnosed |
| author.txt, task 9c0bae95-2c80-4284-a1c7-648f12a8cc62 | Task artifact access owner / subsequent QA | Bytes inaccessible; compare against required identity and reject any mismatch/trailer when retrievable |
| Firefox/Safari, actual device-GPU smoothness and native hidden-tab lifecycle | Future browser/device QA | Not executed; these are declared coverage limits, not invented blockers |

Missing standing extraction/workflow files were confirmed as in the plan;
actual AGENTS.md and installed Next layout/server-client guides were read.
No operator chore, soak, watch or human policy choice is required. Save this
report, its fix plan, independent drivers and sanitized textual evidence on the
QA branch; leave application source and default branch unchanged.
