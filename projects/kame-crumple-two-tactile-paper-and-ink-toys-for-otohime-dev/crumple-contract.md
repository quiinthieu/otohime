# Reversible paper fold · pm-274/t-1584

Only hydrated, registered project/note hosts on `/projects` and `/notes` opt in.
Fetch-only chips and the sea-star sticker retain fetch without folding. The existing
load + idle loader and Save-Data opt-in remain the activation boundary. The Canvas
renderer is a second dynamic import, requested by the first Crumple action only.

## Geometry and renderer port

`lib/crumple.ts` exports `foldMesh(seed, elapsed)`, `createFold({seed, clock})`,
`FOLD_MS=400` and `MAX_BALLS=8`. Unsigned 32-bit seeds produce 72 triangles from
a 7×7 vertex grid. Normalized points stay inside `[0,1]`; final vertices lie within
radius .25 about the center. Triangle shade and crease geometry are seeded.
Elapsed time is injected, clamped at completion and monotonic across backwards
clock samples. Invalid geometry inputs throw; an invalid active clock cancels.
`start(reduced?)`, `tick()`, `reset()` and `cancel()` own the intact → folding → ball
lifecycle. Reset/cancel synchronously return intact; cancelled folds never resume
without an explicit start. No DOM capture, WebGL, physics or dependency is involved.

`components/tactile/crumple-renderer.ts` exports
`createCrumpleRenderer(root, seed, reduced, onFailure) → {canvas, dispose}`.
The root is the absolute `.paper-tools` overlay, not the content node. It measures
once, caps each logical bitmap dimension at 2048 and DPR at 2, paints paper
triangles/ink creases with the host's `--paper` and `--ink`, and contracts to an
approximately 76px ball (smaller on short cards). A successful first paint precedes
source concealment. Reduced motion paints the final mesh immediately and schedules
no animation frame. Animated folding schedules frames only until completion.

`dispose()` is idempotent: cancel the frame, remove the context-loss listener and
canvas, zero its bitmap, and cancel the pure lifecycle. Context acquisition, paint,
context loss and disconnected roots fail through the adapter's restoration path.
Basket work can consume the canvas/geometry port and extend placement; it must keep
the same restoration/disposal contract and route-local slot ownership. This task
does not introduce flight, basket collisions/scoring, persistence or global ironing.

## Content and controls

`createPaperCrumple(signal, motion).attach(el, root, actions, seed, clearPaper)`
returns `{start, restore}`. A route-local set reserves at most eight slots, including
pending imports. A ninth action leaves its source unchanged and announces the limit
in that card's existing polite live region. Every restore invalidates the import
generation, frees its slot and disposes its renderer. Late imports cannot resurrect
cancelled paper. Failed imports keep the original content readable.

Original source DOM, hrefs, accessibility names and layout are retained. Only direct
visual children outside `.paper-tools` receive paint-only opacity while represented
by Canvas. No content is removed, hidden, made inert or assigned `aria-hidden`.
Existing decorative accessibility attributes are preserved. Controls are siblings
of the canvas outside the source box and remain visible/focusable in ball state.
Project/note action shelves have native pointer hit targets at rest; the initial
pointer entry reveals them with the existing hover/focus policy. Untouched touch
cards keep their shelf concealed. The tools have their own stacking layer above
neighbouring titles and the sticky masthead. Enhanced hosts do not
retain an entrance, isolation or translate stacking context; the cartridge shell
and label keep their visual lift separately. Controls stay outside the source,
with no change to its reserved layout box or any content link's pointer handling.

Read card focus/click, Reset focus/click and focus entering any original descendant
synchronously remove the proxy and restore visible paper. Per-card Reset clears
fold, peel and fetch through the existing shared lifecycle. Starting fetch or peel
also restores that card first. The source's reserved box never shrinks or moves.

## One pointer owner and cancellation

Button/keyboard Crumple and the existing `createGesture` owner call the same start.
Stationary primary grip or actual blank-host paint holds for 600ms. Prose, links,
nested controls, selections and modified/non-primary input retain native behavior.
Touch body motion above 8px cancels for scrolling; grip/mouse motion above 6px takes
fetch precedence. Peel owns its corner and cannot turn into hold. Hold completion
consumes only its pointer's release click, including a long hold past fold completion.
Context menus are never prevented.

Escape, pointer cancellation, blur, hidden document, resize, motion changes, modal
opening, removed source, pagehide and route departure release pending holds, imports,
frames, bitmaps and slot ownership. Existing navigation, hydration/remount, bfcache,
peel session and route-reset ports remain authoritative.

## Proof boundary

`lib/crumple.test.ts` exercises deterministic finite/bounded geometry, seeded creases,
completion, cancellation, reset and invalid input with an injected clock. The retained
tactile boundary test now also exercises stationary radial thresholds and wrong-owner
input. These assertions were added before the fold implementation; the initial run
failed because the fold module did not exist.

`e2e/crumple.test.ts` constructs the real production Next application, locked
Playwright and native Chrome/Canvas, exercising real keyboard, mouse and CDP touch.
It reads nonempty pixels, varied crease/shade colors and compact transparent bounds;
compares original accessibility snapshots, text/hrefs/attributes and geometry;
checks source focus and Read/Reset restoration, static reduced motion, slot capacity,
native selection/scroll/context menus and lifecycle cleanup. Deliberately blocked
renderer imports, null contexts, thrown paint and context loss are failure controls;
those injected failures are not claimed as real provider outages. Existing fetch and
peel browser suites remain part of the required verification.

The native-pointer regression covers every opted-in project and note card at
1280×860 and 720×860. Before each action it moves away and blurs the previous
control, verifies the exact centre hit target at rest and after native mouse
movement, then uses mouse input without pre-focus, hover preparation or DOM click.
Crumple must paint real nonempty Canvas pixels; Read card and Reset must restore
the same accessible source and document geometry. Uncovered links receive real
native clicks too. The unchanged stylesheet fails all four route/width cases;
run-9328 retains that red evidence and the corrected production results.

Run-specific results and executable hashes live in `run-9308/artifacts/`. Local
production execution is demonstrated separately from CI/deployed product delivery.
Platform CI and independent deployed QA/acceptance own the latter after branch push.
