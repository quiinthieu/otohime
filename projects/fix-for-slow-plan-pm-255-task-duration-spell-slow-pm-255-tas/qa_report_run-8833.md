# t-1578 QA: fail, cause=code — offline probe passes; deployed delivery absent

Run **run-8833** independently verified delivery **b73d93ca825ae4c56a7931c22e2280a960b535e8**, containing repaired evaluator **c2ca9c20c6ae527d329ed4263672572ffd7219c9**. The offline functionality passes. A deployed QA pass is refused: production health and home publish **ee1f6ce6cd7f47c8e7fe1c450b33ff07e922332f**, and `git merge-base --is-ancestor b73d93c ee1f6ce` exits **1**. Delivery CI has now **failed**, rather than merely waiting.

Cause **code** is the mandated fallback for an unattributed failure, not a newly identified evaluator defect. No environment cause is established; authority cannot explain failed CI and stale deployment. QA changed only artifacts under this plan folder. Preserve the repaired evaluator.

| Independent check | Result |
| --- | --- |
| `npm ci` | exit 0, committed lockfile, Node v22.23.3 / npm 10.9.9 |
| `npm test` | exit 0, **2099 passed**, zero failed/skipped/cancelled |
| Contracted focused Node test command | exit 0, **41 passed**, zero failed/skipped/cancelled |
| `npm run typecheck` | exit 0 |
| QA adversarial diagnostic | exit 0, **20/20** controls meet contract |
| Fresh real snapshots, released / dispatched CLI modes | exit **1** / **1**, no input errors, manifest verified |
| Temporary real-snapshot plan-id tamper, original manifest retained | exit **2**, `manifest_plan_sha256_mismatch` |

[Verification](qa-evidence-run-8833/verification.json), [fingerprints](qa-evidence-run-8833/fingerprint.json), and [adversarial results](qa-evidence-run-8833/adversarial.json) preserve observations. The actual evaluator imports and CLI subprocesses ran on **darwin/arm64, avietidol-mac-mini** in the locked installation. Evaluator, CLI, focused tests, package files, workflow and Next configuration match b73d93c byte for byte. These executables use Node builtins; no processor, vendor adapter, model weights or additional assets apply. Positive fixtures are synthetic board data, not scheduler or product execution. Failed synthetic SWE attempts preserve source/durable ids and failed outcomes while `delivery_proven` remains false. Fresh authenticated board reads and a new temporary-copy negative control provide evidence beyond the supplied SWE summary and reused diagnostic.

## Fresh board user path

The four unfiltered/read-only MCP snapshots and capture timestamps are saved with exact-file hashes in [manifest.json](qa-evidence-run-8833/manifest.json). Payload fields were not edited; decoded JSON was serialized to local files, and the manifest hashes those saved bytes.

**pm-255 is queued, progress waiting/after_plan, holder pm-248, execution_started_at=null. t-1557 is ready.** Slots are **5 used / max 5 / free 0**, superseding earlier cap observations. Capacity and the explicit after_plan hold are separate facts. Parent pm-248 remains abandoned. The CLI correctly reports all five evidence booleans false, with `hold_after_plan`, `held_by_predecessor`, `progress_waiting`, `release_decision_missing`, and `swe_run_missing`. This diagnosis passes the offline probe contract; it does not establish real recovery.

Part timeline: **15 entries, one page, limit 200, oldest idea:idea-248**, complete for this read. Unfiltered `list_runs`: **one succeeded investigator run-8771**, zero t-1557 SWE runs of any status, no durable SWE dispatch or product output. Parent decision history: **200-entry bound**, older history unread/inconclusive; independently read dec-55805 and dec-55807 and its actual final abandonment note. [Board audit](qa-evidence-run-8833/board-audit.json) preserves the note and limits. The note's claim that abandonment frees pm-255 contradicts current scheduling.

At start inspected and reused **esc-395**, fingerprint **release-after-plan:pm-255:pm-248**, waived but chore_done_at unset. Its outcome explicitly permits offline QA. No duplicate chore, privileged write, resume, cap change, scheduler change or wait loop occurred. **esc-395/pm-263** retain recovery ownership; real release is not silently waived.

## Green gate, history and persisted callbacks

Green gate **ver-3526 / run-8826** passes all three items at **b73d93c**; earlier repaired gate ver-3523 remains pass at c2ca9c2. Raw gate runner tail explicitly checks out full b73d93c. SWE task **e6da1063-d2f0-4028-b99d-877c0827f271** and gate task **a98c281a-1e9c-4803-91a0-754df0021eb6** are COMPLETED, callbacks delivered once. Board runs succeeded with callback_apply_failures=0. Independent read-only SQL confirms **events 11471 and 11480, source=callback, outcome=applied**, matching those exact task ids, without truncation. Timeline dec-56905 records green_gate_pass. See [execution audit](qa-evidence-run-8833/execution-audit.json), [ingestion](qa-evidence-run-8833/ingestion.json), and [gate](qa-evidence-run-8833/green-gate.json).

Task-manager plan-manager/coding_task history: FAILED offsets **0,20**, limit 20, **40/62** read; COMPLETED same bounds, **40/1140** read. No scanned FAILED entry belongs to pm-260; older ranges remain unread/inconclusive. RUNNING returned **8/8**; PENDING returned `{}` without an explicit count, so exhaustive zero is not asserted. Selected raw SWE, gate and failed-run tails were read; only their last 40 returned lines are saved, full upstream logs unread. Failed comparison **d1ab959c-5977-4c77-b1ac-6347df0f3b1e / pm-256/run-8828** exits 143 and rescues its workspace; its tail also records a missing `timeout` command. It is unrelated to this probe fingerprint. Prior QA **run-8829** has a COMPLETED task-manager job but board status failed, **QA callback without qa_report**: process completion alone is not an accepted QA result. Plan timeline scan returned **178 entries / limit 200**; global callback-event scan returned **144 / limit 200**. These are bounded observations, not a complete raw-log audit.

## CI and deployment

Public workflow and job pages independently establish:

- Delivery [40303396148](https://github.com/quiinthieu/otohime/actions/runs/40303396148), b73d93c: **checks 121506990908 fails E2E against next start**, production 121509552622 skipped.
- Successor [40303724712](https://github.com/quiinthieu/otohime/actions/runs/40303724712), 9d0fba4: **checks 121509554244 repeats the E2E failure**, production 121512001257 skipped.
- Earlier c2ca9c2 run **40300404091 is cancelled**, annotation: higher priority waiting request for ci-refs/heads/main. The previous saved pending observation is stale.
- Last green [40297827219](https://github.com/quiinthieu/otohime/actions/runs/40297827219), ee1f6ce: **checks 121488109230 and production 121492765411 succeed**. Older failed 40298672101 remains in the history.

[CI history](qa-evidence-run-8833/ci-history.json) records **25/385 main summaries, one page**; selected run/job pages were read, older ranges and other job details remain inconclusive. Public pages name E2E and exit 1 but require sign-in for raw assertions. REST reads return **403 rate limit exceeded** from this host; web fallback is inaccessible. There is no new raw assertion or runner/image metadata with which to establish an environment cause. The visible unused-import warning also exists on the green job and is not the failure. `git log ee1f6ce..b73d93c -- .github/workflows/ci.yml` is empty. Repeated E2E failures remain unresolved beside passing local probe checks; no queued replacement waives them.

Deployed GET /api/health is **200**, ok=true with ee1f6ce; home build-sha agrees. No authenticated Vercel function logs were available. A bounded plan-manager log query for pm-255 returned null, not a clean-log assertion. The probe is a local CLI, with no deployed HTTP endpoint of its own. The required containing-deployment receipt remains absent.

**Offline executable execution: demonstrated. Integration deployed at delivery: false by ancestry. Waiting for capacity: board full, but after_plan remains an independent defect. Real t-1557 execution: unproven. Product delivery: unproven.**

| Deferred id | Owner | Failure condition / required evidence |
| --- | --- | --- |
| 40303396148 / 121506990908; 40303724712 / 121509554244 | pm-258/t-1564 CI repair owner, coordinated with pm-256/t-1559 | Obtain/reproduce actual E2E assertion; preserve tests and provide green checks plus production at a SHA containing b73d93c. Failed or unread assertions cannot be dismissed. |
| b73d93c; ver-3526; deployed ee1f6ce | Otohime CI/deployment owner, then QA | Record a containing deployed SHA and ancestry exit 0; current stale build fails. |
| esc-395 / pm-263 / pm-255 | Privileged platform operator / mono-v2 scheduler owner | Genuine release receipt and current progress leaving after_plan; persistent hold after claimed repair fails. |
| pm-255/t-1557 | pm-260 acceptance | Fresh complete matching evidence, execution and durable SWE id, then separate actual output. Queueing, scheduled-only, failed attempt or absent output cannot prove product delivery. |

Recorded QA identity: **run-8833**, profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, fleet **avietidol-mac-mini**, task-manager **8202df54-5b25-4dc7-b269-079aa3972e62**. Delivery run-8823 used that recorded profile/model/effort on **avietidol-z490**; gate run-8826 is shell. Read AGENTS.md, plan, installed Next guidance and standing documents recovered from the host mono-v2 Git mirror. Explicit decisions and a lesson were recorded. The companion fix plan keeps offline correctness separate from unresolved deployment and live recovery.

The first push was rejected non-fast-forward. Rebased over **ae4607d**, which adds three pm-256 QA artifacts and changes no application, lock, workflow or probe files. Repeated all required checks: **2099 unit**, **41 focused**, typecheck, and **20/20** adversarial controls pass. [Post-rebase receipt](qa-evidence-run-8833/post-rebase.json) records the tested revision and unchanged executable fingerprints. Evidence-only amendments do not change the executable. No force push occurred.
