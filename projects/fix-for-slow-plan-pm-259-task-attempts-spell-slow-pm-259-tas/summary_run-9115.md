# t-1660 · CI probe annotations and streamed headings

Run `run-9115`, profile `codex-sol-6-1-high`, actual flags `--model gpt-6.1-sol -c 'model_reasoning_effort="high"'`, fleet worker `billie-mac`. Base: `7666778e99e21c3bb475d3d66c6798061b7115d5`. Delivery SHA is recorded in the MCP summary and runner `artifacts/commits.txt` after committing this report.

Implemented the shared CI probe postprocessor using the existing reporter's `escapeData`, without changing that reporter. Camera, signed-in motion, Footer walk and Footer Chromium steps capture output through `tee` under bash `pipefail`, then annotate and return the captured status. Failures publish escaped workflow annotations and optional escaped Markdown summaries with bounded assertion/crash diagnostics and server tails, including missing-log diagnostics. The camera wrapper forwards numbered TAP as well as probe output; both failure formats survive later passing output.

The footer's 403-exit probe observes a rendered, nonempty `main h1` for up to 10 seconds after route navigation and footer hydration. All subsequent heading, layout, console, hydration and network assertions remain intact. Signed-in motion now normalizes unset, empty and over-48-character TMPDIR values to `/tmp`. Checks uses 25 minutes and E2E 12 minutes, with the supplied run `40420670837` measurements documented in the workflow.

## Local verification

| Command | Positive evidence |
| --- | --- |
| `node --test scripts/ci-probe-annotate.test.mjs scripts/probe-end-stream.test.mjs scripts/ci-workflow.test.mjs` | 23 tests passed, zero failures/skips. |
| `CI=true npm test` | 2,383 tests passed, zero failures/skips. |
| `npm run lint && npm run typecheck` | Zero lint errors (10 existing warnings); route type generation and TypeScript succeeded. |
| `node scripts/check-gate-closure.mjs` | `certified: true`; 26 tests and 7 required named assertions passed; zero failures. |
| `node scripts/verify-bottle-footer.mjs` | Fresh production build; footer walk 65/65 and Chromium probe 170/170. The worker's named test passed. Real signed-in `/admin/roles` exits to `/projects` and `/dashboard` passed with zero page/console/hydration errors. |

The first new-contract run was red (8 failing tests with the missing implementation). An additional camera regression was independently red when a numbered failure fell outside the last 80 lines, then green after failure selection recognized nested TAP. Real exit-7 and exit-0 subprocesses exercise bash/tee and the actual annotation CLI. Additional negative controls check missing server logs, escaping and bounded output, a crash without assertion lines, and absence of summary configuration. The delayed-heading positive control streams a heading after 1.5 seconds; the missing/empty/hidden-heading control rejects at the real 10-second timeout.

The streamed-heading fixture uses a real HTTP server and Chrome with a synthetic loading skeleton, without React or Next. It executes the actual observer extracted from the CLI and checks its real production call site. The isolated footer verifier separately uses actual Next production, Better Auth, disposable embedded Postgres and Chrome, including the signed-in route sequence. The existing corrupt-link, badge-visibility and external-network negative controls also passed. Fake subprocess output proves reporter orchestration, not camera inference execution; no new claim is made about real camera inference.

## Identity and limits

`npm ci` installed the unchanged lock. Runtime: Node `22.12.0`, Next `16.4.2`, locked `playwright-core` `1.64.0`, Chrome `156.0.8078.48`, darwin arm64. Production build ID: `rKd5VuMMhkjlhOfangau3`, stamped with the base HEAD plus these working-tree changes. An exported bash Chrome launcher made the existing CI shell path available on macOS without changing repository permissions or installing a browser. Build-generated `content/history.json` was restored after verification.

Executable/configuration/lock SHA-256 aggregate: `7c9a395686de436c857e16d6f2055a232d9d4b517a28f109f58820079b8e4acc`. Per-file hashes and counts are in [verification.json](artifacts/run-9115/verification.json). Full local logs remain in this lease's `shared/artifacts/{unit.log,targeted.log,gate.json,footer.log}`.

Execution is demonstrated locally. No capacity wait is pending. Integration deployment and the overall plan's product delivery are unproven in this SWE run. CI history completeness is inconclusive: zero FAILED/COMPLETED/current CI jobs were queried, and no raw remote tails or deployment endpoints were read. Supplied historical run timings are inputs, not independent observations here.

After push, plan-manager owns the green gate for `t-1660/run-9115`; failure means any contract verification fails at the delivered SHA. Sibling `t-1661` owns registering the new suites in `npm test`, public check-run annotation inspection and the subsequent certification delivery; failure means a newly exposed deterministic probe failure, missing registration or an unsuccessful checks/production lane. Independent QA/acceptance owns observing deployed build identity and ancestry; mismatch or absent delivery remains a failure. The explicit stop-at-push contract overrides the generic standing rule to watch staging after push. No pipeline or deployed-system result is asserted by this report.

The initial push was rejected because main advanced by two report-only commits. Rebased onto `6abdc3b76ca307b5b3c39d374dec60ac67a882ad` and reran all five required commands successfully on `d973eb854370385fe822db9e397251f9d207d6f5` before the report-only amendment. Counts remained 23 targeted, 2,383 unit, 26 gate tests, 65 walk and 170 probe assertions. The executable fingerprint remained identical. Rebuilt local production ID: `M8yldkfWOn2qomjcxlww2`. Post-rebase logs have `-rebase1` filenames listed in verification.json. Both author and committer remain `Otohime <quiinthieu@gmail.com>`.
