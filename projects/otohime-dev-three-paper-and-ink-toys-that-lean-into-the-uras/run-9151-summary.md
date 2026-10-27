# t-1647 delivery · run-9151

Plan `pm-269` · Branch `main` · Delivery SHA: the commit containing this report; the resolved SHA is in the run's platform `artifacts/commits.txt` and submitted summary.

The existing `4c9f325` implementation is preserved and strengthened. Failure annotations now retain Footer walk/probe and nested TAP counts after assertion truncation. All four non-TAP workflow shells explicitly preserve the captured child status even if the assertion reporter crashes; camera also gets the existing EXIT fallback. The Footer heading observer requires rendered, visible, nontransparent text within its unchanged 10s bound. Signed-in motion, Footer assertions, public UI and styles are unchanged.

## Verification

`node scripts/ci-probe-verification.mjs projects/otohime-dev-three-paper-and-ink-toys-that-lean-into-the-uras/run-9151/artifacts` ran the original five contract commands, sequentially, with observable evidence validation. Full logs and receipts are in [run-9151/artifacts](run-9151/artifacts/).

| Gate | Observed evidence |
| --- | --- |
| CI probe annotation and streamed heading contracts | 55 tests passed, no failures or skips; includes actual workflow-shell exit-7/exit-0 fixtures, missing-log and broken-reporter controls, escaping, bounded output, real 1.5s stream and real 10s heading timeout. |
| Repository unit suite | 2,444 tests passed, no failures or skips; required Footer and workflow test names checked. |
| Lint and type contracts | ESLint and Next type generation/TypeScript completed successfully; 10 pre-existing lint warnings, no errors. Static analysis only. |
| Gate closure invariants | Real certified runner, locked import/binary preflight, fingerprint intact, 7 named required controls passed; no closure failures. |
| CI-mode isolated footer walk and Chromium probe | Fresh production build and migrated disposable embedded Postgres; walk 65/65 and Chromium 170/170, including repeated 390×844 reduced-motion 403 exits to Projects/Dashboard, zero console/page errors and corrupted-link negative control. |

New regression tests run in a temporary copy against the baseline executables/workflow fail six assertions (49 pass / 6 fail): truncated counts, overwritten exit 7 in each of the four workflow shells, and hidden-only headings accepted as ready. The same tests pass against the delivery code. The evidence validator separately rejects empty exit-zero output for all five gates, renamed/skipped TAP cases, missing browser assertions and fake gate-closure receipts. These fixtures test validation behavior; they are not product execution evidence. The board's exit0-only metadata is read-only to the SWE role; static, closure and full-footer gates remain preservation checks rather than artificial red regressions.

## Execution identity and boundaries

Actual run profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`; fleet worker `billie-mac`, account `codex-main`. Node `v22.12.0`, `Google Chrome 156.0.8078.48`, Next 16.4.2, React 19.3.0, locked Playwright Core 1.64.0 and embedded Postgres 17.10.0-beta.17; installed versions match `package-lock.json` after `npm ci`. The closure preflight imports the real locked modules and executes the actual Postgres binaries. The production footer matrix constructs the real runner, database, server and Chromium probe.

Base checkout: `d49726913796ad09791a67968d47bd423b808eb5`. Tested executable fingerprint: `2b6e3deab1145a2bc1abd40a2e5b496e109c7a27ed1a3e1f17214113f16dd4b9` (code, lock and configuration hashes in `executable.json`). Production build: `HlVSeH4t6MXyGJ4wRWNer`; build manifests, generated pinned vendor/model hashes and the prebuild history hash are recorded there. The server's GITHUB_SHA identifies the base checkout while the fingerprint binds the tested working-tree code to this delivery. Prebuild's unrelated `content/history.json` rewrite was restored after verification. No vendor/model/fixture binaries or secrets are committed.

Real/fake boundary: workflow-shell tests replace external camera/motion/footer child and readiness behavior with deterministic fixtures; Bash, tee, Node and both reporters are real. Heading tests use real Chrome against a local streamed HTTP fixture. The isolated footer gate uses the actual production app and database. Physical webcam inference and the complete signed-in motion matrix were not rerun; their executable/assertions were not changed by this task.

Execution demonstrated locally. No remote integration/deployment or product acceptance is claimed. Current CI jobs read: 0; FAILED history read: 0; COMPLETED history read: 0. History completeness: not inspected, so historical CI failures remain inconclusive. The task expressly stops at push. Plan-manager owns the subsequent CI gate for the pushed delivery SHA and deployed acceptance; failure of that pipeline or its green gate returns the exact failed job to this task. No capacity deferral, operator prerequisite or idle wait was used. No observed local defect remains.

The mono-v2-only standing documents named in the prompt are absent here, as already documented in plan.md; root AGENTS.md and installed Next view-transition documentation were read. Decisions, including a lesson about the already-landed implementation and missed failure paths, are recorded on `pm-269` / `t-1647`.
