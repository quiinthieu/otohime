# t-1578 QA: fail, cause=code (deployment evidence incomplete)

Run **run-8816** verified delivery **c2ca9c20c6ae527d329ed4263672572ffd7219c9**. **The offline repair passes all observed functional checks; a deployed QA pass cannot be issued.** Production independently publishes **ee1f6ce6cd7f47c8e7fe1c450b33ff07e922332f**, and `git merge-base --is-ancestor c2ca9c2 ee1f6ce` exits **1**. Delivery CI **40300404091** was **pending, zero jobs** at 09:37:43Z. These are timestamped observations, not a prediction of future failure.

This uses the role contract's conservative **cause=code** fallback for an unattributable QA failure. No new evaluator defect or environment cause is established. It is not cause=authority: the separate waived operator chore does not explain the unmet deployed-SHA rule, and production delivery is not solely a board reconciliation. No application source was edited by QA. The report does not recommend speculative application or workflow changes to make a check pass.

## What was demonstrated

After `npm ci`, on Linux fleet **avietidol-z490**, Node **v22.23.3**, npm **10.9.9**:

| Check | Independent result |
| --- | --- |
| `npm test` | exit 0; **2096 passed**, zero failed/skipped |
| Contracted `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/plan-release.test.ts` | exit 0; **41 passed**, zero failed/skipped |
| `npm run typecheck` | exit 0 |
| Independent QA `qa-adversarial.mjs` | exit 0; **20/20 contract_met** |
| Fresh real snapshot CLI, released and dispatched | exit **1** each; supported inputs, verified manifest, correctly held |
| Edited copy of real plan snapshot, original manifest retained | exit **2**, `manifest_plan_sha256_mismatch` |

D6–D9 now reject malformed predecessor/progress evidence with stable per-source errors. The positive synthetic baseline exits 0; queued/startable passes only released mode; held, scheduled-only, missing progress/note, wrong identities, inherited statuses and incomplete evidence fail. A synthetic failed SWE attempt preserves **qa-swe / qa-durable-id**, proves dispatch only, and leaves **delivery_proven=false**. The evaluator import and actual CLI execute in the lockfile installation; these are not fake process invocations.

[adversarial.json](qa-evidence-run-8816/adversarial.json) preserves all outcomes. This diagnostic's fixtures are independent of the implementation's fixture helpers. Rerunning it is supplemented by **new authenticated board reads and a new real-snapshot tamper control**, independent of supplied proof summaries.

[fingerprint.json](qa-evidence-run-8816/fingerprint.json) records SHA-256 for the evaluator, CLI, focused tests, package.json, package-lock.json, workflow and Next configuration; all seven match the delivery commit byte for byte. This executable uses Node builtins only. No processor/adapter, model weights or external assets apply. Synthetic snapshots prove probe behavior, not scheduler execution or product delivery.

## Real user path

Four MCP reads were fetched independently at **09:36:35–09:36:37Z**, saved as decoded payloads without field changes. [manifest.json](qa-evidence-run-8816/manifest.json) contains tool arguments, capture timestamps, collector SHA, exact saved-byte hashes and completeness outside those payloads.

**pm-255 remains queued / waiting / after_plan**, holder **pm-248**, execution_started_at=null. **t-1557 is ready**, not dispatched. Parent **pm-248 is abandoned**. Slots were **2 used / 2 maximum / 0 free**; the explicit predecessor hold remains a distinct blocker, not merely capacity.

Both [live-released.json](qa-evidence-run-8816/live-released.json) and [live-dispatched.json](qa-evidence-run-8816/live-dispatched.json) report no input errors and manifest verified, with `hold_after_plan`, `held_by_predecessor`, `progress_waiting`, `release_decision_missing` and `swe_run_missing`. All five evidence booleans are false. This correct negative diagnosis does **not** fail the offline probe's functional contract.

The part timeline is complete in **one page, 14 entries, limit 200**, oldest **idea:idea-248**. Unfiltered list_runs is complete (no pagination): **one succeeded investigator run-8771**, **zero t-1557 SWE runs** across scheduled/pending/running/succeeded/failed states. No failed target SWE attempt is hidden by a pending replacement.

The parent decision history was bounded to **200 decisions**; older entries are unread/inconclusive. Independently read **dec-55805** and **dec-55807**, including the actual final abandonment note. Its claim “Abandoning frees pm-255 to run” is contradicted by the current hold.

At start, inspected and reused **esc-395**, fingerprint **release-after-plan:pm-255:pm-248**. It is waived, chore_done_at unset, **unperformed**. Its recorded outcome authorizes offline QA to proceed. No new chore, privileged mutation, resume, scheduler edit or polling was performed.

## Gate, callbacks and bounded history

Independently read green gate **ver-3523**, **run-8815**, SHA **c2ca9c2**, all three checks pass. Raw verifier tail explicitly checks out that SHA. Task-manager **93ce2092-5bfe-4c95-981f-da2bd3ace8cf** is COMPLETED, exit 0, callback delivered once. Persisted **ev:11415** says applied; **dec-56834** records green_gate_pass.

SWE **run-8814 / c39431b8-0c3b-48d3-a777-2a9fe4ab346e** is COMPLETED, exit 0, callback delivered once; board succeeded with callback_apply_failures=0. Persisted **ev:11409** says applied. Selected raw runner tails were read and saved. See [execution-audit.json](qa-evidence-run-8816/execution-audit.json).

Task-manager project=plan-manager/coding_task FAILED and COMPLETED pages were read at **offsets 0,20, limit 20**: **40/61 FAILED**, **40/1128 COMPLETED**. RUNNING returned **2/2**; PENDING returned an empty object without a count, so exhaustive zero is not asserted. No scanned failed record names pm-260. Relevant completions include this SWE/gate pair and earlier pm-260 attempts; earlier fingerprints do not establish this repair's behavior.

Raw failed comparison **0d081765-06f9-4a1e-9de4-28107aa0608b / run-8808 / pm-258** ends with **push_not_on_main**, after saving another task's QA branch; it is not a probe failure. [task-history-summary.json](qa-evidence-run-8816/task-history-summary.json) records bounds and selected identities. Older histories and full raw logs are unread. pm-260 event and decision reads were each bounded at 200; only the relevant callbacks were followed through persisted ingestion. A global event read was also bounded at 200 and did not include the relevant pair; plan-specific events supplied them.

## Deployment and CI

Production GET /api/health returned **200**, `{"ok":true}`, without SHA. Home HTML publishes **ee1f6ce6cd7f47c8e7fe1c450b33ff07e922332f**. The ancestry check fails; the live deployment contains earlier code, not this repair.

[Delivery workflow 40300404091](https://github.com/quiinthieu/otohime/actions/runs/40300404091) at c2ca9c2 was pending with zero jobs. The latest successful same workflow is now **40297827219**, ee1f6ce; **checks 121488109230** and **production 121492765411** succeeded. This newer green replaces the prior summary's last-green observation at c38f72a.

Latest observed failed checks: **40298672101 / 121493560349 / 0a32605**, failed **E2E against next start**, production skipped. Earlier **40296784613 / 121484664977 / 4059b63** fails the same step. Both raw log requests return **403, Must have admin rights to Repository**. Git log of **.github/workflows/ci.yml** from ee1f6ce to 0a32605, and through c2ca9c2, is empty. [ci-comparison.json](qa-evidence-run-8816/ci-comparison.json) compares the same checks job and runner metadata. There is no demonstrated environment cause or exact failing assertion; no speculative runner repair is proposed.

The recent workflow read is bounded to **10/400 advertised runs**: **4 failures, 3 cancelled, 1 success, 1 in progress, 1 pending**. Selected jobs were read for the delivery, latest/older green and two failed runs; other job details and older histories remain inconclusive. Prior-sha E2E failures remain open with their owner; pending delivery CI cannot waive them. This run did not wait for CI or inspect inaccessible Vercel runtime logs.

**Offline executable execution: demonstrated. Integration deployed at this delivery: unproven/ancestry false. Real part release: not observed. Durable t-1557 SWE execution: not demonstrated. t-1557 product output: not delivered by any evidence in this run.**

## Deferred checks and identities

| Id | Owner | Required evidence / failure condition |
| --- | --- | --- |
| c2ca9c2; CI 40300404091 | Otohime CI/deployment owner, then QA | Green checks/production at a containing SHA and live ancestry; pending or stale deployment cannot pass. If failed, obtain exact assertion before prescribing a source/configuration repair. |
| 40298672101 / 121493560349; 40296784613 / 121484664977 | pm-258/t-1564 CI repair owner, coordinated with pm-256/t-1559 where relevant | Raw E2E failure and same-job regression/repair; assertions are currently unread, not attributed to this CLI. |
| esc-395; pm-255/t-1557 | Privileged platform operator, then scheduler | Conditional edge repair/note/resume or platform release; fails if hold persists after claimed repair. Waiver proves no execution. |
| pm-263 | Mono-v2 scheduler/watchdog delivery and acceptance | Deployed release/receipt and slowness semantics; incompatible future receipt must remain unaccepted until explicitly supported. |
| pm-255/t-1557 release, dispatch, product | pm-260 acceptance | Fresh complete matching snapshots, execution plus durable SWE task id, then separate output proof. A failed attempt remains a defect beside retries. |

Recorded QA identity: **run-8816**, fleet **avietidol-z490**, profile **codex-sol-6-1-high**, **gpt-6.1-sol**, effort **high**. Delivery: **run-8814**, same worker, **claude-opus-high**, **claude-opus-5-5**, **high**. Gate run-8815 is shell, not an agent-model result.

Read AGENTS.md, committed plan and installed Next testing/type guidance. The two referenced standing files are absent in otohime but were found and read under **/data/build-worker/repo/mono-v2/**. Recorded explicit decisions and that discovery as a lesson. All QA artifacts stay under this plan folder; commit and push identity are supplied in the board submission and final response.

