# t-1578 QA: fail, cause=code

Run run-8800 independently reviewed delivery **320a07f621804187c44a9ffb2ca704908750c2b2**. The offline evaluator/CLI has reproducible false positives and rejects the current real schedule shape. No application source was changed by QA. The required suites pass; passing those suites does not establish the acceptance criterion that mismatched, unsupported or incomplete evidence fails.

## Findings

| Id | Evidence and observed result | Required behavior / location |
| --- | --- | --- |
| D1 | Unmodified authenticated `explain_schedule(pm-255)` has `inputs.tasks`, not top-level `tasks`. Both CLI modes exit **2**, `schedule_shape_unsupported`; the intended held-state diagnosis is never reached. `get_plan` also omits progress in this paused state. | Decode the real schedule shape at `lib/plan-release.ts:142` and `:159`. Preserve missing-progress rejection with a specific reason; never manufacture release evidence. Fix fixture drift at `lib/plan-release.test.ts:45`. |
| D2 | Change the otherwise valid synthetic SWE run status to `constructor`: direct evaluator and real CLI report dispatch/pass, exit **0**, with no JSON outcome. | `lib/plan-release.ts:239` reads an inherited Object property. Only the four explicit run statuses may produce recognized outcomes. |
| D3 | A decision of kind `other`, saying “Do not release pm-255: pm-248 was abandoned; release has NOT occurred.” with generic `note: Review this proposal tomorrow.` passes `release_recorded` and exits **0**. A foreign release entry without `evidence.plan_id`, alongside one unrelated local-trace entry, also passes. | `lib/plan-release.ts:210` through `:218`: require a supported structured release decision, exact part/predecessor identity, and the actual parent abandonment note. A blacklist plus prose keywords and any note is not release proof. A matching trace elsewhere cannot authenticate the candidate; parent and part can also share a trace. |
| D4 | Remove the SWE source run `id`: CLI exits **0**, substituting `run_id: ?`. | `lib/plan-release.ts:232`: missing source identity is incomplete dispatch evidence, not a source run id that can be preserved/audited. |
| D5 | Without a manifest, a synthetic runs payload explicitly marked `complete:false`, `has_more:true`, `next_cursor:unread` still exits **0**, with completeness `unverified`. | `scripts/probe-plan-release.mjs:75` and `:103`: successful acceptance must not rest on unverified completeness; unsupported/incomplete envelopes must fail. Optional diagnostic evaluation must not produce an acceptance success. This is a synthetic unsupported-envelope control, not a claim that live list_runs paginates. |

Reproduce all cases from the repository root:

```sh
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/qa-adversarial.mjs
```

The diagnostic generator exits zero after writing observations; **`contract_met` is the per-case assertion**. [adversarial.json](qa-evidence/adversarial.json) records three successful controls and five failing controls. The positive baseline exits 0; restoring an after_plan hold exits 1; a scheduled-only run with no durable id exits 1. Every fixture is synthetic and proves only probe behavior. The script imports the actual evaluator and launches the actual CLI; it does not reuse the implementer's fixture helpers or fake a runtime.

## Verification and executable identity

After `npm ci` on this Linux fleet lease, Node v22.23.3 / npm 10.9.9:

| Required check | Result |
| --- | --- |
| `npm test` | exit 0, 2076 passed, zero failed/skipped |
| focused `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/plan-release.test.ts` | exit 0, 23 passed, zero failed/skipped |
| `npm run typecheck` | exit 0 |
| eslint on the independent QA diagnostic | exit 0 |

[fingerprint.json](qa-evidence/fingerprint.json) records SHA-256 for evaluator, CLI, tests, package.json, package-lock.json and CI configuration. Evaluator SHA-256 is `bfabf24177efeef8f241e1f7890df503cb09022fb3f1ce4cc61020466ec1a0f6`; lock is `2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b`. Real imports and CLI construction ran in that locked installation. The changed executable uses Node builtins only: no processor/adapter, model or external asset is required. No fake runtime is offered as dependency proof.

Independently read green-gate evidence: run-8796, task-manager `5170e115-ee41-421e-a443-49a8510adf66`, SHA 320a07f, COMPLETED, exit 0, callback delivered once. Persisted `dec-56657` records `green_gate_pass`, verification `ver-3518`; callback event `ev:11308` is applied. SWE run-8789 / `f2877d39-a399-477b-916e-616c3a38b997` is COMPLETED, callback delivered once, board succeeded with callback_apply_failures=0; its runner log tail was read. See [execution-audit.json](qa-evidence/execution-audit.json).

## Live user path, integration and CI

QA fetched four snapshots directly through the MCP read tools at approximately 08:57Z, without edits or transcription. [manifest.json](qa-evidence/manifest.json) carries capture timestamps, exact-byte hashes, tools, arguments and completeness outside raw payloads. Full snapshots are in the adjacent plan/schedule/timeline/runs JSON files. `get_timeline(limit=200)` returned **13** entries, ending at `idea:idea-248`, complete in one page. Unfiltered list_runs returned **one succeeded investigator** (run-8771), **zero SWE attempts for t-1557**, zero failed SWE attempts, zero scheduled/pending/running SWE jobs. That plan-specific history is complete; list_runs has no pagination.

The raw board remains pm-255 paused, waiting/after_plan, holder pm-248, execution_started_at null; slots used 1 of max 2 with one free in the saved schedule. This is an unreleased hold, not unavailable execution capacity. The probe user path reads these exact files with the verified manifest, but D1 returns exit 2 in both modes: [live-released.json](qa-evidence/live-released.json), [live-dispatched.json](qa-evidence/live-dispatched.json). It makes no release/dispatch claim. Missing get_plan progress remains a separate evidence shortfall after the shape is repaired.

The parent's dec-55805 abandonment and dec-55807 final note were independently read. Parent timeline was bounded at 200 entries and not paged to inception; older parent history is inconclusive. Its note's claim that abandonment frees pm-255 is still contradicted by the observed hold. esc-395 (`release-after-plan:pm-255:pm-248`) was reused: waived at 08:52:07Z, chore_done_at unset, **not performed**. The decider explicitly directed offline QA to proceed; no second action, privileged mutation, resume or polling was attempted.

Production GET `https://otohime.dev/api/health` returned 200 `{"ok":true}` with **no deployed SHA**. A delivery-to-deployed `git merge-base --is-ancestor` check cannot be executed without that identity; deployed containment is unproven. Offline CLI artifact execution is demonstrated locally. Scheduler integration deployed, pm-255 release, durable t-1557 dispatch and t-1557 product delivery are all unproven.

Independent GitHub CI for delivery SHA: [run 40294920931](https://github.com/quiinthieu/otohime/actions/runs/40294920931), **completed/failure**, checks job `121478537463` failed at **E2E against next start**; production job was skipped. This is separate from the board's green verification gate. Last successful same workflow: [40263545741](https://github.com/quiinthieu/otohime/actions/runs/40263545741), c38f72a6e927800b363769a1de57ee2ceed69470. Git log of `.github/workflows/ci.yml` between that SHA and delivery is empty. Raw job log API returned 403 requiring repository admin rights; public annotations expose exit 1 but no failing-test detail. E2E cause remains inconclusive, not asserted to be environment or caused by this offline delivery. It is not needed to establish D1–D5. [ci.json](qa-evidence/ci.json) preserves these observations. No credential/login chore was raised solely to improve an already conclusive code-failure report.

## Bounded history and deferred work

Task-manager coding_task/project=plan-manager history was read at offsets 0 and 20, limit 20 each: **40 FAILED of total 60**, **40 COMPLETED of total 1110** at capture. Older ranges are unread/inconclusive. [task-history-summary.json](qa-evidence/task-history-summary.json) preserves selected identities, outcomes and callback state without prompts or credentials. Matching pm-260 completions are PO run-8783, SWE run-8789 and gate run-8796; none of the scanned failed tasks matches this executable. Other repo/plan failures cannot establish defects in this fingerprint. Raw failure tail for unrelated `ab0601c1-0d1a-4e67-9dcd-6f56661aff53` / run-8788 was read: model-capacity errors, exit 1. It is explicitly not attributed to t-1578. Only relevant SWE/gate callbacks were followed to persisted board ingestion; unrelated logs/ingestion and older histories remain unaudited.

| Deferred id | Owner | Required evidence / failure condition |
| --- | --- | --- |
| t-1578 D1–D5 | Otohime SWE, then QA | Fix the evaluator/CLI and add regressions; any observed false positive or real-shape rejection remains a code failure, even alongside queued work. |
| CI 40294920931 / job 121478537463 | Otohime CI owner / existing main-check repair work | Obtain the raw failing E2E test and resolve/reproduce it; future push reruns checks. No green-main/deploy claim until observed. |
| esc-395, pm-255/t-1557 | Privileged platform operator | Conditional repair/resume and actual parent note; failure if hold persists after claimed repair. Chore waiver is not execution. |
| pm-263 | Mono-v2 platform delivery/acceptance | Deploy scheduler/watchdog repair and prove real semantics; no promise of later deployment waives local defects. |
| pm-255/t-1557 after release | Scheduler and pm-260 acceptance | Independent snapshots proving execution start plus real SWE tm_task_id, then separately product output. A failed submitted SWE attempt remains a defect; queued/submitted alone is not delivery. |

Recorded identities, not dashboard defaults: QA run-8800, fleet avietidol-z490, codex-sol-6-1-high, model gpt-6.1-sol, effort high; delivery run-8789, fleet avietidol-mac-mini, claude-opus-high, model claude-opus-5-5, effort high. The investigative run is not a SWE dispatch. Missing referenced standing documents (`docs/claude/software-development.md` and `projects/20260921222547_plan_manager_chief_of_staff_extraction.md`) were searched for and absent; AGENTS.md and the committed plan were read. Decisions and a global lesson were recorded explicitly.

Saving the report: first push was rejected by a concurrent main update. `git pull --rebase` incorporated **15fd171** (pm-258/t-1564 E2E runner/footer repair). All three required checks were rerun: **2078/2078 unit tests**, **23/23 focused tests**, typecheck exit 0, zero failed/skipped. Evaluator, CLI, package lock and workflow YAML hashes remain identical to the recorded delivery fingerprint; the E2E runner changes belong to the other task, and no E2E success is inferred from its commit subject. CI and live observations above remain timestamped delivery-SHA evidence. Report commit/push identity is recorded in the board submission.
