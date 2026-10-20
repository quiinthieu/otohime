# Research: the Elements table jiggles when the dialog is closed by clicking outside (pm-197)

**Verdict: reproduced on https://otohime.dev/elements at build-sha 3e01a0a (the checkout's HEAD). Two causes, both in `app/(elements)/elements.css`; neither needs the dialog code to change.**

## What the user sees

Click an element, then click the dim backdrop. The moment the dialog vanishes:

1. **The whole grid snaps sideways and every cell changes width.** On a 1366×768 laptop the table moves 3 px and widens 9 px, so cells on the right slide up to 9 px; on 1920×900 the table translates 7.5 px. The same jump happened on open, hidden behind the 45 % backdrop and the pop animation, so the close is where it registers.
2. **The cell under the pointer springs up on its own.** The cursor was parked over the backdrop, which sits over the table. When the backdrop disappears, Chrome re-hit-tests without any mouse movement, that cell matches `.cell:hover` and scales to 1.08 with the overshooting `--spring` easing. A random cell "bounces" right as the table shifts.

Together: "the table giggles". Both effects were measured with headless Chromium 1248 (Playwright) against the live site, sampling `getBoundingClientRect()` of `.table`, the hovered cell's computed transform, `document.documentElement.clientWidth` and the html `overflow` every 50 ms around the close.

## Cause 1: the scrollbar toggles, so the fluid grid reflows

`elements.css` line 59:

```css
html:has(dialog[open]) { overflow: hidden; }
```

When the page has a classic (non-overlay) scrollbar, hiding overflow removes it: `clientWidth` goes 1351 → 1366 while the dialog is open and back on close. The table is `grid-template-columns: repeat(18, minmax(60px, 1fr))` inside `.atlas { max-width: 1360px; margin: 0 auto }`, so 15 px of extra width is redistributed across all 18 columns (narrow viewports) or shifts the centred page by half the bar (wide viewports).

Measurements (live site, Chromium, scrollbars shown):

| Viewport | Page scrolls? | Table x / width closed | Table x / width while open | Shift on close |
| --- | --- | --- | --- | --- |
| 1366×768 | yes (1094 px tall) | 40.97 / 1269.06 | 43.97 / 1278.06 | 3 px move, 9 px reflow, every cell +0.5 px |
| 1920×900 | yes | 330.09 / 1244.81 | 337.59 / 1244.81 | 7.5 px translate |
| 1366×1200 | no scrollbar | 43.97 / 1278.06 | 43.97 / 1278.06 | none |

This happens on **every** close path (backdrop, Esc, Close button were each measured) and on open. It is invisible on macOS/iOS/Android overlay scrollbars, which is probably why the earlier QA walk (Chrome, lease) did not flag it.

## Cause 2: a hover lift fires without a pointer move, only on backdrop close

`elements.css`:

```css
.cell, .marker { transition: transform 0.3s var(--spring), box-shadow 0.2s ease, opacity 0.2s ease; }
.cell:hover, .cell:focus-visible { transform: scale(1.08); box-shadow: 0 6px 16px var(--shadow); z-index: 1; }
```

Backdrop click at (80, Fe-row) on 1366×768: at close+0 ms potassium (19) is `:hover` with transform 1; at +100 ms it is at scale 1.0816 (the spring overshoot), settling at 1.08. The Close button sits over the page heading at that size, so a button close hovers nothing; Esc instead lifts the opener via `:focus-visible` (keyboard), which is intended. So this half of the glitch is specific to clicking outside, matching the report.

## Ruled out

- **Focus return scrolling the page.** `onClosed` calls `opener.focus()` without `preventScroll`. With cerium (bottom row) cut by the viewport edge, `scrollY` stayed at 92 before, during and after the close, and the horizontal scroller stayed at 0. Chrome already focused the cell on mousedown and restores it natively on `close()`, so the extra `focus()` is a no-op.
- **React re-render on `dispatch({type:"close"})`.** Only the dialog reads `state`; the 118 cells keep the same tabIndex and style, nothing in the grid DOM changes.
- **A close animation.** `.element-dialog[open]` only animates on open; the dialog and backdrop disappear in one frame.

## Fixes, verified by injecting them into the live page

Both were injected with Playwright `addStyleTag` and the same probe re-run.

**1 (the bug): reserve the scrollbar gutter.** Add to `html` in `elements.css`:

```css
html { scrollbar-gutter: stable; }
```

Result: table x/width 40.52 / 1269.97 before, during and after the dialog; `clientWidth` still toggles 1351/1366 but the layout no longer moves. Cost: on a page too short to scroll, classic-scrollbar browsers keep a 15 px empty gutter on the right; overlay-scrollbar platforms are unchanged. Supported in Chrome 94+, Firefox 97+, Safari 18.2+ (older Safari uses overlay bars, so nothing to fix there). This beats the padding-right JS trick (measure the bar, pad the body while open): no script, no measuring, and `.atlas` keeps a constant centre.

Alternative considered and rejected: dropping the `overflow: hidden` rule. A modal `<dialog>` makes the page inert but the wheel still scrolls the document behind the backdrop, which the rule exists to stop.

**2 (the polish, optional): hold the hover lift until the pointer actually moves.** On the dialog's `close` event set `data-settle` on `.table`; remove it on the table's first `pointermove`:

```css
.table[data-settle] .cell:hover { transform: none; box-shadow: none; }
```

Result: after the backdrop click the cell under the pointer stays at `transform: none` (+150 ms, +450 ms); after a 2 px mouse move it lifts normally (1.0812 at +350 ms). About three lines in `table.tsx` (the `onClosed` handler already runs on `close`) plus one CSS rule. Keyboard users are unaffected: `:focus-visible` keeps lifting the opener after Esc.

## Suggested task shape

One SWE task, `app/(elements)/elements.css` (+ `table.tsx` if fix 2 is taken). Verification that proves it without a person:

- A Playwright/CDP probe on `next start` at 1366×768 with `ignoreDefaultArgs: ['--hide-scrollbars']`: open Fe, close via a click at (40, Fe-row centre); assert `.table` `getBoundingClientRect()` x and width are equal before open, while open and 300 ms after close (today: 40.97→43.97→40.97 and 1269→1278→1269).
- Same probe, click at (80, Fe-row): assert the `.cell:hover` computed transform is `none` 150 ms after close, and `matrix(1.08…)` 350 ms after a 2 px `mouse.move` (only if fix 2 is taken).
- Esc and Close-button closes keep returning focus to the opener (existing `scripts/walk-elements.sh` is curl-only, so this stays in the probe).
- `npm run lint && npm run typecheck && npm test` green.

Probe scripts used here: `/tmp/probe/backdrop.mjs`, `edge.mjs`, `fix.mjs` (Playwright, chromium_headless_shell-1248 installed with `npx playwright install chromium --only-shell`; no system packages needed on the job pod). Screenshots of the open and closed states at 1366×768 are in `/shared/artifacts/elements-dialog-{open,closed}-1366x768.png`.
