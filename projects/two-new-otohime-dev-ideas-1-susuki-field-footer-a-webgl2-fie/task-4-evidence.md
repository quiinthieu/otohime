# t-1768 — Three.js Ink Shelf

Implemented in `run-9732` on `pm-299-t-1768-ink-shelf`, based on freshly fetched main `377dfe09193ff6d0aa3ab4fd02d339749485a19e`. The enclosing delivery commit is identified by [artifacts/commits.txt](artifacts/commits.txt); the board summary records its pushed SHA.

## Executable and boundaries

- Locked dependencies installed with `npm ci`: Next 16.4.2, React 19.3.0, Three 0.186.1, R3F 9.8.2. No dependency or lockfile changes. Read installed Next lazy-loading and Server/Client Component guides before implementing.
- Final checks use Node **22.23.4**, macOS arm64. Chrome **156.0.8078.48**, headless **real WebGL2 through ANGLE SwiftShader**. This proves browser shader execution on a software graphics adapter, not physical-GPU performance or deployed integration. Agent is Codex; exact model/effort metadata was not exposed, so none is inferred.
- Production build ID: `WFj9jJObbWTOqtMxjdPI4`. Relevant source/lock/config fingerprint: `d2ebb604525ce8933bbbe3ff088d6532b4a5d3d80e7f0d73a709619ded49c8d6`. [executable-fingerprint.json](artifacts/executable-fingerprint.json) records each input and both built chunk hashes. All shelf textures and geometry are procedural; no external model, font, or image assets are required.
- The only new Three/R3F importer is `components/ink-shelf-3d.tsx`; `lib/shelf-shader.ts` has no runtime dependencies. The client shell conditionally imports the renderer through `next/dynamic` with `ssr: false` after capability/Save-Data checks. The existing `/elements` atom importer is unchanged.

## Positive verification

All commands below ran from the repository root with `TMPDIR=/tmp` and Node 22.23.4 on `PATH`.

| Check | Observed result and positive assertions |
| --- | --- |
| `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/shelf.test.ts lib/shelf-shader.test.ts` | **16 tests pass, zero failures/skips**: nine existing layout/projection tests and seven new shader tests. Numerical grazing suppression/scaling, preserved silhouettes, weighted edge maximum, exact four-band boundaries, strict/clamped debug parsing, independent uniform state, GLSL kernel/coordinate invariants, importer isolation and lifecycle invariants all assert actual values/source. |
| `npm test` | **2,791 tests pass**, two suites, zero failures/skips. Includes the seven new shader tests and the existing positive regression suite. |
| `npm run typecheck` | Route generation succeeds and `tsc --noEmit` succeeds. |
| `npm run lint` | Zero errors; 13 existing warnings in unrelated files. |
| `npm run build` | Optimized compilation, TypeScript and all **217** static pages complete; route output contains `/shelf`. Existing Better Auth placeholder/base-URL warnings occur during static generation; build exits zero. |
| Production browser preflight | **Six named groups pass**, with real shader compilation, WebGL draw calls, screenshot pixel assertions, interaction, idle, fallback and runtime chunk checks. Full bounded output: [browser-preflight.txt](artifacts/browser-preflight.txt). |

The platform's gate descriptors use `expect=exit0`; this role cannot rewrite them. These results supply named positive assertions rather than relying on exit status alone.

## Browser observations

The preflight starts from the real production server at `http://localhost:4431`, without a database or fake renderer. The only simulations are the explicitly named negative controls (blocked WebGL capability, Save-Data preference) and browser device/motion emulation. Shader source instrumentation observes actual `compileShader`, compile status and draw calls; it does not substitute GPU results.

1. **Desktop 1366×1000:** colour/hatching, encoded view-normal and linear-depth composite programs compile; 70 observed draws before interaction, `gl.getError()=0`, DPR 1. The shelf screenshot has 3,232 distinct RGB values and 17,107 dark pixels. DOM keyboard focus visibly changes the screenshot, syncs the canvas book ID, and settles. After driving 100 browser frames, another 16 driven frames leave the shelf's frame count unchanged. A projected real book-centre pointer hit raycasts to the expected book; Notes filtering updates the real DOM list.
2. **Mobile 390×844 at emulated device scale 3:** real render DPR caps at **1.5**. `?outlineDebug=1&kd=2&kn=0.7&ndvCutoff=0.3` exposes the matching uniforms and debug attribute. Pixel assertions find **2,848 blue grazing-suppression pixels**. Focus, hover, idle and filtering checks also pass.
3. **Reduced motion:** moving between two empty shelf positions and driving 24 frames leaves the rendered screenshot byte-identical, proving pointer parallax is disabled.
4. **Actual context loss:** both desktop and mobile call the real `WEBGL_lose_context` extension. The 3D canvas unmounts, `data-shelf-mode="flat"` returns, and the persistent link list regains opacity 1. No page/shader errors.
5. **No-WebGL and Save-Data negative controls:** each keeps all 14 crawlable book links, mounts no shelf canvas, loads zero renderer/Three chunks, and successfully navigates through a real flat-shelf link. No page errors.
6. **Home isolation:** visiting `/` loads neither the shelf renderer nor the Three core chunk. Bundle observations read every captured JS response body before navigation; unread response bodies fail the probe. Static import tests independently restrict the route's import graph.

Reproduce after `npm run build` and starting `next start` with suitable local auth placeholders:

```sh
BASE_URL=http://localhost:4431 TMPDIR=/tmp node \
  --experimental-strip-types --disable-warning=ExperimentalWarning \
  --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  projects/two-new-otohime-dev-ideas-1-susuki-field-footer-a-webgl2-fie/artifacts/task-4-browser-probe.mjs
```

## Failures corrected and evidence completeness

- Initial unit verification caught a floating-point strict-equality assertion; use tolerance at the 0.2 grazing boundary. Initial typecheck caught a default parameter inferred as literal `0.2`; annotate it as `number` so custom cutoff tests are valid.
- The lease's default Node 22.12.0 failed the existing `every listed southern zone is one Intl knows` assertion for `America/Coyhaique`. Node 22.23.4 recognizes the zone and the full suite passes. The app was not changed to accommodate obsolete ICU data. This is recorded as a lesson.
- The initial real browser attempt remained flat: R3F 9.8.2 always mounts `Canvas.fallback` DOM children. A side-effecting fallback incorrectly signalled failure. It is now `null`; capability detection, error boundaries and context-loss listeners handle real failures. A source regression invariant and the real execution probe cover the correction. This is recorded as a lesson.
- An intermediate dev probe could not read a JS response body after navigation; that attempt was inconclusive for bundle isolation. The final probe collects and asserts complete response bodies before navigating, and reports zero unread bodies. The final production receipt is complete, with six passing groups and no ignored executable defect.
- Runtime queue/current-job and paginated FAILED/COMPLETED histories are **not applicable**: this task builds an in-browser renderer and submits no remote executable jobs or callbacks. Local failing attempts above were inspected and resolved; final named receipts are complete. No capacity or operator deferrals exist.
- Prebuild's regenerated `content/history.json` was restored to its initially clean bytes; build output, vendor files and PNG screenshots are not committed. Only task-owned source and text evidence are delivered.

## Delivery state and deferred ownership

Implementation and local execution are demonstrated. Production integration and deployed product acceptance remain **unproven** until plan-manager's post-push gates and independent QA run. Per the role contract, this run stops at the branch push, submits its summary, and does not watch CI or probe a deployed system. No CI run ID/result was observed.

Deferred check IDs: `t-1768/shelf-shader-unit`, `t-1768/repo-checks-and-build`, and deployed QA for `t-1768`, owned by plan-manager's green gate / quality engineer. They fail if the named gates fail, real deployed shader rendering/idle/focus/fallback/isolation regresses, or the deployment cannot bind the delivery fingerprint. This local SWE preflight is not a substitute for independent QA. Book-to-page View Transitions remain task 5's scope.
