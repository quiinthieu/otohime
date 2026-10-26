---
plan_id: pm-260
run_id: run-8846
kind: acceptance_report
verdict: fail
cycle: 1
---

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| pm-248 abandoned at 04:49:13Z. pm-255 is its split part with after_plan_id=pm-248. | `get_plan pm-255` and `explain_schedule pm-255` at 10:48:49Z | **queued, progress waiting / reason after_plan, holders [pm-248]**, execution_started_at=null, queue position 1. Slots are 5/5 used, but the after_plan hold is what blocks pm-255, not the full slots. | [plan.json](acceptance-evidence-run-8846/plan.json), [schedule.json](acceptance-evidence-run-8846/schedule.json) |
| Outcome 4 expects pm-255 released and t-1557 dispatched. | `list_runs pm-255` (unfiltered, no pagination) and `get_timeline pm-255 limit=200` | One investigator run (run-8771, succeeded). **Zero t-1557 software_engineer runs** of any status. The timeline has 15 entries in one page, ending at idea:idea-248. There is **no after_plan_released** entry. The newest entry is dec-56850 promotion_skipped "waiting for after_plan held by pm-248" (09:45:53Z). | [runs.json](acceptance-evidence-run-8846/runs.json), [timeline.json](acceptance-evidence-run-8846/timeline.json) |
| Outcome 1 expects abandoning a parent to release its parts or raise a blocking per-part action, and the abandon text to be honest. | `get_timeline pm-248 limit=15` | Still only **dec-55806 after_plan_orphaned advisory=true** ("They stay held … until you reject them or reopen pm-248"). **dec-55807's note still says "Abandoning frees pm-255 to run"**, and nothing corrects it. There is no per-part operator_action and pm-255 has no open escalation. | receipt.json `board.pm-248` |
| Outcomes 1–3 are platform code in mono-v2, owned by pm-263. | `get_plan pm-263`; plan-manager rollout status | pm-263 is **paused**, execution_started_at=null. t-1579 and t-1581 are ready, t-1580 and t-1582 are in backlog, and none is delivered. plan-manager runs image **f19db8db** (ReplicaSet 6f5fb69d45, rollout complete). No release, decider or watchdog fix is deployed. | receipt.json `deployment.plan_manager`, `board.pm-263` |
| Outcome 3 expects the watchdog not to flag a never-executed part. | Read pm-255's slow history | dec-56464 slow_breach task_duration measured 13582 s from the inherited started_at 04:27:53Z, while execution_started_at was null. The code that produced this is unchanged (above). | timeline.json dec-56464 |
| The delivered t-1593 offline probe is at 0c4a25d. | `npm ci`, then all four contracted commands in the locked checkout (Node v22.23.3, npm 10.9.9, tsc 5.9.3) | `npm test` **2125/2125**. Focused **45/45**, 0 skipped. Adversarial **20/20** contract_met, complete=true. Typecheck exit 0. Fingerprints match the t-1593 delivery. | [receipt.json](acceptance-evidence-run-8846/receipt.json) `verification`, `fingerprints_sha256` |
| My fresh real snapshots, with a hashed manifest | Probe in `--require released` and `--require dispatched` | **Exit 1 in both modes**, with input_errors=[] and the manifest verified. Reasons: hold_after_plan, held_by_predecessor, progress_waiting, release_decision_missing, swe_run_missing. delivery_proven=false. | [live-released.json](acceptance-evidence-run-8846/live-released.json), [live-dispatched.json](acceptance-evidence-run-8846/live-dispatched.json) |
| Negative control | A copy of my plan.json set to executing, without rehashing | **Exit 2**, `manifest_plan_sha256_mismatch`, delivery_proven=false | [negative-tamper.json](acceptance-evidence-run-8846/negative-tamper.json) |
| Positive control, run by acceptance and not supplied by the implementer | A copy of my real bytes mutated into a released and dispatched board (progress live, executing, after_plan_released tied to dec-55805/dec-55807, a running t-1557 SWE run), then rehashed | **Exit 0 in both modes**, delivery_proven=false. Because the probe can answer yes, its "no" on the live board is a real result. | positive-control-*.json |
| Deployment of touched components | GET otohime.dev /api/health and home; GitHub main runs (first page); `git merge-base` | Production serves **ae4607dafc28c6f732fdb7ee2ff2f1c7953ed4d3**. It contains the evaluator c2ca9c2 but **not 0c4a25d** (ancestry exit 1). Delivery CI **40309492875** at 0c4a25d was **cancelled**. Last green: 40306337481 at ae4607d (checks 121516259788, production 121520661524). 841ca69 is in progress. | receipt.json `deployment` |

## Verdict: fail

The idea asked for a platform where an abandoned parent no longer strands its split parts, the decider is told the truth, the watchdog does not blame a never-started part, and pm-255 is released so that t-1557 is dispatched. **None of these four outcomes exists on the running product.**

- **Integration deployed:** none of the platform fix. pm-263 is paused and plan-manager is still f19db8db.
- **Waiting for capacity:** this is not the blocker. The explicit after_plan hold blocks pm-255 regardless of slots.
- **Execution demonstrated:** only the offline CLI, in my checkout.
- **Product delivered:** no. There is no release, no dispatch and no t-1557 output.

The scoped deliverable, t-1593 "Certify offline release evidence", **passes on its own terms**. I reproduced it independently: real evaluator imports and the real CLI subprocess under the committed lockfile, fresh board bytes, one negative and one positive control. Plan.md revision 3 states that this pass "must not be described as full Split Part Recovery success". It is an evidence tool. Its correct answer today is that pm-255 is still held.

### Defects observed (each remains a defect beside any pending work)

1. **pm-255 is stranded behind abandoned pm-248.** This is persistent: dec-55931 at 05:12, dec-56850 at 09:45 and the reads at 10:48 all show the hold. Owners: esc-395, the privileged operator chore (waived 08:52:07Z, chore_done_at unset), and the mono-v2 pm-263/t-1579 code fix. Failure condition: progress still reports after_plan, or there is no after_plan_released receipt carrying dec-55805/dec-55807 provenance.
2. **The decider's abandon text is false.** dec-55807 claims abandoning frees pm-255, and nothing corrects it. Owner: pm-263/t-1580.
3. **task_duration measures an inherited ready time** on a part whose execution_started_at is null (dec-56464, 13582 s). Owner: pm-263/t-1581. An on-demand drill is owned by t-1582.
4. **The board claims a deployment that did not happen.** dec-57069 qa_skipped says "green gate passed and 0c4a25d is deployed". Production serves ae4607d, which does not contain 0c4a25d, and 0c4a25d's CI was cancelled. This does not change the offline CLI's correctness. It does mean board "deployed" text is not deployment evidence on otohime. The existing iss-6 family and the lesson on deploy_detection=none cover it. Owner: plan-manager delivery detection.
5. Historical E2E failures 40303396148/121506990908 and 40303724712/121509554244 remain open history, owned by pm-258/t-1564. Its 841ca69 annotation run 40310239199 is in progress. I did not wait for it.

### Real/fake boundary, identities and completeness

- **Real:** the MCP board reads; the evaluator import and CLI subprocess; the locked `npm ci`; the production HTTP reads; the GitHub API run and job reads; the plan-manager rollout read; the plan-manager logs.
- **Synthetic:** the positive control and the 20 adversarial boards. They prove tool behaviour only.
- **Snapshot redactions:** five long prose fields the probe never reads were replaced with placeholders. manifest.json lists them. Every id, status, kind, progress and evidence field is verbatim.
- **Task-manager history** (project plan-manager, coding_task, offset 0, limit 20):
  - FAILED: **20 of 63** read. None belong to pm-260 or pm-255.
  - COMPLETED: **20 of 1145** read. They include the t-1593 chain: SWE run-8841 (ff6a5a00, callback ev:11661 applied), attempt 1 run-8840 (d7322e5f, ev:11649), and gate run-8845 (bbdad136, shell, git_sha 0c4a25d, exit 0, callback delivered once, ev:11666 applied, ver-3534, dec-57063). None belong to pm-255.
  - Older ranges are unread and inconclusive. Raw tail read: run-8841, last 25 lines.
- **Plan-manager logs:** `pm-255` over 90 minutes returned no lines. `error` over 30 minutes returned 10 lines, all `learning export failed … 403` warnings, which are unrelated.
- **CI:** 10 of 392 main runs read, first page only.
- **pm-248 timeline:** only the newest 15 entries were read.
- **Run identities:**
  - This run: run-8846, claude-opus-high / claude-opus-5-5 / effort high, avietidol-mac-mini, tm 9699a5e1-f501-419e-856a-f7af8ca0ad51.
  - Delivery run-8841: claude-opus-high / claude-opus-5-5 / high, avietidol-z490. The gate run-8845 is a shell runner.

### Deferred checks

| Id | Owner | Required evidence / failure condition |
| --- | --- | --- |
| esc-395 `release-after-plan:pm-255:pm-248` | Privileged platform operator | Authenticated readback showing pm-255 progress no longer after_plan, plus an after_plan_released receipt with dec-55805/dec-55807. A waiver alone, or a lingering hold, fails. |
| pm-263 t-1579, t-1580, t-1581, t-1582 | mono-v2 plan-manager delivery, QA and acceptance | Deployed image newer than f19db8db with the release, honest decider text and execution-anchored task_duration. Plan-split and slowness drills prove each case on demand. |
| pm-255/t-1557 dispatch | Scheduler, then pm-260 acceptance | Fresh complete four-tool snapshots with execution_started_at set and a t-1557 software_engineer run with a durable tm_task_id. Scheduled-only does not count, and a failed attempt stays a defect. |
| pm-255/t-1557 product output | pm-255 delivery, gate and QA | Actual lib/ask-deploy.ts and probe output under its own contract. Dispatch alone proves nothing about the product. |
| CI 40310239199 (841ca69) and E2E history | pm-258/t-1564 | Green checks plus production at a SHA containing 0c4a25d, otherwise the board's "deployed" claim remains false. |
