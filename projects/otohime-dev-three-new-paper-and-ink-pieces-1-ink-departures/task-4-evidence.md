# pm-301 / t-1788 — Ink Departures integration

Run `run-9765`, software engineer, 2026-10-29. Branch `pm-301-t-1788-ink-departures`, freshly fetched base `3977e52e3ecd5cc27082d6aae4fc976fd34c03dd`. Delivery identity is the enclosing commit, resolved through `run-9765/artifacts/commits.txt` and supplied as `git_sha` in the plan-manager summary.

## Behavior and scope

Both `/work` and `/projects` mount `DeparturesBoard` with the existing deterministic builders: 10 pipeline/stack rows and 11 projects. The named section contains a native table, caption, column and row headers, permanent real code/name/schedule/status text, project links and explicitly illustrative schedule/status labeling. Decorative character drums are hidden from assistive technology. DELAYED uses theme-aware vermilion ink. Controls have 44px minimum targets; the table scrolls within its region on narrow screens.

The feature stylesheet is imported by the client component; `app/(site)/globals.css` is untouched. Scroll animation runs only under `prefers-reduced-motion: no-preference` and `@supports (animation-timeline: view())`. A scoped named view timeline on the outer board avoids the horizontal scroller capturing descendant timelines. Click, Enter and Flip all run the same bounded JS fallback in every browser: at most 12 frames at 70ms intervals, finishing at the true status. Semantic text never cycles. Hidden-document, preference-change and effect cleanup settle/cancel the timer. The stylesheet's final reduced-motion block disables animations and transitions with `!important`.

Sound uses the existing shared store and sole AudioContext. It is muted by default, never triggered by scrolling, and produces at most one three-note clack per board per 60ms, including simultaneous rows and rapid restarts. The board opts out of the site's global press cue. Reduced motion suppresses all board clacks and the sound toggle's confirmation cue; optional silent preference updates still persist and notify subscribers. An optional custom-cue policy is rechecked after asynchronous audio resume. No CUES keys or extra AudioContext constructors were added. Existing ViewTransition, FigTitle, DarumaBoard, cartridge-slot and project-title behavior remains intact.

## Verification results

Locked dependencies installed with `npm ci`. Runtime: Linux x64 build-worker lease, Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`, Playwright Core `1.64.0`, Google Chrome `156.0.8078.47`, embedded Postgres `17.10.0-beta.17` (binaries report PostgreSQL `17.10`). The local Codex process invocation exposed model `gpt-6.1-sol` with reasoning effort `high`; no other named runtime profile was supplied. Read installed Next CSS, client-directive and server/client component guides before coding. Configured and checked the repository-local Otohime author identity.

| Check | Actual command | Positive result |
| --- | --- | --- |
| departures-e2e | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/departures.test.ts e2e/senko.test.ts` | exit 0; 17 named tests passed: 10 Departures and 7 Senko; 0 failed/skipped |
| repository tests | `TMPDIR=/tmp npm test` | exit 0; 2,794 passed, 0 failed/skipped; includes `lib/motion.test.ts`, departures and sound regressions |
| typecheck | `npm run typecheck` | exit 0; route generation and `tsc --noEmit` succeeded |
| lint | `npm run lint` | exit 0; 0 errors, 13 pre-existing warnings in untouched files |
| closure | `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | exit 0; certified `otohime.gate-closure.v1`, preflight passed, local_controls=pass, failures=[]; 31 tests and all 10 required named regressions passed |
| whitespace | `git diff --check` | exit 0 |

After the build, restored only generated `content/history.json` using the contract's `git checkout -- content/history.json`. No generated build output, lock changes, binaries or screenshots are included in delivery.

Final combined browser TAP:

```text
ok 1 - /work at 1280px serves the full semantic final timetable without JavaScript
ok 2 - /projects at 1280px serves the full semantic final timetable without JavaScript
ok 3 - /work at 390px serves the full semantic final timetable without JavaScript
ok 4 - /projects at 390px serves the full semantic final timetable without JavaScript
ok 5 - /work click, Enter and board fallback change real drums in at most 12 steps and settle
ok 6 - /projects click, Enter and board fallback change real drums in at most 12 steps and settle
ok 7 - native scroll timeline turns drums; delayed hanko ink works on light and dark paper
ok 8 - muted negative control, shared opt-in and board-wide 60ms real clack throttle
ok 9 - /work reduced motion has zero steps, animations or sound even after opt-in
ok 10 - /projects reduced motion has zero steps, animations or sound even after opt-in
1..17
# tests 17
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 51127.911078
```

Final repository TAP:

```text
1..2776
# tests 2794
# suites 2
# pass 2794
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 41461.952156
```

These are assertions beyond exit status: no-JavaScript contexts check every final row, accessible status cell and link; DOM MutationObserver evidence checks actual changing glyphs and bounded step values; CSS animation is forcibly disabled for click/Enter fallback tests; real viewport scrolling changes computed transforms; both themes change the delayed ink. Fresh contexts prove zero AudioContext construction/notes while muted and under reduced motion even after opt-in. Enabled sound produces three real oscillator starts per clack, one context, and >=60ms between clacks despite eight simultaneous restarts. Muting mid-flip prevents subsequent notes. Changing reduced motion mid-flip settles all rows without replay. Focused unit tests also prove silent preference persistence and suppression after delayed resume.

## Executable identity and failure resolution

The final production build ID was `YmM_9hnYQNkM1Uur5TRKE`. Its locked imports, migrated real Postgres instance, real Next server, Chrome DOM and Web Audio node scheduling executed successfully. Closure additionally preflighted actual imports of playwright-core, pg, embedded-postgres and its platform package against the lock, and executed all three Postgres binaries with recorded hashes.

Final executable-input fingerprint: `a1470820f9d572ff2de28ac94b758c936bd97821f7e0bd56faa416e27490eefb` (SHA-256 of the sorted compact JSON file/hash map below).

```text
da7af6830804a460596eefd65f73dc2c2216feef0d276e4e5b33d6958f555c5e app/(site)/(app)/projects/page.tsx
479a8f7eecaa552d1fc68648d2d3ae4dbc308b530cb6d994cf723789b8fd90c0 app/(site)/(app)/work/page.tsx
bd5e446ce4672ed430e770c5345812cbf96e7e71ca253b8fa9a7c49a941e073f components/departures-board.css
5c210aae41c8d376512cfdf8f399f5c5bfaa24888bcf75c96351154cf8818fe1 components/departures-board.tsx
1b557d5a091badfe4c8a0f1eb868be2df3f8aa5775acdad2ee3ba1ddc5d6f98b e2e/departures.test.ts
b277b7f6b0f028df091316a3f601125c16f96acf448b1e69b0f8630535345dc0 lib/departures.ts
4566d911ac0611dcc0a796999f4e55214b24e641c89dda0265e30ac4ea22f8ad lib/sound-client.test.ts
0549f917adf366d3ee97570f58768658935c55f6265b1f9fddc2ca77de270ec2 lib/sound-client.ts
321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d next.config.ts
9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b package-lock.json
```

Read raw local failures before correcting them: the first build caught a DOM TypeScript property missing from the installed typings (use `getPropertyValue`); the first completed browser attempt passed 14/17 and exposed inert scroll transforms and fractional 44px geometry assertions. The named outer timeline fixes the actual animation defect; hit-target tests assert computed minimums plus a 0.01px geometry tolerance. A superseded attempt using `waitForFunction` in a JavaScript-disabled context was cancelled; no such wait remains. The final build reran both full browser suites after implementation changes. All observed failures are resolved on the fingerprint above, rather than attributed to a later unrelated SHA.

## Evidence boundaries and ownership

Local execution and product behavior are demonstrated in a real production build. The E2E runner's existing Ghosts service is a fake unrelated remote service; Node audio-policy unit tests use a fake context and deferred resume. Browser audio instrumentation delegates to real AudioContext/oscillator methods and observes node scheduling; it does not prove physical speaker output. Page clocks, synthetic preference changes and rapid clicks are explicit test inputs. Browser screenshots were inspected locally and remain only under `/tmp`.

Integration deployed: unproven. Production product delivery and independent QA: pending plan-manager's green gate/QA for the pushed delivery SHA. Waiting for capacity: none; there is no queued runtime job or operator prerequisite. Current/FAILED/COMPLETED remote job history: 0 pages read, incomplete, no remote-history conclusion. The complete final local TAP was read; no pipeline or deployed-system checks were run. Per the role contract, stop after pushes and submit the summary. Plan-manager owns remote CI (failure at this exact delivery SHA returns the task) and subsequent deployed QA. No in-scope local defect remains and no capacity deferral waives a defect.

Decisions and lessons were recorded through plan-manager, including the absent extraction/software-development documents, use of existing policy/tests, non-vacuous verification, shared-sound regression coverage, the scroll-container timeline trap and asynchronous audio policy. No knowledge-graph tool was available; relevant source and installed docs were inspected directly.

## run-9780 — Preserve the verified camera build

Applied `fix_plan_run-9774.md` (`rep-5839`) on branch `pm-301-t-1788-camera-build-reuse`, from freshly fetched `origin/main` at `3cf6d6dd8f1d8b46687b81767263c8c6d91f96ad`. This is the camera CI orchestration repair requested after the successful Departures implementation. Delivery is the enclosing commit, resolved by `run-9780/artifacts/commits.txt` and supplied as the pushed `git_sha` in the summary. Publication targets are the task branch and `origin/main`; actual push outcomes belong to that summary.

The CI camera command now passes `SKIP_BUILD=1` after its successful production build. The camera wrapper preserves that flag while still deleting external `BASE_URL`, vendoring and checking every locked asset, importing the real SDK, and running the isolated production database/server/browser suite. Its child failure and signal handling, CI pipefail/tee, annotations and diagnostics remain intact. Departures application source and `globals.css` are unchanged.

Regression coverage executes the actual wrapper and E2E runner with explicitly fake SDK/vendor/database/npm adapters: artifact preservation, isolated localhost selection despite external `BASE_URL`, asset preflight calls, and assertion failure propagation. A mutation restoring the old flag deletion changes the build ID and executes a redundant build, demonstrating detection of the defect. Workflow coverage executes the real extracted YAML commands with fake compiler/camera behavior: successful build passes `SKIP_BUILD=1`, compiler exit 17 prevents camera execution, and camera exit 7 survives tee/reporters. It also requires the build to precede the camera step with default success gating. These tests remain in the existing `npm test` suites.

### Locked local verification

`npm ci` installed 522 packages from the unchanged lock. Actual parent Codex CLI arguments were `--model gpt-6.1-sol` and `model_reasoning_effort="high"`; no separate named profile was supplied. Worker: `avietidol-z490`, Linux x64; Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`, Playwright Core `1.64.0`, Chrome `156.0.8078.47`, MediaPipe `0.10.32`, model `float16/1`. Read installed Next building, deployment, CI caching and Playwright guides before editing. The two named standing-policy documents remain absent; `AGENTS.md` and the task contract govern. No code knowledge-graph tool was available.

| Check | Actual command | Observed output/result |
| --- | --- | --- |
| Focused regressions | `TMPDIR=/tmp node --test scripts/e2e-build.test.mjs scripts/ci-workflow.test.mjs` | exit 0; 62 tests, 62 pass, 0 fail/skipped |
| departures-e2e | `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/departures.test.ts' 'e2e/senko.test.ts'` | exit 0; 17 tests, 17 pass, 0 fail/skipped; fresh production build |
| repository tests | `TMPDIR=/tmp npm test` | exit 0; 2,798 tests, 2,798 pass, 0 fail/skipped; includes motion and all three new camera regressions |
| Real camera | `SKIP_BUILD=1 TMPDIR=/tmp node scripts/verify-peep-box-camera.mjs` | exit 0; 7 tests, 7 pass, 0 fail/skipped; no build command executed |
| typecheck | `npm run typecheck` | exit 0; generated route types and `tsc --noEmit` pass |
| lint | `npm run lint` | exit 0; 0 errors, 13 existing warnings in untouched files |
| closure | `TMPDIR=/tmp node scripts/check-gate-closure.mjs` | exit 0; certified, preflight OK, local_controls=pass, failures=[]; 31 tests pass |
| whitespace | `git diff --check` | exit 0 |

Restored only build-generated `content/history.json` with `git checkout -- content/history.json`, as required by the verification contract. No lockfile changes, binaries, model files, screenshots or generated application output are included.

The complete final local TAP captures were parsed for assertions, counts, skips and failures. Named passing output, full-log SHA-256/lengths, all executable input hashes and the browser's actual CPU diagnostic are preserved in `run-9780/artifacts/verification.json`. Raw local captures are `/tmp/pm301-run9780-{departures-e2e,npm-test,camera,regressions}.log`; typecheck/lint and closure have adjacent captures. Evidence extraction initially encountered TAP's escaped `\#` in a JSON URL fragment; removing that transport escape allowed parsing. No test or executable failure was observed in this fix run.

### Execution identity and real/fake boundary

The fresh production build ID was **`5Wv6ofhBw1JpP1Shv9538`**, observed before camera verification, inside the actual camera browser diagnostic and afterward. The wrapper log contains no `Building` line. The fingerprint of the sorted compact JSON path/hash map in the verification artifact is **`9078c749b170470dab9482d7624c2c5e4fd39754b9fb57ca59a4c94f71af908c`**. It binds CI/wrapper/runner/tests, the existing Departures source, lock, Next config, worker source and asset manifest, rather than an unrelated new Git SHA.

Real imports, asset verification, embedded PostgreSQL migrations, Next server construction, Chrome execution and production worker/model/Wasm CPU execution all ran in that locked environment. The actual worker emitted 478 landmarks for the licensed face fixture, 478 after translation, 0 for a blank/no-face frame, then recovered to 478. Both CPU and GPU delegates were observed; the explicit CPU adapter was required. Worker SHA-256: `abded2a89252b128933ca06c8a4c9501e128029aaf9df049f231bc7428b5337a`; model SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`; lock SHA-256: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`. All manifest assets were hash/size checked before the browser run.

Camera hardware is synthetic canvas media. Labeled lifecycle cases use fake workers; the CPU inference case uses the real worker, SDK, model and Wasm. Independent negative paths in that suite corrupt/fail model or worker requests, cancel pending permission/download, retain pointer mode and verify no uploads. The E2E runner's Ghosts service is an unrelated fake. Departures/Senko still exercise real DOM, canvas and Web Audio scheduling with explicit page clocks and preference inputs; physical speaker output is unproven. The wrapper/workflow fixtures prove orchestration only and do not substitute for the real camera run. This SWE verification is not independent QA.

### History and delivery limits

Direct task-manager history read FAILED offsets 0/10 (**20/1,429**) and COMPLETED offsets 0/10 (**20/4,504**), plus PENDING **0/0** and RUNNING **5/5** at inspection. Global terminal history is incomplete. `run-9780/artifacts/history.json` records counts and related attempt IDs. Read raw runner tails for prior QA: run-9772 returned 673 lines with 3,329 earlier lines truncated, ending in `push_not_on_main`; run-9774 returned 665 lines with 1,544 earlier lines truncated, showing the published reports and unresolved exact-delivery camera failure. The run-9769 verifier log returned 46 lines without a truncation marker; its test output lives in verification artifacts/persisted gate, not that log. Unread or truncated history remains inconclusive.

Actual task metadata for runs 9765, 9769 and 9774 reports COMPLETED with callbacks delivered after one attempt. `plan_manager_get_task` independently returns the matching persisted `ver-3883` pass and `rep-5838` failure/`rep-5839` fix plan. Callback payloads/ingestion internals and raw GitHub job-log bytes were not inspected here. The prior red job `123280927600` is not waived by this local run or any pending replacement. No GitHub pipeline was watched and no deployed system checked, per the role's stop-at-push instruction.

**Execution demonstrated:** local orchestration and real camera/Departures/Senko behavior. **Integration deployed:** unproven for this fix. **Waiting for capacity:** none. **Product delivered:** local repair is ready for publication; remote CI recovery and deployed acceptance remain pending. No in-scope deterministic local defect remains observed.

Deferred `pm-301/t-1788/ci-recovery`, owner plan-manager/repository CI: require green checks and production on the pushed delivery; failure is any required job red. If camera still fails, read the new raw failure/request before another change. Deferred `pm-301/t-1788/deployed-QA`, owner plan-manager/quality engineer: pin live health ancestry and repeat independent Departures/reduced-motion controls; failure is missing delivery ancestry or a product assertion failing. New workflow/deployment IDs are unobserved under the stop-at-push contract. This overrides the fix plan's suggestion that SWE watch CI/live health; plan-manager performs those checks. Decisions and lessons, including build identity and TAP transport escaping, were recorded explicitly.
