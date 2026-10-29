# Independent Ink Shelf QA — run-9707

Plan **pm-299**, task **t-1767**, 2026-10-29. Delivery under review: **6420027666a19d7b4b5428c631329fd3b8aff3d4**. The board's independently queried green gate **ver-3859**, run **run-9705**, passes both contract commands at `6420027`.

## Disposition

**PASS**, cited deployed commit **6420027666a19d7b4b5428c631329fd3b8aff3d4**, identical to the delivery. `git merge-base --is-ancestor 6420027666a19d7b4b5428c631329fd3b8aff3d4 6420027666a19d7b4b5428c631329fd3b8aff3d4` exits 0. Direct `/api/health` before and after the final independent production walkthrough returns that same SHA with `ok: true`.

[Native CI run 40812311883](https://github.com/quiinthieu/otohime/actions/runs/40812311883) is green: checks job **123245269110** and production job **123253006082** both completed successfully, independently observed through the public workflow page. The production job's actual locked install, build, migrations and deploy/served-SHA verification passed; the latter finished at **03:55:59 UTC**. The final deployed walkthrough, including the negative controls and client artifact capture, passes.

**Integration deployed: yes. Waiting for capacity: no. Execution demonstrated: yes, with real locked runtime/browser/GPU. Task 3 product delivered: yes.** No task-scope defect or required Task 3 check remains deferred. Wider platform history, private GitHub raw logs, separate root author-artifact bytes and whole-site CLS remain unproven within the stated evidence boundaries; none is silently certified by this scoped verdict. No fix plan is required for a pass.

The final captured shelf client artifact is `/_next/static/chunks/36ay6ond8xv5m.js`, **2,695 bytes**, SHA-256 **92438ad2c0d956878f54a435a21ec68d342468665a4a8de268e8201c8de02422**. The captured SSR response is **156,447 bytes**, SHA-256 **a744881e0332f893c543cbf89dbcb130431886bf16be97ef65ce9a0de85c24fd**; that response hash identifies this observation, not a claim that streamed HTML is invariant across requests. A final mobile screenshot was inspected.

The event-driven public-page observer hit its eight-minute observation cap without receiving graph changes. Direct public job/step HTML and final workflow state establish actual progress and completion independently. No idle capacity polling, operator action, fake product execution, or future quota/reset was used to waive a defect.

## Independent execution

Claimed before repository work. QA ran on **codex-sol-6-1-high / gpt-6.1-sol / high**, fleet **avietidol-mac-mini**; these are persisted run fields, not assumed defaults. Started task branch `pm-299-t-1767-qa-run-9707` from freshly fetched `origin/main`, `444953b99578374d5204dc9b5e71d93fd87ef07d`. That source contains the delivery. No application, dependency or CI source was changed.

Installed the exact lock with `npm ci`, using Node **22.23.3**, ICU **78.3**, Next **16.4.2**, React **19.3.0**, Three.js **0.186.1**, and Playwright Core **1.64.0**. Also created detached checkout `/tmp/pm299-9707-delivery` at the immutable delivery, installed its lock independently, and ran both complete contract gates there.

| Check | Immutable delivery `6420027` | Fresh main `444953b` |
| --- | --- | --- |
| Shelf unit suite | 9 passed | 9 passed |
| `TMPDIR=/tmp npm test` | 2,736 passed, zero failures/skips | 2,741 passed, zero failures/skips |
| `npm run typecheck` | exit 0 | exit 0 |
| `npm run lint` | exit 0, 13 existing warnings | exit 0, 13 existing warnings |
| `npm run build` | exit 0; `/shelf` partially prerendered | exit 0; `/shelf` partially prerendered |

Real production builds: delivery **OURX6nA8NbvJrsub0aiTA**, fresh main **-rOhMAWqEZ1Ltvq13OnKJ**. Production Next servers were constructed and exercised at `127.0.0.1:4338` and `:4337`. Their raw tails show successful startup and no runtime auth failure. The main build's unconfigured Better Auth diagnostics are pre-existing; the delivery build and local servers use the existing public CI auth placeholder and loopback URL. No real credentials or database writes were used.

The independent, committed [probe](qa-probe-run-9707.mjs) imports the actual catalog and shelf module and constructs real locked Three.js `PerspectiveCamera`, `Matrix4`, and `Vector3` instances. Eighty translated/rotated perspective cases match the separate Three.js corner oracle within `1e-7` CSS pixels. Seven further cases compare the CPU projection with real WebGL2 rasterization, including near-plane crossing, partial offscreen bounds, far clipping, behind-camera and entirely near-clipped negatives. All pass within the two-pixel raster tolerance, with GL error zero. Chrome reports **ANGLE (Apple, ANGLE Metal Renderer: Apple M6, Unspecified Version)**. This is an actual graphics implementation; no projection/renderer adapter is mocked.

Real Chrome **156.0.8078.73**, at **1366×768** and **390×844**, exercises the immutable delivery, fresh main, and public production:

- HTTP 200 and the actual server-rendered `<ul data-testid="shelf-book-list">` expose all **14** catalog links: **11 projects, 3 notes**. Expected routes come independently from `site.projectList` and `site.notes`.
- All/Projects/Notes produce the correct visible link sets and live counts. Keyboard Tab focuses a book and updates `data-focused-book`. Every book has a distinct, valid transition name.
- The styled paper/ink shelf has three planks and reserves **576px** in both JavaScript-disabled and hydrated views. Filter changes preserve its width and height. Desktop frame width is **960px**, mobile **350px**; neither viewport overflows horizontally.
- No page or console errors occur in the normal shelf walkthrough. Mobile screenshots were inspected: visible paper spines, ink planks, filters and focus outline render correctly.
- **Negative controls:** actual JavaScript-disabled contexts retain all links and navigate to real note and project headings. Reduced-motion browser emulation removes every transition name. Save-Data and unavailable WebGL capability fixtures retain working flat filters and note navigation. A nonexistent `/shelf-qa-negative-run-9707` returns HTTP **404**.

The shared layout's existing `e2e/probe-end.test.ts` and `e2e/riso-headings.test.ts` also pass **8/8** against the real immutable-delivery server. The task's own unit suite covers maximum-thickness packing without overlap, cap/deduplication, deterministic content-dependent dimensions and tilt, unique names, and projection edge cases. Source inspection confirms the Server Component `ViewTransition` boundary, semantic heading, defined CSS tokens, permanent flat fallback, and no changes to pinned navigation arrays.

JavaScript execution, browser navigation, Next rendering, WebGL rasterization and local imports are real. Save-Data/WebGL absence in the capability control are fixtures. This task has no learned model, downloaded rendering artifact, processor job, or external asset prerequisite. Shelf geometry checks are not a whole-site CLS audit. Three.js shelf rendering and book-to-page morphing belong to plan Tasks 4–5 and are outside this Task 3 verdict.

## Integration base before publication

Main advanced during QA. Fast-forwarded the uncommitted task branch to **0449479** without rewriting history, preserving the unrelated departures core and letterpress fixes. Task source/catalog/lock/Next/CI fingerprints remain identical to `6420027`. Reran both full contract gates on that integration base: **9 shelf tests; 2,749 repository tests, zero failures/skips; typecheck, lint and production build all exit 0**. The 13 lint warnings remain unrelated. Generated history output is restored from its exact prebuild copy. The final QA probe is also checked by ESLint and executed against the immutable delivery server.

## Identity and evidence boundaries

The immutable delivery and fresh main have identical SHA-256 values for `lib/shelf.ts`, its tests, the component, page, CSS, catalog, pinned navigation, lockfile, Next config and CI workflow. Earlier implementation `bfce6a2` and initially deployed **573b70e9de539096f3f9e296fe075307b3fe288f** differ from delivery in the page's inherited social metadata and CI configuration. Thus the working older production shelf was not accepted as the requested deployed delivery. The detailed comparison manifest is also a run artifact.

| Delivery input | SHA-256 |
| --- | --- |
| `lib/shelf.ts` | `b36c205a76068dbf8e6c61ead0fd7214dca1abd7eabf22ec710c4cd90673c4a0` |
| `lib/shelf.test.ts` | `f29616f565a98e623af6bb0efe58c2ecc07a2c7264aead9d3ed982a2ef171563` |
| `components/ink-shelf.tsx` | `c78ed12dda1286bcc76193f2644a41efb5bda252f8933a180534c08b0cb95967` |
| `app/(site)/(app)/shelf/page.tsx` | `4dc1663fafad1fbbe7480aeff9798ed8a90c0aaaa7d3b4e5a470e3674150bf29` |
| `app/(site)/(app)/shelf/shelf.css` | `8d3acd55155458b62db23e83e98bf11d374c6819c38af0a8d650ad76c83b85a3` |
| `content/site.ts` | `7e924841a468d850cb8bbdf8d62a74f8b586759d4c65042e371c88bb511b3464` |
| `lib/pages.ts` | `6ace6b9c38943f5d69d356c0e0dbb800edcfc3cd5987ffb174295a143ca4c0ca` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |
| `next.config.ts` | `321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d` |
| `.github/workflows/ci.yml` | `944d94fd8dcae37cd3cb713d2af55b90d0e9e50d608b87d86e8bd87d2e09e53a` |


Git independently identifies delivery author **Otohime <quiinthieu@gmail.com>**, with no `Co-Authored-By` trailer. Task-manager's persisted manifest for SWE task **7bf0ed46-af53-403e-8409-2f8950a4eafd** cites **`run-9695/author.txt`**, 89 bytes, SHA-256 **148d9f5e11ef920dfe74cfe6ec30d262ede16d9c399411cf1703363ff444cd22**. Reconstructing that file with `git show -s --format='%an <%ae>%n%B' 6420027` produces exactly that length/digest and the required identity, with no attribution trailer. This is a content-equivalence check against the persisted digest; it is not a claimed download. Direct HTTP artifact reads returned 401 and cluster port-forward was forbidden. The separate root `author.txt` manifest is retained but its raw content was unavailable.

The installed App Router page, Server/Client Component, lazy-loading and View Transition guides were read. `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md` remain absent; followed AGENTS.md and the supplied contract. No knowledge-graph tool was available, so relevant sources were inspected directly. Build-generated `content/history.json` was inspected and restored from its exact clean prebuild copy; it is excluded from publication.

## Bounded history and ingestion

The [persisted QA snapshot](qa-evidence-run-9707.json) retains board gate, recorded profiles, bounded history, callbacks and raw runner-tail excerpts, independently queried rather than copied from the SWE summary.

- Plan-wide all-runs response: **16 records**, no cursor; **9 succeeded, 6 failed, 1 running** at that snapshot. Earlier explicit failed/succeeded/running filter snapshots are retained and precede the final transition of unrelated footer QA `run-9696` to failed.
- Task-manager project `plan-manager`: FAILED and COMPLETED pages, **offsets 0 and 10, limit 10**, inspect **20 failed of 155 total** and **20 completed of 1,193 total**. Global RUNNING page, limit 10: **all 6** current jobs returned. These are bounded scans, not a complete platform audit; unvisited jobs/logs are inconclusive.
- Read raw task-manager tails for shelf implementation `run-9661` (**ef3b114f-7fa7-42a4-ac55-21ba8936521d**), both failed QA attempts `run-9682` (**81d64689-85f0-4cb9-8317-67c4a5a76001**) and `run-9683` (**f9c89481-dfdb-4ce2-81f2-c95f688644c5**), and latest delivery `run-9695` (**7bf0ed46-af53-403e-8409-2f8950a4eafd**).
- `run-9661` really failed the publication check after a branch-only push. Both failed QA attempts end with **Selected model is at capacity**, exit 1, and no local work to rescue; their `push_failed` text also appears in the supplied known-issue prompt and does not prove a push attempt. Recorded profiles are **codex-sol-medium / gpt-6-sol / medium** for both. They did not execute the shelf and do not establish a recurring shelf executable defect. The final `6420027` fingerprint is not silently equated with those older attempts.
- Both failed QA callbacks and latest successful delivery callback are persisted **delivered, one attempt**. Corresponding plan runs record **zero callback application failures**. The latest green-gate record binds actual command outputs to `6420027`. Full runner logs remain tail-truncated; no completeness claim is made.
- GitHub public API: first **10 current runs**, then **two pages of 10 FAILED runs** and **two pages of 10 COMPLETED runs**, totals initially **163 failed / 590 completed / 595 overall**. Read delivery job/step state, last deployed green job **123237758043** and production job **123244776694** in run **40809987133**. Also inspected latest historical failed run **40806932461**, jobs **123228006839 / 123228006995**, which fail at strict history indexing. Public annotations expose the failing step but do not expose its raw failure body; raw-log API returns **403**. Native CI histories are bounded and do not support a full historical defect audit.
- Read `.github/workflows/ci.yml` history/diff from failed `88f60bc` through green `573b70e`: commit `2cc4b04` adds public ledger refresh steps. No CI change was made in this QA run and no historical failure is reclassified as an environment defect from its label alone. The shared unauthenticated API budget later returned 403 rate-limit; the delivery's public live workflow page supplies subsequent status updates.

Local logs, production/local browser results, native-CI snapshots, reconstructed author bytes and SHA-256 manifest are saved as worker artifacts under `shared/artifacts/run-9707/`. Screenshots are uncommitted artifacts. The probe and report/evidence are the only repository changes.


## Publication retry

The first branch push saved **b11281ee6fc99465d6c2773ff36d1987cfd7e037** on `pm-299-t-1767-qa-run-9707`; the normal main push was rejected fetch-first. Per the explicit recovery instruction, `git pull --rebase origin main` succeeded onto **42faf51dc901e0e9faa0d80115587778a63a8db3**, preserving the incoming Senko/Ennichi core work. The original published branch remains preserved. Created fresh branch **pm-299-t-1767-qa-run-9707-retry-1** rather than force-pushing the rebased branch.

Reran both complete contract gates on this final integration source: **9/9 shelf tests; 2,784/2,784 repository tests, zero failures/skips; typecheck, lint and production build all exit 0**. Lint retains 13 unrelated warnings. All ten listed shelf/catalog/lock/Next/CI fingerprints still match delivery `6420027`. Restored only generated history from the exact clean prebuild copy. This follow-up changes QA evidence only. Publication SHA, actual push outcomes and author are bound by the submitted QA report and worker commit/author manifests; the earlier deployed acceptance remains cited at `6420027`, not at a report-only commit.
