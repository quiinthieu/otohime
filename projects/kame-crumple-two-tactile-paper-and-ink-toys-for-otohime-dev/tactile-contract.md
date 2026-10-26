# Paper registry and gesture contract

Delivered by pm-259/t-1572. The pure interfaces live in `lib/tactile.ts`; the deterministic painted corner lives in `lib/tear.ts`. No React, DOM, vendor runtime or storage global enters those modules.

## Registry

| Input | Meaning |
| --- | --- |
| `data-paper-id` | `stableSurfaceId("project", href || title)` for every Cartridge; `stableSurfaceId("note", date)` for every public note. Trimmed, URI-encoded source keys, never array positions. |
| `data-tossable="true"` | Explicit opt-in; a `.card` class alone grants no interaction. |
| `data-paper-margin` | Plain text, trimmed and limited to 160 characters. The adapter uses `textContent`, never HTML. |
| `data-tactile-exclude` | Explicit ancestor exclusion for a future nested toy or control. |

Only exact `/projects` and `/notes` routes are eligible. Protected/account/admin/auth routes, `/desk`, other exhibits, stamp roots, dialogs, form fields, editable regions and live canvases cannot become registered surfaces. Original nested links remain ordinary links; this adapter attaches pointer gestures only to its own corner button. Discovery rejects empty/overlong ids, duplicates, disabled or excluded surfaces and empty notes; at most 128 surfaces are returned.

The original server DOM contains only inert metadata. The existing site layout mounts one loader inside a null-fallback Suspense boundary, required by this installed Next version's route-hook prerender contract. The feature stylesheet imports from that loader and borrows the site's existing tokens. It defines no palette or root layout.

## Gesture vocabulary

Use one `GesturePort` instance for all surfaces in a mounted route adapter. Future fetch/crumple adapters must share that owner rather than installing independent competing body listeners. This task implements only corner gestures; `hold`, `fetch` and `crumple` below declare the pure vocabulary for subsequent tasks.

| State / input | Transition |
| --- | --- |
| idle + explicit corner | peel; this pointer owns the gesture until end/cancel |
| idle + body/grip | hold, unless blocked or another pointer already owns it |
| hold for 600ms | crumple, using the injected clock |
| mouse body or explicit grip moves more than 6px | fetch; the hold cannot subsequently become crumple |
| touch body moves more than 8px | idle; native scrolling wins |
| exact 6px / 8px boundary | remains a pending hold |
| wrong pointer move/end | cannot mutate or release the owner |
| cancel | idle and no owner |

Peel never becomes hold/fetch/crumple. In the browser, a 24px visual corner has a 44px accessible handle, with `touch-action:none` scoped to that button. Card bodies keep native touch scrolling and text selection. Primary pointer input is captured by the handle; unrelated pointer cancellation is ignored. A completed drag suppresses its following pointer click, while keyboard activation still works.

## Tear and recovery

`deckle(seed, amount)` returns a bounded deterministic polygon; non-finite amounts become zero. A seed derived from the stable surface id keeps the edge identical after reload. Only the small painted flap is clipped. Original card text, links, selection, geometry and DOM order remain intact. A real DOM margin paragraph is revealed with the corner; it remains outside the clipped decoration and is referenced by the Peel corner button's `aria-controls` / `aria-expanded`.

Drag progress of at least one quarter commits the peel. Peel corner (Enter/Space), handle activation and Reset use the same pure transitions. Controls become visible on hover/focus and remain keyboard reachable. On touch, tapping the visible corner reveals the margin and action row; intact cards do not paint a permanent row over the following note. Per-card tool stacking keeps adjacent handles from covering active controls. Project cartridges do not lift while paper controls are focused or hovered; their ordinary link interaction still works.

Pointercancel, lost capture, Escape, blur, resize, hidden documents, motion-preference changes and source removal cancel active cosmetics. Escape resets every registered surface. Focusing original source content restores its paper. Reduced motion applies instant states without flap transitions or animation.

`RouteSession` accepts clock/storage/seed ports. Session storage key `paper:v1:<route>` holds `{version:1, ids:[...]}` with at most 128 ids, each at most 256 characters, and a bounded serialized input. Missing, malformed, oversized or throwing storage falls back to local memory. Reload and pagehide preserve committed state. Pagehide removes controls, attributes, listeners and captures; pageshow reconstructs exactly one adapter. Route departure clears the route session and restores/removes cosmetics. Effect cleanup clears state even if React has not committed the next pathname yet. Modified/new-window links retain their normal navigation behavior.

## Loading and verification boundaries

No interactive paper markup or renderer preload appears in the server response. The client loader waits for window load and an idle callback (200ms timer fallback; idle timeout 2000ms) on eligible routes. Save-Data offers an explicit Enable paper corners button before downloading the renderer. Listener AbortControllers, capture release and observer disconnection bound each adapter lifetime.

Pure tests inject time, seed and storage. Production-browser tests run real locked Next/React/CSS and Chromium against `scripts/e2e.mjs`'s isolated Postgres and production server. Only policy fixtures are synthetic: blocked storage, Save-Data, reduced-motion preference, lifecycle/cancel event injection and the held-idle scheduler. Mouse and CDP touch actions are real browser inputs. The import tests inspect actual renderer response bytes, not just the presence of controls. Negative controls include ordinary links, a measured non-handle body swipe, a wrong-pointer cancellation and actual desk/stamp drags.

Run the four verification commands in `plan.md` / t-1572. Deployment, CI green gate and independent QA belong to plan-manager after the pushed delivery; local production execution is not deployed proof. Fetch visuals, Kame, crumpling, basket physics and full performance-budget acceptance remain assigned to later tasks.
