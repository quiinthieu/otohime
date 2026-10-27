# Ink renderer independent QA

pm-257 / t-1608 / run-9162, quality_engineer. Delivery under review:
**a6723c1b52f25ad9259c23eb33ebd9cafb01b788**. The executable renderer and console
repair descend from **a958913b6a17f2cefda59882dfbdfcb0cd01e453**. This QA change
contains reports and evidence only. No application, maintained test, Worker or CI
source was edited to make a check pass.

**PASS for the authorized local/native scope under esc-427.** No new t-1608
implementation defect was observed. App renderer integration is deployed dark;
local rendering execution is demonstrated. Dedicated hosted fan-out integration
and Ink Ghosts product delivery remain **UNPROVEN**. Capacity waiting: **none**.

The claimed task's recorded **esc-427** outcome explicitly authorizes judging
t-1608's local/native scope, says not to fail it solely for Vercel access, and
retains hosted integration/product delivery as unproven. This is the scope of
the QA verdict. It does not certify a hosted Worker or a green production job.
No new operator request, credential mutation, manual deploy, bypass or polling
was performed. Production activation remains t-1611 scope.

Green gate **ver-3640**, run **run-9160**, passes all four declared contract
commands at **a6723c1**. The task-manager verifier is
**9fbc1895-9d48-4859-8ff1-3a3d22674959**, completed with its callback delivered
once; the persisted run succeeded and its verification SHA matches. SWE
**run-9154**, task **f064cbe7-9854-40d2-a678-422912b1ec60**, also completed with
callback delivered once and a persisted report binding a6723c1. Its raw runner
tail independently contains the successful push. These are not inferred from
the supplied summary.

The initial checkout was clean at a6723c1. All six retained verification commands
passed there: focused 16, project 2,444, lint/build exit 0, targeted Riso 6, full
browser 181 pass / 0 fail / 1 existing optional skip. Fresh origin/main then
contained **e120461717f7e69c17d88f7512e776206d8fe664**, an unrelated landed footer
CSS/Bottle/test change. Its actual diff was read, the generated history index
was restored, and the checkout fast-forwarded. No ghost, palace or root lock
files changed. Final verification uses the integrated checkout; initial results
remain in [verification-a6723c1.json](t-1608/run-9162/verification-a6723c1.json).

The installed Next 16.4.2 connection, route-handler and lazy-loading guides were
read. The two requested shared standing documents are absent in otohime and
were read from the available mono-v2 fleet checkout. The exact root package lock
was freshly installed with npm ci. Actual QA runtime is Node **v22.12.0**, npm
**10.9.0**, macOS, locked Next **16.4.2**, React/React DOM **19.3.0**,
playwright-core **1.64.0**, embedded-postgres **17.10.0-beta.17**. Node differs
from the SWE machine's v22.23.3; both satisfy the declared 22.x engine. Package
imports, real pg adapter construction, compiled Next and actual migrated
embedded PostgreSQL are exercised; a mocked route alone is not the preflight.
See [preflight](t-1608/run-9162/preflight.json) and the verification logs.

Actual recorded run identity: **codex-sol-6-1-high**, model **gpt-6.1-sol**,
effort **high**, fleet **billie-mac**, task
**d4cfdda7-14e2-44f1-b2b2-34520ebf619a**. This comes from the run record and runner
flags, not current dashboard defaults. SWE run-9154 has the same recorded
profile/model/effort on avietidol-mac-mini; run-9160 is a shell verifier with no
model profile.

The [fresh public HTTP snapshot](t-1608/run-9162/public-http.json) serves
**d6221b79b9c796d7c85c975bd122c7bed6d351e1** from /api/health. Ancestry checks:

| Requested ancestor | Deployed d6221b7 | Meaning |
| --- | --- | --- |
| a958913b6a17f2cefda59882dfbdfcb0cd01e453 | exit 0 | Renderer repair is in the served app |
| a6723c1b52f25ad9259c23eb33ebd9cafb01b788 | exit 1 | Evidence-only delivery commit is not deployed |

Direct /api/ghosts is empty **404**, Cache-Control **no-store**; the optional
/api/ghosts?probe=1 is **200 null**, also no-store. This is a dark feature,
not a configured hosted fan-out. A green hosted-delivery verdict is not claimed.
The runtime source manifest at deployed d6221b7 matches all 20 SWE renderer,
lock and configuration entries, including CI. Its application source ancestry
is more informative than exact-string matching a958913 in a descendant's health.

Fresh native **checks job 122025376638**, workflow **40454757987**, is green at
d6221b7. The same workflow's **production job 122030716428** is red at Vercel
inspection; its public annotation retains CLI 64.7.0 `User not found` twice.
The four newer failed workflows examined have green native checks and red
production inspection: jobs **122009123224**, **122008987455**,
**122016574291**, **122030716428**. Original delivery native job
**121976229834** is still green and production **121981152892** red. a6723c1 has
zero GitHub check runs, as expected for a report-only path-filtered push.

The last green same production job examined is **122000364994** at a7da8e8,
workflow **40445352898**, also ubuntu-24.04. Between it and d6221b7, git log/diff
was read: 7735e74 intentionally makes failed inspect terminal and validates
health JSON; f83c73f/d6221b7 add diagnostics and preserve probe exit status.
No authentication secret change is shown by Git. Original same-job comparison
ea79432 -> a958913 has empty deploy-config log/diff. Raw logs for all five failed
production jobs return **403 Must have admin rights**. Account/token/scope
causality remains unproven beyond the vendor annotations; do not call the
executable broken or invent a credential repair from inaccessible evidence.

Fresh bounded history is recorded in
[platform evidence](t-1608/run-9162/platform-evidence.json) and
[fingerprints](t-1608/run-9162/fingerprint.json):

| Source | Read | Limit/completeness |
| --- | --- | --- |
| Task-manager FAILED | 10 / 1,161 | 5/page, offsets 0 and 5; incomplete |
| Task-manager COMPLETED | 10 / 7,150 | 5/page, offsets 0 and 5; incomplete |
| Current RUNNING / PENDING | 6 / 6; 0 pending | one bounded page of 25; non-atomic |
| GitHub failed / successful CI | 10 / 132; 10 / 249 | 5/page, pages 1 and 2; incomplete |
| GitHub in-progress / queued | 0 / 0 | one bounded page of 20 each |
| Raw runner tails | SWE 1,046; gate 55; failed integration 76 lines | tail API, full history unproven |

The unrelated failed integration task
**aaf41670-24d4-4664-998d-744e4d6d29bd** explicitly concerns mono-v2/pm-289 signed
totals and an invalid publication receipt; it is not this UI executable.
The 20 CI history SHAs were compared by file hashes: d6221b7 matches 20/20;
four later red workflows and two successful workflows match 19/20 (only CI
differs). The original ebbb06d failure predates the console repair (13/20 with
two files absent). Other older histories lack ghost files or differ. Read
limits, missing historical files and denied raw logs remain inconclusive;
no exhaustive clean-history claim is made. New pending work or a future token
reset cannot erase an observed deterministic executable defect.

Historical CI comparisons bind the listed source/lock/configuration paths;
historical compiled artifacts were unavailable, so they do not establish binary
identity. The fresh local build records static and server artifact hashes, and
the public browser snapshot independently hashes served assets. No model assets
are used. The integrated footer CSS and generated history bytes are recorded
separately from the unchanged 20-file ghost manifest.

The UI has no product compute queue, visitor persistence or visitor callback
ingestion. Task-manager callbacks above are orchestration evidence, not visitor
events or product output. Capacity waiting: **none**. No Worker deployment/version
id was available or claimed.

Deferred checks retain explicit owners and failure conditions:

| Item/id | Owner | Failure condition |
| --- | --- | --- |
| esc-427, vercel-ci-access:otohime-production | operator | Vercel inspect remains unauthorized; required delivery ancestry absent from production. Repair ancestry is observed now, evidence SHA ancestry is not. No polling. |
| t-1609 | SWE then QA | Pocket opt-out fails immediate cleanup, reload/root navigation or same-origin cross-tab persistence |
| G9121-2, components/theme-toggle.tsx:71; t-1610 | t-1610 SWE/QA | Overlapping native theme activations leak the skipped-transition rejection; known baseline code defect remains open and is not suppressed |
| Maintained exhaustive fake/browser/deploy automation, t-1610 | SWE then QA | Required two-browser/failure/negative controls or dark workflow contracts do not execute |
| Hosted activation/live fan-out and bad-origin rejection, t-1611 | SWE, QA then acceptance | Two real hosted browsers, opt-out, origin rejection and matching app/Worker code+lock+config/version identities are absent or fail |

G9121-1's disabled-config console regression is repaired; targeted Riso includes
negative controls for unrelated 404, same-path 500, application console.error and
pageerror. G9121-2 is unchanged from the independently established pre-ghost
baseline; it is an assigned defect, not a reason to weaken the collector or
pretend all product scope is delivered.

Final verification at integrated e120461 (exact commands and tails in
[verification.json](t-1608/run-9162/verification.json)):

| Check | Result |
| --- | --- |
| Declared focused client/config command | 16 pass, zero fail/skip |
| npm test | 2,448 pass, zero fail/skip |
| npm run lint | exit 0, 10 existing warnings |
| npm run build | exit 0, real production compilation/types/assets |
| Retained targeted Riso browser command | 6 pass, zero fail/skip |
| Retained full browser command | 182 pass, zero fail, 1 existing optional hydration-evidence skip; 183 total |
| Newly authored independent two-Chrome probe | 10 recorded cases pass |
| Separate deployed Chrome user path | Home and /ryugu dark-layer checks pass |

The full browser harness constructs actual Next, Chrome and migrated embedded
PostgreSQL. The compiled-route test restarts real Next with configured and
malformed runtime endpoints and validates no-store/direct404/probe behavior;
it does not stub connection(). The pure route-wiring test substitutes that
boundary, and pure client tests inject sockets, clocks and schedulers. Riso HTTP
negative controls use Playwright fulfillment. The build emits existing Better
Auth notices when its build-time auth fixture is absent; the browser harness
supplies isolated auth fixtures and the production auth system was not tested.

The independent probe was newly authored for this run, rather than replaying the
SWE proof script. It uses two separate Chrome **156.0.8078.48** processes, actual
browser WebSockets, actual compiled GhostSession/canvas construction and native
pixel sampling. Only the relay is the local fake; all pointers are scripted.
Document-hidden changes are synthetic, motion changes use browser emulation,
and offline uses the real browser context network control. No hosted Worker,
real visitor trace or production activation is inferred from these cases.

| Starting state | Driven action | Observable result/evidence |
| --- | --- | --- |
| Two connected browsers in each room | Move and click in first browser | Correct peer-tip pixels, fading old trail, surviving stationary tip, native local and peer ripple pixels |
| Same pair plus other-room browser | Send marks | Other room remains blank; membership alone paints nothing |
| Canvas active at 960x720 / DPR 2 | Resize to 800x600 and activate root navigation controls | Viewport-fixed passive canvas, aria-hidden, no live region; 1440x1080 backing pixels then 1200 backing width; Home Dive and palace surface links navigate |
| Trail has faded | Observe clear timestamp, then drive 20 browser frames | Clear count stays fixed while stationary tip remains |
| Initial motion reduction, then connected | Toggle motion, go offline/online, dispatch hidden, navigate away | Initial zero config/socket/drawing; dynamic reduction clears real pixels; offline/hidden clear; eligible reconnects; unmounted room has no layer |
| Fake full / flap | Start actual page sessions | Exactly 1 / 3 upgrades, terminal gone, zero ink |
| Unset / malformed runtime endpoint | Restart actual Next, fetch both API forms, open Home | Direct empty404, optional200null, both no-store; quiet page with no socket/pixels |
| Connected pair with outgoing frames blocked | Click first browser, then restore native send for positive proof | Local draw counters **14 (Home)** / **13 (palace)**, peer pixels **0** in both; exact peer-visible assertion rejects in both rooms |

See [independent results](t-1608/run-9162/independent-results.json). Both room
positive paths report zero page/application-console errors. The failure-mode
fixtures test lifecycle/retry behavior, not browser/provider error logging.
The [public browser result](t-1608/run-9162/public-browser.json), observed at
2026-10-27T05:59:26Z, independently agrees with the earlier HTTP snapshot:
Home, palace metadata and DB-backed health all serve d6221b7, roots return200,
layers are off/0 members/0 ripples/0 pixels/passive, no sockets or page/console
errors. Served assets are hashed separately (32 Home, 12 palace responses).

Final local BUILD_ID: **BxvPa8iSrOOMFM4PmhJUj**. The unchanged 20-file manifest
hash is **347a28d1870252e39be095db8def9b988f3b15fb55bb540a306733e27ce5b8a9**.
Static build artifact aggregate (131 files):
**37b713b3a49930f2a8c392ee4510ae13556f2935eef24d0074c33da86370c6d4**.
Server artifact aggregate (910 JS/JSON files):
**f45971d80fb3280ce74eea154348fab78c07626d105eb5f53182c583529b43d6**.
The manifest records per-file hashes, root package lock, Next/config/TS config,
runtime CSS/history supplements and no model assets. Public asset hashes are
not equated with this distinct local build. The generated history index was
restored before committing. The Plan Manager submission and commits.txt bind
the pushed QA evidence commit; the report-only push is excluded by CI paths.

One QA harness defect was found and retained: the first independent idle check
sampled 10 clears, then saw 12. Its asynchronous waitForFunction predicate had
returned a Promise, which this locked Playwright accepted immediately. A separate
blank native Chrome page resolves `() => Promise.resolve(false)` with false in
30ms rather than waiting for the 400ms deadline. The failed probe/log/verification
are preserved as initial-probe-*; the control is
[wait-predicate-control.json](t-1608/run-9162/wait-predicate-control.json).
The corrected probe observes a synchronous native-clear timestamp and then
checks that further browser frames do not draw. Application source was unchanged.
This finding was recorded as a lesson, rather than hidden as a successful first
run or attributed to the renderer without evidence.

Build/lint logs normalize terminal carriage returns and trailing whitespace only.

The first QA push was rejected as non-fast-forward. `git pull --rebase`
integrated **7a68c4f38aa499c78344854339129af31a49be43**, whose entire diff is
two Bottle QA/fix-plan documents under projects. Both documents and the empty
non-project diff were read. Focused and project tests were rerun after this
rebase; [rebase-verification.json](t-1608/run-9162/rebase-verification.json)
records their results. The production build and native browser proof above
remain bound to identical executable source bytes; no new build/browser run
is implied by a report-only integration. The final push uses no force option.
