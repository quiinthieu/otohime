# Riso Delivery Recovery

Plan pm-277 · revision 1 · product-owner run run-9022 · 2026-10-26
Initial baseline: eb7ecde; final validation baseline: 17bca22 on main. Research: rep-5279/run-9011, preserved verbatim in [research.md](research.md).

## Outcome and boundary

Consolidate this duplicate incident onto pm-275/t-1617, preserving pm-270's delivered work and pm-268/t-1600's 5ad4906 fallback. pm-277 proposes **zero tasks**. It adds no competing repair and no task that idles on another plan. The existing owner's one code push supplies the on-demand real CI trigger. This Markdown delivery is not evidence that the repairs or Riso product have reached production.

Success requires a main code run with checks green through npm test on ubuntu-24.04 with Chrome, the deploy fixtures green, and production green through the existing verify-deploy.sh step. The public health SHA must contain both 074059495faf4bee48e8f655584dfd4487089b41 and c121b20. t-1600 continues directly to QA; t-1601 gets a fresh green gate on a lease with Google Fonts egress. No Pocket console or Riso heading edit is authorized by this plan.

## Current ownership supersedes research snapshots

| Scope | Current owner and observation | pm-277 action |
| --- | --- | --- |
| CI/Chrome test isolation and deploy readiness repair | pm-275/t-1617, ready; both fixes are in its admitted contract | Reuse that single implementation; no new SWE |
| Original bounded deploy | pm-270/t-1605, 5577ec5 delivered, board ready with esc-419 answer forbidding a rewrite | Reconcile descendants and retain ancestry; do not replay old stop-before-health policy |
| Inspect diagnostic fallback | pm-268/t-1600, 5ad4906 on main; now qa_pending | Preserve the landed repair; direct QA, no further SWE |
| Public unit-test diagnostics and commit identity | pm-276/t-1618 ready, t-1619 backlog | Keep their reporter/workflow scope separate from the repair |
| Riso headings | pm-268/t-1601, c121b20 on main; ready with green_gate prompt | Treat the recorded font-only lease failure as environment; rerun its gate rather than rewriting headings |

Research's statement that nobody owns the repair is historical. Live get_plan/get_task reads at proposal time are authoritative. Concurrent pm-259/t-1583 still holds deploy paths according to pm-275's scheduling view; that scheduler footprint is not another task or permission to duplicate the patch.

Late update during this run: pm-259/t-1583 landed 17bca22d109414873c566d676f63696907c2f2d4, repairing lib/end.test.ts with explicit CI isolation and fake Chrome/node, improving history-index fixtures, and adding public TAP diagnostics. Its report rep-5287 explicitly leaves deploy policy to pm-275/t-1617. CI run 40345114517 was observed running. This checkout rebased onto that commit and reran the full CI-shaped suite. pm-275 must retain these landed fixes, implement only its remaining deployment/matrix obligations and reconcile rather than duplicate the reporter work with pm-276. A green local result is not a green CI or production verdict.

## Agreed deployment policy

Adopt the admitted pm-275/t-1617 contract: bounded synchronous upload, at most one fast no-URL retry within a single total upload budget of 540 seconds; no retry after a URL or timeout; exact requested GITHUB_SHA at HEALTH_URL decides success within a total health budget of 180 seconds. Remove inspect as a verdict. A captured URL or successful CLI alone cannot pass. Preserve escaped diagnostic information and the final verify-deploy.sh validation.

This supersedes both c1b26f1's stop-before-health fixture and research's preferred retained-inspect implementation. 5ad4906 already implements compatible health fallback and must be rebased into the final owner change, not blindly reverted. No precise Vercel token/scope failure is proven by unread raw logs. Research descriptions of CLI timeout semantics disagree; no recovery decision relies on that disputed behavior.

pm-275 also owns lib/end.test.ts environment isolation and deterministic fake Chrome/node coverage, retaining probe-end.sh's no-installer CI branch. Its verification includes the environment matrix, CI=true npm test, deploy fixtures, ancestry controls, lint and typecheck. These are existing contracts, not a duplicate proposal here.

## Execution and handoff

1. This PO saves this document and the exact prior research body, declares/probes its narrow external capabilities, runs the repository tests, commits with pm-277/run-9022:, and pushes normally. It never claims SWE/QA tasks.
2. Submit plan_manager_propose_tasks with this path, saved git SHA, title Riso Delivery Recovery and tasks=[].
3. If the live planner rejects zero tasks, retain the exact reason and summarize the limitation. The canonical validator currently rejects an empty proposal (missing_acceptance_criteria) and only permits software_engineer roles. Do not substitute a vacuous SWE, a duplicate rewrite or a cross-plan waiting task. The authorized board decider/consolidation owner must reconcile this duplicate plan onto pm-275; this PO does not use privileged lifecycle tools.
4. pm-275/t-1617 implements its own admitted contract and stops at push. Its normal green gate and required independent QA own executable and deployed evidence. No manual deployment, empty code commit or report-triggered pipeline is needed.
5. After independently proven delivery, the board owner preserves t-1600's qa_pending handoff, dispatches its QA without another SWE attempt, and re-runs t-1601's green gate against a containing commit on a suitable lease. Verify that no actual code defect is hidden by the environmental classification.
6. The acceptance owner records the actual resulting gates, run ids and report ids. Missing current evidence is reported immediately with owner and failure condition; it is never replaced by a time-based task or presumed completion.

Standing rules remain in AGENTS.md and docs/claude/software-development.md. The referenced shared documents are absent from otohime, so this run read their canonical /data/build-worker/repo/mono-v2 copies; it does not copy standing policy into this folder.

## Independent acceptance contract

Acceptance obtains evidence independently of this PO and the SWE proof summary:

- Read the actual main code run and its jobs/steps. Require successful checks including npm test and deploy shell fixtures on ubuntu-24.04, and successful production including served-SHA and terminal/press verification. A report-only push is filtered and proves no deployment. If a pending code run is superseded, inspect a containing code run or use the existing authorized workflow_dispatch path.
- Audit up to five pages of 20 CI runs each, including current, FAILED and COMPLETED outcomes. Record counts, page exhaustion, omitted history, raw failure tails and inaccessible logs. Known red runs include 40334420077, 40335459968, 40337993898, 40338754295, 40339124232, 40340021768, 40340641001 and 40343322274; production failures include 40328273755 and 40330477897. An unread tail or truncated window is inconclusive, never evidence of zero defects.
- Record the delivered build/executable fingerprint from relevant test/deploy sources, package-lock.json and ci.yml. Compare it with failing attempts; an unrelated report SHA does not demonstrate a repair.
- GET https://otohime.dev/api/health and require HTTP 200, ok=true and a full SHA. Fetch that git object through ordinary read access, then independently run git merge-base --is-ancestor 074059495faf4bee48e8f655584dfd4487089b41 <live-sha>, git merge-base --is-ancestor c121b20 <live-sha>, and the same check for pm-275's delivery. Exact equality with later Markdown HEAD is unnecessary.
- At the delivered checkout independently construct a fake deploy/health negative control returning another SHA: it must fail, while matching SHA succeeds even if diagnostic inspection fails or is absent under the chosen policy. Exercise the real shell and bounded HTTP fixture; a fake vendor does not establish Vercel readiness. Also challenge the probe branch with independently constructed fake Chrome/node under CI=true, ensuring npm is not called.
- Read t-1601 ver-3582 and ver-3584 raw item tails and the fresh gate's actual build results. A font-fetch-only failure on identical sources is environment, not justification to change application code or add font binaries. A fresh deterministic application failure remains a defect.
- Read t-1600's newest QA and t-1601's fresh green result. Record the containing SHA, no new t-1600 SWE attempt, gate/report ids and downstream state. Do not claim these transitions occurred merely because this plan requests them.

Reports name actual run profile/model/effort, real/fake boundaries, identities, history completeness, independent negative controls, observed defects, and deferred ids/owner/failure condition. Integration deployed, execution demonstrated and product delivered are separate claims.

Outstanding ownership: pm-275/t-1617 for red checks/deploy or fixture defects; pm-268/t-1600 QA owner for Pocket evidence; pm-268/t-1601 gate owner for font-capable build evidence; pm-277 board decider for a rejected consolidation-only proposal. A pending replacement never excuses an observed deterministic defect. There is no dated product behavior to prove here.

## Prerequisites, size and planning evidence

[prerequisites.md](prerequisites.md) is the exact platform.plan-prerequisites.v1 manifest. This plan needs repository publication and public CI/health reads only. It needs no additional deployment secrets, migrations, runtime account or spend; those remain in the implementation owner's manifest. Agent-owned capabilities already exist. Typed probe results stay missing/unknown when an adapter cannot establish readiness; runner observations do not stand in for a control-plane probe or vice versa. Only a concrete missing person-owned setup would justify one operator_action with exact setup and readiness signal.

Observed settings: legacy_v1, batch_delivery_enabled=false, max_live_runs_per_plan=1, max_plan_elapsed=6h, qa_mode=auto. Zero new tasks have zero weighted task duration and zero dependency-path duration; no project parts or new ideas are needed. Platform refusal of an empty DAG is a representation limitation, not an oversized plan.

The prior PO run-9019 failed after two selected-model-at-capacity messages. Its raw task log confirms no local work beyond origin/main and no rescue content. This run continues without relaunching that job or changing model settings. Actual profile from list_runs: codex-sol-6-1-high, gpt-6.1-sol, effort high.

Planning validation and current external observations are recorded in [summary.md](summary.md). Passing local default tests alone cannot prove the known CI+Chrome repair. Production recovery remains unproven until the independent criteria above are met.
