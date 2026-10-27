# Bottle paper card · pm-269/t-1588 · run-9064

Footer and Pocket now open the same gesture-loaded Bottle panel. It reveals reviewed links, preserves a bounded no-repeat history with blocked-storage fallback, opens external sites only through a safe Visit anchor, and submits labelled suggestions to pending moderation. Native modal focus, Escape/touch return-focus, route cleanup, live reduced motion, offline browsing and accessible retained-input errors are covered. Footer Bottle uses existing top padding outside the scene hit area, before the unchanged mascot-to-waterline keyboard sequence. The only extra interface is the one-line Terminal opening guard required for exclusive dialog ownership.

## Local verification

Locked installation: `npm ci`; Node 22.23.3, Next 16.4.2, React 19.3.0, Playwright Core 1.64.0, actual Chrome 154.0.8037.57 and migrated embedded Postgres 17. Actual board profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, worker `avietidol-z490`.

- PASS `npm test`: 2,346 tests, none skipped.
- PASS `npm run lint && npm run typecheck`: zero errors, 10 existing lint warnings.
- PASS `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/bottle-ui.test.ts`: 11 production-browser cases.
- PASS `node scripts/verify-bottle-footer.mjs`: unchanged CI-mode walk 65/65 and Chromium probe 170/170. The wrapper builds with GITHUB_SHA/EXPECT_SHA equal to its delivery checkout HEAD, and both shell gates use BASE_URL against that isolated production server.
- PASS `SKIP_BUILD=1 npm run test:e2e`: 168 cases, 167 passed, zero failures, one existing optional screenshot-evidence skip (`e2e/print-runs.test.ts`, EVIDENCE not configured). This reuses the same isolated production build with a fresh migrated database.

At both 1366×768 and 390×844, incremental bootstrap is conservatively 1,612 bytes gzip (emitted entry, scoped source CSS, emitted Pocket/keyboard glue and 64-byte numeric-import allowance), lazy panel/content/CSS 4,966 bytes gzip, and open/close CLS 0 including shifts following recent input. Limits remain 3KiB/25KiB/0.001. The browser verifies actual panel and curated-note bytes are absent before activation, present in activation-requested chunks, and neither hover nor focus fetches the public pool. The panel JS is `199hh8689mj_p.js`, SHA256 `e4b166ce41b6aa0e4172bf530d9dd20593d3a6f0fffa02a896fe9b48567ea167`; CSS `3zvc0i9-car40.css`, SHA256 `f16c4d552e8f62e4858d07bc747b97b16b181f80512f6f220fc3ceb01a362be2`. Full entry/module fingerprints and repeated final receipts are in artifacts.

The final required commands are rerun at the committed delivery HEAD before push. The pre-commit production build is `u7uFcUQyKS5iX_xeB2OSG`; final build ids, delivery SHA and command exits are in `commits.txt`/verification artifacts and the board summary, avoiding a self-referential SHA in this file.

## Evidence boundaries and controls

Real: production Next imports/build/server, Chromium DOM/layout, native dialogs/keys/touch/new-tab isolation, router Back, Web Animations and live media queries; an actual same-origin POST returns 201, the Postgres row is pending, and GET /api/bottles excludes it. The test deletes only its own suggestion after verifying persistence. Existing API/moderation integration runs in the serial regression. No real visitor data or deployed service is touched.

Fixtures: bounded/empty/single public pools, network aborts and 503/429 replies, a hostile error string, throwing storage, and the explicitly clicked external destination fulfilled locally. These prove UI policy/recovery, not availability of external indie sites or human moderation. No camera, model, binary asset, dependency, auth or server persistence change.

Controls caught actual pre-repair defects: Tab/body and touch focus restoration, a growing loading-card CLS of 0.0015296, browser Back retaining the shared-footer dialog, and modal Konami keys unlocking the background footer. Raw Back/key red logs are retained. The unchanged footer gate separately rejected an inserted legacy Tab stop and a Bottle control covering a scene pointer sample; both were fixed in product layout, with no gate assertions changed. The browser now asserts Bottle is outside the canvas and keyboard reachable before the mascot. Local validation rejects unsafe/markup input without any POST, and explicit Visit is the sole new-tab positive control. An earlier run that overlapped a rebuild with a browser gate is inconclusive; final gates run sequentially against one immutable build.

## Executable identity and historical scope

Sorted relative path + NUL + bytes + NUL SHA256 for `components/bottle/*`, end-footer, handheld, pocket-terminal-loader, lib/bottles.ts, curated JSON, package/package-lock and Next configuration: `3d89a9087f67b5f6c11876313d7f7a3f0e366e567c6ed566bf49837ef149fbb9`. Lock SHA256 `2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b`. This identifies the executable independently of report/history commits. No historical failure is claimed cleared by an unrelated SHA.

Bounded task-manager history: offsets 0 and 10, limit 10, returned 20 FAILED of 81 and 20 COMPLETED of 1,418; RUNNING returned 5 of 5. Global history is incomplete. The plan's SWE run listing contains only this run for t-1588. Prior Bottle service gate `d6813b94-f824-440f-ae27-d95753ccac64` / `run-9059` at `9bdb3b2` has a complete 57-line runner log with all five items passing, callbackState=delivered, callbackAttempts=1, and persisted plan run succeeded/callback_apply_failures=0. The inspected unrelated Peep-box failure `a7d6a38f-7400-4d5e-840f-935c6002a3c0` tail records push_not_on_main; its larger transcript is incomplete and does not prove this Bottle UI's execution. Current run callback ingestion follows exit and is not yet claimed. Sanitized history metadata and raw returned tails are in runner artifacts.

## Handoff

Local execution demonstrated. Integration deployed and product delivered remain unproven; there is no capacity or operator prerequisite. CI/green gate and independent deployed QA are deferred to plan-manager for `pm-269/t-1588/run-9064`; successor ids are assigned after push. Failure condition: failed CI/gate/acceptance or a deployed executable lacking this change. This engineering run stops after the successful push and summary submission, with no pipeline watch or deployed-system check.

Repository AGENTS and installed Next lazy-loading/usePathname guides were read. Shared chief-of-staff/software-development/frontend sources were located in `/data/build-worker/repo/mono-v2/`; the task-specific Next/paper stack, plan report location and push-only handoff override generic platform/deploy rules. Explicit design/scope decisions and lessons are recorded. The pre-existing generated history refresh is preserved in artifacts and excluded from the commit.
