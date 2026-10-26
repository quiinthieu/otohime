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

Save `explain_schedule` as returned: its task list is under `inputs.tasks`, and the probe reads nothing else for tasks. `get_plan` of a paused part may omit `progress`. Leave it out; the probe reports `plan_progress_missing` and never treats absent progress as a release.

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

Compute the hashes with `shasum -a 256 plan.json schedule.json timeline.json runs.json` (or `sha256sum`). Set `complete` to `true` only when the result was read in full (see section 1). The probe exits 2 if any entry is missing, any `complete` is not `true`, a `tool` or `args.plan_id` does not match, a `captured_at` is not a timestamp, or a sha256 does not match the file's bytes. The `mcp__plan-manager__` tool-name prefix is accepted.

Exit 0 requires a verified manifest. Without `--manifest` the probe still evaluates the payloads for diagnosis, but it reports `"completeness": "unverified"`, adds `completeness_verified` to `unmet` and exits 1, however good the evidence looks. A payload that declares itself partial (`complete` other than `true`, `has_more` other than `false`, `truncated` other than `false`, or a non-empty `next_cursor`) exits 2 whether or not a manifest is given. `get_timeline`'s own `cursor` is not such a marker. `list_runs` has no pagination; this check only stops a declared-partial payload from passing.

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

`--abandon-decision` names pm-248's abandonment decisions (dec-55805 `abandoned`, dec-55807 note). With it, every decision id field in the release receipt (`abandon_decision_id`, `note_decision_id`) must equal one of them exactly, and at least one must be present. Always pass it for pm-255: it ties the receipt's note to the real abandonment. The plan, predecessor and task ids are required arguments, not defaults.

| Exit | Meaning |
| --- | --- |
| 0 | The `--require` mode holds and `--manifest` verified all four snapshots. |
| 1 | The inputs are readable and consistent, but the evidence falls short, or no manifest was given. See `unmet` and `reasons`. |
| 2 | Unsupported arguments, an unreadable or truncated file, a payload declaring itself partial, an unrecognized payload shape (including a schedule without `inputs.tasks`), mismatched plan/task/predecessor ids, a malformed field (section 4), foreign snapshots, or a failed manifest. See `input_errors`. |

## 4. What each check requires

| Check | Passes only when |
| --- | --- |
| `hold_released` | Both `get_plan.progress` and `explain_schedule.progress` are present and agree. Their state is `live`, `startable` or `finishing_only`, their reason is not `after_plan`, and pm-248 is not among the holders. The two reads must also name the same holders. Absent progress is not a release. |
| `queued_startable` | Plan status is `queued` and progress state is `startable`. |
| `execution_started` | `execution_started_at` is a timestamp and plan status is `executing`, `finishing` or `done`. An old timestamp on a queued or paused plan does not count. |
| `release_recorded` | A pm-255 timeline entry with `type=decision`, its own `id`, and `kind=after_plan_released`, which is the only supported release kind. Its `evidence` must carry `plan_id` = pm-255, `predecessor_id` = pm-248, `predecessor_status` = `abandoned`, and a non-empty `parent_note`. With `--abandon-decision`, `abandon_decision_id`/`note_decision_id` must exactly match those ids. Summary and reason prose are never read, so negated or prospective wording proves nothing. Every other kind (`after_plan_orphaned`, `slow_verdict`, `other`, …) is not a release. A shared trace_id does not identify the part either, because split parts inherit their parent's trace. This is the receipt the pm-260 operator playbook (plan.md, step 3) writes. A future mono-v2 receipt in another shape fails with `release_decision_missing` until the probe is taught that shape. |
| `dispatch_proven` | A `list_runs` run with `role=software_engineer`, `task_id=t-1557`, its own non-empty `id`, a non-empty `tm_task_id`, and status exactly `pending` (submitted), `running`, `succeeded` or `failed` (finished). A `scheduled`, `cancelled` or `superseded` run does not count, and neither does another role or another task. Any other status, including inherited object keys such as `constructor`, is `status_unsupported`. A run without a source id is `run_id_missing`. Each such run is listed in `evidence.ignored_runs` with the reason. |

Mode `released` needs `hold_released`, `release_recorded`, and either `queued_startable` or `execution_started`. Mode `dispatched` also needs `execution_started` and `dispatch_proven`.

Identity is checked first: `plan.id` and `schedule.plan_id` must equal `--plan-id`. The task must be in both task lists under pm-255. `after_plan_id` must be the predecessor or null: the administrative repair clears it, while the mono-v2 fix (pm-263) keeps it as provenance. At least one timeline entry must carry pm-255's `trace_id`. Every run must belong to pm-255.

Present fields are validated before they are read. If a field is present with an unsupported value, that is an input error (exit 2). It is never read as "none", so it can never clear an edge or a hold:

| Field | Supported | Error when present otherwise |
| --- | --- | --- |
| `plan.after_plan_id` | absent, `null`, or a non-empty string | `plan_after_plan_id_unsupported` (e.g. `248`, `{}`, `[]`, `""`) |
| `plan.trace_id`, `plan.execution_started_at` | absent, `null`, or a non-empty string | `plan_trace_id_unsupported`, `plan_execution_started_at_unsupported` |
| `progress.reason` | absent, `null`, or a non-empty string | `<source>_progress_reason_unsupported` |
| `progress.holders` | absent, `null`, or an array | `<source>_progress_holders_unsupported` (e.g. `"pm-248"`) |
| each holder | an object with a non-empty string `plan_id`, string-or-null `task_id`/`run_id`, and an array of strings or null for `paths` | `<source>_progress_holder_unsupported`. A single bad holder fails the whole input, and is never filtered out. |

`<source>` is `plan` (get_plan) or `schedule` (explain_schedule), so a malformed read is named by its tool. An omitted reason or holders list is accepted because a live or startable plan may leave them out. Absence alone cannot pass `hold_released`: the state still has to be released, and a waiting/after_plan read still fails.

The output keeps the source run ids, task-manager ids and statuses under `evidence.dispatch_runs`, and lists failed attempts under `evidence.failed_attempts`. `delivery_proven` is always `false`. A submitted or even failed SWE run proves dispatch only, never that t-1557's Ask deploy bundle probe was delivered. A failed attempt stays a defect to report next to any later retry.

## 5. Negative control (QA, after a real snapshot)

Copy the real snapshots into a scratch directory and change one thing in the copy. Then rerun the probe, which must fail:

- restore `"reason":"after_plan","state":"waiting","holders":[{"plan_id":"pm-248"}]` in both progress objects → exit 1, `hold_after_plan`;
- change `plan.id` to another plan → exit 2, `plan_id_mismatch`;
- change t-1557's run `status` to `scheduled` and blank its `tm_task_id` → exit 1, `swe_run_scheduled_only`;
- drop the release decision's note field → exit 1, `release_note_missing`.

Edit only the copies. Do not regenerate the manifest for an edited copy: the sha mismatch (exit 2) is also a valid negative control. The live board is never written.

## 6. Evidence boundaries

- Run-8823 (2026-10-26) preserves repaired delivery `c2ca9c20c6ae527d329ed4263672572ffd7219c9`. The evaluator, CLI, tests, package files, Next configuration and workflow match that delivery byte for byte. [Verification receipt](verification-run-8823.json) records their SHA-256 fingerprints, the actual run profile, checks and deferred owners. The normal `main` push includes the repair and enters the existing push-triggered checks/production workflow; a push alone does not prove deployment.
- Local checks after `npm ci` on Node v22.23.3: `npm test` **2096/2096**, the contracted focused suite **41/41**, and `npm run typecheck` exit **0**, with no skipped tests. The unchanged QA adversarial diagnostic meets all **20/20** synthetic controls. Running the real CLI against QA's unmodified run-8816 capture (09:36:35–09:36:37Z) exits **1** in both modes with a verified manifest: the part was queued but still waiting/after_plan, with no release receipt or SWE dispatch. Changing only a temporary copy's plan id without rehashing exits **2**, `manifest_plan_sha256_mismatch`. These are offline replays, not fresh board observations.
- **Deployment receipt remains pending.** QA's saved CI observation at 09:37:43Z has run **40300404091** for c2ca9c2 pending with zero jobs. Saved run **40298672101**, checks **121493560349**, failed E2E; its precise assertion remains unread (log request HTTP 403). These historical observations do not describe current CI. Per the SWE role contract and standing policy section 5.2, this run stops at push and summary. Plan-manager/QA own the containing workflow result and deployed ancestry check from [fix_plan_run-8816.md](fix_plan_run-8816.md); record a deployed SHA and successful checks/production job ids here only after independent observation. Existing gate **ver-3523 / dec-56834** remains the repaired delivery's local verification evidence.
- Run-8823 inspected and reused **esc-395**, fingerprint `release-after-plan:pm-255:pm-248`: waived, not performed. No new chore or privileged board mutation was made. **esc-395/pm-263** still own live recovery; **pm-260 acceptance** owns fresh release/dispatch snapshots and separate t-1557 output proof. A persistent hold, missing durable SWE id or failed attempt remains a failure, regardless of a pending replacement. [Bounded history read](history-run-8823.json): 40/61 FAILED and 40/1133 COMPLETED task-manager jobs; older ranges are unread/inconclusive. Current RUNNING returned 5; PENDING returned no explicit count. Prior SWE/gate callback readback is delivered once; saved ingestion evidence and tail limits are identified in the receipt.
- Proven now, in this checkout: the evaluator and CLI behave as described, against synthetic API-shaped fixtures (`node --experimental-strip-types ... --test lib/plan-release.test.ts`).
- Not proven by this task: the real pm-255 release, the release note on its timeline, and t-1557's dispatch. These depend on operator chore esc-395 (`release-after-plan:pm-255:pm-248`, platform operator) or the mono-v2 fix in pm-263, and then on scheduler capacity. QA or acceptance own the live walkthrough.
- QA's independent live capture (run-8800, 08:57Z, `qa-evidence/` with its manifest) is decoded and exits 1 in both modes. The reasons are `plan_progress_missing`, `hold_after_plan`, `held_by_predecessor`, `progress_waiting`, `release_decision_missing` and `swe_run_missing`. This is a negative result: pm-255 was still held. The test suite runs this regression on the unmodified files.
- QA's second live capture (run-8812, 09:18Z, `qa-evidence-run-8812/` with its manifest) shows pm-255 `queued`, with `waiting/after_plan` in both reads. It exits 1 in both modes with `hold_after_plan`, `held_by_predecessor`, `progress_waiting`, `release_decision_missing` and `swe_run_missing`. This is a negative result, and the test suite also runs it on the unmodified files. QA's `qa-adversarial.mjs` meets the contract in all 20 cases, including D6–D9, which now exit 2 (run-8814).
- Last observation by this task's first run (run-8789, 2026-10-26T08:42:13Z, via explain_schedule): pm-255 was `paused`, progress `waiting/after_plan`, holder pm-248, `execution_started_at` null, no own runs. The `heldBoard` fixture copies the shape of that read, and on it the probe exits 1 (`hold_after_plan`). That run did not run the probe on saved live snapshots; run-8809 ran it on QA's capture above.
