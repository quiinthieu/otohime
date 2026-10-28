# t-1620: rescued delivery verification

Run: run-9321. Work branch: `pm-279-t-1620-delivery-run-9321`.
Profile from this run's platform record: `codex-sol-6-1-high`, model `gpt-6.1-sol`, reasoning effort `high`.

## Implementation retained

The runner restored implementation commit `43b3f78a2b460a14561e4ddfca8e3101df867c8f` on parent `8af6a178a484c2a747e481469e0abed3cb37dd89`, which matched freshly fetched origin/main. All eight rescued files were retained. No source was rewritten or dropped. The unrelated pm-256 QA paths listed in the request were outside this commit and had no working-tree changes; they remain unchanged.

The three original titles, dates and bodies are unchanged. Their stable slugs and editorial tags, exact lookup helper, linked readable list, metadata-bearing detail routes, back links and existing paper interactions pass verification. The notes test glob remains registered in the project suite. Source, test, package, lock and Next config SHA-256 values exactly match the executable fingerprints in report-run-9318.md; the rescue SHA change does not represent a different executable.

AGENTS.md and the plan were read. Both requested additional guidance paths are absent, as already recorded in the plan; repository search found no replacement. No knowledge graph tool is available. `npm ci` installed 517 packages from the unchanged lock. Installed Next routing, static params, metadata, notFound and View Transition guidance was read. Current pm-273, pm-275 and pm-276 contracts were checked; their CI/deploy files remain untouched. The package change only registers notes tests.

## Verification in this checkout

Environment: Node 22.23.3; real imports of Next 16.4.2, React/React DOM 19.3.0 and playwright-core 1.64.0 succeeded and matched package-lock.json.

| Check | Result |
| --- | --- |
| `PATH=/tmp/pm-279-t-1620-tools/coreutils-9.7/src:$PATH npm test` | exit 0; 2,617 passed, 0 failed, 0 skipped |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 10 existing warnings outside task code |
| `npm run build --ignore-scripts` | exit 0; all three note routes generated |
| Local production `artifacts/verify-notes.mjs` with `BASE_URL=http://localhost:4321` | exit 0; desktop, mobile/touch/reduced-motion and no-JavaScript profiles |
| `git diff --check origin/main HEAD` | exit 0 |
| `bash scripts/setup-owner-git.sh --check` | exit 0; Otohime author and committer verified |

GNU timeout 9.7, previously built outside the checkout, supplies the real executable required by existing CI shell fixture tests on this Mac. No fixture or assertion was disabled. The production build invokes the package's real Next build while omitting unrelated network/vendor content-generation lifecycle scripts. It used local placeholder Better Auth settings from the existing e2e convention, not credentials. Build ID: `WUfDPtYf1EtXVYGtdVer8`. No dependency, lock, generated content or binary changes were made.

The real local Next production server and Chrome exercised all three list links, keyboard Enter activation, direct URLs, back links, exact copy, metadata, tags and stable tossable paper identifiers. The list and all known note detail pages work without JavaScript. Negative controls `missing-note` and `constructor` show the existing lost-page heading and noindex with JavaScript; neither resolves to a note. Unit negative controls also reject empty/partial/title/uppercase/trailing-slash/whitespace/prototype and reserved `sky` values.

Existing framework limitation remains explicit: an unknown dynamic slug can initially stream HTTP 200 before its not-found result is cached as 404. Without JavaScript it returns 404/noindex with the existing empty Next error shell. This task does not claim a visible no-JavaScript unknown-note fallback or expand into shared root routing changes.

## Delivery repair and evidence boundary

The previous run pushed its topic branch successfully but the runner rejected it with `push_not_on_main: HEAD 0b137f23e07f is not on origin/main`. This is the actual failure being repaired. New evidence is committed on the work branch, preserving the already rescued implementation commit rather than amending/rebasing it. Local main will be fast-forwarded to the verified delivery and pushed normally using `git push origin HEAD`. The pushed SHA and push receipt belong to this run's plan-manager summary; `artifacts/commits.txt` records the retained implementation commit. The extra evidence commit is necessary to save this run's verification without rewriting rescued history.

Real/fake boundary: real locked package imports, production build, local server and Chrome; existing unit fixtures use synthetic inputs and subprocess stubs and prove only their stated behaviors. No fake executable proves deployment. No durable runtime queue, callback, model output or paginated runtime execution history applies to this static notes task. Prior run failure/report and current verification were inspected; broader CI history was not inspected and its completeness is not asserted.

Local execution is demonstrated. Integration deployed and independently accepted product delivery remain unproven. CI is not monitored and deployed systems are not checked under the stop-at-push contract. Deferred check `pm-279/t-1620:green-gate` is owned by plan-manager and fails if any required gate fails at the delivered commit. Deferred check `pm-279/t-1620:deployed-qa` is owned by the quality engineer via plan-manager and fails if deployed note copy, links, tags, list usability or not-found behavior violates acceptance. Neither local passing checks nor a successful push substitutes for those checks.

A platform lesson records that topic-branch push success does not satisfy this runner's required origin/main reachability. No operator action, idle wait or CI/deploy change is needed.
