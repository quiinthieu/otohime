# Keyless Pocket Presence

Plan pm-258 · revision 2 · product owner run-9039 · 2026-10-26.
Baseline: 21a8f6edb7a3bed1ec1e505917a522df1f653468.
Sources: [original plan/provider contracts](plan_run-8715.md), [verbatim research](research.md), [last QA](qa_report_run-8849.md), [newer closure evidence](t-1564-closure.md).
The exact proposal task and prerequisite manifest are in [revision2-contract.md](revision2-contract.md).

## Deliverable and scope reduction

The original product is keyless listening/game presence on /music: ListenBrainz music and optional Lanyard games. This revision replaces only superseded t-1564. Its nearest independently deliverable outcome is a reproducible local gate-repair closure tool. Production recovery and personalized owner presence remain separately unproven.

t-1564 exhausted three fix cycles across two agent profiles. Its original control repairs are landed and recorded as deployed, but its broad seven-command closure repeatedly failed when concurrent app changes broke shared footer contracts. Repeating that closure or accepting evidence-only reports cannot repair those defects. The replacement ships one on-demand command with failure propagation, fingerprints and mutation controls. It proves only the local regressions it executes. This reduction is recorded as a board decision; it does not waive a product defect, weaken a correct assertion or establish external delivery.

## Preserve finished work and successor tasks

| Work | Current observed state | Treatment |
| --- | --- | --- |
| pm-242 twelve build tasks / eleven delivered visitor outcomes | Done; personalized live output missing | Preserve shipped behavior. |
| t-1564 | Superseded in revision 2 | Preserve repairs, reports and raw evidence; replace the remaining closure obligation only. |
| Serial runner, reporter and CI failure summary | 15fd171 / 841ca69; current regression suite passes | Reuse tests, do not re-implement. |
| Kame clock pause/control | 9ddd084/841ca69 | Preserve. Local unit tooling does not prove Kame browser execution. |
| Footer waterline | Actual source repair 3351f78, pm-249/t-1568 | Preserve attribution and behavior. |
| pm-270/t-1603, t-1604, t-1605 | Done | Preserve workflow filtering, probe/runtime and deploy changes. |
| pm-270/t-1606 desk swipe | Green gate | Preserve 0b349dc precondition/trace work; do not duplicate or assert final acceptance. |
| pm-272/t-1565 ListenBrainz | Ready | Keep its existing full build contract in successor pm-272. |
| pm-272/t-1566 Lanyard | Backlog after t-1565 | Keep its existing optional-provider contract. |

pm-272 already has after_plan_id=pm-258 (created 12:54Z). Do not create duplicate provider tasks or a second part. The original provider contracts remain in the archived plan and on their task records. Closing this revision's tooling scope releases that successor without pretending the shared production lane is repaired.

Settings read: max_plan_elapsed=6h; max_live_runs_per_plan=2; qa_mode=auto. Propose one SWE task without dependencies. Default estimate is one hour if no measured role p50 applies; server admission is authoritative. If size admission refuses, propose an independently useful first part within its ceiling and chain later ideas by after_plan_id, never parent_plan_id. No task depends on another plan's unfinished work.

## How the replacement differs

| Failed approach | Revision 2 |
| --- | --- |
| All seven shared app/footer checks must be green while other plans change them | Local repair regressions plus project unit/lint/types/build are the task's proof. Shared footer/production defects retain explicit owners. |
| Repeated manual evidence-only closures | Implement a machine-checkable CLI with bounded children, exact source/lock identity and nonzero propagation. |
| Unavailable historical assertion/author.txt as a mandatory closure gate | Retain exact unread evidence as inconclusive; never infer bytes or historical cause. |
| One newer SHA or successful attempt erases a flake | Correlate relevant code/lock/config hashes; preserve matched failures beside passing runs. |
| Provider builds coupled to human account setup | Preserve pm-272 contracts; personalized activation remains an advisory outcome, not a core integration gate. |

The original broad contract is replaced only for this internal tooling task. Product delivery still needs its actual code repairs, deploy checks, ancestry and user-path proof. Preserve all footer, keyboard, no-JS, motion, contrast, displacement and zero-page-error assertions, reporter diagnostics, and production needs:checks.

## Task 1 — Make landed gate repairs reproducibly verifiable

Role software_engineer; depends_on=[]; qa=skip.

**Problem:** Landed local repairs and evolving shared-lane defects are mixed in expensive manual closure reports. There is no repeatable command that rejects missing or false-positive local evidence.

**Action items:**

1. Read AGENTS.md and relevant installed Next guides. Preserve original repairs and existing owners. Add only scripts/check-gate-closure.mjs, lib/gate-closure.test.ts and gate-closure.md in this plan folder.
2. Declare an on-demand CLI, node scripts/check-gate-closure.mjs, returning otohime.gate-closure.v1 JSON. Execute current-checkout lib/e2e-runner.test.ts, lib/end.test.ts and lib/urashima.test.ts using Node 22 strip-types, clearing NODE_TEST_CONTEXT for nested tests, with child timeout at most 180s and bounded tails. Reuse real serial-vs-parallel, Actions-vs-local reporter, CI exit-preservation, migrated embedded-Postgres lifecycle and waterline regressions.
3. Report tested SHA, dirty status, Node/platform, SHA256 hashes of relevant source/test/workflow files and package-lock.json, command exits/signals/timeouts and local_controls=pass/fail. External evidence is explicitly inconclusive. Exit zero only if every required real child executes and passes; missing results, nonzero exit, spawn error, timeout, malformed output and fingerprint failures exit nonzero.
4. Write failing tests first for serialization/error propagation through a fake child-runner port and a real CLI path. In an isolated checkout, removing the real serial enforcement must make the CLI fail. Restore and clean only owned files/children. Do not copy existing assertions into a competing suite.
5. Use npm ci and preflight real playwright-core, pg, embedded-postgres imports and binary assets in the locked environment. Distinguish fake runner tests from actual nested Node/Postgres execution; neither supplies browser/user-path proof.
6. Write gate-closure.md with exact identities, real/fake boundaries, negative-control results, actual profile/model/effort and the unresolved-owner table below. Verify and push as Otohime <quiinthieu@gmail.com>, subject pm-258/<assigned-task-id>: with no co-author trailer. On rejection pull --rebase, rerun verification at integrated HEAD and push normally. SWE stops at push.

**Interfaces:** scripts/check-gate-closure.mjs; lib/gate-closure.test.ts; projects/pick-up-this-plan-https-apps-vietky-io-vn-plans-plans-pm-242/gate-closure.md.

**Non-goals:** Visitor UI, migrations, providers, changing existing runner/reporter/footer/Kame/desk/deploy implementations, fetching CI history from verification, deployment mutations, human accounts, schedules, global delivery certification.

**Acceptance:** The on-demand CLI executes real local controls and emits fingerprinted JSON, passing healthy controls and failing the isolated serial-enforcement mutation and fake error/timeout/spawn cases. Project tests/lint/types/build pass at delivery SHA. Evidence remains truthful about external gaps. This delivers internal local closure tooling only.

| Verification | Command at repository root | Timeout / expected |
| --- | --- | --- |
| Project suite and new negative controls | npm test | 300s / exit0 |
| Lint | npm run lint | 300s / exit0 |
| Types | npm run typecheck | 300s / exit0 |
| Build | npm run build | 600s / exit0 |
| Real local closure | node scripts/check-gate-closure.mjs | 240s / exit0 |

qa=skip applies because only internal scripts/tests/docs change and verification fully proves the narrow behavior. Plan acceptance remains required. The machine payload in revision2-contract.md includes the complete build contract and identical commands.

## Independent acceptance and retained defects

Acceptance obtains independent evidence beyond the supplied proof summary. At delivery SHA in an isolated checkout, remove serial enforcement and exercise the real CLI; assert nonzero with the named failed control, then restore locally. Independently compare emitted hashes to actual files and verify that fake runner results cannot certify deployment.

Read live /api/health and rendered build-sha independently, compare them and check ancestry of original 841ca69/15fd171 repairs. Record this separately; missing evidence is a delivery gap, not local proof. Acceptance may pass only this revision's tooling scope while retaining the product gap. pm-272 retains its provider acceptance: on-demand GET /api/now-playing and /music, honest off/quiet/fixture/live states, safe links/credits, failure isolation, no-fetch-at-build, sentinel scans, mobile/no-JS/keyboard/motion, and independent controls.

| Outstanding item | Evidence anchor | Owner and failure condition |
| --- | --- | --- |
| Desk swipe | 40310239199/checks 121530268639; desk.test.ts:597; music x0.3 vs0.425 | pm-270/t-1606; fails if the displacement assertion recurs on matched sources containing the repair. |
| Riso footer integration | ver-3586/run-9009/task 1527adf0-8941-4d2e-955d-5743acd0b45d; rep-5295 local walk 7/matrix 12 failures | pm-268/t-1601 source, pm-270/t-1604 harness; pm-275/t-1617 recorded canonical delivery recovery owner. Reproduced code defects remain failures. |
| Vercel production | 40328273755/121600218178; 40330477897/121613136055 | pm-275/t-1617, predecessor t-1605; fails if production fails or served SHA lacks intended code. pm-275 is paused, not proof of repair. |
| Historical unit reds | Eight run/job pairs in t-1564-closure.md; local fixture fix 17bca22 | pm-275/t-1617; diagnose actual assertions/repeated matched failures. Generic exit evidence remains inconclusive. |
| Original footer raw assertion | 40277523350/121423322274 at 2a58479 | Evidence owner this replacement; footer owner t-1604. Unread assertion remains inconclusive. |
| author.txt bytes | Historical task 03c16ea7; 44 bytes; SHA256 7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada | Existing platform artifact owner; replacement preserves gap. Git identity does not prove artifact bytes. |
| Navigation/hydration candidates | Page already revealed / React #418; no matching annotation in later closure interval | pm-256/t-1559 and pm-259/t-1573; matching uncaught errors remain failures. |
| Personalized music/game | No demonstrated owner public identifier/feed | pm-272 activation/acceptance; absent or mismatched owner feed means personalized output undelivered. |

This document records existing ownership; it does not claim an external owner accepted a newly enlarged contract. Paused owners and pending replacements do not waive defects.

At the start of a later run that needs a person to create/connect a feed, raise only that physical chore with plan_manager_ask_user(kind=operator_action), stable fingerprint listenbrainz-user:now-playing or lanyard-join:current-game, then end that activation run. Attach a real readiness URL once the public identifier is known; never placeholders or secrets. Integration work comes first. Nothing proves itself through polling, a soak, another plan's completion or the next natural run. This task needs no new runtime/capacity submission.

## Prerequisites

See the nonempty platform.plan-prerequisites.v1 manifest in revision2-contract.md: exact setup/authority, managed secret name/key only, typed probes and contexts for repository publication, existing Node/npm fleet, public CI and served-SHA reads. No provider or deployment secrets are needed for this replacement. Agent-owned existing setup is inspected; no physical operator setup is needed for the local build.

Manifest generation 3 was declared/probed at 15:39:06Z:
- github:otohime:repository missing: repo has no ci_token.
- runner:otohime:node22 unknown: task-manager accounts/rank HTTP400 requires repo/provider or account_id.
- github:otohime:public-ci failed: github-actions not allowlisted.
- otohime:served-sha failed: https not allowlisted.

These remain unproven adapter results. Earlier expect/target/context validation failures were corrected and recorded, not hidden. No manual state or decision makes a prerequisite ready. legacy_v1 shadow admission applies; an enforced batched_v1 revision cannot finalize until typed probes prove readiness. Do not add unrelated personal credentials to overcome adapter coverage.

Separate execution-runner observations on this baseline: npm ci succeeded; Node 22; project 2320/2320 tests; lint 0 errors/10 warnings; typecheck/build; focused 25/25 all passed. Live health returned 074059495faf4bee48e8f655584dfd4487089b41; both ancestry checks exited 0. CI sample 5/443: newest 40349872187/e03cf1c in_progress, previous four failed. These are incomplete summaries with no new raw job-tail diagnosis. Prior reports retain their exact history bounds and callback evidence; this PO does not extend them.

## Save and submit

Standing files remain AGENTS.md and docs/claude/software-development.md. Requested policy sources were located/read at /data/build-worker/repo/mono-v2/projects/20260921222547_plan_manager_chief_of_staff_extraction.md and /data/build-worker/repo/mono-v2/docs/claude/software-development.md; target root policy paths are absent. Installed Next 16.4.2 Playwright guidance was read. Do not move global standing rules into this plan.

PO edits Markdown only in this folder; research.md is already committed and remains byte-identical. Preserve original plan as plan_run-8715.md. Restore generated content/history.json after build. Commit every authored file with imperative pm-258/t-1564: subject and required identity, push git push origin HEAD, rebase/retest on rejection without force. Then propose this path/SHA/title and exact contract, and submit kind=summary.

Actual run: codex-sol-6-1-high / gpt-6.1-sol / high; account codex-main; fleet avietidol-z490; attempt 3. This planning commit certifies neither new application delivery nor green default-branch CI.

## Integrated delivery check

The first normal push was rejected after concurrent ab34874 landed. git pull --rebase succeeded. The integrated base adds a plain Riso footer-heading HTTP assertion and regression (pm-264/t-1590); it is preserved. On that integrated checkout, npm test passed 2,321/2,321, lint passed with 0 errors/10 warnings, typecheck and build exited 0, and the focused repair suite passed 26/26. Only this Markdown changed after those checks, and generated history output was restored. No claim about all footer browser gates follows from those results.

Latest independent CI summary read after rebase: 3/444 sampled runs. 40352230491 at ab34874 is in progress; 40349872187 at e03cf1c and 40346324813 at 74522bc failed. No raw assertion was read in this sample. This documentation-only push is excluded by the existing projects/** workflow filter and does not itself prove a new successful CI run. No force push or deployment mutation was used.
