# t-1519 Season ambient polish — summary (run-8523)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, sequence 9.

## Delivered

- **One reduced-motion rule, in `app/(site)/seasons.css`.** The dial's stop
  fill transition (background-color and color, 0.15s) moved out of
  `globals.css` and now sits under `@media (prefers-reduced-motion:
  no-preference)`, beside the layer's keyframes. One rule under `reduce`,
  `.season-layer, .season-layer *, .season-dial, .season-dial *
  { animation: none; transition: none; }`, covers both. The selector is broad
  on purpose. The site-wide reset sets `transition-duration: 0.01ms
  !important` on `*`, and `transition-property` defaults to `all`. So without
  this rule, a pick under reduce still started 0.01ms transitions of
  `color` and `border-*-color` on the dial pill itself when `--ink` retinted.
  The probe caught that on its first run.
- **Overlap and z-index.** The joint probe found no overlap to fix. The layer
  stays fixed at `z-index: -1` under the 92% paper masthead. The Ask console
  is a modal `<dialog>` in the top layer, so it paints over the layer even
  when the layer is raised to z-index 9999.
- `components/season-layer.tsx` and `components/season-dial.tsx` are
  unchanged: neither needed a change.

## Tests (named, each with a negative control)

`scripts/probe-seasons.mjs`, run by `bash scripts/probe-seasons.sh`.

Node checks, on the CSS sources:
- one reduced-motion rule that names the layer or dial, in `seasons.css`
- no layer or dial transition or animation outside a media query
- negative control: a dial transition put back in `globals.css` is caught
  twice

New `jointChecks()`, at 390x844 and 1366x768:
- the layer is drawn for spring at z-index -1
- the brand, dial, theme toggle and page heading paint over the layer. This is
  read with `elementFromPoint` while the layer is made hit-testable for the
  read only. Negative control: a layer at z-index 9999 covers all four.
- the open Ask console and its input paint over the layer, even when the layer
  is raised to 9999. Negative control: the same dialog shown non-modal is
  covered by the raised layer.
- no season's layer adds sideways scroll. Negative control: a wide absolute
  layer adds scroll.
- the served CSS (CSSOM) has exactly one layer-and-dial rule under reduce, with
  animation and transition both `none`
- under reduce, a dial pick tints at once with zero `transitionrun` or
  `animationstart` events in the dial or layer. Negative control: the same
  pick with motion welcome runs the dial's transitions.
- the masthead still paints over the layer under reduce
- no console or page errors

`lib/motion.test.ts`: the seasons.css shape test now pins the single reduce
rule and the dial's no-preference transition.

## Evidence (this checkout, darwin, Node from the repo lock, Playwright 1.64.0 chromium headless shell)

- Red: the new probe run against HEAD f4a360b's CSS (clean `.next`, full build)
  exits 1 with 7 failures. Three are source checks. Four are joint checks: the
  served reduce rule and the reduce pick, at both widths, showing 6
  `transitionrun` events per pick.
- Green: `rm -rf .next; bash scripts/probe-seasons.sh` exits 0: node 19/19,
  layer 59/59, dial 45/45, joint 28/28. Rerun with `SKIP_BUILD=1` on the final
  clean build: same counts.
- `npm run build` from a clean `.next` exits 0 (183/183 static pages).
- `npm test`: 1723 tests, 1723 pass, 0 fail.
- `eslint` on the touched scripts, tests and components: clean.

## Boundaries

Real: the built app under `next start` and real headless Chromium. Fixtures:
the layer made hit-testable for paint-order reads, and stored season and fixed
clock and zone on the browser context. Not checked: a deployed URL (QA's
`BASE_URL` mode), and real devices or Safari.
