# Susuki model verification — pm-299/t-1765

Original implementation: `run-9660`, software engineer, 2026-10-29. Base: `95887d3eef1947d487726f17b276b5b72c398462`.
Original branch: `pm-299/t-1765-susuki-model`, commit `d606b996696655f973d025412e14de8d5cd77a4a`. Recovery and current delivery evidence appear below.

## Environment and guidance

- Real run metadata from `plan_manager_get_run`: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, reasoning effort `high`, runner `fleet`, worker `avietidol-z490`, attempt 1.
- Installed the exact `package-lock.json` using `npm ci`: 522 packages installed, no dependency or lockfile changes. Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`.
- Read installed Next guides `01-app/03-api-reference/05-config/02-typescript.md`, `01-app/01-getting-started/05-server-and-client-components.md`, and `01-app/02-guides/lazy-loading.md` before implementing.
- Read `AGENTS.md`, this plan and its research. The referenced `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md` are absent from this checkout and the searched workspace. Followed the available guidance and explicit task contract; recorded the gap as a decision.
- No codebase knowledge graph tool was available; inspected source directly. Reused the existing pure `seeded` PRNG from `lib/ink-particles.ts` and the `Season` type from `lib/seasons.ts`.

## Adapter contract

- All functions are zero-DOM and deterministic, with caller-owned state. All `dt` values are seconds. Invalid/nonfinite or nonpositive time does not advance animation.
- `susukiBladeCount(width, slowFrames = 0)` ramps from 2,400 at 360 CSS px to 8,000 at 1,920 CSS px, clamping at each end. `slowFrames` counts observed frames **exceeding** 20 ms. Any positive count halves the baseline once, yielding 1,200–4,000. The explicit task budget takes precedence over the plan overview's older 6,000–10,000 range.
- `createSusukiBlades(count, seed)` returns interleaved `Float32Array` attributes with stride 6: rootX `[0,1]`, depth `[0,1]`, height `[.25,1]`, lean `[-.25,.25]`, phase `[0,2π]`, plume `[.125,.375]`. Float32 phase bounds allow rounding to the nearest Float32 representation of 2π. Allocations floor count, cap at 8,000, and return empty for invalid counts. Prefixes remain stable when reducing the draw count.
- `stepPointerSpring({x,y,vx,vy}, {x,y}, dt)` uses the analytic critically damped spring, ω=12 (unit mass, k=144, c=24). It avoids frame subdivision drift; long frames converge safely.
- `stepScrollGust(current, scrollDeltaPx, dt)` accepts accumulated pixel displacement for the frame, uses absolute px/s, normalizes by 1,200 px/s, clamps boost to `[0,3]`, and smooths with a 0.18-second exponential time constant. Zero input decays toward calm. Use this boost for wind speed/amplitude in Task 2.
- `susukiSeasonTint(season, scheme)` supplies distinct frozen, normalized RGB paper/ink/plume tuples for every season × scheme combination. Plumes are lighter than stems in both schemes.
- `createFoxState({hasRun, idleThreshold, trotDuration})` defaults to a 14-second idle threshold and six-second trot. `stepFoxState` accepts elapsed seconds or `{type: "pointer" | "scroll" | "key" | "trigger"}`. Trigger starts immediately. Ordinary input resets waiting time or ends an active trot synchronously. Excess time crossing the idle threshold carries into the trot, with x bounded to `[0,1]`.
- The fox consumes `hasRun` **on start**, so cancellation also consumes the session. Task 2 must persist this flag immediately and restore it through `createFoxState({hasRun: true})` on remount. No module-global flag or storage access is hidden inside this model. A completed state is terminal, including explicit triggers.
- The active fox exposes its normalized gust source at depth 0.7. `foxGustAt` delegates to `susukiDisplacement`, the same radial quadratic falloff used for the cursor. Waiting/done/cancelled states contribute zero displacement.
- `chooseSusukiMode` selects static mode for reduced motion, Save-Data, absent WebGL2, or context loss. Restoring context permits live mode again if the other conditions permit it.

## Verification results

| Contract check | Result |
| --- | --- |
| `susuki-unit` | Exit 0: 23 passed, 0 failed, 0 skipped |
| `repo-checks`: `npm test` | Exit 0: 2,684 passed, 0 failed, 0 skipped; 2 suites |
| `repo-checks`: `npm run typecheck` | Exit 0: Next route type generation and TypeScript passed |
| `repo-checks`: `npm run lint` | Exit 0: 0 errors; 11 warnings in existing files outside this task |
| `git diff --check` | Exit 0 |
| `bash scripts/setup-owner-git.sh --check` | Exit 0: effective author is the verified repository owner |

Commands ran from the repository root:

```sh
(test -d node_modules || npm ci) && TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/susuki.test.ts
(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint
```

Unit coverage includes multiple seeds and every attribute bound, stable buffer prefixes, adaptive counts, critical step response without overshoot, velocity and frame-rate invariance, long/invalid steps, scroll clamping and decay, all eight tints, frozen palette safety, radial gust falloff, idle threshold/carry-over, explicit trigger, each immediate input cancellation, remount/session lock, custom timing and all 16 mode combinations.

Negative control: copied the real model/tests and their imports into a temporary directory, changed cancellation to clear `hasRun`, then ran the three `resets idle time` tests. All three failed as expected (pointer, scroll, key). The tracked model was never mutated. This confirms the cancellation/session assertions reject that defect; it is local engineering evidence, not independent deployed QA.

Complete local check history: the first targeted run passed 22/23; an assertion expected exact zero at a subnormal positive timestep, while `Math.expm1` correctly returned `9e-323`. Changed that assertion to numerical tolerance, preserving the filter. The corrected targeted run passed 23/23, the full repository gate passed, and the deliberate negative control failed 3/3 as intended. The lesson is recorded through plan-manager. Raw final unit, repository, typecheck, lint and negative-control logs are copied to `/shared/artifacts/` for this run.

## Executable identity and delivery limits

SHA-256 identities of tested inputs:

```text
82ca02211317b13e29240b5243f521d85d9f6159a3b0dfe855582e0f10ca1d36  lib/susuki.ts
1be699bcec48be9e97df2fdc29a429e7bce4cbb491d7c68f02d89a418c94c680  lib/susuki.test.ts
b5f7552ff8cbbec5fe35fa9447383c441b861544b8530dcbbe433749250877f1  lib/ink-particles.ts
c6a7a691c0ff19fdcc47a98b652cfca26d13bb6cb278ff336719dec8e54aef23  lib/seasons.ts
9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b  package-lock.json
8f9738c8f9cf680970dc8c12c614f3f7a43796e4eac43ecd6f674e4ee9adaacd  package.json
31902b54fba14db30d5a63026588796ddd27599ac76e6660e2c0b3d3ec69ba2d  tsconfig.json
```

Execution demonstrated: real Node imports and pure-model behavior under the installed locked dependencies. No fake runner, model assets, processor construction, runtime queue, callbacks, or ingestion exist in this task; platform FAILED/COMPLETED/current runtime job histories are not applicable and were not inspected. The local invocation history above is complete; no platform-history success is inferred.

No known model defects remain. No runtime capacity or operator prerequisite is deferred. Integration deployed and complete visual product delivery are **not demonstrated** by this model task. Task 2 owns canvas/event/storage integration and browser/fallback/footer verification; that fails if the rendered field, session persistence or footer invariants break. Plan-manager owns post-push CI/green-gate verification for this delivery SHA; a failed pipeline returns the task for correction. Per the role contract, this run stops at push and does not watch CI or inspect a deployed system.

## Delivery recovery — run-9664

- Claimed `t-1765` before starting recovery. Actual run metadata: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `avietidol-z490`, attempt 2.
- Read the prior run and its available raw log. GitHub accepted its feature-branch push, but the persisted run failed with `class=push_failed`, `marker=push_not_on_main: HEAD d606b9966966 is not on origin/main`. Saving a feature branch alone did not meet this legacy workflow's delivery requirement. Recorded this lesson and the recovery approach through plan-manager.
- Fetched `origin/main` at `95887d3eef1947d487726f17b276b5b72c398462`; the rescued implementation was already present in a clean working tree. Created `pm-299/t-1765-delivery-run-9664` from that preserved HEAD, without replaying or amending the rescued commit. Retained all implementation and tests; dropped nothing. This run adds only recovery evidence in a second task-prefixed commit.
- Installed 522 packages with `npm ci` from the unchanged lockfile. Node `v22.23.3`, npm `10.9.9`, Next `16.4.2`. Reviewed the installed TypeScript, Server/Client Component and lazy-loading guidance. The two referenced standing-rule documents and RTK.md remain absent; no graph tool is available, so inspected source directly.
- Fresh real-model verification: `susuki-unit` passed 23/23, zero failures/skips. `repo-checks` passed all 2,684 tests with zero failures/skips, typecheck, and lint (zero errors; 11 existing warnings outside task files). Raw output: `/shared/artifacts/run-9664-susuki-unit.log` and `/shared/artifacts/run-9664-repo-checks.log`.
- Repeated the negative control in temporary copies: clearing `hasRun` on cancellation caused all three pointer/scroll/key cancellation tests to fail (exit 1) as intended. Log: `/shared/artifacts/run-9664-negative-control.log`. Tracked source was unchanged. This is local engineering evidence, not independent deployed QA.
- Recomputed every SHA-256 in the table above: all seven remain identical to the original verified executable, imports, lock and configuration. No fake runtime or unverified dependency substitutes were used; there are no required external model/processor assets for this library.
- Plan SWE run history at inspection contained four entries: two failed (`run-9660` for this task and `run-9661` for Task 3), zero completed, one running (`run-9664`), one scheduled (`run-9669` for Task 3). For this task specifically: one prior failure and this active recovery. The list API exposes no pagination; these are all returned entries. The earlier raw agent log was truncated, so its full execution history is inconclusive; no unseen success is inferred. Runtime FAILED/COMPLETED/current job queues and persisted ingestion are inapplicable to this pure-library task. This run's local check history is complete: targeted pass, deliberate negative-control failure, repository-check pass.
- Publication procedure after green local checks: `git push origin HEAD` saves the recovery branch, then a normal `git push origin HEAD:main` fast-forwards the same tested delivery to the integration branch to resolve `push_not_on_main`. All commits are made on the task branch. No force push. The exact pushed SHA and subjects are written to `/shared/artifacts/commits.txt` and submitted in the summary report; push results belong to that report rather than a pre-push claim here.
- First publication saved `9efd9d5edf4b9c9e3b15d9b32ab22232057d134b` on `pm-299/t-1765-delivery-run-9664`, but main rejected the push because concurrent commit `56ba29c` had landed (only another plan's documents changed). As explicitly required on rejection, created unpublished branch `pm-299/t-1765-delivery-run-9664-retry-1` and ran `git pull --rebase origin main`; both task commits replayed without conflicts. The saved branch remains intact, and no force push is needed. All seven executable fingerprints above remained unchanged. Reinvoked both contract gates after rebase; retry logs use `/shared/artifacts/run-9664-retry-1-*.log`. Final results and rebased delivery SHA are bound by the summary report and `commits.txt`.
- No known model defect, capacity deferral or operator prerequisite remains. Execution of the pure model is demonstrated; deployed integration and visual product delivery remain unproven and belong to Task 2 (`t-1766`). Plan-manager owns CI for this delivery and will return failures. This run stops after publication and report; no pipeline watching or deployed-system checks.
