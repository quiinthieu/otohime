# t-1620 QA — run-9367

**Verdict: pass.** Delivery `657f0474b5fc9ee4030054f43069f43045086f82` passed plan-manager green gate `ver-3718`. GitHub Actions run 548 (`40653759734`) completed its `checks` job `122699755793` and `production` job `122707123311` successfully. The final live `/api/health` and independent browser walkthrough both observed deployed `7d2a49923ebaa4b709e954442729bb0c5617b8f9`; `git merge-base --is-ancestor 657f047 7d2a499` exited 0. This closes the prior run's queued-deployment blocker. Run 556 for the earlier served descendant `7ba2e80` also completed successfully; later CI results were not claimed after the public API returned 403.

## Independent product check

- Real Chrome 156 on public `https://otohime.dev`, mobile 390×844 with reduced motion: `/notes` exposed exactly three paper note cards. Each title had one accessible link to its stable slug. Clicking each link opened the matching note, with the exact original body, editorial tags and a working return link. The check used the source span within the active article, because decorative Riso plates duplicate visible heading text and view transitions temporarily retain the old article.
- A separate no-JavaScript browser found all three title links on `/notes`; the chart is not needed to use the list.
- Negative control: `/notes/not-a-real-note-9367` returned HTTP 404, no note article, visible lost-page heading and `noindex`.
- `git diff 43b3f78^ 43b3f78 -- content/site.ts` shows the three existing date/title/body values were preserved while slugs and tags were added. Exact-slug lookup and `notFound()` are present in the delivered route. The note content, route, `e2e/crumple.test.ts`, lock, E2E entrypoint and Next config have no diff from delivery `657f047` to deployed `7d2a499`. `package.json` added an unrelated Ghosts unit-test glob at `4a1c848`; `.github/workflows/ci.yml` expanded a guestbook author guard at `88ac8b2`. These are separate build/CI fingerprints, checked by the later green runs and local suites; neither reintroduced the old crumple assertion. SHA-256: crumple test `03202295aea76b5088e58325e8c570b2bc474ce2ead69037b1eac821163df214`, lock `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`.

## Local gates and boundaries

| Gate | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Pass; 522 locked packages installed |
| `TMPDIR=/tmp npm run test:e2e -- --test e2e/crumple.test.ts` | Pass, full 249/249 via the package's glob; production build `LzdhN8gkaNBMCRNH7CbO1` |
| `TMPDIR=/tmp SKIP_BUILD=1 node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/crumple.test.ts` | Pass, focused 13/13 on that build; accessible-name-loss and focus-loss negative controls passed |
| `npm test`; `npm run typecheck`; `npm run lint` | Pass, 2637/2637 units; typecheck clean; lint zero errors and ten existing warnings |
| After fast-forwarding to `fb17af7` with new shared tactile code: `TMPDIR=/tmp npm run test:e2e`; `npm test`; `npm run typecheck`; `npm run lint` | Pass, production build `cb8gcow4spR7sewpD8sNb`, 254/254 E2E, 2640/2640 units, clean typecheck, zero lint errors and ten warnings. A later fast-forward to `cc71504` changed only unrelated plan documents. |

The E2E entrypoint imported locked Next 16.4.2, React 19.3.0, Playwright Core 1.64.0 and embedded Postgres, applied real migrations, built and started real `next start`, and drove real Chrome. The Ghosts integration in this suite uses its explicit fake server; it is not proof of a hosted Ghosts backend. This static notes/test delivery has no model, processor, adapter, runtime queue, callback or persisted ingestion path. Local execution, deployed integration and public product behavior were each observed; no capacity wait or product check is deferred.

## History, identity and limits

The public CI run API was read in two bounded pages of 30: 60 of 560 rows at scan time, comprising 34 completed successes, 18 completed failures, two cancellations, two skips and four in progress. Older pages were unread, so the scan is incomplete. Runs 540 (`40645049226`, checks job `122671801451`) and 541 (`40645771046`, checks job `122674106471`) failed the older deterministic `e2e/crumple.test.ts:80` assertion (`0 !== 1`), visible on their public job pages. Authenticated raw log download returned HTTP 403; the public failure text and job step state were inspected instead. The changed test fingerprint in `657f047` passes both focused and full real-browser suites; pending newer jobs do not erase those older failures, and those older failures do not match the delivered test fingerprint. No external job history, raw runner tail or callback applies to the static notes route beyond CI; no such product execution is claimed.

Commits `43b3f78`, `a6297cb` and `657f047` have author and committer `Otohime <quiinthieu@gmail.com>` and no `Co-Authored-By` trailer. There is no `author.txt` in this delivery. Recorded QA run profile: `codex-sol-medium`, model `gpt-6-sol`, effort `medium` (`plan_manager_get_run(run-9367)`); this is not inferred from current defaults. The requested chief-of-staff guide, `docs/claude/software-development.md` and prior fix-plan paths were absent in this checkout; the installed Next dynamic-route and view-transition guides and current source were read. No codebase knowledge-graph tool was available.

**States:** integration deployed at `7d2a499`; locked local execution demonstrated; required public product delivered for t-1620. No observed defect or required deferred check remains for this task. CI for the QA report commit itself is routine follow-up owned by GitHub Actions; it fails if checks turn red, and its result is not represented as already known here.
