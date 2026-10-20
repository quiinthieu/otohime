# Page-styled dropdowns: the open picker wears the page (pm-198)

**Idea.** "All dropdown input fields are using the system-native dropdown menu.
The style does not match the current pages they're on. Fix it."

**Product.** When someone opens one of the site's three dropdowns, the list
that drops down looks like part of the page, not the operating system:

- **Site** (Colour on the /music add-channel form, Role on /admin/users/[id]):
  a paper card with an ink border, the 10 px `.field` radius and the hard 2 px
  ink shadow of `.chip:hover`. Options hover in `--paper-2`, and the picked
  option is yellow with `--on-swatch` ink. It follows the light or dark theme,
  whether the OS picks it or the toggle pins it.
- **Vinyl** (Genre in the crate on /vinyl): a `--card` panel with a `--line`
  border and 8 px radius. Options hover in `--raised`, and the picked option is
  bold `--accent` on `--bg`, like the "on platter" badge.

Keyboard, type-ahead, form submission, labels and screen readers behave exactly
as today, because each one is still a native `<select>`.

Research: rep-3767 (`research.md` in this folder), checked against main at
ec39dad. This plan repeats only what the task needs.

## Constraints that shape the work

- **Only the open popup is foreign.** The closed `select.field` is already
  `appearance: none` with the page's chevron, border and paper. Classic CSS
  cannot reach the OS popup. CSS customizable select (`appearance:
  base-select` on the select and on its `::picker(select)`) can, in Chromium
  135+ and Safari 27. Firefox has not shipped it.
- **Progressive enhancement, nothing removed.** Every new rule sits inside
  `@supports (appearance: base-select)`. Firefox and older browsers keep
  today's native popup unchanged. No JavaScript, no TSX, no new component.
- **No `<selectedcontent>` / `<button>` inside the selects.** React 19 does not
  know `selectedcontent`, and the pattern breaks SSR hydration. Plain options
  are all three fields need.
- **Where the rules live.** In `app/(site)/globals.css` the block goes inside
  `@layer components`, directly after `select.field`, so the cascade order is
  the one the existing rule already uses. Vinyl is its own root layout with a
  hand-written stylesheet, so its block goes in `app/(vinyl)/vinyl.css`, after
  `.crate-filters select`, in that file's one-line-rule voice. Vinyl must never
  import site tokens (`isolation.test.ts`).
- **The build keeps the rules.** lightningcss 1.32 (in the lockfile) leaves
  `@supports (appearance:base-select)`, `::picker(select)`, `::picker-icon` and
  `::checkmark` intact, minified or not, with no warnings. I checked this on the
  lease. The walks still assert it on the served stylesheet.
- **The closed box must not move.** `base-select` swaps in the UA's base
  button styles, so anything `.field` does not set could shift (display, gap,
  min block size). The closed select stays the same height as a neighbouring
  `.field` input (site) or the search input (Vinyl), within 1 px.
- **Repo has no browser harness.** The browser probe installs Playwright into
  a temp prefix at run time. `package.json` and `package-lock.json` stay
  unchanged. The owner form and the admin page need Postgres and auth, so the
  probe injects a `select.field` into the served `/projects` page. That runs the
  same built stylesheet and tokens with no database. `/vinyl` is probed as-is.

## Change (one software-engineer task)

1. `app/(site)/globals.css`: add the site block from `research.md` ("Proposed
   rules for app/(site)/globals.css") inside `@layer components`, after
   `select.field`. Keep the gradient chevron and hide `::picker-icon`. If the
   closed box's height or padding shifts under `base-select`, pin it in the same
   block (e.g. `display: block` / `min-block-size`), not by editing `.field`.
2. `app/(vinyl)/vinyl.css`: add the Vinyl block from `research.md` after
   `.crate-filters select`. Use one-line rules, Vinyl tokens only.
3. `scripts/walk-vinyl.sh`: add checks on the already-fetched Vinyl stylesheet:
   - `/vinyl stylesheet styles the select picker`: matches
     `@supports *\(appearance: *base-select\)` and `::picker\(select\)`.
   - `/vinyl stylesheet keeps base-select inside @supports`: no
     `base-select` or `::picker(` outside an `@supports (appearance:
     base-select)` block. This is a small `node -e` brace walk over the fetched
     file; a grep cannot see nesting.
4. `scripts/walk-music.sh`: fetch every `/_next/static/…css` linked from
   `/music` (the site stylesheet) and add the same two checks, named `/music
   stylesheet …`. This is where the site's `select.field` rules ship.
5. New `scripts/probe-selects.sh` (+ `scripts/probe-selects.mjs`): builds
   (unless `SKIP_BUILD=1`), runs `next start` on `PORT` (default 4033; remap
   reserved ports the way `walk-vinyl.sh` does), installs
   `playwright@1.64.0` into `$(mktemp -d)` with `npm i --prefix`, runs
   `playwright install chromium --only-shell`, then runs the `.mjs` with that
   prefix on `NODE_PATH` (or via `createRequire`). Viewport 420×600. Prints one
   `ok -` / `not ok -` line per check and ends with the same `probe: N ok, M
   failed` summary and exit status as the walks. Checks:
   - **Vinyl** (`/vinyl`, real genre select): computed `appearance` is
     `base-select`. Click it and `select.matches(':open')` is true. The
     `::picker(select)` computed `backgroundColor` is `rgb(42, 35, 30)`
     (`--card`). ArrowDown then Enter moves the value off `""` (All) and closes
     the picker. The closed select's height equals the search input's ±1 px.
   - **Site, light and dark** (`/projects`, with
     `document.documentElement.dataset.theme` set to `light` then `dark`):
     inject `<input class="field">` and `<select class="field">` with the five
     swatch keys from `lib/songs.ts` (`SWATCH_KEYS`) into `<main>`. Assert `appearance` is
     `base-select` and the picker opens. The picker background is `rgb(242,
     239, 231)` in light and `rgb(28, 25, 21)` in dark (`--paper`). The checked
     option's background is `rgb(244, 184, 41)` (`--yellow`). ArrowDown + Enter
     advances the value and closes the picker. The select's height equals the
     input's ±1 px.
   - Screenshot each open picker to `${ARTIFACTS_DIR:-$TMPDIR}` and print the
     paths. Screenshots are for QA; no check reads them.
6. README: one line after the walk lines (around line 119) for `probe-selects.sh`. Note that
   the dropdown pickers are customizable selects behind `@supports`, so Firefox
   keeps the native popup.

## Out of scope

- A custom listbox/combobox component, or rich option content
  (`<selectedcontent>`, swatch dots in options).
- Turning Colour into `.swatch` radio chips.
- Firefox styling (not possible until it ships `base-select`).
- Any change to the closed box's look beyond keeping it where it is.
- Adding Playwright to `package.json` or to CI.

## Verification (all runnable in the checkout, no waiting)

- `npm ci && npm run lint && npm run typecheck && npm test` (isolation tests
  prove Vinyl imports nothing from the site).
- `bash scripts/walk-vinyl.sh` and `bash scripts/walk-music.sh`: build, serve,
  exit 0, and the new stylesheet lines are `ok`.
- `bash scripts/probe-selects.sh`: exit 0 with every check `ok` in headless
  Chromium.
- QA (not the engineer) opens each of the three dropdowns in Chrome at 390 px
  and 1366 px, light and dark for the site ones (owner and admin sign-in). QA
  confirms the picker matches the page, the keyboard still works, and Firefox
  still shows the native popup with nothing broken.
- After deploy (acceptance): `BASE_URL=https://otohime.dev bash
  scripts/walk-vinyl.sh` and `… walk-music.sh`, plus
  `BASE_URL=https://otohime.dev bash scripts/probe-selects.sh` (remote mode:
  no build or start).

## Task graph

1. **Style the dropdown pickers like their pages** (software_engineer, no
   dependencies). It is one task: two CSS blocks with one pattern, two walk
   checks, one probe and one review.

## Cycle 1: the Vinyl Genre picker keeps its keyboard

Change request `change_request_0.md` (acceptance at 83881c1): on /vinyl, with
a record on the platter, keys pressed inside the open Genre picker reach the
deck. Escape ejects the record and the picker stays open. Space on a
highlighted genre plays or pauses. ArrowLeft/ArrowRight change the record.
t-1135 (the CSS, the walks and `probe-selects.sh`) stays as delivered.

**Cause.** While a customizable select's picker is open, focus is on an
`<option>`. The deck's `onKeyDown` in `app/(vinyl)/_components/vinyl-app.tsx`
skips only targets whose `tagName` is INPUT/SELECT/TEXTAREA. An OPTION falls
through, and the handler takes Space, the arrows and Escape and calls
`preventDefault()`, so the picker never sees them. The probe only pressed
ArrowDown+Enter, which the deck ignores, so it missed this.

**Sweep.** No other route group has this bug. Selects live only in
`crate.tsx`, `add-channel-form.tsx` and `user-actions.tsx`. The home handheld
(`components/handheld.tsx`) already skips `closest("input, textarea, select,
[contenteditable]")`, and that covers options. The Elements table and dialog
handlers sit on pages with no select. `turntable.tsx` handles keys only on its
own arm. The capture `keydown` in `sleeve-drag.ts` is bound only during a drag.
The site's Colour and Role pickers already close on Escape.

### Change (one software-engineer task)

1. `vinyl-app.tsx`: the deck skips any key whose target is inside a form
   control, using the handheld's test:
   `el.closest("input, select, textarea, [contenteditable]")`. That replaces
   the `tagName` list, keeps `isContentEditable`, and updates the comment.
   Everything else stays the same: Space on a button, the modifier and
   `defaultPrevented` guards, and the four shortcuts on the deck and turntable.
2. `scripts/probe-selects.mjs`: a new `/vinyl keys` section at 1366×768 and
   390×844. Each round reloads `/vinyl` and clicks the first `button.place` so
   a record is on the platter. It reads `.deck[data-phase]` and the record
   (the turntable's `aria-label` / `.deck` state) before every key. Checks:
   - Open Genre, press Escape: the picker closes (`:open` false), the value
     stays `""`, and the deck phase and record do not change.
   - Open Genre, press ArrowDown then Space: the value leaves `""`, the picker
     closes, and the deck phase does not change (no play).
   - Open Genre, press ArrowRight (and ArrowLeft): the picker stays open or
     closes the way the browser decides, but the record on the platter and the
     deck phase do not change. Then press Escape to close it.
   - Control, picker closed, focus on `.turntable-cell`: ArrowRight changes
     the record and Escape takes the deck to `empty`. The deck keeps its
     shortcuts.
   - Each check prints `ok -` / `not ok -`, and the run ends with the existing
     `probe: N ok, M failed` summary.
3. `scripts/probe-selects.sh`: update the header comment to say it now presses
   Escape, Space and the arrows inside the open Vinyl picker with a record
   loaded. No new env.
4. README line 123: add "and the keys inside the open Vinyl picker" to the
   probe-selects sentence.

### Out of scope

- Any CSS change. The look passed acceptance everywhere.
- Changes to the site pickers, the handheld, the Elements handlers or the
  turntable arm keys.
- A custom listbox, or adding Playwright to `package.json` or CI.

### Verification (runnable in the checkout, no waiting)

- `npm run lint && npm run typecheck && npm test`.
- `bash scripts/probe-selects.sh`: builds, serves on :4033 and exits 0. Every
  `/vinyl keys` line is `ok`, and so are the existing picker checks. Against
  main before the fix, the Escape and Space lines print `not ok`, which proves
  the probe would have caught the bug.
- `bash scripts/walk-vinyl.sh`: exits 0.
- QA, in Chrome at 1366 and 390 px: place a record, open Genre, then press
  Escape, Space and the arrows. Check that the deck's shortcuts still work on
  the turntable.
- Acceptance after deploy: `BASE_URL=https://otohime.dev bash
  scripts/probe-selects.sh` and the change request's `acceptance-keys.mjs`.

### Task graph (cycle 1)

1. **Keep keys inside the open Vinyl picker** (software_engineer, no
   dependencies).
