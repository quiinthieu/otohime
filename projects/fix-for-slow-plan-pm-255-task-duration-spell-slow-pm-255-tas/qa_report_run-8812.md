# t-1578 QA: fail, cause=code

Run **run-8812** independently tested delivery **4e5377c51713a6c31535e4815e52117d32c41b61**. D1–D5 from run-8800 are repaired, but unsupported predecessor/progress values still produce false acceptance. The required suites are green. QA changed only its diagnostic and evidence/report files, not application source.

## Independent findings

[qa-adversarial.mjs](qa-adversarial.mjs) imports the real evaluator and launches the real CLI with temporary local files and verified byte-hash manifests. Its fixture is independent of the implementer's helpers. I corrected only its baseline schedule schema to the independently captured `inputs.tasks`, then added controls. [adversarial.json](qa-evidence-run-8812/adversarial.json) records **20 cases: 16 meet the contract, 4 fail**. The script now exits 1 if a case violates its expectation.

| Id | Single mutation from a valid dispatched baseline | Actual result | Defect location |
| --- | --- | --- | --- |
| D6 | `plan.plan.after_plan_id = 248` | CLI exit 0, input_errors=[], hold_released=true, release_recorded=true, dispatch_proven=true | `lib/plan-release.ts:179`: invalid present value becomes null, indistinguishable from a cleared edge |
| D7 | Both progress objects have `reason: {after_plan: "pm-248"}` | Same false acceptance | `lib/plan-release.ts:106`: unsupported reason becomes null |
| D8 | Both progress objects have `holders: "pm-248"` | Same false acceptance | `lib/plan-release.ts:103`: non-array holder evidence becomes [] |
| D9 | Both progress objects have `holders: [{plan_id: 248}]` | Same false acceptance | `lib/plan-release.ts:104`: unsupported holder identities are silently filtered out |

These are synthetic unsupported-input controls, not claims that the live API emitted malformed types. The contract explicitly requires recognized fields and rejection of unsupported/incomplete inputs. A verified manifest proves bytes and the collector's completeness declaration; it does not make malformed fields trustworthy. The probe must not convert unknown evidence into proof that a hold was released.

Reproduce from the repo root:

```sh
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/qa-adversarial.mjs
```

The positive dispatched baseline exits 0 and preserves qa-swe/qa-durable-id with outcome running. Queued/startable exits 0 only in released mode, 1 in dispatched mode. Held and scheduled-only negative controls exit 1. Wrong plan exits 2; missing progress, wrong task and missing parent note exit 1. All five previous defect cases now exit nonzero. A failed synthetic SWE attempt proves dispatch only, preserves its failed source identity and leaves delivery_proven=false. Every case leaves product delivery unproven.

## Locked executable and suites

`npm ci` completed on this macOS lease with Node **v22.23.3**, npm **10.9.9**. The actual TypeScript evaluator import and real CLI entry point executed successfully. This executable uses Node builtins only: no processor/adapter, model or asset is needed. Synthetic board fixtures do not stand in for real dependency construction or live dispatch.

| Check | Result |
| --- | --- |
| `npm test` | exit 0; 2089 passed, 0 failed/skipped |
| Contracted focused `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/plan-release.test.ts` | exit 0; 34 passed, 0 failed/skipped |
| `npm run typecheck` | exit 0 |
| eslint on independent QA diagnostic; `git diff --check` | exit 0 |

[fingerprint.json](qa-evidence-run-8812/fingerprint.json) records exact SHA-256 values for evaluator, CLI, tests, package.json, package-lock.json, CI configuration and next.config.ts. All seven delivery files match 4e5377c byte for byte; later checkout commits at initial HEAD 095c899 change other planning artifacts. No model/artifact hash is applicable.

The green gate was read independently: **ver-3522**, run-8810, SHA **4e5377c**, pass on all three checks. Task-manager **1ce9d413-e929-4ad3-afd9-6bd0ff084d91** is COMPLETED, exit 0, callback delivered once. Raw gate logs show explicit checkout of 4e5377c and all three checks passing. Persisted **dec-56785** is green_gate_pass; callback event **11376** has outcome applied.

Delivery SWE run-8809 / **bec3c74b-a910-45f1-8689-2685b6bfb0c8** is COMPLETED, callback delivered once; board status succeeded, callback_apply_failures=0, persisted callback event **11370** applied. Its raw runner tail was read. [execution-audit.json](qa-evidence-run-8812/execution-audit.json) preserves selected task/run, callback, decision and raw-tail evidence. The board gate is distinct from GitHub CI and deployment.

## Fresh live user path and deployment

Four authenticated MCP reads were captured back to back at **2026-10-26T09:18:54–09:18:55Z**. The decoded payloads were saved without field edits; [manifest.json](qa-evidence-run-8812/manifest.json) records tools, arguments, captured_at, hashes and completeness outside them.

pm-255 is now **queued**, progress **waiting/after_plan**, holder **pm-248**, execution_started_at=null. Both current reads contain progress. Slots used 2/max 2/free 0 at capture; the explicit predecessor hold persists regardless of capacity. This is not queued/startable release. The parent is still abandoned. Independently read dec-55805 and final dec-55807 note still identify its abandonment; the note's claim that abandonment frees pm-255 is contradicted by the current hold.

The live CLI exits **1 in both modes**, input_errors=[], manifest verified. [live-released.json](qa-evidence-run-8812/live-released.json) and [live-dispatched.json](qa-evidence-run-8812/live-dispatched.json) show hold_after_plan, held_by_predecessor, progress_waiting, release_decision_missing and swe_run_missing. Unlike the previous delivery, the actual schedule shape decodes successfully. This is a valid negative result, not a reason to loosen the probe.

Unfiltered pm-255 list_runs returns **one succeeded investigator (run-8771), zero t-1557 SWE attempts**: zero failed/completed/pending/running/scheduled SWE runs. list_runs has no pagination. Its timeline has **14 entries**, oldest **idea:idea-248**, complete in one page at limit 200. The parent timeline is bounded at **200 entries**, older parent history unread/inconclusive.

At run start, pm-260's existing **esc-395**, fingerprint **release-after-plan:pm-255:pm-248**, was inspected and reused. It is waived, chore_done_at unset, not performed. Its recorded decider outcome authorizes offline QA to proceed. No second chore, privileged write, resume or board mutation was performed.

GET production /api/health returned 200 {"ok":true}, without SHA. Independently fetched home HTML publishes build-sha **c38f72a6e927800b363769a1de57ee2ceed69470**. `git merge-base --is-ancestor 4e5377c c38f72a6e927800b363769a1de57ee2ceed69470` exits **1**. The deployed site does **not** contain the delivery.

GitHub delivery workflow **40297944292** is completed/**cancelled**, **0 jobs**. Last successful same workflow is **40263545741** at c38f72a; checks job **121382351223** and production job **121383942536** succeeded. Previous failure **40296784613** at 4059b63 failed checks job **121484664977**, step **E2E against next start**, production skipped. Git log of `.github/workflows/ci.yml` from that last green through 4e5377c is empty. Raw failing-job logs returned **403: Must have admin rights to Repository**; the exact remote failing test remains unread/inconclusive. No environment diagnosis or speculative CI edit is made.

The workflow snapshot also shows **40297827219 / checks 121488109230** in progress on **ee1f6ce**, which predates 4e5377c; its E2E step had succeeded and signed-in motion was in progress. **40298672101** at **0a32605** was pending. These are observations, not later successes or delivery proof. No polling/waiting was used. See adjacent CI JSON captures.

**Proven:** offline CLI execution, fixture behavior and correct live held-state diagnosis. **Not deployed:** this delivery in production. **Not released:** pm-255. **Not demonstrated:** durable t-1557 SWE dispatch or its product output. Known false acceptances remain defects beside pending CI or future operator work.

## Bounded history and ownership

Task-manager project=plan-manager/coding_task history was read at offsets **0 and 20**, limit **20**, for both FAILED and COMPLETED: **40/60 FAILED**, **40/1122 COMPLETED**. Older ranges are unread/inconclusive. Current RUNNING read returned **2** tasks; PENDING returned an empty object without an explicit count, so exhaustive zero is not asserted. Complete pm-255 list_runs independently establishes zero SWE attempts for the target. See [task-history-summary.json](qa-evidence-run-8812/task-history-summary.json).

No scanned failed task matches this pm-260 delivery/run fingerprint. Raw tail of unrelated **8e93fb33-9d07-45c6-9dac-4bb6e6f92b8f / run-8793** shows selected-model capacity failures, exit 1 and a separate rescue push; it is not attributed to the probe. Relevant SWE/gate callbacks were followed into persisted ingestion. Event read was bounded at 200; unrelated histories/logs/callbacks remain unaudited.

| Exact id | Owner | Required next evidence / failure condition |
| --- | --- | --- |
| t-1578 D6–D9 | Otohime SWE, then QA | Reject malformed present predecessor/progress values. Any false exit 0 fails; see fix_plan_run-8812.md. |
| 40297944292, 40298672101; production build c38f72a | Otohime CI/deployment owner | Green checks and successful production for a SHA containing the repair; ancestry failure or stale build fails deployed proof. No speculative pipeline repair inferred from inaccessible logs. |
| esc-395, pm-255/t-1557 | Privileged platform operator; scheduler | Conditional edge repair/note/resume, or platform release after fix. Failure if hold persists after claimed repair; a waiver does not prove the chore. |
| pm-263 | Mono-v2 platform SWE/QA/acceptance | Scheduler/watchdog semantics and deployed receipt schema; unsupported future receipt stays inconclusive, not accepted by prose. |
| pm-255/t-1557 real dispatch and product | pm-260 acceptance; scheduler after release | Fresh complete snapshots proving execution plus durable matching SWE run id, then separate product-output proof. Failed attempts remain defects; queueing/submission is not product delivery. |

Recorded profiles: QA **run-8812**, fleet **avietidol-mac-mini**, **codex-sol-6-1-high**, **gpt-6.1-sol**, effort **high**. Delivery **run-8809**, same fleet, **claude-opus-high**, **claude-opus-5-5**, **high**. Gate run-8810 is a shell verify runner, not an agent-model result. Profiles/flags are recorded in the audit. AGENTS.md and committed plan were read; the two referenced standing documents were searched for and remain absent. Decisions and a global lesson were explicitly recorded.

All QA artifacts are saved under this plan folder. Commit/push identity is supplied in the board report and final output; the report commit does not repair or deploy application code.

Saving verification: the first push was rejected non-fast-forward. `git pull --rebase` incorporated **0a32605** (another task's QA report). All three checks were rerun: **2089/2089 unit**, **34/34 focused**, typecheck exit 0; eslint and diff checks pass. Application/lock/config fingerprints are unchanged. Current task-manager readback independently records QA lease f1706e38-852a-44b7-83ee-144362065f99 on fleet avietidol-mac-mini. The board submission records the final pushed report SHA.
