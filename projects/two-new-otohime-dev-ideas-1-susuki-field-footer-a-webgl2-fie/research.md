# Research: Susuki Field footer + Ink Shelf (/shelf), pm-299

Verdict: both are feasible on the current stack (Next 16.4.2, React 19.3, three 0.186.1, r3f 9.8.2, drei 10.7.9, cacheComponents on). Build Susuki Field first: it is small and self-contained. Build Ink Shelf second as a lazy-loaded route. Nothing was verified in a browser. The inspiration tweets were not fetched. /shared was read-only, so this body is the deliverable.

## Repo facts
- `components/end-footer.tsx` is a server component. The field must be a client island mounted in or behind `.end-grid`.
- Season: `<html data-season>` is pinned before paint (`lib/seasons.ts`). `components/season-layer.tsx` already subscribes via `useSyncExternalStore` (`appearanceTags`, `isSeason`, `SEASON_ATTR`) and drops motion under reduced motion. Reuse that subscription for the tint.
- Existing GL code: `app/(elements)/_lib/webgl.ts`, `components/ink-hero.tsx`, `lib/ink-particles.ts`. Check whether `webgl.ts` is WebGL2-ready before writing a second helper.
- three and r3f are installed. No postprocessing package is installed and no EffectComposer/OutlinePass is used, so the outline pass is custom.
- View Transitions are already used in several route-group layouts and CSS files. `next.config.ts` sets no viewTransition flag. `node_modules/next/dist/docs/` was absent, so run `npm i` and read the Next docs first, as AGENTS.md requires.
- Projects live at `app/(site)/(app)/projects` and notes at `.../notes/[slug]`.
- SWE task rules: use recognised top-level paths (`scripts/`, `projects/<plan>/task-N-evidence.md`) and prerequisites schema `platform.plan-prerequisites.v1`. Keep a problem ≤1024 characters and a verification cmd ≤2 KiB. Commits start `pm-299/<task>:`.

## Idea 1: Susuki Field footer (WebGL2)
- **Rendering.** One canvas, about 220–320px tall, one instanced draw call. Use 6–10k tapered blade strips with per-instance root x, depth, height, lean, phase and plume size. WebGL2 instancing is core, so no extension fallback is needed. The vertex shader bends each blade quadratically in height fraction.
- **Wind.** Ambient wind is sine/noise plus time. The cursor gust sets `uPointer` and `uPointerVel`, with displacement away from the cursor times a falloff. Smooth the pointer with a critically-damped spring on the CPU so blades part and return. Scroll speed (clamped, low-passed) multiplies wind speed and amplitude. There is no readback.
- **Ink look.** Flat sumi black with soft edge alpha, a dry-brush streak from hash noise, and fuzzy lighter plume quads at the tips. Far layers get lower alpha. The canvas is transparent so paper shows through.
- **Season tint.** A `uTint` uniform comes from CSS custom properties, read once and again on a `data-season` change. The canvas is `aria-hidden` and `pointer-events:none`, with the pointer tracked on the footer so links stay clickable.
- **Idle ink-fox.** After about 12–20s without input, a baked fox silhouette trots across. Blades near it get a local displacement from the same function as the cursor gust. It stops on any input and runs once per session.
- **Fallbacks.** Reduced motion, no WebGL2, context loss or Save-Data renders one static frame with no rAF, no gust and no fox. Handle `webglcontextlost` with preventDefault and restore on `webglcontextrestored`.
- **Performance.** Run rAF only while the footer is in view and the tab is visible. Cap DPR at 1.5–2. Scale blade count with width, and halve it if frames exceed 20ms. Free GL resources on unmount.
- **Integration.** `components/susuki-field.tsx` (client, `next/dynamic` with `ssr:false` via a loader like `ink-hero-loader.tsx`). Put pure math in `lib/susuki.ts`: seeded blade generation, spring, season→tint table and idle state machine. That makes it unit-testable without GL.
- **Risks.**
  - Touch pointer handling: treat touch as a gust only while touching.
  - Cost alongside the fixed SVG `season-layer`. Default is to keep both.
- **Tests.**
  - Unit: blade determinism and count caps, spring convergence, all four season tints present, idle machine with fake timers, reduced-motion path chosen.
  - Playwright probe like `scripts/probe-seasons.sh`: canvas present and non-blank, zero rAF after the first frame under reduced motion, no console errors, footer links clickable, canvas absent from the a11y tree.

## Idea 2: Ink Shelf (/shelf), Three.js
- **Route and data.**
  - `app/(site)/(app)/shelf/page.tsx` is a server page that builds typed books from projects and notes (title, kind, slug, href, accent, thickness from page count).
  - It passes them to a lazy client `components/ink-shelf.tsx`.
  - A real, crawlable `<ul>` of links must exist in the DOM. It serves as the accessible layer and the no-WebGL fallback.
- **Scene.**
  - 3–4 rows of box books with varied size and tilt, on planks.
  - Spine text from per-spine canvas textures, avoiding font loading.
  - Low-FOV camera with pointer parallax. Hover lifts a book with a spring, found by raycast.
  - Keyboard focus on the hidden links highlights the matching 3D book.
- **Outline post-process.**
  - Render the scene to a colour target with a depth texture, then render normals to a second target.
  - A fullscreen pass runs Sobel/Roberts-cross on linearised depth and on normals. Edge = max(kd·depthEdge, kn·normalEdge).
  - **Grazing-angle fix.** Depth edges fire falsely on surfaces seen at a steep angle (planks, book tops). Compute `ndv = abs(dot(N,V))` and scale the depth threshold by `1/max(ndv,ε)`, or suppress depth edges below `ndv ≈ 0.2`. Only real silhouettes and creases fire.
  - Modulate line weight with noise and a brush texture, and add a slight UV wobble for a hand-drawn feel.
  - Compose as paper colour × 3-tone shading + hatching + edges.
- **Hatching.** Tonal-art-map style, procedural in the shader with 3–4 density bands chosen by luminance. Use object-space or world-projected UVs to avoid shower-door effect under parallax.
- **Implementation choice.**
  - Stay on WebGLRenderer with GLSL. Skip WebGPU/TSL and skip the `postprocessing` package unless custom passes exceed about 200 lines.
  - Use `drei` `useFBO`/`useDepthBuffer`.
  - Cap DPR at 1.5 and use `frameloop="demand"`, so a static shelf costs zero idle GPU.
- **View Transition on click.**
  - The canvas cannot morph, so use a DOM proxy: the hidden link, or a transient div at the book's projected screen rect (`Vector3.project`).
  - Set `view-transition-name: book-<slug>` on the proxy and on the destination heading/cover.
  - Wrap `router.push` in `document.startViewTransition`, or use Next's viewTransition support if this version's docs expose it.
  - Feature-detect it. Under reduced motion, skip it with `::view-transition-group(*){animation:none}` and drop the hover springs.
  - Names must be unique per page, and the destination pages (`projects/*`, `notes/[slug]`) need the matching name.
- **Fallbacks.** Without WebGL, the Suspense fallback, or reduced data, render a flat CSS/SVG shelf from the link list. This also avoids layout shift.
- **Risks.**
  - Bundle size: load three only on /shelf, when visible.
  - Edge artefacts on thin boxes at low DPR: tune thresholds with a debug uniform behind a query flag.
  - No MSAA on custom targets: use a multisampled target or FXAA on the final colour.
  - Mobile GPU cost of 3 passes: offer a low-end mode that derives normals from depth derivatives.
- **Tests.**
  - Unit: deterministic layout generator (widths fit the shelf, thickness from page count), unique slug→name mapping, projected-rect helper.
  - Browser probe: /shelf returns 200 with the link list in the DOM and a non-blank canvas. A click navigates to the right href and calls `startViewTransition` (spied). The reduced-motion path skips it. No console errors. A WebGL-disabled launch shows the fallback.

## Recommended task split
1. `lib/susuki.ts` plus tests.
2. `components/susuki-field.tsx` plus loader, mounted in `end-footer.tsx`, with fallbacks and a probe under `scripts/`.
3. `lib/shelf.ts` plus tests, and the `/shelf` page with the link list and flat fallback.
4. Shelf scene plus outline/hatch pass, with a debug threshold flag.
5. View Transition wiring plus destination `view-transition-name` on project and note pages, with a probe.
6. Acceptance walk: light/dark × four seasons screenshots, and a check that the three chunk loads only on /shelf.

Chains 1→2 and 3→4→5 are independent and can run in parallel. The outline pass is the main unknown, so budget one tuning spike. Effort: Susuki is about 2 medium tasks, Shelf about 4.

## Defaults if unanswered
- Shelf contents: all projects plus published notes, newest left, capped at about 40.
- Fox art: a small hand-drawn SVG silhouette baked to a texture.
- Keep the season petal layer while the footer is in view: yes, no change.
