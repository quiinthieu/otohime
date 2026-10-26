---
plan_id: pm-260
run_id: run-8846
kind: change_request
cycle: 1
---

# Change request: an abandoned parent must stop stranding its split parts, and pm-255 must actually run

For the product owner of pm-260. The offline evidence probe (t-1593, 0c4a25d) works and is not in question here. It reports, correctly, that nothing below has happened yet.

## What an operator still cannot do

1. **Abandon a plan with waiting parts and have them move on.** Abandoning pm-248 left pm-255 queued and `waiting/after_plan` for six hours and counting. The only signal is the advisory dec-55806 after_plan_orphaned. There is no release, no per-part operator_action, and no open escalation on pm-255.
2. **Trust the decider's abandon note.** dec-55807 says "Abandoning frees pm-255 to run". The board still contradicts it, and nothing on either timeline corrects it.
3. **Read the slowness watchdog honestly for a part that never started.** dec-56464 breached task_duration at 13582 s on t-1557 from the inherited started_at, while pm-255 had execution_started_at=null and zero attempts.
4. **Get t-1557 (Ask deploy bundle probe) built.** There are zero t-1557 software_engineer runs, so the pm-255 Ask work that pm-248 handed off cannot start.

## Evidence (acceptance run-8846, 2026-10-26 10:48–10:55Z)

- **pm-255 reads.** `get_plan` and `explain_schedule` return status queued, after_plan_id pm-248, progress waiting/after_plan, holders [pm-248], execution_started_at null.
- **pm-255 timeline.** It is complete at 15 entries and has no after_plan_released entry. The newest entry is promotion_skipped after_plan at 09:45:53Z.
- **pm-255 runs.** `list_runs` returns only investigator run-8771.
- **The probe agrees.** On these snapshots, with a hash-verified manifest, it exits 1 in both modes: hold_after_plan, held_by_predecessor, progress_waiting, release_decision_missing, swe_run_missing.
- **The probe is discriminating.** The same bytes mutated into a released board exit 0, and a tampered copy exits 2.
- **The platform fix is not running.** mono-v2 pm-263 "After Plan Recovery" is paused with execution_started_at=null; t-1579 and t-1581 are ready, t-1580 and t-1582 are in backlog. plan-manager is still running image f19db8db.
- **The release chore has not been done.** esc-395 (`release-after-plan:pm-255:pm-248`) was waived by the decider at 08:52Z and its chore_done_at is unset.
- **Side finding.** The board recorded dec-57069 "0c4a25d is deployed", but otohime.dev serves ae4607d, which does not contain 0c4a25d, and 0c4a25d's CI run 40309492875 was cancelled.

Details: [acceptance_report_1.md](acceptance_report_1.md), [acceptance-evidence-run-8846/](acceptance-evidence-run-8846/).

## Which service

- **plan-manager in mono-v2:** the after_plan hold and orphan handling (orchestrator schedule/after_plan), the decider packet and abandon response, and the slowness watchdog's task_duration anchor.
- **The live board state of pm-255**, which is the immediate effect.

pm-260 is homed on otohime and cannot deliver either one from this repository.

## Work for the product owner

- **Get the platform half running.** pm-263 is already filed with the right four contracts but is paused and unstarted. Make it run to a deployed plan-manager build. Its acceptance has to prove each case with the on-demand plan-split and slowness drills:
  - terminal-parent release with the parent note on the part;
  - done-parent release;
  - restore on reopen/retry;
  - a never-executed part is not breached.
- **Get pm-255 actually released and t-1557 dispatched**, through whichever path is available first:
  - the privileged one-edge repair already described in esc-395, which a person with board write access must perform; or
  - once pm-263 is deployed, an authorized resume of pm-255.

  The release must leave a genuine after_plan_released receipt with dec-55805/dec-55807 provenance on pm-255's timeline. The proof is a fresh pm-255 read showing progress off after_plan, execution_started_at set, and a t-1557 software_engineer run with a durable task id.
- **Do not add another offline-tool or documentation task to pm-260.** The evidence tool is done and certified. Further cycles on it cannot move pm-255. The remaining gaps belong to pm-263, to esc-395's operator and to the scheduler. pm-260 acceptance re-walks the board once one of those delivers.
