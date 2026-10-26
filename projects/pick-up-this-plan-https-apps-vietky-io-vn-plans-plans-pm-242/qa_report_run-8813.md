# pm-258 / t-1564 QA, run-8813

Verdict: **fail, cause=code**. Delivery **15fd171ac7d54027fd1c13a715efe1de13110a6b**. Observed production **ee1f6ce6cd7f47c8e7fe1c450b33ff07e922332f** contains delivery (`git merge-base --is-ancestor 15fd171 ee1f6ce` exit **0**). The repair has deployed and executes locally, but the E2E gate still recurs red. No application source was changed by QA.

## What is proven now

Independent production HTTP observations returned 200 from /api/health, /api/now-playing, /projects and /music; health and both pages agree on ee1f6ce. Presence remains spotify-off/steam-off with null track/game. This task restores checks, not the subsequent keyless-provider tasks: personalized owner presence is **undelivered**. No capacity or operator prerequisite applies.

GitHub [40297827219](https://github.com/quiinthieu/otohime/actions/runs/40297827219) at ee1f6ce passed **checks 121488109230**, including application E2E, Footer walk and Footer Chromium probe, and **production 121492765411**. However the later [40298672101](https://github.com/quiinthieu/otohime/actions/runs/40298672101) at 0a32605 failed **checks 121493560349 / E2E against next start**, skipping production 121496003635. Earlier delivery [40295803050](https://github.com/quiinthieu/otohime/actions/runs/40295803050) failed the same step in checks **121481439046**; [40296784613](https://github.com/quiinthieu/otohime/actions/runs/40296784613) at 4059b63 repeated it in checks **121484664977**.

These commits have identical app, components, e2e, package-lock, workflow and changed runner/probe Git objects, recorded in [fingerprint.json](qa-run-8813/fingerprint.json). A successful attempt and newer documentation SHA do not repair an intermittent defect. The current job at capture was **40299753926 / checks 121496004137**, in progress; its queue state is not delivery evidence and this run did not wait for it.

The exact failed CI assertion is **unread/inconclusive**: raw logs for both delivery failures, the latest completed recurrence and the original E2E/footer runs return HTTP 403. Public job HTML confirms the step failure and exit-code-1 annotation but supplies no assertion. This report does not claim that the unknown CI assertion is definitely the known Ryugu transition exception.

Both `git log c38f72a..HEAD -- .github/workflows/ci.yml` and the relevant workflow diff are empty. Old green **40263545741 / checks 121382351223** and newer green **40297827219 / checks 121488109230** were compared with failed checks. There is no evidence for an environment cause. Actual checks fail, so authority does not apply. The contract requires **cause=code** for an unattributed delivery failure.

## Fresh exact-delivery execution

An isolated detached worktree at 15fd171 was installed with **npm ci**, Node **22.23.3**, macOS arm64. Real imports and construction of EmbeddedPostgres, pg.Client and Playwright Chromium passed; versions are Next **16.4.2**, pg **8.23.1**, embedded-postgres **17.10.0-beta.17**, playwright-core **1.64.0**. [Preflight](qa-run-8813/delivery-preflight.json) distinguishes constructor checks from actual startup. The unit database test starts real embedded Postgres, migrates and queries the user table, sends SIGTERM, verifies file removal and rejects a connection afterwards. No fake database or browser is used by the contract checks.

| Contract command | Result | Evidence |
| --- | --- | --- |
| npm test | 2,078 pass, 0 failed/skipped/cancelled | [summary](qa-run-8813/delivery-unit-summary.log) |
| npm run lint | exit 0, 10 warnings, 0 errors | [lint](qa-run-8813/delivery-lint.log) |
| npm run typecheck | exit 0 | [typecheck](qa-run-8813/delivery-typecheck.log) |
| npm run build | exit 0 | [build](qa-run-8813/delivery-build.log) |
| SKIP_BUILD=1 bash scripts/walk-end.sh | 67 ok / 0 failed | [HTTP walk](qa-run-8813/delivery-walk.log) |
| SKIP_BUILD=1 bash scripts/probe-end.sh | 171 ok / 0 failed | [matrix](qa-run-8813/delivery-probe.log) |
| SKIP_BUILD=1 npm run test:e2e | 91 pass, 0 failed/skipped/cancelled | [E2E](qa-run-8813/delivery-e2e.log) |

[Results](qa-run-8813/delivery-results.json) record exact commands, exits and durations. The build carries the full delivery GITHUB_SHA. Fingerprints include lock/config/source SHA-256, real platform Postgres/initdb hashes, Chrome binary hash, build ID, built asset hashes and public-asset Git identity. No runtime model artifacts apply.

The original repaired assertions pass: seven canonical footer pages and final waterline Tab progression; three scene SVGs plus waterline; pointer work at most one pending rAF after scrolling drains; a deliberate scroll/pointer overlap reads two; and the press-specific status locator passes PNG export despite another live region. Footer public-page, keyboard, contrast, reduced-motion, no-JS and network-negative controls remain enabled. The single historical footer failure **40277523350 / 2a58479** still has no readable raw assertion; a passing matrix cannot establish its unknown root cause.

Independent QA HTTP/browser observations and negative-control outcomes are recorded separately in [independent-results.json](qa-run-8813/independent-results.json), [delivery](qa-run-8813/independent-delivery.json), [live](qa-run-8813/independent-live.json) and [scheduling control](qa-run-8813/negative-control.json). These use QA's independently written [browser audit](qa-run-8808/independent.mjs), not the engineer's supplied proof summary. Both independent audits passed. Twelve explicit local Home/work-to-Ryugu hops recorded zero page errors. The audit corrupts and restores a canonical link, verifies every footer page is keyboard reachable through the final waterline, and proves the old page-wide status locator fails while the press-specific locator resolves. The isolated scheduling mutation removes --test-concurrency=1: its existing regression fails (exit 1, overlapping files), then passes after byte-identical restoration (exit 0). Only those two scheduling fixture files are fake; they do not stand in for the real browser/Postgres checks.

## History, callback ingestion and identity

[Independent CI evidence](qa-run-8813/independent-evidence.json): **2 pages × 50 = 100 of 380** main workflow summaries read. Overall captured counts: **49 failure, 34 cancelled, 16 success, 1 in progress**. The c38f72a-to-capture interval within those pages has **65 runs: 40 failure, 22 cancelled, 2 success, 1 in progress**. Nine bounded job listings contain **35 jobs**; job steps and selected public failure HTML were read. Older summaries and other job logs are unread. Bounded summary coverage is not full raw-history coverage. Production function logs are unavailable through the public endpoints and no Vercel log credential was supplied.

[Task history](qa-run-8813/task-history.json): FAILED offsets 0/25, 25 each, **50 of 1,116**; COMPLETED offsets 0/25, **50 of 6,033**; RUNNING **3 of 3**; PENDING **0** returned. This is a cross-project task-manager sample, not complete plan history. [Callback ingestion](qa-run-8813/callback-ingestion.json) follows delivery task **8d0933c1-50c4-40e6-8c5f-e4b07a2934fd** and previous QA task **0d081765-06f9-4a1e-9de4-28107aa0608b**: callbacks delivered once, persisted applied events **ev:11333** and **ev:11392**. Verification callback **ev:11343** persists board green gate **ver-3521 / 15fd171 / pass**. Timeline read: 50 entries, cursor dec-56268, older entries unread.

Delivery Git author and committer match **Otohime <quiinthieu@gmail.com>**, with zero Co-Authored-By trailers. Its manifest lists **author.txt**, 44 bytes, SHA-256 **7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada**. Artifact content remains unverified: the fresh [author access](qa-run-8813/author-artifact-access.json) attempt returned HTTP 403. A manifest hash alone is not proof of the required bytes.

Actual delivery run **run-8744**: profile **claude-opus-high**, model **claude-opus-5-5**, effort **high**, fleet **avietidol-mac-mini**. Current QA **run-8813**: profile **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, fleet **avietidol-mac-mini**. Previous QA **run-8808** used the same Codex profile/model/effort on **avietidol-z490**. These are recorded run profiles and flags, not current dashboard defaults.

## Defects, limits and ownership

- **t-1564**, owner its software engineer: E2E failures **40295803050 / 121481439046**, **40296784613 / 121484664977**, **40298672101 / 121493560349** remain unclosed. Failure condition: any of those executable-matched assertions recurs or is still unidentified; one passing job cannot dismiss it. Preserve all gates and obtain readable assertion diagnostics as specified in the [fix plan](fix_plan_run-8813.md).
- **pm-256/t-1559**, owner its software engineer coordinated by t-1564: the reported urashima `Page already revealed` exception remains an open intermittent candidate. Failure condition: any uncaught page error in the navigation path or its zero-error regression. It must not be filtered from E2E; clean local attempts do not prove its repair.
- **t-1564 / 40277523350 / 2a58479**, owner t-1564 engineer: original single footer assertion is unread; root-cause closure is inconclusive.
- **t-1564 / artifact author.txt**, owner delivery engineer: obtain the bytes and verify exact identity/no trailer. Failure condition: mismatching author/trailer; unread bytes remain inconclusive.
- **t-1564 / subsequent QA**, owner engineer then QA: after a focused defect repair, push to main to drive checks and the existing production dependency, then independently verify repaired delivery ancestry and the green gate. No idle watch, future quota reset or operator action substitutes for repair.

The previous run's [raw push-failure tail](qa-run-8813/previous-push-failure.log) identifies `push_not_on_main`: f697e2c was saved only on a feature branch. Its original QA artifacts are recovered byte for byte here, as historical evidence, and this run commits/pushes its QA-only changes to **main**. Before the push retry, main npm test additionally passed **2,089 tests**, and lint passed. The push was rejected non-fast-forward after another plan advanced main to **c2ca9c2**; git pull --rebase recovered it without force. All seven post-rebase contract checks passed: **2,096 unit tests**, lint, typecheck, build, **67/0 HTTP walk**, **171/0 Chromium matrix**, and **91/91 E2E**, with no skipped tests. [Rebase fingerprints](qa-run-8813/rebase-fingerprint.json) compare 516 application/runner/lock/config files with delivery: none changed; the concurrent source edits concern lib/plan-release. [Post-rebase verification](qa-run-8813/post-rebase-results.json) and its logs record the integrated checkout checks. The final evidence commit adds only QA records after testing; its compiled build marker identifies the tested pre-amend evidence commit, not a different application executable. The recovery does not label the already-red inherited gate green.

The requested extraction document and docs/claude/software-development.md remain absent. AGENTS.md, the explicit role/build contract and installed Next Playwright guidance were read. Significant judgments and the deployment/recurrence lesson were recorded on the board.

A second push met an evidence-only concurrent advance to **836df71**. Rebased without force; [final rebase evidence](qa-run-8813/final-rebase.json) proves no source/test/lock/config changes since the full seven-check pass. The project unit suite (2,096 tests) and lint were rerun successfully before the final push.
