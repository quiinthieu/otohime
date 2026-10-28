# t-1620: crumple accessibility regression repair

Run `run-9342`; work branch `pm-279-t-1620-crumple-run-9342`, freshly fetched base `c532e4e`. Actual platform profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, reasoning effort `high`, from this run's `profile_flags`.

During verification, freshly fetched main advanced to `f4b3de8`; the task branch was fast-forwarded with all task edits preserved. The inherited changes are unused fortune helpers, their unit tests, a footer unit fixture and sibling evidence. Source search confirms no fortune imports in `app/` or `components/`; application code, E2E files, package/lock and build configuration are unchanged. Thus the production executable fingerprint remains the same. Full unit/type/lint checks run on the updated branch.

A final fetch advanced main to `b5fa423`, adding only the sibling Pachinko QA report. The branch was fast-forwarded again; no executable or test changed. No rebase, history rewrite or force push was needed during preparation.

## Change and positive assertions

The delivered notes implementation at `a6297cb` is retained without modification. All three original titles, dates and bodies, stable slugs, editorial tags, strict lookup, linked list and detail routes remain. Their source, package, lock and configuration hashes match the earlier delivery report. No chart, new content, product markup, dependencies, CI or deploy configuration changes are included.

Fresh main already contains sibling commit `5cd648d`, which replaced the incorrect decorative `innerText` lookup with semantic source text. This repair strengthens the same test: it retains a CSS locator scoped to the original card, requires an initially nonempty accessible link name, and compares its accessibility snapshot before folding, while folded and after focus restores the source. It explicitly checks that the same link is `document.activeElement` after restoration. Existing real Canvas, source geometry, keyboard, pointer and recovery assertions remain enabled.

Two named mutation negative controls call the same assertion: hiding the note link from the accessibility tree must reject with the name/destination assertion; blurring it must reject with the restored-focus assertion. Each mutation is restored in `finally`, then the real positive assertion runs again.

The first targeted production run passed 10 of 11 tests, exposing a new test assumption: the existing project Peek preview adds `aria-expanded=true` on keyboard focus (`components/peek-layer.tsx`, `request` and `onFocusIn`). Raw snapshots differed only by `[expanded]`. The final comparator excludes only that legitimate disclosure annotation; role, name, destination and child content remain compared. Product behavior was not altered. A lesson and the approach decisions were recorded in plan-manager.

The first full E2E run passed 248 of 249 tests with no skips. Its sole failure was an unchanged Ink Lab test (`e2e/ink-lab.test.ts:125`): a single correct SVG update took 140 ms against the 100 ms input bound. The exact named test passed unchanged in isolation via the same production runner (1 passed, 0 failed). The full suite was rerun unchanged; both attempts are retained in this report. No timing limit or other test was relaxed.

The existing registered notes unit tests make concrete assertions:

- `each original note has a stable address and retains its exact copy`: compares all published title/date/body/slug values with the originals.
- `published slugs are unique URL segments and each resolves to its own note`: checks syntax, uniqueness and identity.
- `an unknown or near-match slug cannot open a different note`: rejects missing, partial, title, uppercase, slash, whitespace, prototype and reserved values.
- `editorial tags describe the text and share the data-engineering topic`: checks nonempty unique tags, syntax and intended shared topics.

The red-gate feedback about `expect=exit0` is addressed by these named behavioral assertions and the real production E2E checks, including the two negative controls. Typecheck and lint remain static analyzers: zero compiler diagnostics and zero lint errors are their defined results, not behavioral proof. A decision records why inventing named behavioral tests for those tools would misrepresent their purpose.

## Environment and evidence boundaries

`npm ci` installed 517 packages from the unchanged lock. Node `22.23.3`; Next `16.4.2`; React/React DOM `19.3.0`; playwright-core `1.64.0`. Real imports of Next, React, React DOM, Playwright and embedded-postgres succeeded. The repository runner constructed real embedded Postgres, applied migrations, and built with `npm run build`, including lifecycle prebuild. Build ID: `sfulplxuFSH4cGXfReLc6`. Subsequent runs use `SKIP_BUILD=1` to exercise this identical production build through `scripts/e2e.mjs`; no tests are omitted by that flag. Prebuild's task-generated `content/history.json` change was restored to its original bytes and is excluded from delivery.

Real execution: local production Next, Chrome, Postgres and the crumple Canvas renderer. The E2E runner's existing Ghosts service is fake; unit subprocess/workflow fixtures prove their stated integration contracts only. No fake proves production delivery. Required Next testing and Link guidance in the installed package was read. The chief-of-staff document, `docs/claude/software-development.md`, and both QA fix-plan files are absent on freshly fetched main; the supplied fix-plan contents and repository/task instructions were followed. No knowledge graph tool is available.

There is no queued runtime/model executable or ingestion callback in this test-only change, so paginated runtime job history does not apply. Supplied QA history identifies deterministic CI failures 540/541 against earlier code; it is not independent current-run evidence. Broader CI history was not read, and no completeness is claimed. This SWE run stops at push and does not monitor pipelines or inspect a deployed system.

Local execution is demonstrated by the checks below. Integration deployed and independently accepted product delivery remain unproven. Deferred `pm-279/t-1620:green-gate` belongs to plan-manager and fails if the delivered commit fails CI. Deferred `pm-279/t-1620:deployed-qa` belongs to quality engineer via plan-manager and fails if the deployed SHA lacks the notes implementation/fix or public note copy, links, tags, list usability or unknown-slug behavior violates acceptance. No capacity deferral or operator prerequisite is used.

The single delivery commit contains this report and the run artifacts. `artifacts/run-9342/commits.txt` identifies it symbolically; its full immutable SHA and push receipts are recorded in the plan-manager summary after commit creation, avoiding a self-referential commit hash.

## Completed verification

All commands run from the repository root. The full E2E command is the package entrypoint used by CI, through the real `scripts/e2e.mjs` runner against production `next start`.

| Command | Observed result |
| --- | --- |
| `npm ci` | 517 packages installed from unchanged lock |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/crumple.test.ts` | Production build passed; initial raw-snapshot assertion exposed the expected Peek state (10 pass, 1 fail), then was corrected |
| `SKIP_BUILD=1 node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/crumple.test.ts` | 13 passed, 0 failed, 0 skipped, including both mutation negative controls |
| `SKIP_BUILD=1 npm run test:e2e` | First: 248 pass, 1 timing failure; final unchanged rerun: **249 passed, 0 failed, 0 skipped**, 638,788 ms |
| `SKIP_BUILD=1 node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test --test-name-pattern='withheld animation frames' e2e/ink-lab.test.ts` | Between full runs: 1 passed, 0 failed; full rerun also passes this unchanged timing test |
| `SKIP_BUILD=1 node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test projects/otohime-dev-two-new-experiments-1-ink-assembly-line-work-pag/t-1620/artifacts/verify-notes.mjs` | Passed all three notes in desktop, phone/reduced-motion and no-JavaScript profiles; original copy/date/tags, links/direct URLs/back links, metadata and paper ids. Unknown `missing-note`/`constructor`: no article and noindex, JS lost-page UI, no-JS 404 empty shell |
| `PATH=/tmp/pm-279-t-1620-tools/coreutils-9.7/src:$PATH npm test` | **2,627 passed, 0 failed, 0 skipped**, including all four named notes tests; 39,845 ms |
| `npm run typecheck` | Route types generated; TypeScript completed with zero diagnostics |
| `npm run lint` | Zero errors; 10 existing warnings outside this change |
| `git diff --check` | Passed |
| `bash scripts/setup-owner-git.sh --check` and Git identity inspection | Otohime author and committer, `quiinthieu@gmail.com`; no coauthor trailer |

Local attempt history is complete for this run: two targeted crumple attempts, two full E2E attempts, one isolated Ink Lab reproduction, one three-profile notes probe, and one full unit/type/lint sequence. Full logs were retained outside Git during execution; the committed curated verification artifact records every result without ephemeral authentication URLs or generated build output. Browser evidence identifies Chrome `156.0.8078.48` and build `sfulplxuFSH4cGXfReLc6`. See `artifacts/run-9342/fingerprints.json` for the final test, notes, lock and configuration SHA-256 values.
