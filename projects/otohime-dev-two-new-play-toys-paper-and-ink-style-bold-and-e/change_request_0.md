---
plan_id: pm-294
run_id: run-9303
kind: change_request
cycle: 0
cited_sha: 68dd79dba309c7713122e08b02ebb4e6844de749
---

# Change request: Pipeline Pachinko is not playable as an ink-and-paper machine (pm-294, cycle 0)

The Ink Purikura Photobooth is done and live. This request covers only Pipeline Pachinko and its delivery.

## What a visitor still cannot do

1. **Play Pipeline Pachinko on otohime.dev at all.** `https://otohime.dev/play/pachinko` returns 404. Production serves `22a88f0` because main CI failed for both pachinko commits:
   - run 40633395018 (`f50d7aa`): "E2E against next start has timed out after 12 minutes"; `e2e/bottle-ui.test.ts:185` "sceneTop: Bottle state preserves reserved footer geometry".
   - run 40635091133 (`68dd79d`): "Gate: Footer Chromium probe; exit 1 … not ok - network: zero unexpected external network requests from footer pages: /music → https://www.youtube.com/embed/…" (175 ok, 1 failed).
   These tests are outside pm-294's files, but until main is green and the production job runs, this plan delivers nothing for Pachinko. The `/play` teaser links ship with the same commit, so they are also missing in production.
2. **See and pull a plunger, or recognise the controls as buttons.** `pachinko.css` styles everything with `var(--fg)`, `var(--bg)` and `var(--accent)`, which this site does not define (its tokens are `--ink`, `--paper`, …). In the browser those three variables are empty strings, so every declaration built on them (77 `var()` uses) drops out. The plunger track and knob are invisible: only the vertical word "PLUNGER ↓" shows. "Launch record", "Backfill (60 records)", nudge, tilt and sound controls render as bare bold text. The machine has no frame. Seen at 1366×768 and 390×844.
3. **Get the paper "on-call pager" gag.** It fires correctly (`role="dialog"`, focus on dismiss, inside the viewport, streak reset), but it has no paper, border or background. Its text prints over the board and bucket labels on desktop, and over "Back to Play" and the Bottle widget on mobile. A visitor sees overlapping text, not a pager.
4. **Read the page header while playing.** The sticky status bar is transparent, so on scroll "IN-FLIGHT … SETTLED … DLQ STREAK", "Peg clicks" and "Enable tilt" overprint the site logo, Sign in and theme controls.
5. **Run a backfill that drains.** After every Backfill, 7–10 of about 37 records stay "IN-FLIGHT" forever, lodged on the join funnel's slanted arms against the blue pegs. Measured for 60 s with the default seed (7), and after 40 s with seeds 777 (10), 424242 (8) and 20261028 (7). Records/sec decays to 0 while the counter still shows records in flight. The plan's own outcome says the funnel "never stalls". A visitor's later backfills keep adding to the jam.

## Evidence

`projects/otohime-dev-two-new-play-toys-paper-and-ink-style-bold-and-e/acceptance_report_0.md` holds the walkthrough. In short: production `/api/health` returns `22a88f0…`; I built origin/main `4614484` (app code = `68dd79d`) locally with `next build` + `next start` and walked it in Chrome 155 at both viewports. `getComputedStyle(document.documentElement)` gives `--fg=""`, `--bg=""`, `--accent=""`. `.pachinko-root`, `.pachinko-status-bar`, `.pachinko-btn` and `.pachinko-plunger-track` compute `border: 0px none; background: transparent`. In the 60-second Backfill trace, IN-FLIGHT goes 60 → 40 → 15 → 8 → 7 and stays at 7. All of this passed task QA because the e2e suite asserts data attributes and bounding boxes, not what the visitor sees, and never waits for a backfill to drain.

## Service

otohime.dev Next.js site (Vercel project, `app/(site)/(app)/play/pachinko/**`, `lib/pachinko/sim.ts`) and the main-branch CI gate in `.github/workflows/ci.yml` that blocks its production deploy.

## Work for the product owner

- Get Pipeline Pachinko deployed. Main CI must pass the E2E step within its time budget and the footer probes, so the production job runs and `/api/health` serves a sha containing the pachinko work.
- Make the Pachinko page look like the paper-and-ink machine the idea describes, using the site's own colour tokens. The page needs a visible plunger to pull, controls that look like buttons, a framed board, a status bar that doesn't overprint the header, and an on-call pager that reads as a paper card on desktop and mobile.
- Make the pipeline drain: every record launched by a Backfill must end in a partition bucket or the DLQ within a bounded time, with no records resting on the funnel.
- Have the acceptance checks for this toy prove what a visitor sees: computed styles or pixels for the plunger, buttons and pager, and a backfill that reaches IN-FLIGHT 0.
- Optional polish: on the booth strip, the hanko date text is wider than the stamp ring.
