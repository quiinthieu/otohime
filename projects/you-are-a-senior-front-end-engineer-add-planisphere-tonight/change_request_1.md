---
plan_id: pm-203
run_id: run-6841
kind: change_request
cycle: 1
cited_sha: 6997065c2eee6ce503845de556f29c97a16b0be5
---

# Change request: Planisphere's wheel cannot be turned by finger on a phone

**Service:** the otohime web app on Vercel (otohime.dev), route `/planisphere`,
deployed at `6997065c2eee6ce503845de556f29c97a16b0be5`.

## What a user still cannot do

On a phone or tablet, a visitor cannot turn the star wheel by dragging it.
The disc follows the finger for about 15° (≤1 h of sky). Then the browser
takes the gesture: the drag stops, and the page scrolls or pans under the
finger. Turning the wheel by hand is the plan's main interaction ("A paper
planisphere is used by turning it") and part of t-1163's acceptance ("dragging
the disc … turns the sky in quarter hours"). The plan's QA asks for it at
390×844. Mouse, keyboard, Now, Use my location and the no-JavaScript form all
work.

## Evidence (otohime.dev, Chrome mobile emulation at 390×844, real touch events through CDP)

| Drag | Expected | Observed |
| --- | --- | --- |
| 90° anticlockwise inside the window | 21:00 → 15:00 | 21:00 → 20:00, `pointercancel` after 4 moves |
| 90° clockwise | 21:00 → 03:00 | 21:00 → 22:00, `pointercancel` |
| 60°, finger moving upward first, page at scrollY 120 | +4 h | +45 min, page scrolled to 177 |
| the same drags with `svg.wheel { touch-action: none }` injected by the probe | 15:00 / 03:00 | 15:00 / 03:00, 0 `pointercancel` |

Diagnosis: `touch-action: none` is set on the SVG `<g data-disc>`. Chrome
ignores touch-action on SVG child elements and uses the outer `<svg>` box,
which is `auto`. The earlier QA's "390 touch" drag used mouse events, so the
touch path was never exercised. The walk and the QA probes need a check that
uses real touch events (`Input.dispatchTouchEvent` or Playwright
`hasTouch` with CDP touches) and asserts a 6 h quarter turn with no
`pointercancel` and no page scroll.

Done when, on otohime.dev at 390×844 with touch input, a quarter-turn finger
drag on the disc moves the hour by 6 h and the page does not scroll. Scrolling
the page by touch outside the wheel must still work, and the mouse, keyboard
and no-JavaScript behaviour must stay as they are now.

## Also in scope (same route, same service)

- **Error log on every view.** Each render of `/planisphere` logs
  `Error: Route "/planisphere": Next.js encountered the unstable value Date.now() while prerendering`
  (38 of 38 renders in a local `next start` of 6997065, and no other error).
  The call is `parseQuery(query, Date.now())` at
  `app/(planisphere)/planisphere/page.tsx:40`. Next 16.4's docs
  (`01-getting-started/08-caching.md`) say to defer the clock read to request
  time (`await connection()` from `next/server`). Any change must keep
  `instant = false`, add no `<Suspense>`, and keep the page fully working
  with JavaScript off: the walk's "no `<template id="B:`, no `$RC`" line.
  Done when a local `next start` serves the walk's pages with no error in the
  server log, and the walk checks for that.
- **Optional, accessibility:** axe reports `nested-interactive` (serious)
  because the focusable `role="slider"` disc sits inside `<svg role="img">`.
  The form's hour range stays an accessible fallback, and Lighthouse scores
  100. It can ride along if cheap.
