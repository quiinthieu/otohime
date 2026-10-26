# Split Part Recovery

Plan **pm-260**, current-revision planning handoff · product owner **run-8866** · 2026-10-26.
Repository **otohime**. The original recovery outcomes remain required.

## Run-8878 update: the live hold is released

Read at **11:37 UTC** (run-8878, product owner, profile claude-sonnet-5-5):

- **pm-255 is released.** Orchestrator decision **dec-57364** (`after_plan_released`,
  advisory=false, 11:35:26Z) names pm-248 abandoned, `released_parts=[pm-255]`,
  `terminal_decision_id=dec-55805`. explain_schedule now shows pm-255
  `progress.state=startable`, queue position 1, holders `[]`; t-1557 is ready.
  Slots were 5 of 5 used, so t-1557 has no SWE run yet: dispatch follows when a
  slot frees, owned by the scheduler. This is the deployed pm-263/pm-267 release
  code (f9e9cc574 lineage) acting on the existing edge, not a manual board write.
- **The note is still empty.** dec-57364 has `terminal_note=""`: the legacy
  abandon note lives in the later dec-55807 `decision_applied`. pm-267 **t-1594**
  fixed that binding in **cef2b4f62** (green gate ver-3541 pass: build, test,
  test-postgres, test-conditional-writes, test-after-plan-release 60 of 60);
  it is `qa_pending`, not yet deployed. Parent-note provenance on pm-255 is
  therefore **not** yet met.
- t-1595, t-1596 (slowness anchor) and t-1597 (drills) are still pending in pm-267.

Remaining originals and owners (no otohime task can discharge them):

| Outcome | State | Owner / failure condition |
| --- | --- | --- |
| (1) release or operator_action, decider text | release observed live; decider text is t-1595 | pm-267; fails if abandon text still says it frees parts |
| (2) unit tests | t-1594 tests green at cef2b4f62 | pm-267 QA |
| (3) slowness anchored to execution | t-1596 | pm-267; fails if null execution start still breaches task_duration |
| (4) pm-255 reaches startable, t-1557 dispatched | startable met; dispatch pending a slot | scheduler; fails if t-1557 has no SWE run after a slot is free |

**Zero remaining otohime SWE tasks.** The local proposal is again the saved empty
DAG; the platform will refuse it (`missing_acceptance_criteria`), as in run-8866.
The accepted execution-complete proposal is dec-57246 on pm-267. No task waits.

## Current execution handoff

[Fresh bounded observations](planning-observations-run-8866.json), captured at
**11:25:17 UTC**, supersede the earlier status snapshots below. pm-260 is still
revision 3, drafting. Both previous summaries **rep-5164 and rep-5171 exist**;
their empty local proposals were refused. The repeated missing-report prompt
does not mean either report or the platform proposal disappeared.

**mono-v2 pm-267 is executing its accepted four-task DAG.** Product owner
run-8863 succeeded with **rep-5173**, and **dec-57246** admitted the contracts
at source SHA **67882dcd8fc7a8b99a0a7e4acbc41571c61e1481**. The pushed platform
plan/report SHA is **2c4b5cae88931b5ea18bd7405316104f44d3e445**; plan path:
projects/after-plan-recovery-replacement-for-human-abandoned-pm-263-r/20261026111255_after_plan_recovery.md.
The [accepted contract archive](platform-contracts-run-8866.json) preserves every
problem, action item, repository interface, non-goal, verification command and
QA requirement read from the live tasks. These are existing execution records,
not a new proposal to otohime.

| Sequence | Existing task | Dependencies | Observed status |
| --- | --- | --- | --- |
| 1 | t-1594 Release finished predecessor parts | none | running |
| 2 | t-1595 Explain abandonment effects to deciders | 1 | backlog |
| 3 | t-1596 Anchor task slowness to execution | none | ready |
| 4 | t-1597 Prove split recovery on demand | 2, 3 | backlog |

t-1594 has real SWE **run-8870**, durable task-manager id
**51636328-89fa-4ffe-b5ce-ccc4d39cf536**, profile **claude-opus-high**, actual
model **claude-opus-5-5**, effort **high**. Dispatch demonstrates execution of
the platform contract has started; it demonstrates neither a finished build
nor deployed repair nor pm-255 recovery. No replacement intake or duplicated
platform proposal is needed. Preserve its research findings: current default
slowness cases include platform_shadow_to_live, its platform counter is 2,
the watchdog manifest gained six names, and observeStageTiming must stay green.
Transactional drill fixture ids are reused after rollback; identify proof by
fixture case, build identity and assertions rather than treating fixture ids
as live plans.

**pm-255 remains queued, waiting/after_plan pm-248, execution_started_at=null.**
Its complete 15-entry timeline ends at idea:idea-248 and has no release record;
its unfiltered runs list contains only investigator run-8771. Slots were 5 used
of 5. The independent parent hold persists regardless of capacity. Research's
last deployed build observation was f19db8db; this run did not reread deployment
or execute deployed drills and makes no current rollout claim.
No platform release, t-1557 execution or Ask output is delivered by this plan
update. Keep the original acceptance outcomes below.

**esc-405 is the existing waived chore**, using fingerprint
release-after-plan:pm-255:pm-248; esc-395 is its historical predecessor.
The decider waived esc-405 at **11:21:14 UTC**, with chore_done_at unset, and
assigned recovery to deployed pm-267 or the existing privileged repair.
Do not open another copy. Its waiver is not release evidence. The authenticated
operator can execute the conditional repair below and attach the real parent
note on pm-255 before the code lands; otherwise pm-267's deployed reconciliation
must release the existing edge. No generic health/login probe demonstrates this
private board mutation. Capacity placement and callbacks belong to the scheduler.

The handoff chooses retained-edge terminal release in pm-267 and the existing
one-edge administrative repair as the optional earlier recovery. Reopening
pm-248 is unsupported for this abandonment; increasing caps bypasses the
defective predicate; more local evidence-tool tasks cannot release the part.
Those alternatives remain rejected. No new service, library, UI or external
dependency is needed. Standing policy files were read through the host mono-v2
git mirror because their requested paths do not exist in otohime.

There are **zero remaining otohime SWE tasks**. Re-proposing t-1593 creates new
work rather than referencing its done record. ValidateProposed rejects an empty
proposal before recording it. Call the required local proposal tool once with
the saved empty DAG and pushed SHA, then submit a summary preserving the actual
result. The accepted execution-complete proposal is dec-57246 on pm-267. Report
the remaining local workflow conflict honestly instead of claiming admission.
The next useful pm-260 step is independent acceptance of the deployed repair
and live release, not another planning or offline-tool delivery. The platform
continues independently; no task waits on it. No board bypass or manufactured
execution contract is authorized by this limitation.

The original outcomes remain **unmet and deferred**, owner **pm-267 / esc-405**,
failure condition **pm-255 still waiting/after_plan once pm-267 is deployed**.
Dispatch additionally requires a real t-1557 SWE run and durable task-manager
id, with execution_started_at set; product output follows pm-255's own gates.
Existing t-1593, fixtures and green checks cannot discharge those criteria.

## Preserve the delivered tool; route the remaining work

**t-1593 Certify offline release evidence is done**, delivered at **0c4a25d**.
Keep its CLI, evaluator, tests and all prior evidence. This revision proposes
**zero remaining otohime tasks**. Another offline-tool or documentation task
cannot repair the platform or release the live board.

[Research rep-5107](research.md), [acceptance run-8846](acceptance_report_1.md),
its evidence directory and earlier reports remain unchanged. The previous plan
and proposal remain in git history. Standing rules stay in AGENTS.md and
docs/claude/software-development.md. The Chief of Staff plan and development
policy were read from the host mono-v2 checkout because those files are absent
here; this document does not replace them.

## Previous run-8851 platform handoff

| Item | Observed during run-8851 | Consequence |
| --- | --- | --- |
| pm-263 After Plan Recovery | **Human-abandoned**, dec-57095 at 10:55:28.980007Z; execution_started_at=null | Acceptance's paused observation is superseded. Resume requires paused; reopen accepts only budget abandonment. |
| Platform tasks | t-1579/t-1581 ready; t-1580/t-1582 backlog, none executed | Preserve the four build contracts under a supported replacement intake. |
| pm-255 | queued; waiting/after_plan; holder pm-248; execution_started_at=null | No release or execution claim is justified. |
| pm-255 runs | Only investigator run-8771; zero t-1557 SWE runs | No real dispatch or product output. |
| Capacity | 5 used / 5 maximum / 0 free | The predecessor hold independently blocks promotion; preserve current overrides. |
| plan-manager | Rollout complete, 2/2 ready, image f19db8db | Platform repair remains undeployed. |
| esc-395 | Waived, chore_done_at unset | Waiver did not perform the administrative repair. |

An all-visibility plan list showed no other live After Plan Recovery plan.
The newer operator request explicitly requires the platform work to run.
Restoring a human-abandoned row is not supported by the delivery APIs.
Run-8851 therefore refiled the preserved scope through supported mono-v2 intake
as **pm-267 / idea-263**, with neither after_plan_id nor parent_plan_id.

The replacement dispatched research **run-8855**, durable
task-manager id **a2c8a349-51fa-4648-8a1e-a84688f86ee3**: now succeeded,
profile claude-fable-high, model claude-fable-5-1, effort high.
This proves intake and research dispatch only, not a SWE attempt or deployment.
This PO's actual profile is codex-sol-6-1-high, model gpt-6.1-sol, effort high.

## Execution-complete platform scope: mono-v2 pm-267

[platform-contracts-run-8851.json](platform-contracts-run-8851.json) archives all
four approved pm-263 contracts, numbered from 1 with dependencies only on each
other. Their full objects were included in the durable replacement idea.
The immutable original mono-v2 handoff is
projects/after-plan-recovery-correctly-homed-platform-fix-from-pm-260/20261026085239_after_plan_recovery.md
and mono-v2-contracts.json at **406f07877e618a90b3270a53356e5036b591933f**.
The replacement PO refreshes current source and settings and reads that handoff
for exact required test-group names before proposing these contracts.

| Sequence | Build contract | Depends on | Observable result |
| --- | --- | --- | --- |
| 1 | Release finished predecessor parts | none | Terminal predecessors release existing parts within one controlled tick; retained edge and final parent note preserve provenance; supported reopen/retry restores an unstarted hold. |
| 2 | Explain abandonment effects to deciders | 1 | Packets name open direct parts; abandon/reject responses and evidence describe eligibility honestly; actual final notes reach the part. |
| 3 | Anchor task slowness to execution | none | Null execution start suppresses local task duration/attempts; executed duration, Since, spell and investigator ReadyFor use max(first-ready, execution start). |
| 4 | Prove split recovery on demand | 2, 3 | Existing HTTP/local/MCP drills exercise shared code with controlled clocks, real-store rollback fixtures, fake launcher, exact case counts and cleanup. |

Each archived SWE contract retains problem, action_items, repository interfaces,
non_goals and nonempty verification[]. Preserve its declared make build,
make test, make test-postgres, make test-conditional-writes and focused required
test-manifest targets. SWE stops at its tested commit and push. Platform QA and
acceptance own deployed HTTP/MCP drill evidence. A fake launcher cannot prove
real t-1557 execution or product output.

Actual **dec-57246** admission is **9775.622884 seconds** (about 2h43m), below
**21600 seconds / 6h**. SWE p50 is 2443.905721 seconds from 35 samples; all four
tasks overlap, so their weighted sum is 9775.622884 seconds at the current
max_live_runs_per_plan=1. Critical path 1→2→4 is 7331.717163 seconds; the maximum
of those terms passes. The admitted DAG needs no split and has no dependency
on pm-260 or abandoned pm-263. Preserve live runtime settings.

## Immediate live recovery: reuse esc-405, preserving esc-395 history

The privileged operator can perform the existing one-edge repair before platform
delivery. Reuse fingerprint **release-after-plan:pm-255:pm-248** rather than opening
another chore. The release policy is chosen; the operator executes it.

1. Refresh pm-255 and pm-248 under the operator's own authorization. Verify the
   parent is still abandoned and the part still carries precisely that edge.
2. Conditionally clear **only pm-255.after_plan_id=pm-248** with the authorized
   board/database repair procedure. Audit the old edge. Preserve current
   settings, t-1557/t-1558 contracts and timestamps.
3. After successful repair, write a genuine **after_plan_released** decision on
   pm-255 carrying plan_id=pm-255, predecessor_id=pm-248,
   predecessor_status=abandoned, abandon_decision_id=dec-55805,
   note_decision_id=dec-55807, the actual parent_note, actor and mutation receipt.
   The note says “Abandoning frees pm-255 to run”; correct that false claim
   under f19db8db and describe what actually released the part.
4. pm-255 is currently **queued**. Do not invoke paused-only resume on a queued
   plan. If it has become paused, the authorized operator resumes it after
   release. Otherwise the scheduler promotes the released queued part at its
   rank and submits t-1557 with the existing durable queue and callback.
5. Return fresh authenticated get_plan, explain_schedule, get_timeline and
   list_runs reads, including the actual release decision, execution start,
   t-1557 software_engineer run id and durable task-manager id.
   Queued/startable proves eligibility only; dispatch needs the real run.

Alternatively deployed pm-267 semantics must reconcile the existing terminal
edge and release the queued part, retaining provenance. Authorized resume is
needed only if the part is paused. Do not use pm-248 reopen, cap/reset,
resume-bypass or fabricated receipts.

A direct correction from run-8851 onto pm-255 was refused **invalid_run** because
the run belongs to pm-260. **No correction or release receipt landed there.**
The successful repair actor must attach it under valid authority. The refusal
and correction to the earlier intent decision are recorded on pm-260.

esc-395's old cap of 2 is historical: preserve whatever overrides are now live.
No ready_probe is attached: the private schedule endpoint needs IAM, and the
probe cannot send auth headers. A login-page 200 or generic health response
would falsely resolve it. Require the authenticated operator outcome.
Once only capacity remains, the scheduler owns durable placement and callbacks;
a person does not start the runtime. Record actual pending ids and placement
reason. A failed executable remains a defect beside a replacement.

## Independent acceptance: original outcomes still required

pm-260 acceptance retains the whole product outcome. The done evidence-tool task
cannot justify passing it. Platform QA/acceptance run the existing on-demand
split and default slowness drills against the actual containing build and
inspect raw assertions independently.

| Claim | Immediate proof | Failure condition and owner |
| --- | --- | --- |
| Terminal-parent release | Abandoned-parent fixture, one held part, one controlled tick, final parent note and per-part receipt | Hold or note missing: pm-267 |
| Done-parent behavior | Same deployed shared drill with done parent | Release regression: pm-267 |
| Supported reopen/retry | Retained edge, released unstarted part, supported reopen/retry, one tick | Hold not restored or running work cancelled: pm-267 |
| Honest watchdog | Old-ready/null-execution fixture past threshold; executed below/equal/above controls; correct Since/spell/ReadyFor | Local task breach before execution or wrong anchor: pm-267 |
| Negative controls | Unfinished predecessor still holds; deficient fixture/auth is refused; old build missing cases fails | Unconditional success or missing cases: pm-267 |
| Real pm-255 release | Fresh four-tool capture, progress off after_plan, genuine dec-55805/dec-55807 receipt | Waived chore or narrative-only release: pm-267 / esc-405 / scheduler |
| Real t-1557 dispatch | execution_started_at set; matching SWE run and durable tm_task_id | Scheduled-only, wrong task or missing ids: scheduler, observed by pm-260 acceptance |
| Ask product output | Original t-1557/t-1558 locked executable gates and independent QA | A dispatch id alone is insufficient: pm-255 contracts |

The certified CLI can independently evaluate fresh hash-verified board captures;
do not modify or recertify it. Inspect genuine receipt fields directly if the
platform's new schema differs. Preserve failed attempts and separate integration
deployed, capacity pending, execution demonstrated and product delivered.
The live outcomes remain **not delivered**.

Acceptance reads bounded paginated FAILED and COMPLETED histories plus current
jobs, raw tails and callback ingestion for the relevant executable fingerprint;
reports give counts/completeness, actual build/run identities, negative controls
and each deferred check's exact ids, owner and failure condition. This PO did
not audit new executable histories or callbacks. Its pm-255 runs listing was
complete (one run); the initial timeline was complete at 15 entries ending in
idea:idea-248. The pm-248 decisions read was bounded to 100, incomplete overall,
and included dec-55805/55806/55807. No new platform drill success is claimed.
Run-8846's site CI/deploy discrepancies remain historical open evidence;
this planning push proves no deployment repair. Run-8866 read the complete
15-entry pm-255 timeline and one-run pm-255 listing, and the three-run pm-267
listing (research, PO, current SWE). It did not audit task-manager FAILED or
COMPLETED pages, raw runner tails or callbacks; execution success and product
delivery remain unproven rather than inferred from these limited listings.

## Proposal and planning delivery

[proposal.json](proposal.json) contains **[]**, zero remaining otohime tasks.
Call propose_tasks with title Split Part Recovery and the pushed plan SHA,
then submit the summary. Source inspection shows validation permits only SWE
tasks and refuses zero tasks as missing_acceptance_criteria (“proposal has no
tasks”). Preserve the actual response. Do not invent a task or duplicate
t-1593 to force admission. This workflow limitation is separate from ownership.

Run-8862 used locked npm ci with Node v22.23.3. Its npm test passed **2133/2133**,
zero skipped or failed. Run-8866 installs the same lock on Node v22.23.3 and runs
the project suite, typecheck and lint; its own summary records actual results,
proposal response, branch/SHA and observed CI separately. This run's profile is
codex-sol-6-1-high / gpt-6.1-sol / high. No application, evaluator, lockfile or policy changes.
Commit and push origin HEAD; if main
moves, pull --rebase, rerun npm test and push again without force.
The summary names actual branch, SHA, proposal result, chore reuse and observed
CI. No task idles on another owner or a natural schedule.
