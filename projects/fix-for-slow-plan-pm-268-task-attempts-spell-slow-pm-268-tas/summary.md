# Planning evidence — run-9022

Riso Delivery Recovery (pm-277), product owner, 2026-10-26. Markdown-only consolidation; zero new implementation tasks. The final proposal result and saved commit identity are submitted in the board summary report. A proposal is not claimed admitted until the live tool accepts it.

## Delivered artifacts and scope

plan.md records single-owner repair policy, current ownership, bounded independent acceptance and the pm-268 handoff. research.md is the exact 11,575-character body of rep-5279/run-9011, including its historical claims; current corrections are in plan.md. prerequisites.md is the exact manifest declared and probed for revision 1. No standing rule, application, deployment script, workflow, font or binary is changed by this run.

The previous run-9019 raw task log ends with two selected-model-at-capacity errors, exit 1, and rescue reporting no work beyond origin/main. No lost local work was available. This run's actual profile is codex-sol-6-1-high, model gpt-6.1-sol, effort high, as recorded in list_runs/profile_flags. Research ran claude-fable-high with claude-fable-5-1 and effort high; these are observed profiles, not current defaults.

## Validation

- npm ci succeeded using Node v22.23.3 and the existing package-lock.json.
- Initial eb7ecde: npm test passed 2,315/2,315, zero skipped; lint exited 0 with 10 existing warnings. The independent CI=true lib/end.test.ts reproduction failed 1/11 with exit 130 instead of 1 at the BASE_URL stub-npm assertion. This is retained baseline defect evidence, not an ignored failure in changed code.
- bash scripts/vercel-deploy.test.sh passed all checks, including matching-SHA health fallback after inspect failure and wrong-SHA/unreachable failure controls. bash scripts/verify-deploy.sh --self-test passed 15/15, including stale-code and off-branch negative controls.
- Concurrent pm-259/t-1583 delivered 17bca22d109414873c566d676f63696907c2f2d4. Read its actual diff and rep-5287, pulled with rebase using explicit Otohime author and committer, then ran CI=true npm test with /usr/bin/google-chrome present: 2,318 passed, zero failed/skipped. Final lint also exited 0 with the same 10 warnings. These independently demonstrate the local CI-shaped test repair, not the GitHub production job.
- git diff --check passes. Only this plan folder is saved by this PO; author and committer are explicitly Otohime <quiinthieu@gmail.com>, with no coauthor trailer. Push uses git push origin HEAD; non-fast-forward is handled by rebase and rerunning project tests.

## External observations and limits

Public /api/health returned HTTP 200 JSON ok=true and SHA 074059495faf4bee48e8f655584dfd4487089b41. git merge-base --is-ancestor c121b20 074059495faf4bee48e8f655584dfd4487089b41 exits 1: the required Riso heading ancestry is not yet proven live.

Anonymous GitHub REST returned HTTP 403 rate limit exceeded. The first public Actions listing page showed run 40345114517 at 17bca22 currently running, and failures including 40343322274, 40340641001 and 40340021768. The specific 40343322274 page independently showed failure at 5ad4906. Only one listing page and one failure run page were read; no raw job tails were accessible. This is a bounded current snapshot, not a complete FAILED/COMPLETED history audit. Acceptance must perform the independent bounded pagination and raw-tail review declared in plan.md. Do not infer deployment recovery or zero defects from missing logs.

Typed probes at 2026-10-26T15:00:39Z recorded github:otohime:repository=missing because the registration has no ci_token; github:otohime:public-ci and otohime:public-health=unknown because service_capability cannot establish execution_runner context. None was made ready manually. Their successful SSH/public-read observations remain separate. The plan is legacy_v1 with shadow prerequisite admission. No concrete lost person-owned setup was observed; no new credential or physical chore is needed for this consolidation.

## Real/fake boundaries and remaining owners

Final validation baseline fingerprints (SHA-256):

| Input | Fingerprint |
| --- | --- |
| package-lock.json | 2d0ec0bea389a532592da1c7a96f8eb6452a90f055fa37cebb8a39d771791a8b |
| lib/end.test.ts | a0ebc19f1cbcc8bee4db185faa0cfa050440a2fc6136e66f5b7b54e62e4483f9 |
| scripts/vercel-deploy.sh | 6d8b092f77e378e2c0ebf4068ee7cdf33c4dacb8f7a1db498134a999ee1e80e3 |
| scripts/vercel-deploy.test.sh | debcc3a954f54571cad955ab0b8adfefb850f8393ff46efa6d49cb0dffe8bc2e |
| .github/workflows/ci.yml | 76d1ece93d012a50ab793e197bdbed9dfb79f007b03d0d9c5d40aa59be54f5a9 |

The real shell fixture suite uses fake vendor calls and local HTTP bodies; it proves branching, wrong-SHA rejection and bounds, not a real Vercel deployment. The CI-shaped local suite executes the real probe shell but isolates Chrome/node in its runner control. The baseline failing reproduction actually reaches the existing real Chrome branch. No executable changed in this PO run; build imports, real production-browser contracts and deployed output remain the implementation/gate/QA owners' obligations.

pm-275/t-1617 retains only the unmet deployment/matrix work after reconciling 17bca22, while pm-276/t-1618 must retain the landed diagnostics rather than replay them. A red deterministic check or wrong served SHA is still a defect beside any queued replacement. pm-268/t-1600 is already qa_pending and must not receive another SWE attempt for this lane; t-1601 needs its green gate on a font-capable lease, with raw failure evidence classified as environment only if the font-only signature holds. Their future report/gate ids are not invented here.

The remaining board representation issue belongs to pm-277's consolidation/decider owner: the canonical validator rejects zero tasks and permits only SWE proposals. This run submits the real zero-task proposal and reports the actual result instead of creating duplicate or idle work. A rejection is an unresolved admission issue, not delivered product output. No automatic privileged lifecycle change is claimed.
