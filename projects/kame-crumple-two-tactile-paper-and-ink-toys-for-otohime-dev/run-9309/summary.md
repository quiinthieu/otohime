# pm-274/t-1584 · Deliver the rescued reversible Canvas folds

Run run-9309; task branch `pm-274-t-1584-run-9309`. Actual run profile:
codex-sol-6-1-high / gpt-6.1-sol / high; fleet worker avietidol-mac-mini.
The enclosing commit is the delivery; the plan-manager summary `git_sha` records
its immutable SHA after push.

The recovered feature commit is `689c2369ded07e655475fec386c5d83a35851740`,
already rebased by the runner onto freshly fetched main
`3684cb5e2aa7a2ae517637c74a6d387aa693a9f9`. No further rescue rebase was performed.
Its application code and tests match prior delivery `3ff1c47` byte for byte.
Keep all passing work: seeded Canvas folds, lazy renderer, 600ms shared hold,
keyboard controls, synchronous restoration, retained accessible content and
layout, static reduced motion, eight-ball limit and lifecycle/failure cleanup.
The renderer port remains documented in [crumple-contract.md](../crumple-contract.md).
No basket physics, dependency, content persistence or new application code is added.

The previous run's push succeeded, but the persisted failure was
`push_not_on_main: HEAD 3ff1c47c577e is not on origin/main`. Delivery therefore
fast-forwards the tested task branch onto main, then uses `git push origin HEAD`.
Commits are created on the task branch, never directly on main. The existing
rescued commit is preserved, so this recovery adds a second task-prefixed evidence
commit rather than amending history. The prompt's unrelated plan/prerequisite
paths are absent from the rescued diff; nothing from those paths was added or
dropped. The build-generated `content/history.json` rewrite was discarded by
restoring its exact pre-build bytes. No binaries or secrets are committed.

| Required gate | Current result |
| --- | --- |
| Fold, gesture, peel and fetch unit tests | 19 passed, zero failed/skipped |
| Repository `npm test` | 2,613 passed, zero failed/skipped |
| ESLint | Zero errors; 10 existing warnings |
| Next typegen and TypeScript | Passed |
| Production crumple/fetch/peel browser suites | 27 passed, zero failed/skipped |

The first repository run failed seven CI-shell assertions because this Mac lease
lacked GNU `timeout` (exit 127). Built genuine GNU coreutils 9.7 `timeout` outside
the repository and prepended its source build directory to PATH. The unchanged
suite then passed, including real timeout termination and exit preservation.
This is a host prerequisite, not a fake runner or an application dependency.

Local execution is demonstrated with Node 22.23.3, locked Next 16.4.2 and
Playwright 1.64.0, native Chrome 156.0.8078.48, real migrated temporary embedded
Postgres and production build `PBluf_5_gJdGmvdXPVQp8`. The browser suites inspect
nonempty Canvas pixels, ink variation, compact ball bounds and DPR; retain source
accessibility snapshots, hrefs, text and geometry; exercise actual keyboard,
mouse and CDP touch; and prove restoration on source focus, Read and Reset.
Blocked renderer requests, delayed imports, null contexts, thrown paint and
context loss are deliberate negative controls, followed by recovery. Native
selection/scroll/context menus, reduced motion, ninth-ball rejection and
fold/fetch/peel cancellation remain covered. The unrelated Ghosts backend in
the runner is a fixture; the positive paper renderer is real Canvas.

The executable fingerprint is
`238d35fe38b1e363d0fe065697811f175f31b29726d7bb1d61380484cec63396`;
source, lock, configuration and generated renderer chunk hashes are in
`artifacts/fingerprints.json`. Named assertions and counters are preserved in
`artifacts/`, alongside `verification.json` and `commits.txt`.

Pre-push CI history inspected two pages of five FAILED runs (10/152), two pages
of five COMPLETED runs (10/538), current in-progress (1/1), and queued (0/0).
Historical filters overlap; older pages are unread, so completeness is
inconclusive. Failed run `40635091133`, job `122640103971`, belongs to unrelated
SHA `68dd79dba309c7713122e08b02ebb4e6844de749`: Footer Chromium reports an
unverified YouTube embed frame, 175 passed / 1 failed. Raw job logs returned
HTTP403; its public bounded assertion and runner tail were read. In-progress
run `40640198126` belongs to the parent baseline `3684cb5`, before this feature.
Neither proves this delivery's CI outcome. A decision containing a mistyped
current-run id was explicitly corrected on the board to `40640198126`.

Integration deployment and product delivery remain unobserved. There is no
async product queue, capacity deferral or callback ingestion for this browser
feature. Platform owns the pushed-SHA green gate and CI; independent QA and
acceptance own deployed identity and interaction checks. Their check ids are
not yet assigned at this handoff; the exact delivery SHA binds those checks.
Any red/missing/skipped required gate, wrong served fingerprint or regression
in retained content, input, accessibility or geometry fails that handoff.
Engineering stops after push without watching CI or probing the deployed site.

The referenced extraction/software-development paths are absent from this
clone. Recovery used the supplied contract, AGENTS.md and installed Next client
and lazy-loading guides. Previously cached copies of the standing documents
were read as background; their freshness is unverified. No graph tool is
available, so the declared source interfaces were inspected directly. The
checked-in plan.md still describes pm-259 recovery; it was not rewritten.
Decisions and the lesson about the main-ancestry push check are recorded in
plan-manager.
