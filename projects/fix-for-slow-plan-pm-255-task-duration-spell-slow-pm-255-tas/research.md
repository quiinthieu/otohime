# Research: release split parts whose after_plan parent is abandoned (pm-260, run-8776)

Research agent, 2026-10-26. Code read from mono-v2 at f7d5b90 (2026-10-26 15:03 +0700, `servers/plan-manager`), board read through plan-manager MCP and the plan_manager database (read-only). A copy sits uncommitted at projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/research.md in the otohime checkout (research does not push).

## 0. Repo mismatch, read this first

pm-260 is filed on repo **otohime** (inherited from pm-255). Every code change below lives in **mono-v2** `servers/plan-manager` (Go). A software-engineer run leased on otohime cannot edit it. The product owner must either (a) file the code work as a plan on repo mono-v2 (`plan_manager_submit_idea repo=mono-v2`, idea text = section 3) and keep pm-260 for the board-side release of pm-255 only, or (b) accept that pm-260's SWE tasks will fail on checkout. Option (a) is recommended.

Also: `/shared/artifacts` is a read-only path on this mac lease; the brief's `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md` do not exist in otohime at 3351f78.

## 1. Confirmed facts (board + live database)

| Item | Evidence |
|---|---|
| pm-255 row | `plans`: status `paused`, after_plan_id `pm-248`, execution_started_at NULL, queue_rank_at NULL, updated 08:14:16Z |
| pm-248 row | status `abandoned`, execution_started_at 2026-10-25 22:25:13Z (source decision), updated 04:49:13Z |
| t-1557 row | status `ready`, started_at = created_at = 04:27:53.975898Z (seeded ready under pm-248), plan_id pm-255 since 04:28:31Z, 0 fix cycles, 0 retries |
| t-1558 row | `backlog`, started_at NULL, depends_on t-1557 |
| abandon decision | dec-55805 kind `abandoned`, reason `decider-agent run-8680`, actor decider-agent (NOT `auto:decider-budget`) |
| orphan line | dec-55806 `after_plan_orphaned`, evidence `{parts:[pm-255], advisory:true}`; no escalation, no operator_action |
| watchdog | esc-389 slow_plan task_duration 13582 s vs 7200 s, from_status `queued`; investigator run-8771 verdict fix_plan -> pm-260 |
| slots now | max_active_plans 4, used 4, free 0; max_active_fix_plans 1, fix_used 0 (pm-260 can take the fix lane) |

## 2. Root causes in the code

### 2a. The hold has no release for an abandoned or rejected predecessor
- `internal/orchestrator/schedule.go:570` `afterPlanHold`: a part waits unless `AfterStatus == ""` (predecessor missing) or `AfterStatus == board.PlanDone`. Abandoned and rejected are "not done", so the part waits forever. Asymmetry: a deleted predecessor releases the part, an abandoned one does not.
- `internal/orchestrator/engine.go:2052-2056` `finishPlanBy`: for every non-done terminal status it calls `noteAfterPlanOrphans` (`after_plan.go:180-221`), which writes one decision with `advisory:true` and one messenger line. Nothing changes on the part, no escalation is created, so the digest and the inbox never show it.
- The hold is enforced only at promotion (`engine.go:3406` in fillSlots: `res.Reason == WaitAfterPlan` is skipped, `promotion_skipped` once per spell) and at drafting (`after_plan.go` `draftWaits` / `releaseHeldDraft`).
- `validateAfterPlan` (`after_plan.go:63-66`) already refuses filing a part after an abandoned or rejected plan: "its code will never land, so a part cannot wait for it". The same logic says an existing part waiting for a plan that just became abandoned is waiting for nothing.

### 2b. The decider is never told about parts
- `internal/orchestrator/decider.go:119` builds `executor.DeciderPacket{Plan: p, ...}`; no field for parts.
- `internal/executor/decider_prompt.go:223-226` prints plan status and, only for a follow-up, its parent. Nothing about plans chained after this one.
- `internal/orchestrator/decision.go:346-351` applies `abandon` with reply `"abandoned " + p.ID`; the parts' fate is not in the reply.
- Hence run-8680 wrote "Abandoning frees pm-255 to run" from assumption; the orchestrator wrote the opposite 20 ms earlier (dec-55806).
- `internal/executor/prompt.go:183-184` tells the research and PO of a part "chained after X (after_plan_id), which is done" unconditionally; after a release this sentence would be false.

### 2c. The watchdog counts time the part never held a slot
- `internal/board/postgres.go:434` `UpdateTask` sets `started_at = COALESCE(started_at, ..., CASE WHEN new='ready' AND old='backlog' THEN now)`. t-1557 was seeded ready under pm-248 at approval, so started_at = 04:27:53Z.
- `postgres.go:508` `MoveTasks` updates only `plan_id` and `updated_at`; started_at travels with the task into the part.
- `internal/orchestrator/slowness.go:167` `slowStatuses` includes `queued`; `slowness.go:327-333` `measurePlan` measures `now - *t.StartedAt` with no regard for the plan's `ExecutionStartedAt` (nil for pm-255). `slownessPacket` (`slowness.go:929-930`) prints the same raw ReadyFor, which is why the investigator saw "ready for 3h46m" with 0 attempts.
- The duration samples already have the right anchor: `board/types.go:695` `sampleStart` and `postgres.go:900` `GREATEST(t.started_at, COALESCE(p.execution_started_at, t.started_at))`. The watchdog does not use it.
- `measureIdle` (`slowness.go:424-427`) already returns nothing when Progress is `waiting(after_plan)`; task_duration and task_attempts lack the same guard.
- After the one pause (`pauseSlowPlan` CAS, spell deduped by `spellFirst` RecordEvent key) the plan is `paused`, which is not in `slowStatuses`, so the hold is invisible from then on.

### 2d. Nothing resumes a plan after its fix_plan verdict
- `slowness_verdict.go:27-29` and ARCHITECTURE.md line 3095: a fix_plan verdict "keeps it paused". No code path resumes pm-255 when pm-260 finishes (the only `slowness_fix_for` consumer is the drill). An operator `plan_manager_resume_plan pm-255` is required in every scenario below.

### 2e. The idea's manual fallback does not work as written
- `plan_manager_reopen_plan` (`reopen.go:65-67`, `budgetAbandon`) accepts only a plan whose newest `abandoned` decision has reason `auto:decider-budget`. dec-55805's reason is `decider-agent run-8680`, so reopening pm-248 is refused `invalid_transition`. "Reopen pm-248 then re-abandon" is not available.
- No HTTP, MCP or messenger route writes `after_plan_id` after intake (only `SubmitIdea` and the split's `CreatePlan`). Clearing the edge today means SQL with a write login (`UPDATE plans SET after_plan_id=NULL, updated_at=now() WHERE id='pm-255' AND after_plan_id='pm-248'`); the agent_reader door is read-only.

### 2f. A hole that is also today's board-only escape hatch
`continuePausedPlan` (`failure_apply.go:866-905`) does not consult Progress. A paused part that is resumed while a normal slot is free goes straight to `executing` and dispatches, bypassing the after_plan hold (which lives only in fillSlots promotion). With 4 of 4 slots used, a resume today parks pm-255 as `queued` and the hold bites again; with one free slot it starts t-1557 at once.

## 3. Recommended fix (mono-v2 `servers/plan-manager`), four build contracts

Design choice (recorded on pm-260): **release, not an operator question**. Operator actions are chores, never choices; a release/reject prompt would be decided mechanically after 10 minutes anyway. Release is simple and reversible (a released part can still be rejected or paused) and matches the intake rule that a part cannot wait for an abandoned plan.

### T1. Release parts of a finished predecessor, keep the edge so reopen restores the hold
- `schedule.go` `afterPlanHold`: hold only while the predecessor is unfinished; treat `done`, `abandoned`, `rejected`, `failed_draft` (`board.IsFinishedPlanStatus` / `isTerminalPlanStatus`) as released. Keep `AfterPlanID` on the part, so `plan_manager_reopen_plan` on a budget-abandoned parent (abandoned -> paused) restores the hold by construction, and explain_schedule keeps provenance.
- `after_plan.go`: replace `noteAfterPlanOrphans` with `releaseAfterPlanParts`: on the parent, one `after_plan_released` decision (evidence `{parts, status, advisory:false}`); on each part, one `after_plan_released` decision whose summary carries the parent's terminal status and the parent's newest abandoned/rejected decision summary and note (dec-55807's note into pm-255's timeline). Keep one messenger line worded "released: they re-enter the promotion line in their own right".
- fillSlots needs no change: next tick Progress no longer answers after_plan and the queued part is promoted at its rank. `releaseHeldDraft` already releases when `res.Reason != WaitAfterPlan`; add the predecessor status to its `draft_released` evidence.
- `executor/prompt.go:183-184`: print the predecessor's actual status: done -> "build on what it delivered on main"; abandoned/rejected -> "it was <status> (<reason>): plan only what stands on main today and name what the predecessor did not deliver".
- `validateAfterPlan`: unchanged.
- ARCHITECTURE.md "Plan size and chained parts" and the Progress table row `waiting(after_plan)`: update the sentences that say parts stay held and silence is not approval.

### T2. Tell the decider about parts; make the abandon text name them
- `executor.DeciderPacket` gets `Parts []DeciderPart{ID, Title, Status, OpenTasks int}`; `decider.go` `scanDeciderWaits` fills it with `tx.ListPlans(PlanFilter{AfterPlanID: p.ID, Visibility: VisibilityAll})` filtered to non-terminal parts.
- `decider_prompt.go` after the status line, only when Parts is non-empty: "Plan parts chained after this plan (after_plan_id): pm-255 (queued, 2 open tasks). abandon or reject releases them to run in their own right on the next tick; replan or accept keeps them waiting until this plan is done."
- `decision.go` OptionAbandon reply and the `abandoned` decision evidence: add `released_parts: [ids]` and "released parts pm-255".

### T3. Watchdog measures from execution start and names an after_plan hold
- `slowness.go` `measurePlan`: for task_duration use `since := board.SampleStart(*t.StartedAt, p.ExecutionStartedAt)` (export `sampleStart`), and skip task_duration and task_attempts when `p.ExecutionStartedAt == nil` (a plan that never executed cannot be slow at its own work). Same anchor in `slownessPacket` ReadyFor so the investigator prompt is honest.
- Defence in depth: compute `afterStatus` once per plan (already done in `measureIdle`) and, when Progress is `waiting(after_plan)`, record no local spell but attach `cause: after_plan held by <id>` if another rule fires.
- Spell key: since becomes the execution start, so a part promoted later gets a fresh spell instead of the inherited one.
- Settings, modes, metrics unchanged.

### T4. Unit tests (orchestrator package, `forEachBackend` + `cwEngine`, memory and Postgres)
- Flip `TestPM245Split_AbandonedPredecessorHoldsPartsWithOneNotice` (`pm245_split_test.go:438`): after `setPlanStatus(pm-gone, abandoned)` and one `HandleTick`, a queued part is `executing` (or queued with no `promotion_skipped after_plan` when slots are full), a drafting part has `draft_released` and one research run; each part has one `after_plan_released` decision naming the parent's abandon summary; exactly one messenger line.
- Keep the existing "head done -> part executing on next tick" case (`pm245_split_test.go` ~428).
- Reopen restores the hold: parent abandoned by `auto:decider-budget`, part still queued (slots full), `reopenPlan` -> paused, tick -> `promotion_skipped after_plan` again; after `setPlanStatus(done)` the part is promoted.
- Decider: `scanDeciderWaits` on a plan with one queued part yields `Parts` with that id; the rendered prompt contains the part id and "releases them"; the `abandoned` decision evidence lists `released_parts`.
- Slowness: a queued plan with `ExecutionStartedAt == nil` and a ready task whose `StartedAt` is 3 h old produces no task_duration measure and no pause; after promotion (`ExecutionStartedAt = now`) the breach fires only once `slow_task_duration` has elapsed since promotion, with `Since == ExecutionStartedAt`. Pattern: `pm245_speed_test.go:185`; drill fixture `drill_slowness.go slowFixture{started, readyAgo}` gains an `executionStart` knob.
- Gates: `make test` (go test -race ./...), `make test-postgres` for board + orchestrator, `make test-conditional-writes`.

## 4. Immediate board effect for pm-255 (outcome 4), ranked

Nothing in the platform will move pm-255 by itself: the fix_plan verdict keeps it paused, and even after T1 deploys a resume is required.

1. **Board-only release today, no SQL, no code** (uses 2f): `plan_manager_set_setting max_active_plans=5` (reason "release pm-255 held behind abandoned pm-248"), then `plan_manager_resume_plan pm-255`. `continuePausedPlan` sees a free slot, sets `executing`, dispatches t-1557 to a software_engineer on an otohime lease. Then `plan_manager_reset_setting max_active_plans`. Record `plan_manager_record_decision` on pm-255 kind=other: "released from after_plan pm-248 by operator; pm-248 abandoned dec-55807; pm-260 tracks the platform fix". If another plan grabs the fifth slot between the two calls, pm-255 lands `queued` and stays held; retry when a slot is free. The watchdog will not re-pause it: its spell is already recorded.
2. **After T1 deploys**: `plan_manager_resume_plan pm-255` alone; with slots full it goes `queued`, Progress no longer holds it, fillSlots promotes it at its rank.
3. **SQL with a write login** (`p0w3r_us3r`): clear the edge as in 2e, then resume. Leaves no timeline decision unless recorded by hand.
4. **Reject pm-255 and refile** its two tasks as a new idea on otohime without after_plan_id. Loses t-1557/t-1558 identity and the dec-55752 decider answer that names them; last resort.

Reopening pm-248 is not possible (2e); drop "reopen then re-abandon" from the acceptance walkthrough.

## 5. Acceptance evidence to collect
- Unit tests above green on memory and Postgres backends in mono-v2 CI.
- Drill: `plan_manager_drill_plan_split` gains "abandoned predecessor releases the part"; `plan_manager_drill_slowness` gains "queued part past slow_task_duration with no execution start: no breach".
- Board: pm-255 timeline shows a release decision and `execution_started` (or `queued` with no `promotion_skipped after_plan`), t-1557 has a software_engineer run; `plan_manager_explain_schedule pm-255` progress.reason != after_plan.
- Negative control: a part whose predecessor is still `executing` is still skipped `promotion_skipped after_plan`.

## 6. Open points for the product owner
- Repo homing (section 0): T1-T4 must run on a mono-v2 lease.
- Whether to also make `continuePausedPlan` honour the after_plan hold (close 2f). Recommended inside T1, but only after section 4 option 1 has been used for pm-255, or that escape hatch disappears.
- Whether a part released by a rejected intake-time predecessor (drafting, no code landed) should draft at all. T1 releases it with an honest prompt; the alternative is `failed_draft` with the parent's reason. Release chosen for symmetry and simplicity.
