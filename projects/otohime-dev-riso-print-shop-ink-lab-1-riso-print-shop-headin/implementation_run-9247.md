# pm-268/t-1678 implementation — run-9247

Deliver on branch `pm-268-t-1678-hydration`, based on freshly fetched main `36ba86a99f78ce93a8972c8e1f4d003242325469`. The pushed delivery SHA is recorded in the platform summary and `shared/artifacts/commits.txt`. Run profile: **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, fleet worker **avietidol-mac-mini**.

## Change and diagnosis

The loaders now follow route children. Each actual mutation target acknowledges its React commit through `PaperHost`: cartridges inside DarumaBoard, Notes entries, footer Lines and the Kame shell. A per-DOM-identity WeakSet gates loader activation and the actual Companion/PaperLayer lifecycles. Load, idle and advancing a fake clock cannot grant hydration readiness. Hidden cached Next Activity routes are excluded by rendered layout boxes; their disconnected effects cannot block the current page. PaperLayer reattaches to committed replacement cartridges after Daruma view changes, preserving the route session and cancelling old listeners/gestures. Pagehide, pageshow and unmount retain teardown and restoration.

The ordinary baseline production run passed all 15 existing Kame/Riso tests, so a natural reproduction was intermittent. A controlled negative test establishes the failure mechanism: hold the real Daruma client module, bypass only `afterPaperHydration` in one HTTP-served compiled helper, dispatch early load and advance 46 seconds. Four real overlay nodes appeared before the host commit; releasing Daruma produced **Minified React error #418, args[]=HTML**. The unchanged production helper under the same scheduling attaches zero overlays before release and exactly one companion/sticker after hydration, with zero pageerrors. This is a deliberately mutated bundle control, not a claim that the unmodified baseline failed naturally.

The original nine Kame tests and their unconditional pageerror assertion remain. `ready()` now waits for rendered host commits, initialized Riso text and companion controls on first load and reload. New real/fake-clock journeys exercise three loads each, idle/Call, paper peel/reset, Daruma replacement and Notes navigation, with a DOM mutation audit. The audit retains witnessed commit identities through cleanup, so removing attributes from a previously hydrated cached route is distinguished from editing never-hydrated server DOM. Riso helpers, rendering and CSS are preserved; existing Unicode, accessibility, static-media, TitleMorph and Stamp it assertions still execute.

## Verification

| Command | Positive result |
| --- | --- |
| `node --experimental-strip-types --test lib/riso-heading.test.ts` | 5 named tests passed; Unicode graphemes, whitespace, offsets, bounded stagger and plate counts asserted |
| `node --experimental-strip-types --test lib/paper-hydration.test.ts` | 4 named tests passed; all-host commit, replacement/revocation, cancellation and cached-route reactivation asserted |
| `npm test` | 2,571 tests passed; 0 failed/skipped/cancelled |
| `npm run typecheck` | Route types generated; 0 TypeScript diagnostics; exit 0 |
| `npm run lint` | 0 errors, 10 existing warnings; exit 0 |
| `npm run test:e2e` | Fresh production build; all 202 browser tests passed, 0 failed/skipped/cancelled |
| `node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts e2e/kame.test.ts` | All 19 tests passed, 0 failed/skipped/cancelled; `SKIP_BUILD=1` reused the just-verified full-suite build and brought a new real Postgres/server |

Raw logs, named assertion/count validation (`verification.json`) and the controlled failing-bundle reproduction script/output are preserved under `shared/artifacts/t-1678/`. `TMPDIR=/tmp` keeps Chrome's Unix socket path within its limit. The prebuild-generated `content/history.json` was restored and excluded; no lock, binary, secret or generated asset is delivered.

Locked preflight used `npm ci` including lifecycle scripts, Node **22.23.3**, Next **16.4.2**, React **19.3.0**, playwright-core **1.64.0**, real Chrome **156.0.8078.48**, embedded Postgres **17.10.0-beta.17**, real migrations and a fresh production build. Build id: **T94ibt1oy-Glpuo-Mr3CV**. Relevant source/config/lock aggregate SHA-256: `ebc9a4d569e7c48f61fd4b196f1378a9ec6681b2d6ce5fa2886ffdac03391ac8`; per-file hashes are in `shared/artifacts/t-1678/executable.json`. Lock SHA-256: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`. The negative-control helper hashes are separately recorded in `unsafe-control-fingerprint.json`.

Unit registry cases use object-identity fakes. Production browser tests use real React hydration, route modules, imports, assets, timers and controls; Playwright clock installation and the held network response are explicit fixtures. The unsafe control mutates only its own HTTP response, never product files or pageerror assertions. The broader project's existing tests identify their own fakes in their output. No model, runtime queue, capacity deferral or external operator chore belongs to this feature.

Behavioral proof includes named TAP assertions and nonzero pass counts, zero failures and zero skips. The contract's `expect=exit0` fields were not treated as behavioral evidence on their own. Typecheck and lint remain static validators, not simulated visitor tests; the decision explaining this distinction is persisted on the board. No task-edit MCP tool is available to revise the persisted verification schema.

## History and handoff

Before pushing, public GitHub API pages 1–2 (15 rows/page) returned 30 recent runs: **17 failure, 12 success, 1 in progress**, from a reported total of 522. Older history is unread, so completeness is explicitly **bounded/incomplete**. Exact historical job lists were read completely for failed run `40531718309` and successful run `40529749649` (four jobs each). The failed `checks` job `122286013559` failed E2E; production `122295482137` was skipped. Prior checks `122278992502` and production `122289083990` succeeded. Their GitHub runner identities differ, but this alone does not establish an environment defect.

The failed run's public annotation includes the raw bounded 80-line E2E/server tails and Kame #418 assertion, build `WCBl-d8B-EoNGAEuykVuu`, Node 22.23.3 and Chrome 155.0.8059.39. The full raw job-log API returned HTTP 403; unseen/truncated evidence remains inconclusive. Relevant Kame/Tactile/Riso, lock, runner and workflow paths did not change between that failed delivery and this run's fetched base. Existing QA reports and the independent public annotation were both inspected; no callback-ingestion internals were inspected. Historical snapshots are in `shared/artifacts/t-1678/`.

**Execution demonstrated locally; integration/deployment and independent product acceptance pending platform validation.** No deployment or public-system check is claimed. No capacity wait is claimed. CI and exact-SHA deployment/QA are deferred to plan-manager under this SWE stop-at-push contract, owner the platform green gate/QA successor for **t-1678**. Failure conditions: any failed required check, React #418/pageerror, missing or duplicate overlays, heading/TitleMorph/Stamp regression, or absent exact-delivery integration. The task branch push does not itself trigger this repository's main/PR-only workflow, and main integration is outside this run's explicit commit/push authorization. No observed remaining feature defect is waived by that handoff.
