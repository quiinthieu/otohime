# t-1606 run-9045

**Infrastructure: main integration is incomplete.** Four pushes to main were
rejected non-fast-forward despite three rebase/reverification cycles. The exact
tested code is saved on **task-rescue/pm-270-t-1606-run-9045**; only report/commit
metadata changed after final verification. Main merge/delivery remains owned by
pm-270 plan-manager. Failure condition: this delivery is not integrated into
main and independently deployed. No force push was used. Rescue-branch CI is
not assumed to run, and neither CI nor the deployed site is observed here.

The observed desk swipe and bounded trace are already delivered in **0b349dc**.
This run adds **e2e/probe-end.test.ts**, exercising the footer probe's actual
shared reader on real production markup with JavaScript enabled and disabled.
The final code changes are this 50-line regression and a controlled-clock fixture
for the existing notebook motion control. The complete **9bb1dae**
pm-264/t-1590 title-source/settled-glyph repair and **ab34874** shell repair are
preserved. No desk application, assertion threshold, breakpoint, quarantine, Kame/Ryugu
E2E or workflow change is made by this delivery.

The tests call `endTitleText` via `inPage` with the exact normal/no-JS footer
expressions from the probe. They check the accessible source rather than the
duplicated decorative ink. Negative controls mutate the actual rendered DOM:
a wrong source plus correct ink and unrelated correct source cannot pass exact
equality; empty source stays empty; plain heading still works; a missing heading
cannot borrow unrelated text. The original raw read failed **2/2** with the
exact duplicated title before repair.

Before the fixture repair, third-rebase E2E runs 1 and 2 passed (151 pass,
0 fail, 1 skip each), but run 3 failed the notebook motion assertion with
**6 poses** (150 pass, 1 fail, 1 skip). The application deliberately navigates
after a **900 ms** fallback regardless of frame delivery, so a fixed pose-count
assertion races scheduling before that deadline. No host-cause claim is made.

The full-motion control alone now installs the locked Playwright clock, waits
for the Tidy up bodies to settle, then drives notebook RAF/timers through that
deadline. The **>6** pose threshold is unchanged; failures include at most 40
observed transforms. A targeted positive passes. A negative fixture switches
only the notebook phase to reduced motion and fails the same assertion with
**3** poses. These exact fixtures/logs are in motion-clock/. This controlled
clock proves the animation branch executes, not native wall-clock frame
availability. Every swipe test, including the 120 px control, keeps real clocks.

The first push collided with **9bb1dae**, so the duplicate local reader was
removed in favor of the designated owner's implementation and the real-markup
regression adapted to it. The second rebase adds report-only **193c37b** and
**afb1186**; executable hashes were identical. The third and final allowed rebase
adds Bottle API/admin/store/migration and integration tests (**1c77142**,
**70fe593**) plus reports (**c0a6f3f**, **1e039a3**). Those changes are preserved.
The lock is unchanged. Required tests were repeated after every rebase.

Final verification on **1e039a34a27b102173527ac04ce1765e359898d6** plus the regression:

| Check | Result |
|---|---|
| `npm ci` | initial exit 0; lock unchanged through all rebases |
| trace helper (contract command) | 5/5 pass |
| `npm run lint && npm run typecheck` | exit 0; existing lint warnings only |
| `npm test` | 2337/2337 pass |
| `for i in 1 2 3; do bash scripts/e2e-local.sh || exit 1; done` | 3/3 exit 0; each 151 pass, 0 fail, 1 existing skip |
| full footer browser probe | exit 0; 171 ok, 0 failed, including strict JS/no-JS title comparisons and built-in negative controls |

Final suite times: **340.1 s**, **342.1 s**, **337.4 s**. Each suite builds
again, runs production Next and throwaway Docker Postgres, and passes the wide
120 px desk control, phone/narrow/tablet no-drag checks and both added footer
regressions. The skip is the existing `evidence: every root hydrated under each
colored run`. Generated `content/history.json` is restored before delivery.

Complete final evidence: **shared/artifacts/t-1606/run-9045/final/**.
Initial proof and the first two rebase cycles remain in the parent, `rebased/`
and `rebased-2/`, respectively: each earlier E2E cycle was 3/3 with 140 pass,
0 fail, 1 existing skip per run; unit counts were 2321 then 2323, and every
footer probe was 171/171. rebased-3/ separately retains the six-pose failure;
its footer probe was not run after the failed suite. These historical results are separated from final-tree
proof. `commits.txt` resolves the single delivery commit; the pushed hash is
supplied as `git_sha` in the plan-manager summary.

Final relevant code/lock/configuration/assets fingerprint:
`6907f9b6c9f65bb581ac4dba7603a95931960df7d57d391d759b595988868130`.
The previous executable fingerprint was
`c5b007d61826c83f61b3676b444bdead46769898ba4af3ba5502cf88e9a83925`; the final fingerprint also includes
upstream Bottle sources/schema/migration assets and the changed desk clock
fixture. Every recorded file was checked
unchanged after verification. All three production build IDs and manifest hashes
are saved. Source ancestry contains **0b349dc**, **3ae76a4** and **9ddd084**;
this is source-tree evidence, not deployed ancestry.

Real for the footer and touch controls: locked imports, real Chrome/CDP, production Next's
rendered Riso component and real database/migrations. The DOM controls are
deliberate fault injection. Date/performance/timers/RAF in the single
full-motion notebook context are emulated explicitly as described above.
Upstream unit/browser fixtures remain unit proof;
the added E2E tests cover actual production markup. Nothing about local fixtures
is claimed as independent live QA. Runtime: macOS arm64, Node **22.12.0**, locked
Next **16.4.2** / playwright-core **1.64.0**, real Chrome **155.0.8059.86**,
Docker **postgres:17-alpine**, with digest saved. The footer probe runs
`CI=true SKIP_BUILD=1 EXPECT_SHA=dev bash scripts/probe-end.sh` with a temporary
CLI launcher that execs the installed macOS Chrome. It owns its local server and
database and reuses the final production build; no browser installer runs.

Execution is demonstrated locally. Integration deployed and product delivered
remain unproven by this role, and there is no capacity wait. No remote pipeline
or deployed endpoint is queried, per the explicit stop-at-push contract.
Deferred CI identity: `.github/workflows/ci.yml` main-push event for submitted
`git_sha`; run/job IDs are intentionally not observed by this role. Owner:
plan-manager QA and pm-270 acceptance. Deferred deployed checks: `/api/health`,
`/desk` build identity and independent wide/tablet controls. Failure conditions:
correct title source rejected, red CI, served SHA omits **3ae76a4**, or a failed
120 px wide drag. The original CI-only gesture flake is not claimed reproduced
or eliminated. Local state-based preconditions and traces remain intact.

History completeness: no new remote audit. Prior QA's bounded **60/444** history
is inherited, incomplete context. Local before/after logs are complete. No
operator or runtime-capacity prerequisite is deferred.

Run profile: Codex (GPT-6 per runtime instructions), software_engineer,
**run-9045**; effort is not exposed. Referenced standing files
`docs/claude/software-development.md` and
`projects/20260921222547_plan_manager_chief_of_staff_extraction.md` are absent.
`AGENTS.md` and installed Next 16.4.2 CLI/testing guides were read. Scope,
approach, rebase and lesson decisions are recorded on pm-270.
