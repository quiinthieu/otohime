# pm-255 release walkthrough: collecting snapshots and running the probe

Plan pm-260 · task t-1578 · probe `scripts/probe-plan-release.mjs` · evaluator `lib/plan-release.ts`

This walkthrough checks whether pm-255 has been released from its after_plan hold on the abandoned pm-248, and whether t-1557 has been dispatched to a software_engineer. The probe reads only four JSON files saved from existing plan-manager read tools and prints one JSON verdict. It makes no network calls and writes nothing to the board. Its fixtures (`lib/plan-release.test.ts`) are synthetic and only prove the probe's rules. Whether the live board is released stays unproven until QA or acceptance runs this walkthrough on independently fetched snapshots.

## 1. Collect four snapshots (read-only MCP tools)

Use your own authenticated plan-manager MCP session. Save each tool's decoded JSON result exactly as returned: no edits, no re-indenting, no merging. If the client spills a large result to a file, copy that file as is. If a result comes back as an error string or cut off, it is not evidence.

| File | Tool | Arguments |
| --- | --- | --- |
| `plan.json` | `plan_manager_get_plan` | `{"plan_id":"pm-255"}` |
| `schedule.json` | `plan_manager_explain_schedule` | `{"plan_id":"pm-255"}` |
| `timeline.json` | `plan_manager_get_timeline` | `{"plan_id":"pm-255","limit":200}` |
| `runs.json` | `plan_manager_list_runs` | `{"plan_id":"pm-255"}` (no role/status filter) |

Take all four reads in one sitting, back to back. The probe fails closed when `get_plan` and `explain_schedule` disagree on status or progress, so if a tick lands between them, take all four again.

Completeness: `list_runs` returns every run of the plan in one `runs` array, with no pagination. `get_timeline` returns at most `limit` entries, newest first, plus a `cursor`. If it returns exactly `limit` entries and the oldest one is not the `idea:` entry, page backwards with `before=<cursor>` until you reach it. Then mark the timeline incomplete, or save a timeline that covers the release. A truncated or partly read history is inconclusive, never a pass.

Keep credentials, tokens and cookies out of these files and out of the manifest. The tool payloads contain none.

## 2. Write the manifest (metadata outside the raw payloads)

Write `manifest.json` next to the snapshots. Do not add these fields to the payloads themselves: the sha256 is taken over each file's exact bytes.

```json
{
  "captured_at": "2026-10-26T09:20:00Z",
  "captured_by": "run-NNNN (quality_engineer)",
  "board_build_sha": "<plan-manager build sha, if the board shows one>",
  "delivery_sha": "<otohime commit the probe ran from: git rev-parse HEAD>",
  "snapshots": {
    "plan":     { "tool": "plan_manager_get_plan",         "args": { "plan_id": "pm-255" },               "captured_at": "...Z", "complete": true, "sha256": "<shasum -a 256 plan.json>" },
    "schedule": { "tool": "plan_manager_explain_schedule", "args": { "plan_id": "pm-255" },               "captured_at": "...Z", "complete": true, "sha256": "..." },
    "timeline": { "tool": "plan_manager_get_timeline",     "args": { "plan_id": "pm-255", "limit": 200 }, "captured_at": "...Z", "complete": true, "sha256": "...", "pages": 1 },
    "runs":     { "tool": "plan_manager_list_runs",        "args": { "plan_id": "pm-255" },               "captured_at": "...Z", "complete": true, "sha256": "..." }
  }
}
```

Compute the hashes with `shasum -a 256 plan.json schedule.json timeline.json runs.json` (or `sha256sum`). Set `complete` to `true` only when the result was read in full (see section 1). The probe exits 2 if any entry is missing, any `complete` is not `true`, a `tool` or `args.plan_id` does not match, a `captured_at` is not a timestamp, or a sha256 does not match the file's bytes. The `mcp__plan-manager__` tool-name prefix is accepted. Without `--manifest` the probe still evaluates the payloads but reports `"completeness": "unverified"`. QA and acceptance should always pass a manifest.

## 3. Run the probe

```sh
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  scripts/probe-plan-release.mjs \
  --plan plan.json --schedule schedule.json --timeline timeline.json --runs runs.json \
  --plan-id pm-255 --predecessor-id pm-248 --task-id t-1557 \
  --abandon-decision dec-55805,dec-55807 \
  --manifest manifest.json \
  --require released      # or dispatched (the default)
```

`--abandon-decision` names pm-248's abandonment decisions (dec-55805 `abandoned`, dec-55807 note). With it, the release decision must cite one of them. The plan, predecessor and task ids are required arguments, not defaults.

| Exit | Meaning |
| --- | --- |
| 0 | The `--require` mode holds. |
| 1 | The inputs are readable and consistent, but the evidence falls short. See `unmet` and `reasons`. |
| 2 | Unsupported arguments, an unreadable or truncated file, an unrecognized payload shape, mismatched plan/task/predecessor ids, foreign snapshots, or a failed manifest. See `input_errors`. |

## 4. What each check requires

| Check | Passes only when |
| --- | --- |
| `hold_released` | Both `get_plan.progress` and `explain_schedule.progress` are present and agree. Their state is `live`, `startable` or `finishing_only`, their reason is not `after_plan`, and pm-248 is not among the holders. Absent progress is not a release. |
| `queued_startable` | Plan status is `queued` and progress state is `startable`. |
| `execution_started` | `execution_started_at` is a timestamp and plan status is `executing`, `finishing` or `done`. An old timestamp on a queued or paused plan does not count. |
| `release_recorded` | A pm-255 timeline `decision` that names pm-248, says it was abandoned, says the part was released or the edge cleared, and carries the note in an evidence field ending in `note` (for example `parent_note`). It must cite the `--abandon-decision` ids when given. Kinds that mention pm-248 without releasing it never count: `plan_split_from`, `promotion_skipped`, `after_plan_orphaned`, `slow_breach`, `slow_verdict`, `slow_investigator_dispatched` and `escalation`. |
| `dispatch_proven` | A `list_runs` run with `role=software_engineer`, `task_id=t-1557`, a non-empty `tm_task_id`, and status `pending` (submitted), `running`, `succeeded` or `failed` (finished). A `scheduled` run, a cancelled run, another role or another task does not count. Each run is listed in `evidence.ignored_runs` with the reason. |

Mode `released` needs `hold_released`, `release_recorded`, and either `queued_startable` or `execution_started`. Mode `dispatched` also needs `execution_started` and `dispatch_proven`.

Identity is checked first: `plan.id` and `schedule.plan_id` must equal `--plan-id`. The task must be in both task lists under pm-255. `after_plan_id` must be the predecessor or null: the administrative repair clears it, while the mono-v2 fix (pm-263) keeps it as provenance. At least one timeline entry must carry pm-255's `trace_id`. Every run must belong to pm-255.

The output keeps the source run ids, task-manager ids and statuses under `evidence.dispatch_runs`, and lists failed attempts under `evidence.failed_attempts`. `delivery_proven` is always `false`. A submitted or even failed SWE run proves dispatch only, never that t-1557's Ask deploy bundle probe was delivered. A failed attempt stays a defect to report next to any later retry.

## 5. Negative control (QA, after a real snapshot)

Copy the real snapshots into a scratch directory and change one thing in the copy. Then rerun the probe, which must fail:

- restore `"reason":"after_plan","state":"waiting","holders":[{"plan_id":"pm-248"}]` in both progress objects → exit 1, `hold_after_plan`;
- change `plan.id` to another plan → exit 2, `plan_id_mismatch`;
- change t-1557's run `status` to `scheduled` and blank its `tm_task_id` → exit 1, `swe_run_scheduled_only`;
- drop the release decision's note field → exit 1, `release_note_missing`.

Edit only the copies. Do not regenerate the manifest for an edited copy: the sha mismatch (exit 2) is also a valid negative control. The live board is never written.

## 6. Evidence boundaries

- Proven now, in this checkout: the evaluator and CLI behave as described, against synthetic API-shaped fixtures (`node --experimental-strip-types ... --test lib/plan-release.test.ts`).
- Not proven by this task: the real pm-255 release, the release note on its timeline, and t-1557's dispatch. These depend on operator chore esc-395 (`release-after-plan:pm-255:pm-248`, platform operator) or the mono-v2 fix in pm-263, and then on scheduler capacity. QA or acceptance own the live walkthrough.
- Last observation by this task's run (run-8789, 2026-10-26T08:42:13Z, via explain_schedule): pm-255 was `paused`, progress `waiting/after_plan`, holder pm-248, `execution_started_at` null, no own runs. The `heldBoard` fixture copies the shape of that read, and on it the probe exits 1 (`hold_after_plan`). This task did not run the probe on saved live snapshots.
