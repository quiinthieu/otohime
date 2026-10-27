# pm-268/t-1678 delivery recovery — run-9250

The complete implementation from run-9247 is retained as rescued commit `c5497e0ce3a170ad7291702f22cdceeeb287ac52`. No application code or regression test was dropped or rewritten. This retry adds a delivery receipt and fixes the missing main integration; the earlier report remains historical evidence for that earlier run, not a claim about this delivery.

## Diagnosis and delivery

The previous agent's `git push origin HEAD` successfully published `cbf862f` to its feature branch, but the runner subsequently rejected it with `push_not_on_main`. Task-manager task `8e9ae0a1-f0c8-49ed-9faf-3bd121d2b056` persisted that failure, delivered its callback in one attempt, and plan-manager run `run-9247` ingested the same failure with zero callback-application failures. An accepted summary and successful feature-branch push did not satisfy this legacy runner's integration requirement.

The runner restored the implementation atop `e8f2667`. After fetching main, this run created `pm-268-t-1678-delivery` without replaying or rebasing the rescued commit. Commit on that task branch, publish it with `git push origin HEAD`, and fast-forward `origin/main` to the same verified delivery. If main advances, use the authorized non-force rebase/retest retry. The final SHA and actual push results belong to the platform summary and `shared/artifacts/commits.txt`.

## Preserved behavior

Loaders follow route children. `PaperHost` acknowledges each real shell, cartridge, footer line and Notes host from its React effect. Both loader activation and the actual Companion/PaperLayer mutations wait on those DOM identities; elapsed time and load events cannot grant readiness. Hidden cached routes do not block the active page, and committed Daruma card replacements receive paper controls with old listeners and gestures torn down. The dedicated registry tests and heading-contract document remain included.

The original nine Kame cases and their unconditional pageerror assertions remain. Browser coverage includes real and Playwright fake time across three loads, reload persistence, 45-second idle emergence, Call, naming, dismissal, calendar streaks, paper reset, Daruma replacement and Notes navigation. The held real Daruma module regression dispatches load and advances 46 seconds before releasing hydration: no early overlays may attach. Riso coverage preserves the accessible source, Unicode graphemes, deterministic offsets, static/no-JavaScript rendering, TitleMorph and Stamp it interactions. No hydration error is suppressed or filtered.

## Fresh verification and executable identity

Locked `npm ci` ran with lifecycle scripts. Runtime: Node **22.23.4**, Next **16.4.2**, React **19.3.0**, playwright-core **1.64.0**, real Chrome **156.0.8078.48**, embedded Postgres **17.10.0-beta.17** with real migrations. Build **qDd78QVwjj1zxQcOC7x_k**. Relevant source/lock/config fingerprint **8c13435b8f55c7aec9c326641fec8f3628274a7fc703bc0def19023d49ab828e**; per-file hashes are in `shared/artifacts/executable.json`.

| Command | Observed result |
| --- | --- |
| `node --experimental-strip-types --test lib/riso-heading.test.ts` | 5 named tests passed |
| `node --experimental-strip-types --test lib/riso-heading.test.ts lib/paper-hydration.test.ts` | 9 named tests passed |
| `npm test` | 2,571 passed; zero failures, skips or cancellations |
| `npm run typecheck` | Route types generated; zero TypeScript diagnostics |
| `npm run lint` | Zero errors; 10 existing warnings |
| `node --experimental-strip-types scripts/e2e.mjs --test e2e/riso-headings.test.ts e2e/kame.test.ts` | Fresh production build; 19 passed; zero failures, skips or cancellations |
| `SKIP_BUILD=1 npm run test:e2e` | Complete rerun: 202 passed; zero failures, skips or cancellations; exit 0 |

The complete browser suite ran against that fresh build with a new real database/server on each invocation. The final complete rerun passed all 202 tests in 512,535ms. Logs and count validation live in `shared/artifacts/`; `local-verification.json` records positive named assertions and log hashes. Generated `content/history.json` is excluded from delivery.

The first complete-suite attempt ended with 201 passed and one cancelled by a 30,003ms timeout in the unchanged Ghosts cross-tab test (`e2e/ghosts-pref.test.ts:179`); it supplied no awaited-step stack. The unchanged focused case then passed 1/1 in 2.6s, and `npm run test:ghosts-pref` passed 4/4 in 24.1s, including the same cross-tab case in 1.9s. The final complete-suite rerun also passed that case in 1.7s. This is not a demonstrated deterministic product defect, and its cause remains unproven. No timeout, assertion or product behavior was changed to accommodate it. The failed whole-suite log is retained as `shared/artifacts/full-e2e-first.log`; the clean complete rerun is `full-e2e.log`.

Registry unit cases use object-identity fakes. Browser tests run real React, route bundles, assets, Postgres and controls. The fake clock, blocked-storage fixtures and held network response are explicit test boundaries. The clock negative control proves host delay cannot advance frozen browser time. This run does not claim to have repeated the earlier unsafe-bundle mutant; the preserved delayed-module test checks the real safe executable directly. Static typecheck/lint results are not visitor behavior assertions.

## History and handoff limits

Task-manager coding history was read in two five-row pages each for FAILED (**10/88**) and COMPLETED (**10/1,198**), plus both current RUNNING tasks (**2/2**). These totals cover plan-manager coding jobs across repositories. A first query using project id `otohime` returned empty; the actual job project is `plan-manager`, so absence was not inferred. Terminal history is bounded/incomplete; older or truncated evidence is inconclusive. Raw tails were read for the prior failed task and completed red-gate task `b2e9f86a-f006-4dfc-aaab-f7d29139a9e8`; that red gate passed the unmodified baseline and did not launch an agent. It cannot disprove the intermittent hydration defect. History ids and counts are saved in `shared/artifacts/history.json`.

Run identity from the persisted run: **codex-sol-6-1-high**, model **gpt-6.1-sol**, effort **high**, fleet worker **billie-mac**, attempt **3**. This receipt changes no executable relative to the tested rescued commit. Local execution is demonstrated. Exact-delivery CI, deployment and independent product acceptance remain pending with plan-manager's green gate and QA for **t-1678**. No runtime queue, unavailable capacity or operator action is involved. The successor must fail on any required check failure, React #418/pageerror, duplicate/missing overlay, heading/TitleMorph/Stamp regression, or absent exact-delivery deployment. Per the explicit SWE contract, this run stops after pushing and submitting its summary; it does not monitor CI or probe the deployed system.
