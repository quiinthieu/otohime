# t-1766 QA — run-9742

Verdict: **fail**, cause **environment**. The delivered executable passes local verification, but required product delivery is not observed on production. This is not an authority/reconciliation failure. No application source was changed.

Delivery SHA: **ec7e171e1ae5fc68e0a68e133ded9ea145c611a6**. QA branch started at freshly fetched main **1e382390cfd1db4a589c2b3cc92f4016bfc8cec1**; the ordered task code/lock/config/test fingerprint is identical to the delivery. The supplied and independently read plan-manager verification run **run-9739**, native task **e3c4e495-167a-4567-94ac-b4e7eb407873**, passed the green gate for ec7e171. That does not establish deployment.

## Deployed result and CI comparison

Initial real GET https://otohime.dev/api/health returned HTTP 200, ok=true, SHA **42faf51dc901e0e9faa0d80115587778a63a8db3**. The independent browser walkthrough later received **377dfe09193ff6d0aa3ab4fd02d339749485a19e** and found **zero Susuki canvases on both / and /projects**, with no page errors. The final cache-busted health read at approximately **2026-10-29T04:38:23Z** still returned 377dfe0. Both deployed observations precede ec7e171; `git merge-base --is-ancestor ec7e171 <deployed-sha>` fails. Neither older production is accepted as this delivery.

[Delivery CI run 40817421327](https://github.com/quiinthieu/otohime/actions/runs/40817421327), checks job **123261664083**, remained executing at inspection. Its native job API showed successful install, lint, types, units and build, followed by the larger E2E stage. Production was not yet a completed deployment for this SHA. Main successor **1e38239**, run **40817663407**, was also in progress in the initial snapshot. No pipeline was polled or awaited.

Before selecting environment, compared this running checks job with the last green same-workflow run **40815103116** at 42faf51 (checks job **123254210190**, production **123260603754**). The public run was completed/success and initially matched live production. `git log 42faf51..ec7e171 -- .github/workflows/ci.yml scripts/e2e.mjs scripts/vercel-deploy.sh scripts/verify-deploy.sh` is empty: no intervening CI/deploy configuration change. Workflow SHA-256 is **944d94fd8dcae37cd3cb713d2af55b90d0e9e50d608b87d86e8bd87d2e09e53a**. The observed environment defect is the production delivery gap, not an invented runner crash or an assertion that the progressing job failed.

Also read actual failed run **40812600516**, checks **123246190922**, at 672b289. Its public annotation preserves a bounded raw 80-line command/server tail: **267 tests, 266 pass, 1 fail**, asynchronous `response.text: Target page, context or browser has been closed` from **e2e/tactile-tear.test.ts:12** after its hook ended. Last preceding green **40812311883** at 6420027 (checks **123245269110**) succeeded. CI configuration log/diff between those SHAs is empty. This older executable lacks the Susuki implementation and is not evidence of a current Susuki regression. The underlying tactile history is not waived or classified as environment by this report.

## Fresh verification

`npm ci` installed the unchanged lock; `npm ls --depth=0` succeeded. Node **22.23.3**, npm **10.9.9**, Next **16.4.2**, React **19.3.0**, Playwright Core **1.64.0**, embedded-postgres **17.10.0-beta.17**, real Chrome **156.0.8078.73**. Installed Next server/client and lazy-loading guides were read. There is no available code graph tool; relevant source was inspected directly. The requested chief-of-staff and software-development documents are absent.

| Command | Result |
| --- | --- |
| Required e2e.mjs invocation with e2e/susuki.test.ts and e2e/bottle-ui.test.ts | **21/21**, zero failed/skipped, fresh production build/start and real migrated embedded Postgres |
| TMPDIR=/tmp npm test | **2,785/2,785**, zero failed/skipped |
| npm run typecheck | pass |
| npm run lint | pass; 13 existing warnings, zero errors |
| TMPDIR=/tmp node scripts/check-gate-closure.mjs | local_controls=pass, failures=[]; external_evidence=inconclusive |
| SKIP_BUILD=1 TMPDIR=/tmp bash scripts/walk-end.sh | **67 ok**, zero failed |
| CI=1 SKIP_BUILD=1 TMPDIR=/tmp bash scripts/probe-end.sh | **177 ok**, zero failed, no page/console/hydration errors |
| New independent qa-probe-run-9742.mjs, both local routes | pass; real framebuffer/input/navigation |
| New independent probe, production | fail; missing canvas on both routes at pre-delivery SHA |

The delivered browser suite demonstrated **214,242** initial ink pixels; static reduced-motion and Save-Data each rendered **214,176** pixels in one draw with zero ambient rAF; Canvas2D fallback rendered **75,838** pixels with zero GL calls/rAF. Actual shader uniforms, same-draw fox instance/cancellation, native touch/session behavior, real context loss/restoration, four seasons/themes, aria exclusion, clickable links/Bottle/mascot, five SVGs, last waterline and zero geometry shift all passed.

Independent proof is in [qa-probe-run-9742.mjs](qa-probe-run-9742.mjs) and [qa-evidence-run-9742.json](qa-evidence-run-9742.json). It holds only the wind-time uniform constant, requests preserveDrawingBuffer, then uses actual native mouse input and reads actual GL pixels. On / it observed **165,273** ink pixels and **266,879** changed framebuffer bytes; on /projects **165,272** pixels and **245,730** changed bytes. Actual pointer uniforms converged to approximately (0.53, 0.78); all four shader tints differed; clicking the real footer anchor navigated to /work. **Negative control:** clearing the real framebuffer yielded exactly zero nonzero bytes before navigation. No fake GL, rasterizer or processor was used.

An initial independent-local attempt reused the footer probe's server; the probe completed and removed that server during the second navigation. Another attempt started Next without a DB and health correctly returned 500/ECONNREFUSED. Both QA setup failures are retained. The final independent run used a separately owned Next server and real migrated Postgres, health 200, and passed both routes. These are not concealed product failures.

## Executable and identity

Fresh build ID **R3_NOQqGfWvq2mAr0SzHq**; its health SHA is **dev**, so local identity is explicitly bound by checked-out Git SHA, source hashes and emitted artifact, rather than misrepresented as a deployed commit. Ordered task fingerprint **d469a1021086e1fe1d017447f2188fb56374d7767cfaf54e4429d321ab7a5737** exactly matches ec7e171 evidence. Lock SHA-256 **9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b**. Actual field chunk `.next/static/chunks/12qgltjgzy1gg.js`: **5ca02dfa389bb4c1055229019d254b2dc447eff5ad2dd7e5735319091ec1ff16**. Source contains the shaders and baked fox atlas; there are no fetched model/image assets to assume present.

Real execution includes Next imports/build/start, GL program/shader/buffer/texture construction, linking, instancing/readPixels, native input, WEBGL_lose_context, and embedded DB migrations. Fixtures are explicitly reduced-motion emulation, Save-Data/no-WebGL capability overrides, document.hidden events, and the independent wind-time/preserved-buffer controls. Existing Ghosts fake/Bottle network fixtures do not establish external service behavior.

Git independently identifies delivery commits 1962971, 766603b and ec7e171 as **Otohime <quiinthieu@gmail.com>**, with no Co-Authored-By trailer. SWE task e3050401-3675-4cbe-a2de-88c807a38c56 advertises **author.txt**, **44 bytes**, SHA-256 **7694250f32f87a6fd29a61b3171d13b30e854a830dbfe458ae56151101cd5ada**. Its actual bytes were unavailable: direct cluster HTTP timed out, public candidate artifact paths returned 404, Kubernetes port-forward was forbidden and service proxy required authentication. **Artifact-byte agreement remains inconclusive**, not a claimed match or invented download. Next QA must read that artifact in addition to Git metadata.

Actual board-recorded profile for this QA and SWE run-9726: **codex-sol-6-1-high**, **gpt-6.1-sol**, effort **high**, fleet **avietidol-mac-mini**. Verification run-9739 is shell with no LLM profile. The current QA record also shows an earlier worker_error release before this fleet execution; it is not attributed to the implementation.

## History, ingestion and continuation

[qa-platform-run-9742.json](qa-platform-run-9742.json) retains sanitized native evidence. Task-manager history scan: project plan-manager, coding_task, two pages per status, limit 20, offsets **0 and 20**; **40 FAILED of 140**, **40 COMPLETED of 1,026**. Global history is incomplete. The unpaginated plan list returned **21 runs**, including all **six t-1766 runs**: two failed SWE publications, two completed SWE records (one vacuous preflight), completed green verification and current QA.

Read native details and raw tails for all six. run-9680's complete **29 lines** say red_gate_already_green and no agent start; not feature proof. run-9686 tail **1,060 lines** omits **2,942** earlier lines and confirms push_not_on_main at 3726e97. run-9696 tail **940 lines** omits **3,062** and confirms repeated non-fast-forward publication at f3635e5. run-9726 tail **1,009 lines** omits **2,993** and confirms successful main/task publication at ec7e171. run-9739's complete **45 runner lines** identify detached checkout ec7e171 and verification execution; the supplied gate and artifact manifest bind its passing checks. Every finished native task has callbackState=delivered, one callback attempt; corresponding persisted plan runs agree and callback_apply_failures=0. Payload internals and all omitted raw assertions remain unread/inconclusive.

GitHub scan read the newest **20 unfiltered** run rows (total **604**) and the first **20 completed** rows. Additional status/pages hit anonymous HTTP 403 rate limits. The failure-filter UI supplied 20 run IDs, and the actual relevant failed job/annotations and last-green pages were read. This is bounded evidence, not complete remote CI history. Known older failures are retained separately from current fingerprint results.

No current deterministic local Susuki defect was observed. **Integration published: yes; integration deployed: no at observation; execution demonstrated: yes locally; waiting for runtime capacity: no; product delivered: no.** The external CI/deploy stages remain unproven. No queued job, fake or future event is accepted as product output.

Deferred checks (owner **plan-manager deployment continuation / quality_engineer**):

- **t-1766/deployed-ec7e171**, CI **40817421327**, successor **40817663407**: resume once production serves ec7e171 or a descendant. Fail if live ancestry excludes ec7e171 or any deployed Susuki/Bottle/walk/probe assertion fails. Read current native terminal jobs first; a cancelled/superseded deployment requires an on-demand main workflow dispatch, not waiting for a clock.
- **t-1766/author-artifact-e3050401**: obtain the exact 44 author.txt bytes and compare owner identity/trailers; any different identity or trailer fails.
- **t-1766/history-completeness**: authenticated CI pagination/full raw artifacts and callback payload ingestion remain incomplete. Do not claim full-history cleanliness from this bounded scan.
- **run-9742/final-callback**: platform owns post-exit callback persistence; failure is a missing/failed report application. It cannot be proved from inside the still-running agent.

The QA probe, reports and sanitized evidence are the only repository changes. Build-generated content/history.json was restored with the contract's authorized command. No source repair, default-branch push, polling loop, operator chore or speculative CI fix was performed. Decisions and a production-SHA lesson were recorded before report submission.
