# Delivery Signal Guardrails

Plan pm-276, revision 1. Product owner run-9016, 2026-10-26.
Baseline 5598e40 on main. Research: [research.md](research.md), verbatim rep-5278/run-9002.

Final planning checkout was fast-forwarded to 175a10b before the final test run, including concurrent pm-268 deploy repair 5ad4906.

## Product outcome

Restore trustworthy delivery signals for otohime and eliminate repeated diagnoses of hidden test failures. Acceptance retains the original delivery outcome: a main code push with both checks and production green, a live health SHA containing 658f6fc9fe5b1211413fd30ea8331ee77df00fb1 and this plan's code deliveries, and GET /api/guestbook returning HTTP 200 JSON with entries and nextCursor. The next pm-273/t-1612 QA should cite that same deployed SHA.

This proposal adds public unit-test diagnostics and a general code-commit identity guard. It does not claim production recovery has happened. The research includes verified local patches, not delivered code. Research artifact paths belonged to another ephemeral lease; implement from the recorded behavior, never depend on those files surviving.

## Ownership and coordination

Live board was reread during planning, superseding research's 14:40Z snapshot:

| Scope | Owner | pm-276 boundary |
| --- | --- | --- |
| lib/end.test.ts CI/Chrome fixture repair | pm-273/t-1612 fixing; pm-275/t-1617 also includes it | No edits here. Both tasks name the same fixture fix; read their latest state before implementation. |
| scripts/vercel-deploy.sh and scripts/vercel-deploy.test.sh | pm-270/t-1605 delivered 5577ec5, at gates; pm-275/t-1617 ready with the served-SHA repair | No competing third repair. Preserve the script interface and deploy workflow behavior. |
| Public unit-test annotations and generic reporter | pm-276 task 1 | Extend existing reporter; keep tests and CI command aligned. |
| General code author/committer CI check | pm-276 task 2 | Replace guestbook-only inline guard; preserve diagnostics from task 1. |
| Fleet GIT_* export, commit templates and strict pre-push refusal | mono-v2 pm-278 / idea-270, drafting | Already filed by research. Do not create another idea or claim CI can enforce lease identity. |

The scheduler handles shared .github/workflows/ci.yml and package.json footprints. These tasks have no prerequisite steps that idle on sibling work. They can prove their own behavior now with fixtures and a real Node child. External repair status is evidence for acceptance, not a task step.

Concurrent update at final fetch: pm-268/t-1600 landed 5ad49062c0a3583a70f3c7075e81c324e51adc57, whose deploy script now proceeds to health after failed inspect and retains diagnostics for final failure. This supersedes the baseline script in research and reinforces the no-deploy-edits boundary here. Latest observed run 40343322274 at that commit is failed (2m2s); this does not establish production recovery. Read the latest pm-275 contract and actual main script before any sibling repair, rather than replaying the old patch.

pm-275 chose bounded synchronous upload rather than research's smaller inspect-warning patch. This plan does not reopen that choice. If actual deployed evidence reveals a deterministic defect, acceptance must name it and its owner; a pending replacement cannot excuse it.

## Decisions and size

1. Reuse the existing node:test annotation reporter, generalize its titles, preserve TAP, exit codes, escaping and output bounds. Prefer the canonical npm test command rather than duplicating glob lists.
2. Check both author and committer for every code commit in a push range. Exempt projects/** and Markdown-only commits. Print a warning for trailers until fleet pm-278 supplies strict refusal; historical queued trailers must not create another rollout outage.
3. Set all four author/committer environment values explicitly for every commit and rebase: Otohime <quiinthieu@gmail.com>. No coauthor trailer. The platform's current default environment is not authority for the repository's required identity.
4. The PO run writes Markdown only, saves research body verbatim, and neither claims SWE/QA tasks nor edits application/configuration code. SWE stops at its push; platform green gates, QA and acceptance own deployment evidence.
5. Both tasks are internal plumbing, covered by real subprocess/git-fixture verifiers, so qa=skip is appropriate under qa_mode=auto. Final independent acceptance still examines real CI and production.
6. max_live_runs_per_plan=1 and max_plan_elapsed=6h. Two SWE tasks share workflow/test/package interfaces and run in order 1 -> 2. Fallback estimate is 2h with a 2h longest path; the platform's learned role p50 is authoritative at admission. No parts or periodic jobs are needed.

## Build contracts

```json
{
  "sequence": 1,
  "title": "Publish unit-test failure diagnostics",
  "role": "software_engineer",
  "qa": "skip",
  "depends_on": [],
  "problem": "The checks job's npm test failures are hidden behind authenticated raw logs, so unrelated delivery plans repeatedly diagnose the same anonymous red status.",
  "action_items": [
    "At start read this plan, research.md and the current pm-270/t-1605, pm-273/t-1612 and pm-275/t-1617 contracts. Keep their test and deploy repair files outside this change. If genuinely missing operator-owned setup prevents this task, raise plan_manager_ask_user kind=operator_action with the prerequisite_id, exact chore and readiness signal immediately and end the run; adapter unknown is not proof of a service outage.",
    "Write scripts/unit-test-reporting.test.mjs before implementation. Exercise a real Node 22 node:test child with deliberate pass, assertion failure and nested failure, a temporary GITHUB_STEP_SUMMARY and both reporters. Assert nonzero on failure, TAP not ok, escaped ::error with repository file and line, generic Test failed title, one bounded summary for the underlying failure, no duplicate parent annotation, and successful exit with no error annotation for the passing control. Test CI and ordinary local invocation without public-service writes.",
    "Reuse scripts/e2e-annotate.mjs for unit tests, using a generic annotation title and summary heading. Preserve existing E2E behavior, limits and workflow escaping. Wire TAP plus the annotator into the checks npm test invocation (workflow or canonical package.json command), with each reporter's destination explicit, without losing the original child exit status or changing test selection. Include the new regression in npm test.",
    "Extend scripts/ci-workflow.test.mjs to resolve the actual checks command to the reporter wiring and prove an ordinary local run remains usable. Keep reporter flags before test file arguments. Preserve runner pins, trigger filters, timeouts and production behavior.",
    "Run the declared commands and full project tests. Set all four GIT_AUTHOR_*/GIT_COMMITTER_* values to Otohime and quiinthieu@gmail.com for commit and rebase. Commit with pm-276/<assigned-task-id>: imperative subject, omit Co-Authored-By, push through the existing main path, and stop SWE work at the push."
  ],
  "interfaces": [
    "scripts/e2e-annotate.mjs",
    "scripts/unit-test-reporting.test.mjs",
    "scripts/ci-workflow.test.mjs",
    ".github/workflows/ci.yml",
    "package.json"
  ],
  "non_goals": [
    "lib/end.test.ts or probe/deploy repair changes",
    "New GitHub credentials or authenticated-log acquisition",
    "Application UI, database or hosting changes",
    "Manual production deployment"
  ],
  "acceptance_criteria": "A deliberate Node test failure exits nonzero and publishes its file, line, assertion and test name in a public workflow annotation and bounded step summary while retaining TAP. A passing control exits zero without an error annotation. The real checks npm test invocation uses this same reporter path.",
  "verification": [
    {
      "name": "Real Node reporter positive and negative controls",
      "cwd": ".",
      "cmd": "node --test scripts/unit-test-reporting.test.mjs",
      "expect": "exit0",
      "timeout_s": 120
    },
    {
      "name": "Checks workflow wiring",
      "cwd": ".",
      "cmd": "node --test scripts/ci-workflow.test.mjs",
      "expect": "exit0",
      "timeout_s": 60
    },
    {
      "name": "Project unit suite",
      "cwd": ".",
      "cmd": "npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    }
  ]
}
```

```json
{
  "sequence": 2,
  "title": "Enforce code-commit identity in CI",
  "role": "software_engineer",
  "qa": "skip",
  "depends_on": [
    "1"
  ],
  "problem": "The existing guestbook-only author check misses incorrect committer identity and non-guestbook code, while inherited lease identity overrides repository git configuration.",
  "action_items": [
    "At start read task 1's delivered wiring, the live sibling ownership map, and mono-v2 pm-278/idea-270. Do not edit the sibling deploy scripts or fleet repository. Raise any genuinely missing operator-owned prerequisite immediately with plan_manager_ask_user kind=operator_action and its prerequisite_id, then end the run without an idle loop.",
    "Create scripts/verify-commit-identity.test.mjs first, using isolated temporary git repositories with explicit author and committer environment. Cover approved identity, wrong author, wrong committer, a bad code commit followed by a good report commit, report-only commits, mixed code/report commits, file deletion, initial zero-before range, and merge changes. Passing tests must assert guard exit and diagnostic contents, not just search source text.",
    "Extract scripts/verify-commit-identity.sh from the existing guestbook author step. For every commit in the push range touching any path outside projects/** and Markdown files, require both author and committer exactly Otohime <quiinthieu@gmail.com>. Inspect every commit including root/merge changes; a later report cannot hide an earlier code change. Fail with an escaped public error naming the commit and offending field. Missing or unreadable range objects must fail clearly. Report-only changes remain exempt. A Co-Authored-By trailer emits an escaped warning; strict pre-push trailer refusal remains pm-278's fleet scope.",
    "Replace the inline guestbook-only workflow check with the tested script for push events, preserving full checkout history and existing before/SHA inputs. Extend scripts/ci-workflow.test.mjs to pin the script, event condition, range and fetch depth. Include the git fixture in npm test without removing any existing suite.",
    "Document the CI guard's boundary versus fleet enforcement in this plan's implementation report. Run verification and all project tests; use explicit Otohime author/committer environment for every git commit and pull --rebase, no Co-Authored-By, prefix pm-276/<assigned-task-id>:, push normally, and end SWE work at the push."
  ],
  "interfaces": [
    "scripts/verify-commit-identity.sh",
    "scripts/verify-commit-identity.test.mjs",
    "scripts/ci-workflow.test.mjs",
    ".github/workflows/ci.yml",
    "package.json"
  ],
  "non_goals": [
    "Fleet lease environment, CLI commit templates or pre-push hooks (pm-278 owns them)",
    "Rejecting historical trailers or rewriting existing history",
    "Deploy repair, probe environment repair or guestbook application changes",
    "New accounts, permissions or paid capacity"
  ],
  "acceptance_criteria": "Git fixtures prove every code commit's author and committer are checked across the push range, with actionable public errors for violations. Report-only commits are exempt; trailers produce warnings. The existing push workflow invokes the tested guard and retains the public unit-test diagnostics.",
  "verification": [
    {
      "name": "Git range and identity negative controls",
      "cwd": ".",
      "cmd": "node --test scripts/verify-commit-identity.test.mjs",
      "expect": "exit0",
      "timeout_s": 120
    },
    {
      "name": "Guard shell syntax",
      "cwd": ".",
      "cmd": "bash -n scripts/verify-commit-identity.sh",
      "expect": "exit0",
      "timeout_s": 30
    },
    {
      "name": "Combined workflow and reporter controls",
      "cwd": ".",
      "cmd": "node --test scripts/ci-workflow.test.mjs scripts/unit-test-reporting.test.mjs",
      "expect": "exit0",
      "timeout_s": 120
    },
    {
      "name": "Project unit suite",
      "cwd": ".",
      "cmd": "npm test",
      "expect": "exit0",
      "timeout_s": 300
    },
    {
      "name": "Lint",
      "cwd": ".",
      "cmd": "npm run lint",
      "expect": "exit0",
      "timeout_s": 300
    }
  ]
}
```

All commands execute inside the delivery checkout and make no shared infrastructure changes. npm ci uses package-lock.json. Fixture repositories are temporary and never push. Deliberately failing Node children are expected controls inside a passing parent test; they must not turn the outer verifier into a false success.

## External prerequisites

[prerequisites.md](prerequisites.md) contains the exact manifest passed to the board. Existing GitHub, Node/npm runner, Vercel and Neon capabilities are required even though this plan adds none. The fleet identity repair is separately owned code, not a credential prerequisite.

The plan is legacy_v1; prerequisite admission currently records shadow evidence. Readiness is established only by typed probes. Unknown/unconfigured adapter evidence stays unknown and is not recast as ready, or as a human setup chore. Missing authenticated GitHub raw-log read is avoided by the public reporter path; no new token is required for this implementation. An actual missing operator-owned setup discovered by a task is raised once at that task's start and the run ends. Existing operator actions are reused where available.

A control-plane key presence check does not prove push rights; the lease's normal push supplies that observation. A fleet account probe does not prove GitHub runner Node/Chrome or deployment credentials. Actual CI execution supplies those independent observations. This run must call set_prerequisites then probe_prerequisites; append the observed outcomes to this document before the proposal.

## Independent acceptance

Acceptance obtains its own evidence outside SWE summaries. It records run profile/model/effort, delivery/build SHA, package-lock and relevant executable/configuration fingerprints. It must distinguish integration deployed, execution demonstrated and product delivered; pending work is not success.

1. Open the actual delivery run and jobs, including the checks npm test and production deploy/final verification. Require both jobs successful on a main code push that contains both task deliveries. Anonymous run/job HTML and annotations are valid observations; unread raw logs remain a stated evidence gap. The reporter fixture proves the red diagnostic path without deliberately breaking main.
2. Inspect current CI and bounded FAILED and COMPLETED history: up to 100 runs in at most five 20-run pages, covering known red runs 40334420077, 40335459968, 40337993898, 40338754295, 40339124232, and 40340641001 where accessible. Include production-red runs 40328273755 and 40330477897. Record counts, failed job/step ids and whether pagination is exhausted. Raw tails unread or a window truncated by the bound is inconclusive, never zero failures. Compare relevant code/lock/config fingerprints rather than treating report-only SHAs as new executables.
3. Fetch https://otohime.dev/api/health, require HTTP 200 JSON ok=true and a full SHA. Fetch its git object and independently run git merge-base --is-ancestor for 658f6fc9fe5b1211413fd30ea8331ee77df00fb1 and each pm-276 delivery against the live SHA. Exact equality to report-only main HEAD is unnecessary.
4. Fetch https://otohime.dev/api/guestbook, require HTTP 200 JSON with entries as an array and an own nextCursor property. Do not write public guestbook data for this check. A 404 HTML response remains an observed delivery failure.
5. Independently challenge the guards at the delivered checkout: make a separate temporary git fixture with correct author but wrong committer on a code deletion followed by a report commit; require nonzero with that commit/field named. Feed a separate nested assertion failure to the real Node reporter and require nonzero child status plus escaped public annotation and bounded summary. This adds evidence beyond rerunning the author's summary script.
6. Read pm-278/idea-270's delivered contract and proof when available. Strict fleet identity completion needs evidence of all four GIT_* exports, a rejected wrong-author/committer push and a rejected trailer, against temporary remotes. An otohime CI warning is not this proof. Until observed, report fleet enforcement unproven with owner pm-278.
7. Provide the verified live SHA and run/job ids in the acceptance report for pm-273/t-1612's QA; read that task's newest report and record whether it cites the SHA. Do not create an idle task for the next QA. If this downstream observation has not occurred, name t-1612 and its exact next-trigger owner rather than invent evidence.

The real code push triggers the existing CI path on demand. If superseded, find a containing code run; an authorized existing workflow_dispatch can recover a replaced pending run. No empty commit, timed soak, consecutive-run threshold, manual deployment or person-started runtime is needed. Do not infer recovery from unrelated later SHAs.

Deferred evidence is always explicit: pm-275/t-1617 owns checks/deploy repair, pm-273/t-1612 owns guestbook QA citation, pm-278 owns fleet refusal. Failure conditions are a recurring deterministic red check, a red production verdict with a served target SHA, missing guestbook JSON, or accepted malformed identity push respectively. Acceptance must fail observed defects with a change request and the owner, rather than pass on a queued fix. A truly future observation uses the board's pending/watch mechanism with exact ids and trigger; no dated acceptance is required by these fixture-driven tasks.

## Planning verification

Typed probes at 2026-10-26T14:52:07Z recorded four failed states and one unknown: the SSH key is outside plan-manager's managed-secret allowlist; GitHub Actions, Vercel and Neon services are outside its service allowlist; the fleet account adapter returned HTTP 400 because its request omitted a required provider. None is marked ready. These adapter results do not prove production setup is absent. The actual lease's git ls-remote and npm ci succeeded, but those observations do not replace the typed probes or prove the execution runner. Admission remains shadow on legacy_v1; the final proposal response is authoritative about whether tasks were stored.

On the baseline: npm ci succeeded with Node 22.23.3 and npm test passed 2315/2315 with zero skipped. This macOS lease does not prove the ubuntu-24.04 Chrome branch; rep-5278 records that reproduction. The plan-only push is filtered by CI paths-ignore and cannot itself prove deployment. Current production status and any observed CI result will be recorded in the PO summary, without relabeling them as implementation success.

Direct planning observations: /api/health returned HTTP 200 with SHA 074059495faf4bee48e8f655584dfd4487089b41; /api/guestbook returned HTTP 404 text/html. Anonymous Actions listing showed completed failure for run 40343322274 at 5ad4906. This PO read only the first listing page and no raw job tails: it is not a complete execution-history audit. Final acceptance must perform the bounded independent scan above.

After refreshing to 175a10b, npm test again passed 2315/2315 (zero skipped) and bash scripts/vercel-deploy.test.sh exited 0 with '# all checks passed'. Both JSON build contracts and their dependency ordering were parsed and validated. Only this plan folder's Markdown files are committed by this run.
