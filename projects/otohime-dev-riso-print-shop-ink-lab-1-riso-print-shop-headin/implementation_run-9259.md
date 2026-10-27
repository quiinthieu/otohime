# pm-268/t-1678 linear delivery — run-9259

This fix follows `fix_plan_run-9254.md`: add meaningful paper-hydration regression coverage and publish a single-parent descendant of main so CI runs strict history generation on a non-merge tip. The task branch is `pm-268-t-1678-linear-run-9259`, created from freshly fetched main `7a165b7e9507f0a087abd85f1f191ef98a71512e`. The pushed SHA and post-commit strict-index result are recorded in the platform summary and artifacts, rather than introducing another evidence-only commit.

The fix plan's sample references `markPaperHostHydrated`, `FakeRoot` and frame-delayed activation, which are absent from this checkout. The actual `createHydrationRegistry` API settles subscriptions synchronously. The new test proves duplicate marks cannot replace a missing host acknowledgement, preserve all-host readiness, activate a later subscriber immediately and never reactivate either settled subscriber. Production code, the heading contract and all browser assertions remain intact.

## Fresh verification

| Command | Observed result |
| --- | --- |
| `node --experimental-strip-types --test lib/riso-heading.test.ts` | 5 passed |
| `node --experimental-strip-types --test lib/riso-heading.test.ts lib/paper-hydration.test.ts` | 10 passed |
| `npm test` | 2,573 passed; zero failures, skips or cancellations |
| `npm run typecheck` | Route types generated; zero diagnostics |
| `npm run lint` | Zero errors; 10 existing warnings |
| `TMPDIR=/tmp node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts e2e/kame.test.ts` | Fresh production build; 19 passed; zero failures, skips or cancellations |

The browser suite exercises real React hydration, Next route bundles, Chrome, embedded Postgres with migrations, and required assets. It retains all original nine Kame cases, the frozen-clock negative control, real/fake-clock reload/navigation, held Daruma hydration, tactile interactions and unconditional pageerror guards. Riso accessibility, Unicode, no-JavaScript/static media, TitleMorph and Stamp interactions pass. Registry unit objects, Playwright clock overrides, blocked storage and the held network response are explicit fixtures. Static checks alone do not prove visitor behavior. Unrelated full-browser projects were not rerun for this test-only change.

A temporary copied registry with its immediate subscription check removed fails the new test at the late-subscriber assertion. A separate disposable shared clone pinned to historical merge `a62c6356893c4080714795d11599469b55f9aa2e` reproduces the exact strict-history failure (`does not match git at its own head a770c135ab`). Neither control changes product source or weakens assertions. Exact-delivery strict history generation is required after commit and before push; generated `content/history.json` is restored and excluded.

Locked installation used `npm ci` with lifecycle scripts. Runtime: Node **22.23.3**, Next **16.4.2**, React **19.3.0**, playwright-core **1.64.0**, Chrome **156.0.8078.48**, embedded-postgres **17.10.0-beta.17**. Build **huCibb8mZ5Ym8iVTNpLAy**; relevant source/config/lock/test aggregate SHA-256 **4a6ab6ad73df6e08f00f47322e1fd87ec315a539bc0221e3ee040975eabf480c**. Per-file hashes and raw logs live in the lease's external `$SHARED_DIR/artifacts/`, including `executable.json`, `late-subscriber-mutant.log`, `merge-history-negative.log` and `commits.txt`. An initial metadata-only probe hit embedded-postgres's unexported package.json subpath; reading installed metadata directly corrected the probe. The real production executable passed without dependency substitution.

## History and handoff

Independent task-manager reads cover two five-row pages each of FAILED (**10/88**) and COMPLETED (**10/1,196**) plan-manager coding jobs, plus all current RUNNING jobs (**3/3**). Terminal history is bounded/incomplete. Raw predecessor/QA tails and persisted task records were read: `8e9ae0a1-f0c8-49ed-9faf-3bd121d2b056` failed `push_not_on_main`; `7e22f3c7-7f8d-4942-ba3b-5fdd3643e598` completed; both callbacks were delivered in one attempt, with zero callback-application failures in persisted plan runs. QA task `5ded3c30-3a85-46f3-b898-e9f33dd1f1bf` completed its report while failing product delivery. Agent completion is not product acceptance.

Public GitHub history pages 1–2 cover **30/524** runs (16 failure, 13 success, one in progress). Complete four-job history for failed run **40548308774** confirms checks job **122344833837** failed strict history Step 18 and production **122347217303** was skipped. The public annotation exposes exit 1 but not the full failure tail; the exact historical executable's failure was independently reproduced locally. Unread historical logs remain inconclusive. Historical production source, lock and CI configuration are unchanged by this test-only delivery; the repaired identity is its single-parent commit topology. The observed in-progress run **40552915182** belongs to another task/commit and is not this delivery's CI result.

Actual run identity: **codex-sol-6-1-high**, **gpt-6.1-sol**, **high** effort, fleet worker **avietidol-mac-mini**, attempt **4**, task-manager **8c73a365-9fce-4eb8-9579-6fdb30fdebf6**. Required process documents were absent here and read from the host mono-v2 checkout. No graph tool or local safe-push helper was available; source discovery and explicit non-force push/rebase retries are used.

**Execution demonstrated locally; integration deployment and product delivery remain unproven. Waiting for capacity: none.** Exact-delivery CI, deployment and independent QA are owned by plan-manager's green gate/QA successor for **t-1678**, deferred check **t-1678-live-production-verification**. Failure conditions include strict-history failure, any required check failure, absent exact-delivery deployment, React #418/pageerror, duplicate/missing overlays or heading/TitleMorph/Stamp regression. This SWE run stops at the authorized branch/main pushes and summary; it does not watch CI or probe production. No remaining observed executable defect is waived by this handoff.
