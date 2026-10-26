# Delivery summary · pm-264/t-1590 · run-9012

Implements `fix_plan_run-8904.md`: remove shared workflow concurrency, give each main/manual checks job its own run-id group, retain PR cancellation in separate checks/preview groups, and serialize only production with `cancel-in-progress: false`. Keep `needs: checks`, report-only filters, manual recovery, pinned runners and served-SHA verification. Source guards failed 3/10 before the change and pass 10/10 after it. They reject the actual old shared-queue configuration; they do not execute GitHub's scheduler.

Peep-box application code and its repaired browser verifier remain unchanged. The broad regression found two deterministic sibling verifier failures on the starting checkout: Ink Radio required bare heading text, while Pocket Terminal counted decorative Riso text twice. This delivery bounds Ink Radio's HTTP heading extraction to its real h2 and accepts the nested plain source, retaining section identity, ordering, credits and lazy/privacy checks. Upstream `5ad4906` supplies the terminal accessible-name repair. Initial failing log: `artifacts/e2e-full.log` (136 pass, 2 fail, 1 optional screenshot-evidence skip).

Integrated main from `620eb60` through `eb7ecde`, then `17bca22`. Incoming changes include terminal/print fixtures, deploy script/self-tests and reports, followed by the installed-Chrome unit repair and unit-failure annotations. No application code, dependency lock, Next config or active browser runner changes. The same real production build is therefore reused with documented `SKIP_BUILD=1`; it was initially built by the exact focused contract command. All required checks are repeated on the combined tree. Full serial regression is repeated after the heading repairs; the final unit/annotation-only integration leaves that executable and its cases unchanged. Generated `content/history.json` prebuild churn is excluded. A single task-prefixed source commit is delivered on main; the pushed SHA/subject and author are captured in `artifacts/commits.txt` and `author.txt`.

The initial push was rejected as non-fast-forward. Retry 1 uses `git pull --rebase` onto `6306c7b`, without conflicts; the incoming commits touch only plan Markdown. Hashes independently confirm unchanged relevant source/config/test/build identities. Repeat all four required checks before the next push; preserve the broader serial browser, CI-mode unit and deploy self-test results on the identical executable. No force push.

## Local verification

Fresh `npm ci`; Node 22.12.0, Next 16.4.2, React 19.3.0, Playwright Core 1.64.0 and Google Chrome 155.0.8059.86 on the macOS fleet lease. Board run identity: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort high, worker `billie-mac`. Production build `RFVb2PzPC1EtCgDls0aji`; disposable real embedded Postgres 17 is constructed and migrated by `scripts/e2e.mjs`, and real Next/Chrome render the SVG geometry. The aggregate of exact relevant source/config/lock/test hashes is `45f19c49b6a753909a450b82cd115f3f7e0d1fee35f3c594fa6061857c78bc30` (`artifacts/identity.json`).

| Check | Result |
| --- | --- |
| Pure projection/pose | 6/6 |
| Workflow configuration guards | 10/10 |
| Repository units | 2320/2320 after final integration (2317/2317 before it) |
| `CI=true npm test` on this macOS lease | 2320/2320 after final integration (2317/2317 before it) |
| Lint + typecheck | exit 0; 10 pre-existing lint warnings |
| Focused production Peep-box browser contract | 8/8 on fresh build and 8/8 after final integration |
| Complete serial production browser regression | 138 pass, 0 fail, 1 optional screenshot-evidence skip |
| Deploy-script and served-SHA self-tests | exit 0, including after integrating changed upstream deploy scripts |

At both 390×844 and 1366×768: conservative incremental gzip 8,454 bytes, attributable CLS 0, stabilized inactive rAF 0, no camera/model/worker requests or media calls. Browser logs print emitted hashes: Play chunk `ee0af5c50a8cb0256297f4f6407808a3ec6cded43ca8b14f88810d0d6e7d345a`, lazy controller `3570b1f30dfed72f4f83c6c15e8ba2dbb5c95bcc7b328f0ddacdba6ed4b12c23`. Negative controls include nonzero frames during movement, native CDP touch scrolling, and failed/mismatched fake deployment health. Orientation/permission/visibility are synthetic policy fixtures, not physical-device tilt evidence. Deploy self-tests use fake npx/HTTP boundaries, never an actual deployment.

## History and handoff

Independent pre-push public GitHub index reads cover two pages each: 50/100 FAILED and 50/439 COMPLETED main runs; current page 25/439 has no nonterminal run. Older pages and most raw logs are unread: repository history is incomplete. Run `40319533832` confirms the original verifier delivery's cancellation before jobs by `ci-refs/heads/main`. Descendant `40319672622` is now successful; no live health probe was performed. Latest observed run `40340641001`/checks `121634081296` failed at `Run npm test`; REST raw logs return 403 and public step logs 404, so its assertion is inconclusive here.

Plan history returns 14 nonpaginated runs through this run. The prior SWE `run-8885` task `93bb73db-3750-4b1e-866c-6e8eeff98f34` is persisted COMPLETED with callbackState=delivered, callbackAttempts=1. Its raw runner tail was read; it is a bounded tail, not full prior execution. No new remote runtime, processor/model assets or runtime callback adapter is introduced by this CI-only fix.

The diagnosed installed-Chrome/inherited-CI TMPDIR defect is repaired by upstream `17bca22`, integrated before final checks. It explicitly separates npm-stub fixtures from the runner path and tests the latter with fake Chrome/node handoff, plus new public unit-failure annotations. These fake shell executables establish branch policy, not real Ubuntu/browser execution. macOS has app-bundle Chrome rather than `google-chrome` on PATH; real Ubuntu CI remains to be observed on the repaired source. Upstream `5ad4906` partially repairs deployment inspection/health handling and its updated self-tests are included locally. Plan pm-275 still owns its further deploy-script repair; real deployment execution remains unproven here. Failure condition: repaired-source checks/production fail, especially the installed-Chrome runner branch or deployed health/ancestry.

Per the explicit stop-at-push role contract, plan-manager owns the delivery SHA's CI/green gate and subsequent independent QA/live controls. IDs for the new push are assigned after handoff and are not observed here. Fail on any declared check, repeated pending-main cancellation, failed production, live SHA missing delivery ancestry, or Peep-box geometry/lifecycle/privacy/sibling regression. No operator prerequisite or capacity deferral is claimed. Local production execution is demonstrated; deployed product delivery is pending observation. Decisions and lessons are recorded on the board.
