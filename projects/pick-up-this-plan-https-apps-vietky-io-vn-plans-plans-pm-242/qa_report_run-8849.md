# pm-258 / t-1564 QA — run-8849

Verdict: **FAIL, cause=code**. Delivery **841ca69823a2e71e6a97e5c1d01c12babdccd2ea** has board green **ver-3535 / run-8847**, but its GitHub [run 40310239199](https://github.com/quiinthieu/otohime/actions/runs/40310239199) fails **checks 121530268639 / E2E against next start**. Production job **121532945623** is skipped. The new diagnostic reporter works and exposes a remaining defect; the deployment checks gate is not restored.

Observed deployed SHA: **ae4607dafc28c6f732fdb7ee2ff2f1c7953ed4d3**, from real `/api/health` and the rendered build-sha meta. `git merge-base --is-ancestor 841ca69 ae4607d` exits **1**. Thus this delivery is **not deployed**. Execution is demonstrated locally; required gate restoration and deployment are **not delivered**. No capacity queue or person-only prerequisite applies. The plan's later keyless providers and personalized owner output are outside this task and remain undelivered: live presence still reports spotify-off/steam-off, null track/game.

## Independent CI diagnosis

The public run page discloses the actual assertion, independently of the engineer's summary:

```text
E2E failed: a narrow window and a wide touch tablet get the stacked desk too;
the same touch swipe drags on a wide mouse desk
e2e/desk.test.ts#L576
AssertionError [ERR_ASSERTION]: the swipe dragged music: 0.3 is not 0.425
  at near (.../e2e/desk.test.ts:181:10)
  at TestContext.<anonymous> (.../e2e/desk.test.ts:597:3)
```

This is a desk touch-input failure, not the repaired Kame 499/500 ms clock assertion. [Public CI captures](qa-run-8849/public-ci.json) retain the assertion and job identities. [Step captures](qa-run-8849/public-job-steps.json) show delivery lint, typecheck, unit tests, build and migrations succeeded; E2E failed; signed-in motion and both footer steps were skipped. Skipped footer checks are not CI passes.

Comparison: the last green completed run before delivery, **40306337481 / ae4607d**, passed **checks 121516259788** and **production 121520661524**, including E2E, motion, footer walk and Chromium probe. The desk application subtree, `lib/desk.ts`, `e2e/desk.test.ts`, lockfile and Next configuration are byte-identical between that green commit and delivery. Broader app/components/e2e trees differ, including Kame fetch work; they are not falsely represented as one complete executable. `git log ae4607d..841ca69 -- .github/workflows/ci.yml` identifies only 841ca69's logging/reporting change; its diff retains the suite status and `production: needs: checks`. [Fingerprints](qa-run-8849/fingerprints.json) record Git object identities and this workflow diff. Neither an environment cause nor an all-checks-pass authority cause is established. An unattributed delivered CI failure is cause=code under the role contract.

Full CI raw logs remain unread: the shared-IP GitHub API rate limit returns **403** for delivery checks and original footer checks; public per-step log endpoints return **404**. [Access responses](qa-run-8849/raw-log-access.json) and [API capture](qa-run-8849/ci-evidence.json) preserve these limitations. The assertion above is readable; the runner's exact Node/browser/OS/build summary and server tail are not. No claim of Linux reproduction or known root cause for this particular touch failure is made.

## Fresh execution at the exact delivery

A detached worktree at 841ca69 was installed with **npm ci**, using Node **22.23.3**, macOS arm64, Next **16.4.2**, React **19.3.0**, playwright-core **1.64.0**, pg **8.23.1** and embedded-postgres **17.10.0-beta.17**. [Preflight](qa-run-8849/preflight.json) imports and constructs real EmbeddedPostgres and pg.Client and launches real Chrome **156.0.8078.48**. Constructor checks are explicitly distinguished from startup. The contract suites then start/migrate/query real isolated Postgres and render through the actual production server/browser. The database lifecycle regression also rejects a connection after SIGTERM and verifies database-directory removal. No fake database or browser proves these dependencies.

The build carries the full delivery GITHUB_SHA; build ID **1mqCkk54ITDWwfqlR--8d**. Lock/config/runner hashes are in preflight; [build assets](qa-run-8849/build-assets.json) contain 114 built static-file SHA-256 hashes and real Postgres/initdb and Chrome binary hashes. No model artifacts apply to this executable.

| Contract command | Fresh result | Evidence |
| --- | --- | --- |
| `npm test` | 2,127 pass; 0 failed/skipped/cancelled | [unit summary](qa-run-8849/delivery-unit-summary.log) |
| `npm run lint` | exit 0; 10 existing warnings, 0 errors | [lint](qa-run-8849/delivery-lint.log) |
| `npm run typecheck` | exit 0 | [typecheck](qa-run-8849/delivery-typecheck.log) |
| `npm run build` | exit 0 | [build](qa-run-8849/delivery-build.log) |
| `SKIP_BUILD=1 bash scripts/walk-end.sh` | 67 ok / 0 failed | [walk](qa-run-8849/delivery-walk.log) |
| `SKIP_BUILD=1 bash scripts/probe-end.sh` | 171 ok / 0 failed | [matrix](qa-run-8849/delivery-probe.log) |
| `SKIP_BUILD=1 npm run test:e2e` | 102 pass; 0 failed/skipped/cancelled | [E2E](qa-run-8849/delivery-e2e.log) |

[Command results](qa-run-8849/delivery-results.json) retain exits/durations. The original footer assertions remain enabled and pass: public-page isolation/canonical links, keyboard order through the waterline, contrast, reduced motion, no-JS, rAF budget and overlap control, achievement visibility control and unexpected-network controls. The actual failing CI desk test also passed in this local full run. One local success does not close its observed CI failure.

## Independent user path and negative controls

QA's separate [audit](qa-run-8849/independent.mjs) uses real HTTP and Chrome without importing application assertions or the engineer's proof script. [Delivery observations](qa-run-8849/independent-delivery.json), [live observations](qa-run-8849/independent-live.json) and [results](qa-run-8849/independent-results.json) show:

- Local and live health/presence APIs answer successfully, presence has no-store, the projects page has the expected build identity and one footer, and clicking its Work link reaches `/work` with one main landmark.
- Changing the footer Work href to `/qa-corrupt` makes the same canonical-link assertion fail; restoring it passes. This changes only the audit browser's DOM.
- Local Kame is not petted at paused 499 ms and is petted at 500 ms. Resuming the clock and adding real elapsed time makes the same not-pet assertion fail. Browser time is a deliberate Playwright fixture; the rendered component and timers are real.
- Local real CDP touch moves the music item. Blocking pointermove in the audit page makes the same displacement assertion fail; a fresh unblocked page passes. Recorded pointer event targets/coordinates accompany all three attempts. This control detects the observed no-movement failure mode without asserting that its injected blocker is the CI cause. Unlike the original helper, this independent audit scrolls the tape into view and uses network-idle navigation; that readiness difference is explicit.

Both completed audits pass. An initial local audit attempt failed due to QA using an unavailable `page.removeExposedFunction` method; distinct binding names fix that QA script. [Initial log](qa-run-8849/independent-delivery-initial.log) is retained and does not count as an application defect. No application source was changed by QA. Fakes are limited to node:test scheduling/reporter fixtures and Playwright clock control; no fake runtime, adapter or generated product output is substituted for real execution.

## History, ingestion and identities

Bounded independent GitHub history: **two public pages, 25 entries each, 50 summaries**: **27 failure, 19 cancelled, 2 success, 1 in progress, 1 pending**. The initial API listing reported **395 total** before the shared-IP rate limit; later public pages may include a newer run. Eight targeted run pages and **32 public job pages** were read, including original **40277024423 / checks 121421820314** (E2E), **40275822192 / checks 121418580863** (footer), **40277523350 / checks 121423322274** (footer), and old green **40263545741**. Eight raw public step-log attempts were unavailable. Public text captures have explicit 22,000-character run and 18,000-character job tails. Older pages and inaccessible raw assertions are unread/inconclusive; this is not complete history. The API capture attempted two pages and eight job listings after rate limiting and read zero of them; it is not counted as additional history.

[Task-manager history](qa-run-8849/task-history.json): FAILED offsets 0/25, 25 each, **50 of 1,118**; COMPLETED offsets 0/25, **50 of 6,102**; RUNNING **5 of 5**; PENDING returned an empty object, so no pending jobs were observed but no numeric total was supplied. This is a cross-project sample, not a complete plan history. [Raw runner tails](qa-run-8849/runner-tails.json) include delivery and failed sample **d1ab959c-5977-4c77-b1ac-6347df0f3b1e**; tails are truncated by the API and the unrelated sample does not explain the delivery defect.

[Task callback state](qa-run-8849/callback-tasks.json) shows delivery task **03c16ea7-5c92-43cf-b919-89f1843c1204** and verification task **bbd3d2b8-f5d4-40d0-8e40-b9bcb3cf23f4** completed with callback delivered once. [Persisted callback events](qa-run-8849/callback-events.json) **11671** and **11681** are applied; [board state](qa-run-8849/board.json) contains green **ver-3535 / 841ca69**, seven passing items, and delivery summary rep-5154. The current QA callback is not yet expected: task **91152aac-2ffc-4fc1-b721-1a9a28b6f591** is running. Timeline read was 50 entries; callback event read was 50 entries, older entries unread.

Delivery Git author and committer are **Otohime <quiinthieu@gmail.com>**, with no Co-Authored-By trailer. The current delivery task's manifest lists **author.txt**, 44 bytes, SHA-256 **7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada**. Its bytes remain **unverified**: the independent [artifact request](qa-run-8849/author-artifact-access.json) returns 404. This is not a claim that the manifest bytes match the identity.

Recorded delivery **run-8822, attempt 3**: profile **claude-opus-high**, model **claude-opus-5-5**, effort **high**, worker **avietidol-mac-mini**. Recorded QA **run-8849, attempt 3**: profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, worker **avietidol-mac-mini**. These come from run flags and task worker records, not dashboard defaults.

## Remaining defects and deferred checks

- **t-1564 engineer:** repair delivery **40310239199 / checks 121530268639**, exact assertion **e2e/desk.test.ts:597**, preserving its expected displacement and stacked-device coverage. Failure condition: the same touch gesture does not persist the expected movement, or the gate remains red. See [fix plan](fix_plan_run-8849.md).
- **t-1564 engineer then QA:** push a focused repair to drive CI and the existing production dependency. Required output remains missing until repaired SHA has board green, successful checks, deployed ancestry and live user-path evidence. Skipped production **121532945623** is not capacity waiting. No polling/watch is created to waive this defect.
- **t-1564 engineer:** original footer **40277523350 / 121423322274 / 2a58479** still lacks a readable raw assertion. Fresh walk/matrix pass, but its historical root-cause closure is inconclusive. Obtain the historical failure or demonstrate its precise repaired assertion.
- **pm-256/t-1559 engineer, coordinated by t-1564:** historical `Page already revealed` candidate remains unrepaired/unproven; current 102-test suite has no occurrence. Failure condition: any uncaught navigation page error, which must not be filtered.
- **t-1564 engineer with pm-259/t-1573:** engineer's earlier one-off React #418 on `/projects` remains unclosed; no occurrence in this QA. Failure condition: a hydration error in the unchanged zero-error checks. Passing attempts do not establish a repair.
- **Delivery engineer/platform artifact owner:** supply current delivery **03c16ea7… / author.txt** bytes and verify identity/no trailer; unread content is inconclusive, a mismatching identity/trailer fails.
- **QA evidence limits:** authenticated CI runner/server tails and Vercel function logs were unavailable. Owner t-1564 engineer/platform evidence access; failure condition is inability to diagnose the disclosed gesture before claiming repair. No request for new personal credentials or physical chore is needed for the observed code failure.

The requested extraction and shared software-development policy files were located and read in the host mono-v2 checkout; the target checkout itself lacks them. AGENTS.md and the installed Next 16.4.2 Playwright guide were read. Board decisions include the code verdict, evidence limits and a lesson about public annotation access. QA changes are confined to this plan folder. At initial capture, main differed from delivery only by three earlier report commits, with unchanged source/lock/config fingerprint. That main checkout additionally passed npm test **2,127/2,127**, lint, typecheck and build; only generated history output was discarded.

The first evidence push was rejected non-fast-forward. `git pull --rebase` advanced the base to **45129f9**, bringing **28d4542** (Ryugu peep-box and Kame E2E changes), **543ba68** (history-fixture auto-maintenance fix), and a report commit. The rebased QA test tree is **e6e432a6055ac854f6ea64ab33fb187f3629ff27**. [Integration identity](qa-run-8849/integration-identity.json) records these source changes and confirms all 36 QA paths remain within this plan folder. Integrated checks are separate from exact-delivery proof; they cannot retroactively repair 841ca69's red CI or establish its deployment. The run submission/final response name the saved evidence commit.

All seven integrated contract checks passed after that rebase: **2,133 unit tests**, lint (0 errors/10 warnings), typecheck, build, footer walk **67/0**, Chromium matrix **171/0**, and **110/110 E2E tests**. [Integrated results](qa-run-8849/integrated-results.json), [unit summary](qa-run-8849/integrated-unit-summary.log), [E2E log](qa-run-8849/integrated-e2e.log) and [build identity](qa-run-8849/integrated-build-identity.json) preserve the exact test SHA, commands, outcomes and fingerprints. Only evidence files changed after these tests; the generated tracked history index was restored. The detached exact-delivery worktree was removed after its checks and independent audit finished; cleanup touched only this run's worktree and owned runtime/database lifecycle.

A second push met concurrent report commit **4a87fc4** and was rejected. A second `git pull --rebase` changed no application, component, library, test, runner, lock or configuration file relative to the seven-check tree. The final-rebase record captures that empty source diff and the rerun of npm test and lint; no force push was used.
