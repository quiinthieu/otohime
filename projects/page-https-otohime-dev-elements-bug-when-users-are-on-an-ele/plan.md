# Still table: the Elements grid stops jiggling when the dialog closes (pm-197)

**Idea.** "Page: https://otohime.dev/elements. Bug: when users are on an
element's dialog and close it by clicking outside the dialog, the element
table giggles (glitches)."

**Product.** Opening and closing an element's dialog leaves the periodic table
exactly where it was: no sideways snap, no column reflow, and no cell bouncing
up by itself under a pointer that has not moved. A cell lifts on hover again as
soon as the pointer moves. Keyboard users still see the opener lifted
(`:focus-visible`) after Esc.

Research: rep-3763 (the research run before this one), reproduced on the live site at
3e01a0a and checked against main at 54692ce. The full measurements are in
`research.md` next to this file. Only what the task needs is repeated here.

## The two causes (both measured on the live site)

1. **Scrollbar toggle → grid reflow, on every open and close.**
   `elements.css:59` `html:has(dialog[open]) { overflow: hidden; }` removes a
   classic (Windows/Linux) scrollbar while the dialog is open. `clientWidth`
   goes 1351 → 1366, so the fluid 18-column grid inside the centred `.atlas`
   reflows. At 1366×768 the table moves 3 px and grows 9 px wide; at 1920×900 it
   shifts 7.5 px. The backdrop hides the jump on open, so it shows on close.
   Overlay-scrollbar platforms (macOS, mobile) never see this.
2. **Hover lift without a pointer move, on backdrop close only.** The pointer
   is parked over the backdrop, which sits above the table. When the backdrop
   goes, Chrome re-hit-tests, the cell underneath matches `.cell:hover` and
   springs to `scale(1.08)` with the overshooting `--spring` easing.

Ruled out: focus return scrolling the page, a React re-render of the grid, and
a close animation (see research.md).

## Decisions

- **Fix 1: `html { scrollbar-gutter: stable; }`** in `app/(elements)/elements.css`.
  It is one line with no script and no measuring, and `.atlas` keeps a constant
  centre. Cost: when the page is too short to scroll, a classic-scrollbar
  browser shows an empty 15 px gutter on the right. Accepted. Rejected options:
  dropping `overflow: hidden` (the wheel would scroll the page behind the
  backdrop) and padding the body with measured scrollbar widths in JS.
- **Fix 2 is in scope, not optional polish.** The report names the backdrop
  close, and the spontaneous hover lift is the half of the glitch that only that
  path has. When the dialog closes, `.table` gets `data-settle`; the table's
  first `pointermove` removes it. CSS:
  `.table[data-settle] .cell:hover { transform: none; box-shadow: none; }`.
  `:focus-visible` is not suppressed, so the keyboard lift after Esc stays.
- **Proof needs a real browser with scrollbars shown.** The repo has no
  browser tooling, and `walk-elements.sh` only uses curl. A committed probe,
  `scripts/probe-elements-dialog.sh`, installs Playwright into a scratch dir
  under `$TMPDIR` (package.json and CI's `npm ci` stay unchanged). It launches
  headless Chromium with `ignoreDefaultArgs: ['--hide-scrollbars']`; without
  that flag the bug is invisible. It builds and serves like the walk, or takes
  `BASE_URL` to probe a deployed site. A `node:test` stylesheet guard in
  `npm test` keeps both rules from being removed later.

## Change (one software-engineer task)

1. `app/(elements)/elements.css`: add `scrollbar-gutter: stable` to `html`
   (next to the `html:has(dialog[open])` rule, with a one-line comment on why).
   Add the `.table[data-settle] .cell:hover` rule beside the existing
   `.cell:hover` rule.
2. `app/(elements)/_components/table.tsx`: in `onClosed`, mark the table
   settling. Suggested: a `settle` state rendered as `data-settle={settle || undefined}`
   on `.table`, plus `onPointerMove` that clears it. Setting the attribute on
   `grid.current` directly is also acceptable; it is the engineer's call. Update
   the component comment.
3. `app/(elements)/_lib/stylesheet.test.ts` (picked up by the existing
   `npm test` glob): read `elements.css` and assert an `html` rule with
   `scrollbar-gutter: stable` and a `.table[data-settle] .cell:hover` rule that
   sets `transform: none`. Plain file reads only, so `_lib` stays free of React
   and the isolation test stays green.
4. `scripts/probe-elements-dialog.sh` plus its probe module. Use the same
   conventions as `walk-elements.sh`: `ok -` / `not ok -` lines, PORT default
   4031 (not 4045), `SKIP_BUILD=1`, `BASE_URL` remote mode, and cleanup of the
   server process group. Viewport 1366×768, scrollbars shown. Checks:
   - **steady table, backdrop close:** open Fe (26), click the backdrop at
     (40, Fe-row centre). `.table` `getBoundingClientRect()` x and width are
     equal (±0.5 px) before open, while open and 300 ms after close.
   - **steady table, Esc and Close button:** the same equality for the other
     two close paths.
   - **no spontaneous lift:** open Fe, click the backdrop at (80, Fe-row
     centre), where a cell lies under the pointer. 150 ms and 450 ms after
     close, the hovered cell's computed `transform` is `none`.
   - **hover still works:** after that, `mouse.move` by 2 px. 350 ms later the
     hovered cell's transform is a `matrix(1.08…`.
   - **focus returns:** after each close path `document.activeElement` is the
     opener (`a[data-element="26"]`).
   - Before the fix, the probe fails on the steady-table and no-lift checks
     (state this in the commit or the report, with the numbers).
5. README: one sentence after the `walk-elements.sh` paragraph on how to run the probe (local and `BASE_URL`).

## Out of scope

- Any change to `element-dialog.tsx`, the dialog's open animation, or the
  bottom-sheet layout under 768 px.
- Removing `overflow: hidden` while the dialog is open.
- Wiring the probe into CI, and adding Playwright to `package.json`.
- Other projects' dialogs or scrollbars.

## Verification (all runnable in the checkout, no waiting)

- `npm ci && npm test`: includes the new stylesheet guard and the isolation tests.
- `npm run lint` and `npm run typecheck`.
- `bash scripts/walk-elements.sh`: the existing walk still passes.
- `bash scripts/probe-elements-dialog.sh`: builds, serves on :4031, and every
  check is `ok`.
- QA (not the engineer): at 1366×768 and 1920×900 in a browser with classic
  scrollbars, open and close by backdrop, Esc and the Close button. The table
  does not move and no cell lifts until the mouse moves. At 390 px the bottom
  sheet still opens and closes normally.
- Acceptance after deploy: `BASE_URL=https://otohime.dev bash scripts/probe-elements-dialog.sh`.

## Task graph

1. **Keep the table still when the element dialog closes**, software_engineer,
   no dependencies. Two small style/handler edits, a guard test and a probe,
   in one task and one review.
