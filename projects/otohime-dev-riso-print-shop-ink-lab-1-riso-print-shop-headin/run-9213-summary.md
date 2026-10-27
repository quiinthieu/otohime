# t-1601 resumed green-gate evidence

The supplied gate at `c121b20` failed during Turbopack font resolution before browser execution. This checkout starts at `b4e142ad37c76abdc496c14afb4ac18b2b5c03ba`, which already includes `0ca7e9a` removing stale `.next` output before fresh browser builds. Three fresh production runs of the exact Riso browser command pass all six tests. No speculative font or heading rewrite is required.

This delivery adds `scripts/e2e-build.test.mjs` to `npm test` and documents the build boundary in [heading-contract.md](heading-contract.md). The regression executes the actual runner in a disposable checkout. It verifies stale-output removal before compilation, deliberate build reuse, and actual suite invocation. Its mutation control removes the cleanup statement and proves the stale-output compiler refuses before either server or suite starts. The mutation is confined to the temporary fixture.

All required checks pass with Node 22.23.3 after a locked `npm ci`, including lifecycle scripts:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --test lib/riso-heading.test.ts` | 5 passed |
| `npm test` | 2,510 passed; zero failed/skipped, including 3 runner regressions |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 10 existing warnings |
| `node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts` | fresh production build and 6 browser cases passed |

Real execution uses Next 16.4.2, locked React and Playwright, embedded Postgres and migrations, vendored assets, local `next start` and Chrome. It covers heading names, selectable source, actual plate offsets/counts, one observer, static media, mobile/no-JavaScript output, console A → Work TitleMorph and Play stamp/drop/tidy/focus return. The edge-string preview uses real component SSR/CSS and does not claim hydration. The separate lifecycle regression has explicit stand-in database, compiler and server; it cannot prove application execution. Initial fixture development exposed inherited `NODE_TEST_CONTEXT` suppressing nested test execution; the fixture clears it and requires a suite-written receipt.

Negative controls include Sumi hiding the third plate without altering the heading name, Play producing exactly four source-letter blocks, and unrelated console/resource errors remaining failures. No observed defect remains in these local checks.

Build ID, selected source/lock/config hashes, fingerprint and final output are in [.agent-artifacts verification](../../.agent-artifacts/pm-268-t-1601/run-9213/verification.json) and [output](../../.agent-artifacts/pm-268-t-1601/run-9213/verification-output.txt). Full local logs are also copied into this lease's `shared/artifacts/run-9213`. Generated `content/history.json` and vendored binaries are excluded from the commit. The pushed SHA is supplied by the summary report and artifact `commits.txt`.

History scope: three local production attempts, all completed successfully; full final logs inspected. Fixture development had two initial harness failures, corrected before the successful 3-case run and full suite. Remote FAILED/COMPLETED pagination, CI and deployment are deliberately uninspected under this SWE stop-at-push contract; remote history is incomplete, not a claim of zero failures. Integration deployed: unverified. Capacity waiting: none. Execution demonstrated: local production only. Product delivered: independent deployed acceptance remains pending. Plan-manager owns the next green gate and QA for `pm-268/t-1601`, with any failed check returning its exact job id and raw output; those future job ids are not yet available.

Observed run metadata: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, high effort, fleet worker `avietidol-z490` (from `plan_manager_get_run`, not current role defaults). Decisions and lesson are recorded on run-9213.

The first push was rejected because main advanced to `6809e82` with a QA report. The rebase was clean; all five verification commands passed again, including a fresh production build. The selected executable fingerprint is unchanged.
