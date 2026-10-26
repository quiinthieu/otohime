# Fetch contract — pm-259/t-1583

Extends the landed [paper registry](tactile-contract.md) and [companion](kame-contract.md). Their loaders, site-route allowlists, CSS import locations, identity storage, peel session and existing controls remain in place. No dependency, binary asset, backend write or document-wide body gesture manager was added.

## Registration and arbitration

The existing `PaperLayer` creates one `createGesture` owner. Its fetch adapter receives that same owner; it does not create another one. Project/note cards retain their existing stable ids. Footer Lines opt in through their noninteractive `li` wrappers using `line:<encoded label>` and `data-paper-fetch-only="true"`. The lazy adapter adds one `sticker:sea-star` inside the reserved Kame shell, absolutely positioned without changing its layout box. Fetch-only surfaces have no margin requirement, corner or Peel action. Discovery still rejects duplicate/overlong ids, excluded ancestors, nested form/canvas surfaces and ineligible routes, with the same 128-surface limit.

Each source has a 44×44px `Drag paper` button and a keyboard `Fetch back` button. Enter/Space or an ordinary grip click tosses a small paper proxy. Explicit grips alone receive `touch-action:none`. A primary grip movement greater than 6px claims fetch through the shared owner. Wrong pointers cannot move/end/cancel it. Peel continues to own its own corner and can never become fetch.

Optional mouse body input starts only on the blank source container itself, without direct text, an existing selection, modifiers or descendant targets. Links, prose, controls, SVGs and all touch bodies keep native behavior. Descendant pointer events are not prevented. Capture starts immediately for a grip, or at the fetch threshold for safe blank mouse input. No crumple hold is consumed by this task; later crumple work can use the same owner.

A completed drag records one short-lived click token containing pointer id, target identity and release time. The source's capture-phase click listener consumes it once; keyboard/detail-zero, modified, other-target, other-pointer and expired activations pass through. Every new pointerdown clears the old token. A cancelled drag also consumes the remainder of its own interrupted pointer sequence. No later real click is suppressed. The original anchors are neither draggable nor replaced.

## Lifecycle and local port

`lib/kame-fetch.ts` owns browser-free release velocity, viewport bounds, toss/seek/return states, terminal cancellation and click policy. Coordinates are viewport centers. A toss begins with the measured source rectangle and a velocity capped at 700 CSS px/s; friction settles it after 180ms. This duration controls the toss only and never proves turtle arrival.

| Phase | Observable condition |
| --- | --- |
| Acceptance | `commandKame({type:'fetch',id,target})` returns true. This alone proves no completion. A rejected command creates no proxy. |
| Toss | One fixed, pointer-transparent, `aria-hidden` proxy moves within the viewport. Kame may already approach the initial target. |
| Seeking | The settled proxy is the target of a fresh identified leg. Only the actual rendered turtle center within 3px can emit `arrived`. |
| Returning | The source is measured again; the turtle receives its bounded visible center as a new leg. The proxy follows actual rendered position events. |
| Returned | A second measured arrival within 3px completes the return. The proxy is aligned with the source anchor for that paint, then removed on the next frame. |
| Cancelled | The proxy, frame and capture disappear immediately. Original content was always present and readable. No arrival or return is claimed. |

`subscribeKameCompletion(listener)` in `components/kame/commands.ts` returns an unsubscribe function. Events are typed `{type:'accepted'|'position'|'arrived'|'cancelled',id,position}`. The companion alone emits measured positions. The adapter correlates each toss/seek/return leg, so cancellation of a replaced leg cannot complete/cancel a new one. Legacy boolean commands remain valid; callers wanting completion supply an id and subscribe before commanding. There is no window test or global event API.

The companion's fetch speed is capped at 2200 CSS px/s. Fetch uses whole-sprite viewport bounds, including the top edge; follow/swim retain their existing placement. The complete operation is capped at 5000ms of active elapsed time from keyboard activation/release, across all legs. Frame deltas and event-time deadline checks both enforce the cap; hidden pages cancel instead of accumulating paused work. Position integration clamps large frame deltas separately from elapsed deadlines. A stalled/missing/hidden turtle cannot produce a successful return. No timeout or guessed sleep supplies arrival.

The original DOM, text, hrefs, accessibility tree and layout box are never cloned, moved, hidden, faded, made inert or removed. Only a small generic paper print animates. Source controls remain outside the decoration. Wrapped mobile actions and their real margin paragraph share a flowing action container, so a new row cannot cover the note.

## Recovery, loading and cleanup

Escape, pointercancel, capture loss, window blur, hidden page, pagehide, route departure, source removal, resize, an opening modal, Kame dismissal and motion changes cancel safely. Focusing source content restores it. Reset cancels fetch and restores peel; `components/tactile/reset.ts` exposes `resetPaper()` for later paper toys. Route cleanup unbinds that port. Removed registry nodes are pruned so they cannot cancel subsequent operations on remaining sources.

Reduced motion creates no fetch proxy or movement; Fetch back responds immediately. Unmounted/dismissed/petting/modal-blocked Kame rejects safely. Each source owns a scoped polite live message explaining recovery/rejection; no extra page-wide `status` role is introduced. Existing Kame sound gating, Pet, name, shell and Call remain covered by regression tests.

Existing load-plus-idle imports are unchanged. Save-Data requests neither renderer automatically. Enabling paper alone permits its controls but safely rejects fetch until Kame is explicitly enabled. The sticker and fetch adapter are part of the lazy paper module. All pointer listeners use the route AbortController; teardown releases captures, cancels frames, removes proxy/sticker/controls, disconnects the existing observer and unsubscribes the completion/reset ports. There is no resting fetch animation loop.

## Evidence and limits

Real locked Node/Next/React, production imports/build/server, embedded PostgreSQL migrations and Chromium execute the checks. Mouse/keyboard and CDP mobile input are real browser actions. Pure clocks/storage, browser preference/Save-Data fixtures, lifecycle event injection and the deliberately immobilized turtle are explicit synthetic boundaries. Geometry assertions read real bounding rectangles rather than treating data-state changes as arrival proof.

Tests include initial sprite placement; source text/hrefs/boxes; arrival and return distances; bounded active completion; repeated real clicks; mobile grip versus body scroll; prose selection and native navigation; all cancellation paths; unavailable/reduced-motion recovery; Save-Data enablement; route/pagehide reconstruction; and wrapped mobile margin geometry. The immobilized-renderer negative control advances the clock past five seconds and requires cancellation, no proxy and no `returned` state. Existing companion/tear tests retain Pet, sound, blocked storage, no-JS, lazy imports and desk/stamp inputs. The exact 499/500ms Pet fixture now pauses its injected clock before the boundary to exclude real scheduler drift.

The first unit red run had 7 passes/2 failures (missing fetch module and fetch-only registry policy); the production red test asserted 0 Fetch back controls versus 11 cards. A separate mobile overlap test failed before putting the margin after all wrapped actions. Raw red and final green logs plus the executable file-hash map are in run-8821's artifacts. Full iteration history is not claimed. No queued runtime, capacity prerequisite, callback ingestion or FAILED/COMPLETED asynchronous job history applies to this browser-only feature.

The companion's inline SVG is the required artwork; there are no model/downloaded runtime assets. Engineering demonstrates local production execution. CI, deployed integration, independent QA and product acceptance remain unobserved here and belong to plan-manager after the pushed delivery; no local passing summary substitutes for those gates. The exact identity and final check totals are recorded in [the engineering report](run-8821-summary.md).
