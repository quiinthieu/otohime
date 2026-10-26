# Split Part Recovery

Plan **pm-260**, revision 3 · product-owner **run-8836** · 2026-10-26
Repository **otohime** · remaining deliverable: **offline recovery evidence certification**.

This revision replaces the exhausted **t-1578 Verify split part release** contract. It preserves its working implementation and every finished artifact. It does **not** claim that pm-255 has been released, t-1557 dispatched, the platform fixed, or production deployed.

## What changes after the failed attempts

[QA run-8833](qa_report_run-8833.md) passed 2099 project tests, 41 focused tests, typecheck and 20 independent adversarial controls. Green gate **ver-3526** passed at **b73d93ca825ae4c56a7931c22e2280a960b535e8**, containing the repaired evaluator **c2ca9c20c6ae527d329ed4263672572ffd7219c9**. No new evaluator defect was identified. QA nevertheless failed after three fix cycles on two profiles because site E2E failed and the live site lacked the delivery. Repeated documentation-only pushes did not repair either condition.

| Previous coupling | Revised execution |
| --- | --- |
| Local file-reading CLI judged by the site's Vercel deployment | Execute the real CLI from the locked Node 22 checkout. It is not a deployed endpoint. Site E2E/deployment remains an explicit separate defect. |
| Another SWE cycle despite already-green offline commands | One certification contract, with the existing red-gate already-green path. Repair only a newly reproduced offline defect; never manufacture a source change. |
| QA repeatedly discovers the same held board | All 20 independent adversarial controls are now declared in verification[], alongside the complete unit suite, focused subprocess tests and typecheck. |
| Tool correctness, board release, dispatch and product output blurred | Independent booleans and evidence boundaries stay intact; delivery_proven is always false. Full original recovery is still unmet. |
| Stale capacity workaround in the first plan | Preserve current overrides and reuse esc-395. No cap/reset, SQL, reopen or resume bypass by a delivery role. |

The nearest deliverable that this repository and role can prove now is an independently executable offline evidence tool. The original scheduler/decider/watchdog implementation belongs to mono-v2; the administrative release requires privileges this delivery role does not have. This limitation is recorded as a scope decision, not a claim that eventual recovery is impossible or a waiver of a known defect.

## Preserved work and current facts

The earlier [plan](plan_run-8783.md), [proposal](proposal_run-8783.json), verbatim [research rep-5107](research.md), all QA reports, snapshots, manifests and repair history remain committed. The earlier plan/playbook is historical; its settings, ownership placeholders and temporary-cap workaround are superseded by this revision and the recorded esc-395 outcome. Standing rules remain in AGENTS.md and docs/claude/software-development.md; this plan does not replace them.

Live reads during run-8836 establish:

- pm-260 is drafting revision 2 before this proposal. Its only returned task t-1578 is **superseded**, not done. No completed board task needs replacement. Preserve any task already done if the board changes before proposal application.
- pm-255 is **queued**, progress **waiting/after_plan**, holder **pm-248**, execution_started_at **null**, t-1557 ready; explain_schedule returns no own runs. The current slot snapshot is **4 used / 5 maximum / 1 free**. This is a predecessor hold, not solely missing capacity.
- max_live_runs_per_plan is **1**, max_plan_elapsed **6h**, qa_mode **auto**. Do not inherit the original cap of 2 or a prior report's full-board observation.
- pm-258/t-1564 **Restore the deployment checks gate** is already running. It owns the concrete E2E/footer diagnosis and repair; a second CI repair contract here would conflict with it.
- mono-v2 **pm-263** is paused: t-1579 and t-1581 ready, t-1580/t-1582 backlog. None is delivered by this re-plan. t-1582 explicitly excludes the real pm-255 administrative repair and t-1557 dispatch, so those must not be silently transferred to that plan.
- **esc-395**, fingerprint **release-after-plan:pm-255:pm-248**, is waived/unperformed. Its decider outcome permits offline work, forbids the bypasses above, and retains the operator chore. Do not open a duplicate action or treat its resolved flag as chore completion.

The QA report's CI evidence remains open: **40303396148/checks 121506990908** and **40303724712/checks 121509554244** failed E2E; the precise assertion was unread, so no environment cause or application repair line is established. QA observed production **ee1f6ce6cd7f47c8e7fe1c450b33ff07e922332f**, lacking b73d93c. This run does not promote those historical observations to fresh production evidence.

A bounded independent GitHub read in this PO run returned five main workflows: **40307460821** pending at **9ddd0840**, **40306767130** cancelled at **922b210**, **40306337481** in progress at **ae4607d**, then the two failed runs above. Five summaries are not complete history or raw assertion evidence. Cancellation is not a repaired gate, and pending is not deployment.

## Remaining build contract

[proposal.json](proposal.json) is the exact new task array. One task, **Certify offline release evidence**, has no dependencies and can start immediately. It changes only the existing internal CLI/evaluator, their tests and evidence documentation if an actual offline regression requires repair. It does not require a board write, external runtime, other plan completion or natural tick.

The task's acceptance is narrowly executable: the actual evaluator imports and CLI subprocesses pass all four declared commands in the locked checkout. Synthetic API-shaped positive fixtures prove the tool's rules. Held, malformed, foreign, incomplete, tampered and scheduled-only evidence must fail with the existing stable distinctions. A failed submitted SWE run may prove dispatch but never product output. No weakened assertion, skipped test or fabricated receipt is acceptable.

The exact verification commands are:

```sh
npm test
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/plan-release.test.ts
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON projects/fix-for-slow-plan-pm-255-task-duration-spell-slow-pm-255-tas/qa-adversarial.mjs
npm run typecheck
```

Install first with **npm ci**, use Node 22, and keep the committed lockfile. Commands only affect the checkout or temporary fixtures. There are no deployment/cluster/board mutations in verification[]. All 20 adversarial cases must retain a passing positive baseline and contract_met=true, including malformed optional fields, missing progress, negative prose, unrelated receipt identities and failed-attempt preservation.

Set **qa=skip** because this task certifies an internal offline tool and changes no person-facing screen, endpoint or migration; verification[] fully proves that scope. Acceptance remains independent. This does not disable CI or change the classification of the prior QA failures. If all red-gate commands are already green, the documented **red_gate_already_green** mechanism should close the task without another SWE delivery. If a command fails, implement its failing regression and smallest repair, run the full verification, commit with the newly assigned task prefix and push. SWE work stops at push; no site-deployment receipt is part of this contract.

The one-task DAG has no idle edge. Size admission uses current role p50 and max_live_runs_per_plan=1: weighted sum and longest path both equal one SWE task duration (fallback 1h if fewer than 20 samples), below the 6h ceiling on the available historical estimate. The proposal response is authoritative; if it refuses size, split only real implementation scope rather than duplicate this already-delivered tool. No later project part or duplicate idea is needed: the other work already has owners.

## Original outcomes: owners, evidence and failure conditions

These remain visible even if the replacement task passes. A scoped offline pass must not be described as full Split Part Recovery success.

| Outcome / exact ids | Owner | Required evidence; failure condition |
| --- | --- | --- |
| Terminal-parent release, retained edge, supported reopen and final parent note | pm-263/t-1579, t-1580; mono-v2 QA/acceptance | Unit/backends plus deployed on-demand split drill. Abandoned/done release within one controlled tick; unfinished/reopened predecessor holds. Missing note, lingering hold or unsafe resume fails. |
| Null execution start and honest task_duration | pm-263/t-1581, t-1582; mono-v2 QA/acceptance | Controlled-clock tests and deployed slowness drill; never-executed part past threshold has no local work-duration breach; real execution resets the anchor. An inherited ready-time breach remains a defect. |
| E2E and containing site deployment | Existing pm-258/t-1564, coordinated with pm-256/t-1559; site QA | Obtain actual failing assertion using [fix_plan_run-8833.md](fix_plan_run-8833.md), reproduce locally, repair only evidenced source and retain gates. If necessary, diagnostic entry .github/workflows/ci.yml:80 publishes bounded failing TAP while preserving pipefail/original exit. Checks+production must pass at a containing SHA; unread assertions, repeated red or stale deployment remain unresolved. |
| Real pm-255 release receipt | Privileged operator esc-395; **pm-260 acceptance retains observation ownership** | Reuse the existing chore. Before action, operator refreshes parent status and current settings; administrative repair is conditional on the exact edge and abandoned pm-248. Record genuine after_plan_released provenance including actual dec-55805/dec-55807 note, and authenticated progress leaving after_plan. Alternatively use deployed pm-263 semantics and an authorized resume if needed. Persistent hold or merely waived chore fails. |
| Real t-1557 SWE dispatch, separately from output | Scheduler/durable queue; **pm-260 acceptance** | Fresh matching four-tool snapshots/manifest, execution_started_at, a real t-1557 software_engineer run id and durable tm_task_id. Scheduled-only, wrong task, missing execution or missing durable id fails. Capacity uses the durable scheduler, never another person-starts-runtime step. A failed attempt stays a defect beside a replacement. |
| t-1557 Ask probe product output | pm-255/t-1557 owning delivery/gate/QA | Successful actual executable/output evidence under its unchanged contract. A dispatch id, fake runner or this CLI's result proves none of that product delivery. |

The manual chore is already raised at its first point of need; there is no new human gate for the offline task. If a future role encounters a distinct person-only prerequisite, it raises kind=operator_action immediately with a stable chore fingerprint and a meaningful ready_probe when supported, then ends with the exact id and outcome requirement. An operator action is a chore, not a request to choose policy. Do not poll, soak, spend fix cycles on a missing external prerequisite, or add tasks that idle on pm-263 or CI.

## Acceptance and evidence boundaries

For the revised task, acceptance independently executes the checkout CLI and inspects the implementation diff and prior independent controls. Do not pass by rerunning only the implementer's supplied summary. Use the saved unmodified run-8833 four-tool capture as an observed historical hold negative, and a separate temporary copy changed without rehashing as a manifest-tamper control. The former must exit 1 and the latter 2. Fresh reads are required for any *current* release claim. Existing [release-walkthrough.md](release-walkthrough.md) defines collection, completeness and source identities.

The scoped artifact may be reported delivered when its independent evidence passes. For the **original** recovery request, pm-260 acceptance retains the live release/dispatch gap and must explicitly report it unmet until genuine evidence exists; it cannot submit a full original-outcome pass based on the narrower contract. No pending replacement, future dated event or scoped certification waives observed CI defects. Report a missing prerequisite with its owner and exact ids rather than starting another documentation-only fix cycle. Dated observations belong to an existing pending/watch mechanism only where its contract applies, never a task step.

Any execution/delivery claim identifies the executable fingerprint (relevant code, lock, configuration and artifact hashes), actual build SHA and observed run profile/model/effort. Inspect bounded paginated FAILED and COMPLETED histories plus current jobs, raw runner tails and callback persisted ingestion before claiming real execution. Record inspected counts and completeness; unread/truncated ranges are inconclusive. This PO performed planning reads only and does not claim a new runtime-history or callback audit. Historical QA audit bounds remain in qa_report_run-8833.md.

Boundary table for this re-plan: offline CLI execution **demonstrated**; synthetic success **tool behavior only**; integration deployed at delivery **unproven**; real pm-255 release **not demonstrated**; real t-1557 dispatch **not demonstrated**; t-1557 product output **unproven**.

## Planning delivery

Read the Chief of Staff plan and software-development.md from the host mono-v2 checkout because these standing documents are absent in otohime. Actual run identity: **run-8836**, profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, fleet worker **avietidol-z490**, task-manager **e2ca0f05-6ffb-44e4-8230-26653c5c3c80**. Current role defaults are not substituted for observed identity.

This PO changes planning artifacts only. The already-committed research.md is retained verbatim. Validate proposal fields/DAG/paths and run the project's own tests, focused CLI tests, 20 controls, typecheck and git diff --check. Use **pm-260/t-1578:** for this re-plan commit to identify the exhausted source task; do not claim an engineering task as product owner. Push normally; if rejected, pull --rebase, repeat verification and push without force. Submit plan_manager_propose_tasks with this path, pushed git_sha and title **Split Part Recovery**, then plan_manager_submit_report kind=summary with branch, SHA, returned task id and visible CI status. This delivers a concrete revised plan, not the unresolved original recovery.
