# Engineering evidence — pm-259/t-1583, run-8945

The landed fetch and Peek repair is preserved. This delivery adds a deterministic real-Git regression for the supplied red gate's history-fixture failure; it changes no application behavior or CI policy.

The checkout at `d79586cb50a8b27c8b046e04b26bb2b702b6c4ac` contains both Peek repair `591c28e` and Git isolation repair `543ba68`. The latter disables automatic garbage collection/maintenance in fixture commands and subprocesses inherited by the history index. The existing 205-commit history test passes. A new trace-based test explicitly enables repository maintenance, observes a real maintenance subprocess without isolation, then requires its absence for both fixture commands and the inherited `gitRunner`. The enabled control disables actual repacking/pruning, so the test proves subprocess arbitration without recreating a destructive timing race.

Removing the environment-isolation line in a temporary test copy makes the new assertion fail: Git launches `maintenance run --auto --quiet`. The temporary copy was removed. The final test passes without changing the existing upstream repair. See [negative control](artifacts/history-negative.log) and [history suite](artifacts/history-control.log).

All four task contracts passed before commit:

| Contract | Result | Evidence |
| --- | --- | --- |
| Fetch policy and existing foundation | 21 passed, 0 failed | [TAP](artifacts/foundation.log) |
| `npm test` | 2219 passed, 0 failed, 0 skipped | [summary](artifacts/repository-summary.log); successful per-test TAP omitted |
| `npm run lint && npm run typecheck` | exit 0; 10 existing warnings | [log](artifacts/lint-typecheck.log) |
| Production fetch, companion and peel | 28 passed, 0 failed, 0 skipped | [build and TAP](artifacts/browser.log) |

The production suite uses real locked imports, PostgreSQL migrations, Next build/start, SVG artwork and Chromium rendering/Web Audio. It includes initial sprite placement; continuous real mouse movement across the open Peek fan and back to Fetch back; actual turtle/proxy arrival and return geometry; native link navigation and source text/href/box retention; CDP mobile grip versus body scrolling; selection; cancellation; reduced motion; Save-Data and excluded desk/stamp controls. Pure clocks/storage/media fixtures, synthetic lifecycle events and the deliberately immobilized renderer are controlled boundaries. The stalled-turtle negative control must cancel rather than claim return. No fake renderer or mocked geometry proves completion.

Production build: `n6Iy4k9FiYFWkOUMfoRnq`. Node `v22.23.3`, Next `16.4.2`, React `19.3.0`, Playwright Core `1.64.0`, Chromium `154.0.8037.57`, Git `2.43.0`; `npm ci` used the committed lock unchanged. The required art is inline SVG, with no downloaded model or binary asset. [Identity](artifacts/identity.json) records source, lock, runner, test and CI configuration hashes. Feature fingerprint: `c693899bd53131d5fa1368e7d69c4ceba92fe127e71e201f392b5fe6384e2688`. Build-regenerated history was restored rather than delivered as an unrelated content edit.

Actual agent profile/model/effort from the run record: `codex-sol-6-1-high` / `gpt-6.1-sol` / `high`; fleet worker `avietidol-z490`.

CI evidence is incomplete. One pre-push snapshot requested planned run `40325669520`, current queued/running runs, completed history pages 1–2 (20 records each), and old failed job `121549479127`'s raw log. All returned HTTP 403 rate limit exceeded: zero records were readable, neither history page was read, and no raw tail was obtained. [Responses](artifacts/ci-history.json) preserve the failures. No current CI conclusion or deployment is inferred from previous reports. The supplied older live Peek defect remains historically observed; this run makes no claim about its current live status. No asynchronous application jobs, callbacks, durable runtime queue or capacity prerequisite applies to this browser-only feature.

Execution demonstrated: local production checks pass. Integration deployed: unobserved. Waiting for capacity: no. Product delivered/independent acceptance: pending platform verification. For task `t-1583`, plan-manager owns the pushed commit's CI checks and production job, exact-SHA green gate, and independent deployed QA. Fail if any gate fails, the served SHA lacks `591c28e` or this delivery, or native mouse/keyboard/touch/reduced-motion behavior, arrival/return geometry or source integrity fails. The older plan's request to watch CI and inspect deployment is superseded by this SWE run's explicit stop-at-push contract. No pipeline watch or deployed-system check ran.

Delivery is the single task-prefixed commit containing this report, pushed with `git push origin HEAD`; its exact SHA and push result are supplied in the final summary and uploaded `artifacts/commits.txt`. Any required rebase verification is recorded in additional artifact logs before the push. No post-push checks are required from engineering.
