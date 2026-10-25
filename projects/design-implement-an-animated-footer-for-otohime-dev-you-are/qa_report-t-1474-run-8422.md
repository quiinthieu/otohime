# QA report — pm-241 / t-1474 / run-8422

**Verdict: fail. Cause: code.** The previous streamed-denial React #419 defect is repaired, and all eight local contract suites pass. However, the delivered browser probe fails twice against production: it attributes the existing Music television's advertising requests to the footer, and its achievement check reports an invisible badge despite unlocked state. These are verification defects requiring correction; green CI does not waive them. No application source was edited by QA.

## Identities and gates

- Delivery: **96120648889ec448fe0ebe380093bff29e9d3593**. Exact checkout on `pm-241/t-1474-qa-run-8422`, installed with `npm ci` before testing.
- Deployed and independently walked: **ced64c1f59210ba8310d4110651c8232bfe0f2ac** at https://otohime.dev. `git merge-base --is-ancestor 9612064 ced64c1` exits 0.
- Green gate: **ver-3353**, `run-8411`, delivery `9612064`, eight passing verification items. Obtained from the board independently of the supplied summary.
- Delivery CI [40230128313](https://github.com/quiinthieu/otohime/actions/runs/40230128313): checks **121279858534** and production **121281179917** succeeded, including signed-in motion and footer steps.
- Deployed CI [40231812986](https://github.com/quiinthieu/otohime/actions/runs/40231812986): checks **121286821133** and production **121288264646** succeeded. Step outcomes were read directly from GitHub's public API.
- Local build ID: `Hrw7Gu0O8mKRuWoZawSIj`; build-time SHA was the full delivery SHA, not a placeholder. Node **22.23.3**, npm **10.9.9**, Next **16.4.2**, Darwin arm64; temporary Playwright **1.64.0**, real Chromium **156.0.8078.4**.
- Recorded QA run profile: **codex-sol-6-1-high**, **gpt-6.1-sol**, explicit effort **high**, fleet task **6efaf5d1-5261-48a9-9785-0f34208bd432**, worker **avietidol-mac-mini**, account **codex-main**. SWE `run-8400` is recorded as **agy-argon-high**, **gemini-4-argon-high**, fleet worker **avietidol-z490**, account **billie-agy**; profile metadata says high effort, while its recorded CLI flags have no separate effort option. Verify `run-8411` is a shell runner, not that model. Earlier prose summaries misidentify several task/run correlations; the saved run rows are authoritative.

Git independently shows delivery author and committer **Otohime <quiinthieu@gmail.com>**, with no Co-Authored-By trailer. SWE task **2ed652b4-6a2e-43df-b497-390dd0c1a90e** lists `author.txt`, 44 bytes, SHA-256 `7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada`. Artifact download returned 403: its bytes remain unread and are not claimed verified. Git identity passes; artifact-byte identity is an explicit evidence limit.

## Fingerprint and source review

Delivery and deployed descendant have identical footer components/reducer, page routes, probe executables, package lock, CI configuration, and changed RolesPage/Forbidden files. Full stylesheet/content files differ because later plans added pocket-game and gallery styles/copy; the footer rules and `site.end` are unchanged. These differences were inspected, not hidden behind an unrelated newer SHA.

SHA-256 examples (full inventory in the evidence JSON):

| File | SHA-256 |
| --- | --- |
| package-lock.json | 9005913dc28933faba4649e30c1b4b45b3ae5c049a6b0110ef1a068997e0ad10 |
| .github/workflows/ci.yml | 23410d8f1209cceb0959e871e583551118d2430640a3d5f9bf101187de856dfa |
| scripts/probe-end.mjs | 56529d4a44b4935c62fd926409674a68b52d889928310b4377c2203f034e73b8 |
| scripts/probe-end.sh | 53fcee4c8e6f3df1049658b18d7c161554eb14622b0099cf603342b3f6d21288 |
| components/end-stage.tsx | c423208e47eebea1fdf0821ad9b7bf32df0cc9edc0f3024c9e78b72e82537255 |

Read actual AGENTS.md, installed forbidden function/file and loading/streaming guides, footer source, authorization predicate, group layouts, README and checks workflow. The referenced extraction document and `docs/claude/software-development.md` remain absent. Source retains native navigation, cached UTC year, per-scene accents/wobble, separate visibility/reveal state, bounded pointer rAF, short press ticks, storage exception handling and reduced-motion subscription. Ambient SVG layers are outside the filter. CI runs walk and probe against its own production server, preserving deployment/migration semantics. The concept is a tiny paper save point using the site's familiar handheld, signpost, sparse sky and numbered links.

## Executed checks

All local commands ran against the exact delivery build. `EXPECT_SHA` was set for footer checks; `TMPDIR` was deliberately unset for both shell entrypoints.

| Check | Result |
| --- | --- |
| npm test | 1538 pass, 0 fail |
| npm run lint | exit 0; 9 existing unused-disable warnings |
| npm run typecheck | exit 0 |
| npm run build | exit 0; 182 static pages |
| SKIP_BUILD=1 PORT=4081 bash scripts/walk-end.sh | 67 ok, 0 failed |
| SKIP_BUILD=1 PORT=4083 bash scripts/probe-end.sh | 166 ok, 0 failed |
| SKIP_BUILD=1 bash scripts/probe-motion.sh | 510 ok, 0 failed |
| SKIP_BUILD=1 APP_PORT=4085 bash scripts/e2e-local.sh | 28 pass, 0 fail |
| Extra: SKIP_BUILD=1 PORT=4093 bash scripts/probe-motion-signed-in.sh | 356 ok, 0 failed |
| Stable deployed walk, EXPECT_SHA=ced64c1… | 65 ok, 0 failed; two local cleanup/log checks intentionally absent |
| Stable deployed probe, EXPECT_SHA=ced64c1… | **161 ok, 2 failed**, exit 1 |

The browser matrix covered all seven public pages, isolated project/auth/404 roots, desktop 1366×768, tablet 768×1024, touch 390×844, themes, all five accents, real LCD bounds through the tenth poke and achievement, displacement values, focus order, no-JS, storage denial, reduced motion, visibility, layout stability and ambient efficiency. Local href corruption failed the same canonical-link assertion, and reload restored its pass. Live stable-run layout and runtime-error checks pass; the two exceptions below remain failures.

The first live run crossed an actual deployment from `1f7490b36849aa2bdbcf8d12c61133a5429a814b` to `ced64c1…`: independent SHA matching rejected it after ten observations. That probe ended 159/4, including a stale CSS-chunk 404 and restore geometry failure. Those rollout-contaminated observations are not counted as a stable-build pass or used to diagnose the new build. A full fresh walk/probe/walkthrough was driven at ced64c1; the network and badge failures repeated there without console/page errors.

## Independent user-path evidence

The saved QA drivers import no author-supplied probe helpers. Screenshots were reviewed locally and kept outside git; textual observations and screenshot hashes are saved.

| Starting state | Action | Observable result / evidence |
| --- | --- | --- |
| Home, exact local build; fresh browser | Footer Work → footer Projects | One visible main and footer, footer below main, canonical six routes/four contacts, no horizontal overflow |
| Locked achievement; focused temporary textarea, local browser only | Type real Konami keys | Remains locked; textarea contains `ba`, demonstrating preserved defaults; then in-view mascot sequence unlocks and persists |
| Restored badge | Activate reduced motion, then keyboard Back to top | Ambient active marker clears, eyes reset; scrollY ≤4 and `#main` receives focus |
| Music; six fresh viewport/theme contexts | All five accents; mobile keyboard disclosure and tap | Geometry remains contained, readout changes, touch eyes remain still; 30 accent observations |
| Projects, unfiltered timer/rAF instrumentation | Observe 700 ms after entry settles | No rAF or interval callback increase; no callback-source exclusions |
| Production ced64c1 | Same public path and matrix | **38 observations, zero page errors**; local version has 39 including editable negative control |
| Disposable migrated real Postgres; plain user; mobile reduced motion | Three cycles of full-load /admin/roles → Projects and full-load denial → Dashboard | **6/6** denial documents contain locked copy and noindex; zero `$RX` abort digests, zero page errors; every landing has one main/one footer. Streamed HTTP status remains 200, as before; access is denied |
| Production badge; three fresh contexts | Wrong sequence, overlapping correct uppercase sequence | Immediate opacity 0 with running 150 ms transition; cycle 3 still measured opacity 0.741712 after 250 ms (66.735 ms animation time), then bounded settling reached 0.992904. Original ≥0.99 assertion passes 3/3. Does not erase the full-probe failure |

Visual review: the miniature console and torn platform use consistent rough ink; desktop copy/navigation balance the scene; mobile stacks it coherently with readable wrapped copy and spaced contact chips. Light/dark screenshots show sufficient ink contrast and no intrinsic scene clipping. Tablet's tall-footer locator screenshot includes the sticky masthead overlay; this is a capture/scroll-position limitation, not evidence that the SVG bounds exceed its reserved scene. No physical-device GPU, Safari or Firefox claim is made.

## Defects

**D1 — Incorrect network attribution**, `scripts/probe-end.mjs:171–172` (verdict cause=code). Both live probes classify `googleads.g.doubleclick.net/pagead/id` and `static.doubleclick.net/instream/ad_status.js` as footer traffic. Independent request/frame inspection identifies the existing `https://www.youtube.com/embed/` child frame. In a fresh read-only browser control, allowing the player produces **3** such requests; aborting only `https://www.youtube.com/iframe_api` produces **0**, with the same one footer present in both contexts. The footer did not add these requests. The delivered check's whole-URL substring allowlist fails to model the existing player boundary. Do not repair this by disabling the television or broadly ignoring external traffic.

**D2 — Achievement visibility assertion races rendering**, `scripts/probe-end.mjs:1359–1385` (cause=code; precise timing mechanism not fully established). Both live probes return `stageUnlocked=true`, `badgeUnlocked=true`, correct LCD/readout/storage, no prevented keys and unchanged route, but `badgeVisible=false` after the fixed 250 ms delay. The independent targeted check reaches the original visible-opacity threshold in all three contexts; one cycle was still at opacity 0.741712 after 250 ms, proving the wall-clock sampling race. Preserve the visible-badge requirement; add bounded state/transition settling and diagnostics, then prove the full probe passes. If bounded settling fails, treat that as a product defect rather than weakening visibility checks.

## History, ingestion and limits

- Board run history: **14/14** rows, including this running QA; recorded callback-apply failures are zero. Saved rows establish actual profiles and task IDs.
- Task-manager project history: FAILED **51/51**, pages at offsets 0/30; no pm-241 tasks. COMPLETED **60/909**, offsets 0/30; older 849 unscanned and inconclusive. RUNNING **3/3**, PENDING **4/4**; no pending pm-241 execution. Counts are point-in-time, not a frozen global snapshot.
- Independently fetched SWE task `2ed652b4…`, prior QA `a9d3d5bc…` and verify `cffedbc9…`: each COMPLETED, callback `delivered`, one attempt, exit 0. Their persisted board rows and gate/report ingestion are present. Prior QA's raw runner tail records the #419 failure; the new real-DB reproduction proves its current disposition. An unrelated FAILED task `76a56c65-4853-4d14-a0c6-3aa2a28fcb27` reports argument-list-too-long and explicitly missing logs, not a clean run.
- GitHub history: two 20-row pages, **40 rows / 39 unique** of approximately **260** runs; one overlap because the feed advanced. Earlier history unscanned. Before delivery, run **40229676108** failed signed-in motion; after delivery, run **40230420183** failed footer checks, job **121281616994**. The latter shares the footer/lock/CI fingerprint but has unrelated app changes. Raw logs return 403, so its exact failure is inconclusive. No CI-config changes occur between those failed jobs and the corresponding observed green runs; no runner repair or environment exemption is asserted.
- GitHub raw logs for jobs **121281616994**, **121278496658**, **121279858534**, and run **40224228174** returned 403. Task artifact endpoints returned 403. Cluster log lookup for container `otohime` returned null; this cannot prove production runtime logs clean. Local probe/server logs and independent server log were read and report no runtime errors.

## Real/fake boundary and remaining work

Real: locked Next/pg/sharp imports, actual pg Client/Pool construction, Sharp in-memory PNG encoding, production prerender and servers, pinned Chromium, migrated disposable Postgres, HTTP/auth/SQL and browser interactions. Postgres image digest: `sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb`. No model weights or generated raster asset are involved. The existing TMPDIR unit cases use a temporary npm stub solely for environment/cleanup checks. The href/editable controls mutate isolated browser DOM; the player control aborts only that browser's request. No deployed content/accounts/infrastructure were mutated and no fake establishes product execution.

**Integration deployed:** yes. **Execution demonstrated:** all local suites and independent footer/403 paths. **Product delivered:** footer observed live, but QA acceptance withheld for D1/D2. **Waiting for capacity:** none.

| Deferred check / exact ID | Owner | Failure condition / next action |
| --- | --- | --- |
| D1/D2, t-1474 | Software engineer, then QA | Fix probe attribution/settling, keep negative assertions, rerun eight suites, signed-in probe and full read-only deployed probe; any nonzero exit remains failure |
| author.txt, task 2ed652b4-6a2e-43df-b497-390dd0c1a90e | Artifact access owner / subsequent QA | Retrieve bytes when accessible; reject mismatched owner identity or trailer |
| Raw CI jobs 121281616994 / 121278496658 / 121279858534 | GitHub evidence access owner | Logs inaccessible; do not claim failure cause or log cleanliness until read |
| Production logs, container otohime | Deployment/log access owner | Null query remains inconclusive; investigate an observed server error if evidence becomes available |
| Safari/Firefox, native hidden-tab lifecycle, physical GPU smoothness | Future browser/device QA | Not executed; retain as coverage limits |

QA artifacts: this report, same-run fix plan, four independent `.mjs` drivers, evidence JSON and bounded-history JSON. No screenshots, binaries, secrets, dependencies or application changes are committed. Save on the QA branch; do not alter the default branch to make a check pass.
