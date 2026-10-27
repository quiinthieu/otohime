# t-1601 Node 22.12 green-gate repair

The supplied green gate at `221af4b` failed before main-lane assertions because Node 22.12.0 does not export `node:module.stripTypeScriptTypes`. This checkout starts at `86dfe92`. Two targeted reproductions confirmed that exact failure on the actual gate runtime. Passing on a newer local Node did not repair that gate.

`scripts/main-lane-closure.test.mjs` now compiles its extracted clock, ledger and ghost-route fixtures with the existing locked TypeScript 5.9.3 compiler, matching the Riso preview's approach. No dependency or Node engine change is needed. All 21 main-lane cases still execute, including the frozen-clock boundary, fitting-ledger rejection and detectable direct-configuration HTTP 404. Heading implementation and interactions are unchanged.

After `npm ci` including lifecycle scripts, all required commands pass on Node **22.12.0**:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --test lib/riso-heading.test.ts` | 5 passed |
| `npm test` | 2,510 passed; zero failed/skipped |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 10 existing warnings |
| `node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts` | fresh production build; 6 passed |

Real preflight constructed embedded Postgres and launched Chrome 156.0.8078.48 with the locked imports. Production verification ran migrations, Next 16.4.2, generated font assets, local `next start`, hydration and actual browser interactions. Browser controls cover accessible names, selection, offsets/counts, one observer, static media, no JavaScript, mobile wrapping, empty/Unicode/long headings, console A → Work TitleMorph and Play stamp/drop/tidy/focus. Sumi hides the third plate while retaining the heading name; unrelated HTTP/console errors and a deliberate pageerror remain detectable. The edge-string preview uses actual component SSR/CSS without hydration. Existing lifecycle/shell controls use explicit dependency stand-ins; the ghost-route control substitutes request context and environment. Those fixtures do not prove deployment.

Evidence: [verification identity](../../.agent-artifacts/pm-268-t-1601/run-9217/verification.json), [output tails](../../.agent-artifacts/pm-268-t-1601/run-9217/verification-output.txt), and [preflight](../../.agent-artifacts/pm-268-t-1601/run-9217/preflight.json). Identity includes source/lock/config hashes, selected executable fingerprint, production build ID and generated media hashes. Complete logs are in lease `shared/artifacts/run-9217`; `commits.txt` records the delivery SHA after commit/push. Generated history and binary assets are excluded.

Local history: two identical pre-fix reproductions (one retained log), one successful targeted suite, three successful full unit suites and three successful production browser runs (two fresh builds, one verified build reuse). Full local logs are retained; totals and failure markers were inspected. Remote FAILED/COMPLETED history, callbacks and CI are uninspected under the explicit SWE stop-at-push contract; remote completeness is inconclusive. Integration deployed: unverified. Capacity waiting: none. Execution demonstrated: local production only. Product delivery: independent deployed acceptance pending. Plan-manager owns the successor green gate and QA for `pm-268/t-1601`; successor job ids are not assigned here. Any failing verification or deployed defect must return its exact job id and raw output.

Observed run metadata from `plan_manager_get_run`: profile `codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`, fleet worker `billie-mac`. Decisions and a global lesson are recorded on `run-9217`. The absent process documents were read from their canonical host mono-v2 copies; reports remain in this plan folder.

The first push was rejected because main advanced to `bbf394e` with QA reports/artifacts only. The clean rebase preserved the selected executable fingerprint. All five contract commands passed again, including a fresh production build and six browser cases, before retrying the push.

A second concurrent push advanced main to `0cd1e09` through two other-plan Markdown commits. After the second clean rebase, all five checks passed again. Browser retesting used documented `SKIP_BUILD=1` with the rebase-1 build: source, lock, configuration, build ID and every recorded media hash were checked equal before launch and before delivery. No executable change was hidden by reuse. The first rebase-2 unit attempt had one initial READY-response timeout in the unrelated deployment-status fixture (100ms request limit). The complete suite then passed without concurrent typecheck/lint. Both logs are retained; this transient failure is not erased from the history.
