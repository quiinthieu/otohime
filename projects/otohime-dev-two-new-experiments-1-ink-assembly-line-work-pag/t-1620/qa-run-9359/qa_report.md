# t-1620 QA — run-9359

**Verdict: fail; cause: environment (production delivery state).** Delivery `657f0474b5fc9ee4030054f43069f43045086f82` passes green gate `ver-3718`, but the public `/api/health` reported `b5fa42372d98c8d3712d8b46cd6b6008727552ae` at the final check. `git merge-base --is-ancestor 657f047 b5fa423` is false. CI run 548 (`40653759734`) completed checks job `122699755793` successfully; production job `122707123311` is queued. The requested production deployment of the fix is unproven, so this cannot pass. The live site already contains the earlier notes feature; its working paths do not prove this fix was deployed.

## Independent outcome and boundaries

- Browser against `https://otohime.dev`, Chrome 156, mobile 390×844 with reduced motion: `/notes` exposes all three exact title links; each opens the matching slug, original body and editorial tags. Independent no-JavaScript browser: all three list links remain present. Negative controls: `/notes/constructor` renders no article and `noindex`; `/notes/missing-note` returns 404 with no article without JavaScript. These are independent of the SWE proof script.
- `git diff 43b3f78^ 43b3f78 -- content/site.ts` shows only slug/tag fields were added to the three original notes; title, date and body lines are unchanged. Current code uses exact slug lookup and `notFound()`. The three delivery commits `43b3f78`, `a6297cb`, `657f047` have Otohime author and committer `<quiinthieu@gmail.com>` and no Co-Authored-By trailer. No `author.txt` accompanies this delivery.
- Fresh `npm ci` installed the lock; real locked imports of Next 16.4.2, React 19.3.0, React DOM, Playwright Core 1.64.0 and embedded Postgres passed. `scripts/e2e.mjs` constructed real Postgres/migrations, built and started real Next production build `dkc7SLC00Rrbj-pSV6GZL`, and drove real Chrome/Canvas. Its Ghosts service is fake; that only proves the suite's integration paths, not hosted Ghosts or delivery. No model asset, processor queue, callback or persisted ingestion belongs to this static notes/test change.
- Actual QA run profile from `plan_manager_get_run(run-9359)`: `codex-sol-medium`, model `gpt-6-sol`, effort `medium`. SWE run-9342 was `codex-sol-6-1-high`, `gpt-6.1-sol`, effort `high`; this attribution comes from its recorded `profile_flags`.

## Gates and identity

| Gate | Result |
| --- | --- |
| `npm ci` | Pass, 522 installed packages |
| Production build via `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/crumple.test.ts` | Pass, 13/13, 0 skipped, including name-loss and focus-loss mutation controls |
| `SKIP_BUILD=1 npm run test:e2e` through the CI entrypoint | Pass, 249/249, 0 skipped, 584,410 ms, same production build |
| `npm test` | Pass, 2,627/2,627 |
| `npm run typecheck` | Pass, zero diagnostics |
| `npm run lint` | Pass, zero errors, ten pre-existing warnings |
| Plan-manager green gate `ver-3718`, SHA `657f047` | Pass: unit, typecheck, lint |

Current SHA-256 identity matches SWE run-9342 for `e2e/crumple.test.ts` (`03202295aea76b5088e58325e8c570b2bc474ce2ead69037b1eac821163df214`), `package-lock.json` (`9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`), `package.json`, `next.config.ts`, `content/site.ts` and all three notes route/lookup files. No model or generated artifact hash participates. Prebuild's regenerated `content/history.json` was restored to its original bytes and excluded from the commit.

## CI and deployment history

Two bounded pages of the public CI workflow index were read (runs 504–550, 47 unique rows after three overlapping rows): 26 completed success, 15 completed failure, five in progress and one pending at scan time. The index reported 550 total / 22 pages on page one and 553 total / 23 pages on page two as new pushes arrived. The other pages and authenticated full runner logs were unread; this scan is incomplete. Raw public checks annotations for runs 540 (`40645049226`, job `122671801451`) and 541 (`40645771046`, job `122674106471`) both show `e2e/crumple.test.ts:80`, `0 !== 1`; they used the old test fingerprint. The new test has stable locator/accessibility snapshot and explicit restored focus; the targeted and full real E2E now pass. The old deterministic failure is not attributed to the changed executable.

Baseline green completed CI run 544 (`40649996558`, SHA `c532e4e`) had successful checks job `122687584073` and production job `122694644371`. The later green run 546 (`40651936749`, SHA `f4b3de8`) had successful production job `122700343858`. `git log f4b3de8..657f047 -- .github/workflows/ci.yml` is empty: no CI configuration commit separates that last green production job from the requested fix. Successful run 546 deployed `f4b3de8`; subsequent successful run 545 production job `122701126605` served older `63c36af`, as public health showed. At the final check health had advanced to `b5fa423`, still an ancestor of delivery. This out-of-order serving and the queued 548 production stage are delivery-environment evidence, not a notes source defect. No successful production job or served SHA containing `657f047` was observed.

**States:** integration committed on main and green-gate passed; local execution demonstrated; production deployment waiting on GitHub Actions production capacity; required deployed product delivery unproven. Deferred `40653759734/production/122707123311` is owned by GitHub Actions and fails if the production job ends red or is superseded without a descendant deployment. Deferred `pm-279/t-1620:deployed-ancestry` is owned by the delivery pipeline/next QA run and fails if `/api/health` still does not serve a descendant of `657f047` after a green production job. Capacity does not waive an observed regression; none was found in the changed notes/test executable. The separate deployment-order defect is addressed in the paired fix plan.

The requested chief-of-staff document and `docs/claude/software-development.md` are absent from this checkout. Installed Next 16 dynamic route and not-found guides were read. No knowledge graph tool was available, so source and commit history were inspected directly.
