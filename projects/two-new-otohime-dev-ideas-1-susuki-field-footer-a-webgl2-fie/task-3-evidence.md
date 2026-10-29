# Task 3 — deterministic Ink Shelf and accessible route

The original implementation evidence below belongs to `run-9661`. The recovery verification and publication procedure for **run-9669** are recorded at the end of this file.

Plan `pm-299`, task `t-1767`, run `run-9661`, 2026-10-29.
Branch: `pm-299-t-1767-ink-shelf`. Base: `95887d3eef1947d487726f17b276b5b72c398462`.
Delivery identity is the enclosing commit, also supplied as `git_sha` in the plan-manager summary and recorded in the worker's `shared/artifacts/commits.txt` after commit creation.

## Delivered behavior

- `/shelf` is a Server Component inside the requested page ViewTransition. It passes serializable books to the prerendered client island; raw HTTP contains all 11 linked projects and 3 notes in `ul[data-testid="shelf-book-list"]` before JavaScript runs.
- The flat paper shelf uses defined paper, ink, line, shade and swatch tokens. Its three-row frame is 576 CSS px high from initial HTML through hydration and filtering. All/Projects/Notes are native buttons with pressed state, an accessible group and live status. Every volume is a real link; focus updates `data-focused-book` and each link has its unique transition name. Reduced motion removes those names in CSS.
- No WebGL, Three.js, capability detection or deferred rendering is introduced in this task. The same flat shelf remains usable without JavaScript. The later 3D island can share this reserved frame. A separate overflow link list preserves discoverability when a future collection exceeds the 40-volume visual cap.
- `buildShelfBooks` sorts publication dates descending with an identity tie-break, deduplicates identities, skips projects without destinations and caps at 40. Project dates use shipped, then started. Thickness uses project description or note body plus tag length; height and tilt use a stable identity hash. Three rows hold up to 30 books; four hold 31–40. Each centred book packs using its full rotated extent on a 12-unit plank, with explicit margin/gap/row/depth constants for Task 4.
- Projection takes Box3-shaped bounds, a column-major MVP array and a CSS-pixel viewport with optional offset. It intersects the box with all six homogeneous clip planes before perspective division, including generated near-plane vertices and boxes enclosing the entire frustum. Fully clipped books are invisible. No browser or Three.js dependency is required for this math.

## Required verification

Installed dependencies were already present; no dependency or lockfile change was needed. The installed Next 16.4.2 App Router layouts/pages, Server/Client Components, lazy-loading and View Transitions guides were read before implementation. The dynamic import guide confirms `ssr: false` belongs inside a Client Component; that loading step belongs to Task 4.

| Check | Result |
| --- | --- |
| `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/shelf.test.ts` | PASS: 9 tests, 0 failures |
| `TMPDIR=/tmp npm test` | PASS: 2,670 tests, 0 failures, 0 skipped |
| `npm run typecheck` | PASS: route generation and TypeScript |
| `npm run lint` | PASS: 0 errors; 11 existing warnings outside changed files |
| `npm run build` | PASS: Next production build, `/shelf` included as partially prerendered HTML |
| `git diff --check` and owner identity check | PASS |

The full final required command chain completed with exit 0 after the final source/test edits. Unit coverage includes 0/1/2/3/14/29/30/31/39/40/100 input volumes, maximum thickness, row bounds and tilted extents, input immutability, shuffled-input determinism, cap handling, duplicate identities, matching project/note slugs, orthographic/translated/rotated/perspective projection, partial clipping, near-plane crossings, enclosing frusta, behind-camera/far-plane rejection and invalid inputs.

## Real local browser evidence

The production server was started on `127.0.0.1:4317`, using the repository E2E harness's public auth placeholder and loopback auth URL. Playwright Core 1.64.0 launched real installed Chrome **156.0.8078.73**. No browser runner, DOM renderer, projection adapter or shelf asset was mocked. The auth setting is a local fixture; authentication flows and database writes were outside this route check.

The final browser run exercised build **`dgBE3ISL2azw0UomPWZYK`**:

```text
SSR HTTP 200; all 14 catalog links present before JavaScript
Browser: 156.0.8078.73; Next build: dgBE3ISL2azw0UomPWZYK
1366x768: filters, keyboard focus, transition name, stable 576px frame, no page errors
390x844: filters, keyboard focus, transition name, stable 576px frame, no page errors
Negative control: JavaScript disabled; all shelf links present and a book navigates successfully
```

Both viewports also asserted no horizontal overflow, no console errors and no page errors. At mobile size the JavaScript-disabled frame had exactly the same bounding rectangle as the hydrated frame. This demonstrates the shelf's reserved geometry; it does not claim a whole-site CLS audit. Mobile and desktop screenshots were visually inspected locally and are not committed as binaries.

The first browser attempt exposed a local environment failure: HTTP 200 included the prerendered links, but the shared auth layout replaced them after hydration with the error boundary because `BETTER_AUTH_SECRET` was absent. The raw server tail identified `BetterAuthError: You are using the default secret`. Applying the existing E2E fixture fixed the local runtime; no auth application code changed. Both successful browser runs followed this correction, and the last used the final build. The standalone build still emits those auth-environment messages without test env settings and exits 0. This observation was recorded as a plan-manager lesson.

## Executable identity and evidence limits

Runtime: macOS fleet lease, Node **22.23.3**, npm **10.9.9**, Next **16.4.2**, React **19.3.0**. Model/profile effort is not exposed to this session; no inferred default is claimed. No model assets or new external runtime assets were added.

SHA-256 fingerprints:

| Input | SHA-256 |
| --- | --- |
| `lib/shelf.ts` | `b36c205a76068dbf8e6c61ead0fd7214dca1abd7eabf22ec710c4cd90673c4a0` |
| `lib/shelf.test.ts` | `f29616f565a98e623af6bb0efe58c2ecc07a2c7264aead9d3ed982a2ef171563` |
| `components/ink-shelf.tsx` | `c78ed12dda1286bcc76193f2644a41efb5bda252f8933a180534c08b0cb95967` |
| `shelf/page.tsx` | `6cf13aafeefc1ec708a7064a466a336d93a6a42f6d88a4e8b3bc7850b9ab3d13` |
| `shelf/shelf.css` | `8d3acd55155458b62db23e83e98bf11d374c6819c38af0a8d650ad76c83b85a3` |
| `package-lock.json` | `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b` |
| `next.config.ts` | `321b992409329951687bbdf81ff936fd317055490a1c438e15a22abfe7f6606d` |

Full local command output, the browser driver/output and the fingerprint manifest are saved in worker `shared/artifacts/run-9661/`. The initial repository test run passed 2,669 tests; the final run includes the added rotated-projection case and passes 2,670. Both production builds passed. The one failed local browser attempt was an auth fixture setup failure; subsequent runs passed. No external job queue, processor callback, capacity wait or model execution applies to this task. Remote FAILED/COMPLETED job history was not inspected, so no remote history completeness or deployed execution claim is made.

Integration deployed: **unproven**. Waiting for capacity: **no**. Local execution demonstrated: **yes**, for this flat-route/model contract. Deployed product acceptance: **pending plan-manager CI/QA** for the pushed delivery SHA, owned by plan-manager and failing if its delivery CI or deployed route checks fail. Three.js rendering and book-to-page morph wiring remain Tasks 4–5. This run stops after push and summary and does not watch CI or inspect the deployed system.

The pre-existing `content/history.json` change was preserved byte-for-byte and excluded from the commit. The referenced `docs/claude/software-development.md` and chief-of-staff extraction document were absent in this checkout; AGENTS.md, the supplied contract and the committed pm-299 plan were followed, with the missing references recorded as a lesson.

## Recovery verification — run-9669

2026-10-29. Claimed `t-1767` first. Actual persisted run profile: `codex-sol-6-1-high`, model `gpt-6.1-sol`, reasoning effort `high`, fleet worker `avietidol-mac-mini`. Runtime remains Node 22.23.3 / npm 10.9.9 / Next 16.4.2 / React 19.3.0. Installed the exact lock with `npm ci`; no dependency or lock changes. Read installed App Router pages, Server/Client Components, lazy-loading and View Transitions documentation. No structural knowledge graph was available, so inspected source directly. Both missing standing-rule documents above remain absent.

The prior run's persisted error is `agent_failed: exit 1 class=push_failed marker=push_not_on_main: HEAD 59d6abe76a56 is not on origin/main`. Its branch push succeeded, but that did not satisfy runner publication. Read the persisted run and raw log tail before recovery. The rescue arrived as clean local `main` at `ca45eec`, containing implementation `3d51d32` plus a WIP generated history snapshot. Preserved that rescue without rebasing, resetting or amending it. Fetched main at `4765342` and created isolated task branch `pm-299-t-1767-delivery`; applied only the six task files from `3d51d32`. Retained all shelf code/tests unchanged; **dropped only the generated `content/history.json` snapshot from delivery**. Build-generated history changes are also excluded. This produces one task-prefixed delivery commit on the new branch.

All seven executable/lock/config SHA-256 fingerprints in the original table above match exactly. Thus the prior local browser evidence concerns the same shelf executable inputs, although it does not replace this run's checks. New production build ID: **`drSd8agxS8WBU-vV9VS3D`**.

| Current check | Result |
| --- | --- |
| Contract `shelf-unit` | PASS, 9 tests, zero failures |
| `TMPDIR=/tmp npm test` | PASS, 2,693 tests, zero failures/skips |
| `npm run typecheck` | PASS, generated route types and TypeScript |
| `npm run lint` | PASS, zero errors; 11 existing warnings outside shelf files |
| `npm run build` | PASS, `/shelf` partially prerendered |
| Owner identity and whitespace checks | PASS |

The unconfigured build logs the existing `BetterAuthError` about a default secret while exiting zero. For the real production-server browser check, used the repository E2E harness's public auth placeholder and loopback auth URL; the server tail has no auth failure. No application auth code changed. No real credentials, database writes, external assets, or fake renderer were used.

Real Chrome **156.0.8078.73**, Playwright Core **1.64.0**, production server `127.0.0.1:4319`:

```text
SSR HTTP 200: 14 crawlable project and note links
1366x768: hydrated filters, focus, unique transition name, stable 576px frame, no overflow/errors
390x844: hydrated filters, focus, unique transition name, stable 576px frame, no overflow/errors
Negative control: JavaScript disabled, all 14 links present, 576px frame, real book navigation passed
Capability negative control: reduced motion + Save-Data + unavailable WebGL preserves flat links; transition names disabled
```

Save-Data and unavailable WebGL were browser capability fixtures; HTML, React hydration, routing, CSS and Chrome were real. The frame's bounding rectangle stayed identical across every filter change. This is local flat-shelf execution evidence, not a whole-site CLS audit or Task 4's WebGL rendering proof.

Bounded plan history read: all-runs endpoint returned seven records without a cursor (three `succeeded`, two `failed`, two `running` at observation). Failed filter returned two records; `completed` filter returned zero because successful records use `succeeded`. The sole failed shelf attempt is `run-9661`; this is the running replacement. Prior run callback application failures: zero. Prior logs were tail-truncated, so full-log completeness and wider platform history remain inconclusive. There is no shelf runtime queue or processor callback to exercise. Both observed failed plan runs reported branch-only publication, not a deterministic shelf executable failure.

Publication procedure: commit on the task branch, write the exact SHA/subject to worker `shared/artifacts/commits.txt` and `shared/artifacts/run-9669/commits.txt`, then `git push origin HEAD` and normal `git push origin HEAD:main` to fast-forward the tested commit into integration. Return the primary checkout to this delivery branch before pushing so the runner inspects the delivered HEAD. The rescue remains preserved. On a non-fast-forward rejection, use the explicitly authorized pull/rebase and rerun both contract gates before retrying; never force push. Actual push outcomes and delivery SHA are bound by the summary report rather than claimed before publication here.

Integration deployed: **unproven**. Capacity wait: **none**. Local execution demonstrated: **yes**. Task 3 implementation is complete; deployed product acceptance remains **pending**, owned by plan-manager CI/QA for `t-1767` at the submitted `git_sha`, and fails if delivery CI or deployed shelf usability checks fail. No known shelf defect is deferred. Three.js and book-to-page transition wiring remain Tasks 4–5. Stop after publication and summary; no CI watching or deployed checks. Current raw check logs, browser driver/output and fingerprints are worker artifacts under `shared/artifacts/run-9669/`.
