# Split Part Recovery

Plan: pm-260 · product owner run-8783 · 2026-10-26
Repository: otohime · platform implementation repository: mono-v2
Status: execution contracts prepared; code and real board release are not yet delivered.

## Outcome and ownership

A split part must not stay held forever after its predecessor is abandoned. Existing parts of a terminal predecessor become eligible in their own promotion line within one tick. The edge remains as provenance; a supported reopen restores the hold for an unstarted part. Abandonment releases eligibility, does not promise a slot, and does not resume a paused part.

This checkout contains the product site, not the scheduler. Research [rep-5107](research.md) located the implementation in mono-v2 `servers/plan-manager` at f7d5b90. The research report body is preserved verbatim, including its historical observations; the decisions in this plan supersede its open points and manual workaround.

Delivery is divided by repository, without a cross-repository after_plan edge:

| Owner | Deliverable |
| --- | --- |
| pm-260, otohime | One SWE contract in [proposal.json](proposal.json): an offline read-only release/dispatch evidence probe and collection walkthrough. QA independently reads the real board. |
| New mono-v2 plan, filed by this PO run | Four implementation contracts in [mono-v2-contracts.json](mono-v2-contracts.json), to be copied into that plan and proposed by its own PO after inspecting current main. No otohime SWE task names a mono-v2 code path. |
| Privileged platform operator | Exact one-plan administrative repair and resume for pm-255; fingerprint `release-after-plan:pm-255:pm-248`. The request is filed after the planning artifacts and proposal are saved; there is no polling. |
| Acceptance on both plans | Preserve separate verdicts for artifact delivery, scheduler integration, release eligibility and actual t-1557 dispatch. The mono-v2 plan owns platform semantics; pm-260 owns the real pm-255 observation. |

The new mono-v2 idea is an independent repair, not part 2 of pm-260: cross-repository after_plan edges are forbidden, and it must start without waiting for the evidence probe. Its intake id is recorded in the PO summary.

## Evidence and resolved decisions

- At 08:30:38Z, `explain_schedule(pm-255)` reported paused, waiting/after_plan, holder pm-248, no own runs, t-1557 ready, and execution_started_at null.
- Live settings now show max_active_plans **2**, an operator override, with **4** used and **0** free. Research's max=4 and temporary max=5/reset sequence are stale. Reset would restore Helm's 4 and discard the operator's 2. Preserve the current cap.
- pm-248 was abandoned by decider-agent, not auto:decider-budget. The reopen API refuses that predecessor. Reopen/re-abandon is not an executable recovery procedure.
- Proposals admit only SWE tasks and at least one task. A local acceptance probe is a useful repo-owned build contract; a pretend scheduler task or empty DAG would fail.
- Release existing parts of done, abandoned, rejected and failed_draft predecessors. Preserve intake validation and other terminal/revision semantics unless the canonical status predicate already includes them safely. No new library, controller, storage schema or screen is needed.
- Keep the edge in normal policy and copy the actual final terminal decision summary/note to every open direct part. Handle the terminal note's write order so a pre-note status transition does not lose it.
- Make paused resume consult the same hold predicate. On supported reopen, restore the hold on queued/unstarted work; do not cancel work that already started.
- Skip local task_duration and task_attempts for plans without execution_started_at. Otherwise anchor duration and investigator ReadyFor at max(first-ready timestamp, execution_started_at). A still-held part gets no local work-slowness pause; independent CI rules retain the explicit after_plan cause.
- No task proves a claim by passage of time. Controlled clocks and real on-demand drill entry points prove periodic scheduler/watchdog behavior now.
- This is a bug fix to the existing deterministic scheduler. Alternatives considered: advisory-only notices (the defect), per-part release/reject questions (a needless policy gate), permanent edge clearing (loses reopen semantics), and a new workflow engine (unnecessary scope). Release with retained provenance is chosen.
- Product-owner run has no task id; its documentation commit uses `pm-260/run-8783:`. Assigned SWE runs use their actual `plan_id/task_id:` prefix.
- Every judgement is also recorded through plan_manager_record_decision; the missing research artifact and changed cap are recorded as a lesson.

## Current plan build contract

[proposal.json](proposal.json) is the exact task array submitted to plan_manager_propose_tasks. It contains one independent SWE task, **Verify split part release**, with problem, ordered action_items, interfaces, non_goals and three checkout-only verification commands.

The probe consumes unmodified decoded JSON from get_plan, explain_schedule, get_timeline and list_runs. It makes no network call or board mutation. It reports release eligibility and actual durable SWE submission separately, requires matching ids and the parent's terminal note on the part timeline, and fails closed on incomplete inputs.

Two modes are explicit:

| Mode | Required evidence |
| --- | --- |
| released | Current progress has left after_plan, the release note is present, and pm-255 is either queued/startable or has actually started execution. |
| dispatched, default | released plus execution_started_at and a software_engineer run for t-1557 with a durable task-manager id; a scheduled run without submission is insufficient. |

A failed submitted SWE attempt can prove dispatch, never product delivery. Tests cover API-shaped synthetic positive fixtures and held, paused, wrong-id, missing-progress, missing-note, scheduled-only and truncated negative fixtures. They are fake board evidence, not proof of the live release. Verification runs `npm test`, the focused evaluator/CLI test, and `npm run typecheck`. QA remains required.

Offline implementation is independent of board capacity. The operator action already filed by this PO is reused, not recreated by each run. If a run encounters a genuinely absent person-only prerequisite, its first action raises the stable chore and reports immediately; subsequent work resumes under the outcome. Runtime capacity is handled by the existing durable plan queue, not a machine-start chore.

## Platform build contracts for mono-v2

[mono-v2-contracts.json](mono-v2-contracts.json) contains all fields and commands for these four contracts. It is a blueprint for the correctly homed plan, not a claim they were proposed on pm-260.

| Sequence | Contract | Dependencies | Result |
| --- | --- | --- | --- |
| 1 | Release finished predecessor parts | none | One-tick queued/drafting release; per-part terminal note; repeat/race idempotence; retained edge; resume observes unfinished hold; reopen restores unstarted hold. |
| 2 | Explain abandonment effects to deciders | "1" | Deterministic part list/counts in the packet and prompt; abandon/reject responses and terminal evidence name real effects and released_parts, including still-paused parts honestly. |
| 3 | Anchor task slowness to execution | none | Never-executed parts cannot trigger task-local slow work rules; measurements, investigator prompt and spell identity share the execution-qualified first-ready anchor. |
| 4 | Prove split recovery on demand | "2", "3" | Existing split/slowness HTTP and MCP drills cover release, reopen, real hold and clock scenarios through production code with isolated fixtures and explicit cleanup. |

Each behavior ships with its own failing regression tests in its implementation contract; sequence 4 is deployed-path proof, not delayed unit coverage. The no-skip recovery target checks named tests actually ran on memory and PostgreSQL. The real executable preflight is `make build` using the service's locked go.mod/go.sum and existing dependency environment; fake launchers prove orchestration only.

Current admission settings are max_plan_elapsed=6h and max_live_runs_per_plan=3. At fallback 1h/task, all four overlap through service architecture/changelog and their total is 4h; the longest dependency chain is 3h. The correctly homed PO must use the server's learned role p50 estimate before storage. If refused plan_too_large, keep a first part within the limit and file the remainder as same-repo after_plan parts using the returned preceding plan ids; never parent_plan_id. No planned task requires an external human or runtime to pass its checkout verification.

All target SWE work ends at commit/push. QA/acceptance run the deployed drills through `plan_manager_drill_plan_split` and `plan_manager_drill_slowness` (default isolated mode), the same implementations used by the HTTP surfaces. No live_submit fixture is needed for this change. The natural periodic tick is outside task proof.

## Immediate pm-255 recovery playbook

This is an administrative database repair and existing resume operation performed by the privileged platform operator. Delivery roles must not invoke the privileged tools or bypass them through HTTP/SQL.

1. Read pm-255, pm-248, the actual abandoned decision/note (dec-55805 and dec-55807), and current settings. If pm-255 has already progressed, preserve its evidence and do not repeat writes.
2. If pm-248 remains abandoned and pm-255 still has after_plan_id=pm-248, conditionally clear only that edge in a transaction using the operator's authorized database procedure. Predicate on both ids and pm-248's abandoned status; require one changed row. Preserve the old edge in the audit decision. This one-off repair differs from normal retained-edge policy because the old deployment has no release route and no authenticated resume can remove its schedule hold.
3. Record a pm-255 timeline decision naming pm-248, its abandoned decision id, summary and final note, pm-260 and the administrative edge repair; include before/after edge and actor. Verify note readback. If already cleared, avoid a duplicate repair decision.
4. Resume pm-255 through the existing privileged resume operation if it remains paused. Do not alter max_active_plans, watchdog settings, task timestamps, t-1557/t-1558 identities or contracts.
5. Read the immediate result once through get_plan/explain_schedule/list_runs. Resume admits executing when capacity is available or durably queues pm-255 in its own right; normal caps may keep it queued/startable. Record observed state and any real task-manager id. Do not call queueing a dispatch.
6. If not yet dispatched, leave acceptance pending under the platform's pending/watch mechanism with exact plan/task/chore ids, ownership and failure condition. This is a capacity deferral, not a new human prerequisite, and does not make a false dispatch claim.

Do not use reopen/re-abandon or the cap-bump bypass. Clearing this single stale edge makes the old scheduler's progress truthful immediately and prevents renewed after_plan holding. The general code fix keeps edges for all normal transitions.

A generic unauthenticated HTTP ready_probe cannot establish this admin-only state: GET /api/v1/plans/pm-255/schedule requires IAM, /internal requires its token, and the probe schema has no auth headers or JSON predicate. Omit a misleading HTTP 200 login-page probe; readiness is the operator's recorded outcome plus independent MCP readback. No credential is put in a URL. After the platform fix, acceptance uses the existing authenticated tools to prove the state directly.

## Acceptance walkthrough and negative controls

| Scope | Starting state | Action now | Required observable evidence |
| --- | --- | --- | --- |
| Existing-part release | abandoned predecessor, one queued part, one free slot | Fixture HandleTick once through deployed split drill | Part executes; parent note attached; after_plan edge retained; one release notification. |
| Capacity boundary | terminal predecessor, full normal slots | Fixture tick | Part queued, progress startable/capacity-bound, not after_plan; release does not promise dispatch. |
| Existing done behavior | done predecessor, queued part | Fixture tick | Part promoted with previous done semantics. |
| Supported reopen | budget-abandoned predecessor, unstarted queued part | Existing reopen then fixture tick | Progress after_plan names predecessor; done then tick releases it. |
| Negative control | executing predecessor | Fixture promotion/resume | No part dispatch, progress remains after_plan. |
| Draft safety | abandoned/rejected predecessor and held draft | Fixture draft release | One research run, prompt names true status and undelivered assumptions. |
| Decider honesty | parent has open/paused parts | Render packet, apply abandonment in fixture | Part ids/counts listed, release eligibility distinguished from paused state, released_parts evidence and final note copied once. |
| Watchdog clock | ready 3h ago, execution_started_at=null, threshold 2h | On-demand slowness drill | No task_duration/task_attempts pause or investigator. After promotion clock advances synthetically to threshold boundaries; Since and ReadyFor use new anchor. |
| Real board | pm-255 paused behind abandoned pm-248 | Operator administrative repair/resume; independent MCP reads | Part timeline has the parent note and repair; queued/startable or executing with progress.reason != after_plan. Final dispatch criterion requires a real SWE run for t-1557 and its task-manager id. |
| Evidence-probe negative control | Copy of real snapshots | Change part/holder/task id or restore after_plan hold | Probe fails; the untouched live board is not mutated. |

QA/acceptance obtain raw evidence independently of the implementer's summary, compare deployed build identity to delivery SHA, and inspect bounded paginated failed and completed run/task histories as well as current jobs. Record counts and whether pagination/tails are complete; any unread/truncated range is inconclusive. Follow a real submitted run's callback through persisted ingestion if asserting execution/delivery, and correlate executable fingerprints (relevant code, lock/config hashes) rather than unrelated main commits.

Reports distinguish integration deployed, queue/capacity pending, execution demonstrated, and product delivered. Actual profile/model/effort must come from the observed run. This PO ran profile codex-sol-6-1-high, gpt-6.1-sol, high (run-8783); research ran on its historical cited profile, not today's defaults. No task or report may equate a fake launcher, green unit tests, or a durable queue id with t-1557's delivered output.

Deferred live items name ids pm-255/t-1557, the operator chore id returned at filing, and the new mono-v2 plan id returned at intake; owners are platform operator (edge repair/resume), scheduler (capacity/admission) and acceptance (dispatch proof). Failure means the hold persists after reported repair, a fresh local slowness pause occurs before execution, or a submitted SWE job fails; the latter remains a defect alongside any replacement.

## Scope and delivery validation

No application, scheduler code, deployment config, credentials or binaries are changed in this PO run. Only planning/research artifacts under this folder are committed. Run the project's own `npm test` before the documentation commit, validate both JSON DAGs and all required contract fields, and run `git diff --check`. Push with `git push origin HEAD`; on non-fast-forward rebase, rerun the tests and push without force.

The summary report records pushed SHA, branch, proposal task id(s), mono-v2 idea/plan id, operator action id, local tests and visible GitHub Actions status. Planning completion is not platform-fix completion. The report explicitly leaves real release/dispatch unproven until independent observation.
