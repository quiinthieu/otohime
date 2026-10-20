---
plan_id: pm-198
run_id: run-6663
kind: change_request
cycle: 0
cited_sha: 83881c1d9c6f8dadfbd6678cf433519dc6b7c9ff
---

# Change request: the Vinyl Genre picker must keep its keyboard (pm-198, cycle 0)

## What a user still cannot do

On https://otohime.dev/vinyl, a keyboard user who opens the Genre dropdown cannot close it with Escape. With a record on the platter, each key has a side effect instead:

- **Escape** ejects the record, and the picker stays open.
- **Space** on a highlighted genre starts or pauses playback instead of picking that genre.
- **ArrowLeft/ArrowRight** change the record on the turntable while the picker stays open.

Before pm-198, the native popup handled all of these keys. Task t-1135 promised "keyboard and form behaviour are unchanged", and on Vinyl that no longer holds. Mouse use, ArrowUp/Down, Home and Enter still work. The look is right everywhere: the Vinyl card picker and the site's paper/ink/yellow picker in light and dark, at 1366x768 and 390x844. Firefox keeps its native popup.

## Evidence

- `acceptance-keys.mjs` in this folder, run against production builds 40e9d7c and 83881c1 in Chromium 156. Place a record, then open Genre. Escape leaves `:open` true and moves the deck from `loaded` to `empty`. Space leaves the value at "" and moves the deck to `playing`. ArrowRight changes the record.
- `acceptance-walk.mjs`: `not ok - 1366x768 /vinyl Escape closes the picker and keeps All (open=true value="")`, and the same at 390x844.
- Control: a bare `<select>` with `appearance: base-select` in the same browser closes on Escape. So the page is causing this, not the browser.
- Cause: when a customizable select's picker is open, focus is on an `<option>`. The deck's `onKeyDown` in `app/(vinyl)/_components/vinyl-app.tsx` (lines 321-342) exempts only INPUT/SELECT/TEXTAREA targets. It handles Space, the arrows and Escape for the OPTION target and calls `preventDefault()`.

## Service

otohime web app (Next.js on Vercel), the Vinyl route group `app/(vinyl)`. The site's Colour and Role pickers are not affected.

## Work for the product owner

Plan one task so that keys pressed inside any open select picker on /vinyl reach the picker, not the deck. Escape closes it without a change, Space/Enter pick, and the arrows move through options. The deck keeps its shortcuts everywhere else. Acceptance should prove it in a browser against the deployed site, with a record loaded: open Genre, then press Escape, Space and ArrowRight, and check that the picker behaves natively and the deck does not change. The same check belongs in `scripts/probe-selects.sh`, which today only presses ArrowDown and Enter and so missed this. Sweep the other route groups for page-level key handlers that would claim keys from an open picker too (the home page handheld already exempts `select` through `closest`, which covers options).
