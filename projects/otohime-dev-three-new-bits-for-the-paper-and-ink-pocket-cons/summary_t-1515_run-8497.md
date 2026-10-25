# t-1515 Ambient almanac layer — summary (run-8497)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, sequence 5.

## Delivered

- `components/season-layer.tsx` is a client component that renders one
  `<svg class="season-layer" aria-hidden="true" focusable="false">`. It reads
  `data-season` on `<html>` through `useSyncExternalStore` and a
  MutationObserver, so it follows a later dial. It draws these bits:
  - spring: 16 ink petals (pink fill, ink edge)
  - summer: 28 rain streaks
  - autumn: 14 leaves (coral fill, ink midrib)
  - winter: 28 snow specks

  Each bit is one element drawn around the origin. A static CSS `translate`
  scatters it with a fixed low-discrepancy spread, and the existing `almanac-*`
  keyframes move it, transform and opacity only. Each bit also gets the ink
  hand's wobble: `inkFilter("ink", 0, 2)`, turbulence plus displacement only, in
  a `userSpaceOnUse` filter. Worst case is 32 elements: svg, filter, 2
  primitives and 28 bits. `MAX_ELEMENTS` is 40.
- Pause: `useSyncExternalStore(subscribeHidden, hidden, () => false)` listens
  for `visibilitychange` and sets `data-paused`. seasons.css then sets
  `animation-play-state: paused` on every bit.
- Reduced motion: a `matchMedia` store renders no bits at all; the tint stays.
  As a backstop, the CSS declares the animation only under
  `@media (prefers-reduced-motion: no-preference)`. A
  `@media (prefers-reduced-motion: reduce)` block sets `animation: none`, not
  the site-wide 0.01ms. A bit at rest is `opacity: 0`.
- `app/(site)/layout.tsx` mounts `<SeasonLayer />` first in `<body>`, before
  `{children}`. It therefore comes ahead of every group's `<Masthead />`, the
  auth bar and the in-site 404. Mounting once in the root means a move between
  groups does not restart it. The group layouts are untouched, so the EndFooter
  and group ViewTransition tests stay as strict as they were.
  `app/global-not-found.tsx` (outside the interfaces; its test pins
  `<body><NotFound /></body>`) keeps the tint only.
- The layer is fixed, `inset: 0`, `z-index: -1` and `pointer-events: none`.
  Text and any paper surface paint over it, which keeps the page readable.

## Tests

- `lib/motion.test.ts`: the seasons.css test now allows exactly these blocks:
  the four tints, `.season-layer`, `.season-layer > .almanac-bit`, the
  no-preference query and the reduce query, plus keyframes. Neither the tints
  nor the resting rules may animate or transition. Inside no-preference, every
  selector is the layer's, the four names are the four keyframes, and the
  paused rule is present. The reduce block is exactly
  `.season-layer > * { animation: none; }`. A new test checks that the root
  layout mounts `<SeasonLayer />` first in `<body>`, once, and that nothing else
  under app/(site) mounts it. It also checks that the component is "use client",
  aria-hidden, and subscribes to `visibilitychange` through
  `useSyncExternalStore`.
- `lib/seasons-contrast.test.ts` (transform/opacity-only keyframes) and the
  design-system siblings test (seasons.css declares only --ink, --paper and
  --paper-2) pass unchanged.
- New `scripts/probe-seasons.sh`, following the probe-pocket-game.sh pattern:
  build, `next start` on :4141 (or a free port), pinned temporary
  `playwright@1.64.0` with chromium --only-shell, `BASE_URL` remote mode and
  `EXPECT_SHA`. It runs `scripts/probe-seasons.mjs`, which keeps its 14 node
  checks and adds 59 layer checks when `PW_PREFIX` is set:
  - The served HTML holds one empty aria-hidden layer ahead of the masthead.
  - Each season at 1366x768, and summer and winter at 390x844, is chosen
    through localStorage `season`. In each one the layer is drawn for
    `data-season`, aria-hidden, `pointer-events: none`, fixed at z -1 over the
    whole viewport, and is the first rendered element in `<body>`. Next's own
    `<div hidden>` metadata boundary comes before it. It has at most 40
    elements, only that season's bits, and one running animation per bit with
    no transitions. The keyframe properties are exactly opacity and transform.
  - A faked `document.hidden` plus `visibilitychange` pauses every bit, and
    showing the tab again resumes them.
  - A `data-season` change redraws the layer (autumn to winter).
  - A live switch to reduced motion drops every bit and every animation.
  - Under reduced motion from the start (dark scheme, every season) the tint is
    on, the layer is empty and nothing runs. A forced bit computes
    `animation-name: none` and opacity 0.
  - No console errors or page errors.
- Negative controls in the probe:
  - an injected `r` animation is reported by the property reader;
  - a visibilitychange that leaves the tab visible does not pause;
  - the same forced bit does animate when motion is welcome.
- Mutation run on the shipped code, built and probed, then reverted:
  - summer at 40 bits: caught by the probe at 1366px and 390px (44 elements);
  - pause disconnected: caught by the probe;
  - reduce guard changed to `animation-duration: 0.01ms`: the probe does not
    see it, because the no-preference query already keeps names away. The unit
    test catches it; `npm test` failed 2 with the mutations in place.

## Verification (local, node v22, linux)

- `npm test`: 1713 tests, 1713 pass, 0 fail.
- `npm run typecheck`: exit 0. `npx eslint` on the touched files: exit 0.
- `npm run build`: exit 0.
- `bash scripts/probe-seasons.sh`: exit 0, node 14/14, layer 59/59.
- `SKIP_BUILD=1 bash scripts/probe-motion.sh` (not in the contract; it covers
  view-transition hops across the root the layer now sits in): 512 ok, 0
  failed, on the pre-rebase build.
- After rebasing onto c06a430 (t-1512, the torn 404), from a clean `.next`:
  `npm test` 1713/1713, typecheck exit 0, probe-seasons node 14/14 and layer
  59/59, and `SKIP_BUILD=1 bash scripts/probe-lost.sh` 34/34. The layer also
  sits behind the 404 sheet and does not disturb the rub. One rebuild over the
  old `.next` produced CSS without t-1512's `.lost-*` rules, and probe-lost
  failed 6/34 on it. c06a430 built alone passed 34/34, and so did a clean
  rebuild of this tree. It was a stale build cache, not a code defect.

## Boundaries

- Real: next build and next start of this checkout, and headless Chromium
  (Playwright 1.64.0). Fake: only `document.hidden`, because headless Chromium
  cannot background a tab.
- Not checked: the deployed site (plan-manager runs QA against it), and frame
  cost on low-end phones. The filter is per bit with a 48x60 region, at most 28
  bits.
