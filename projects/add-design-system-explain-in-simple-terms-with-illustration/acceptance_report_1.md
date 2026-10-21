---
plan_id: pm-216
run_id: run-7140
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 06b5b196b3ce145c8f430583e245942707e57544
---

# Acceptance: Design System Knob Board (pm-216), cycle 1

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| `otohime.dev/projects`, 1366x768 and 390x844, light | Inspect the projects bench; click "Design system" | One `/design-system` link, eleventh row on the bench, with the coral dot (`#ef6a4c`, `rgb(239, 106, 76)`) and note "A box of decisions made once, drawn so you can turn the knobs."; the title carries `--vt:project-design-system` and view-transition hops into `/design-system` whose visible `h1` "Design system" has `view-transition-name: project-design-system` | `walk.mjs` desktop/mobile lines 1–6; `shots/desk-01-projects.png`, `shots/phone-01-projects.png`; `scripts/probe-motion.sh` 510/510 ok: "pageswap carries a view transition", "pagereveal carries a view transition of type hop", "the old page fades out in 150 ms", "the new page fades in over 210 ms after 150 ms", "the title moves as project-design-system" |
| `/design-system` | Read the page and inspect the four drawings | Four figures present in order: Fig. 01 The box (painter's box with 8 pots, 9 parts, 3 patterns, rulebook), Fig. 02 The board (sample screen and knobs), Fig. 03 One knob, nine parts (system vs no system comparison columns), Fig. 04 Right here (honest audit of 11 stylesheets, 10 --paper, 8 creams); 27 stamps inked on server in `<defs>`; text is plain and legible, 180-350 words at FK grade ≤ 8; 3 allowlisted sources linked | `shots/desk-02-design-system.png`, `shots/phone-02-board.png`; `scripts/walk-design-system.sh`: "draws its four figures once each, in order", "inks 27 stamps into <symbol>s", "places nine parts" |
| `/design-system`, start state | Read counter and rule line | Counter reads "Turn a knob and watch what follows."; rule line reads "Ink on paper 15.5 to 1, passes. Spot on paper 6.2 to 1, passes." (passes WCAG contrast) | `walk.mjs` checks; `scripts/walk-design-system.sh`: 52/52 ok |
| `/design-system`, hydrated | Turn Spot knob from blue to coral | Counter updates to "1 knob turned. 9 parts followed."; all nine parts marked hot and glide over 0.15s; button accent computes to coral (`#ef6a4c`, `rgb(239, 106, 76)`); decoded screenshot pixels confirm solid coral fill in button centre-left `[239, 106, 76]` and note accent pixels ≥ 0.2% (measured 0.36%); rule line recomputes contrast and fails: "Spot on paper 2.8 to 1, fails." | `shots/desk-03-spot-coral.png`, `shots/phone-03-spot-coral.png`; `walk.mjs` desktop/mobile pixel checks; `scripts/probe-design-system.sh`: 94/94 ok |
| `/design-system`, Spot coral | Toggle "No system" switch ON | Counter says "System off: every part keeps its own values."; parts assume private mixed values; rule line reads "No system on: parts pick their own spots, so there is no rule to check." | `shots/desk-04-no-system.png`; `walk.mjs` check |
| `/design-system`, No system ON | Turn Spot knob to mint | Knob moves nothing on the board; counter updates to "1 knob turned. 0 parts followed. 9 to fix by hand."; no parts marked hot; button and note fills remain unchanged | `shots/desk-05-no-system-spot-mint.png`; `walk.mjs` check; `scripts/probe-design-system.sh` |
| `/design-system`, No system ON | Toggle "No system" switch OFF | Counter updates to "System on: 9 parts follow the pots again."; all 9 parts rebind to board pots | `walk.mjs` check; `scripts/probe-design-system.sh` |
| `/design-system` | Click "Dress as Gazette" | Board paper re-paints in Gazette's cream (`#f3eee3`, `rgb(243, 238, 227)`), matching `/articles`; counter says "Dress as Gazette: 9 parts followed." | `shots/desk-06-dress-gazette.png`; `walk.mjs` check; `scripts/probe-design-system.sh` |
| `/design-system`, dressed | Click "Reset" | Board restores DEFAULT pots (Paper cream, Spot blue, Corner rounded, Gap neat, Size medium, Speed steady, Face cursive); counter says "Back to the start."; Spot blue radio checked; rule line passes | `shots/desk-07-reset.png`; `walk.mjs` check; `scripts/probe-design-system.sh` |
| `/design-system` | Click "← All projects" | Navigates back to `otohime.dev/projects` | `walk.mjs` check |
| 320x640 viewport | Load `/design-system` | `document.documentElement.scrollWidth` is 320; page fits within 320 px without horizontal scrolling | `shots/phone-320px.png`; `walk.mjs` check; `scripts/probe-design-system.sh` check |
| JavaScript OFF, 1366x768 and 390x844 | Load `/design-system` with `javaScriptEnabled: false` | Server renders complete finished start drawing with 9 parts and 27 stamps; knobs fieldset is disabled (`fieldset[data-knobs].disabled === true`); start sentences rendered in counter and rule line | `shots/desk-nojs.png`; `walk.mjs` check; `scripts/walk-design-system.sh` check; `scripts/probe-design-system.sh` check |
| Dark mode (`colorScheme: dark`), reduced motion | Load `/design-system`; keyboard only: focus Spot blue, press ArrowRight | Root paper resolves to `#161513` (`rgb(22, 21, 19)`); transition-duration is 0s (turns land at once, no glide); ArrowRight selects Spot coral and counter updates to "9 parts followed"; Paper night with Spot blue fails contrast ("Spot on paper 2.7 to 1, fails."), Spot yellow passes ("Spot on paper 10.2 to 1, passes.") | `shots/desk-dark.png`; `walk.mjs` checks; `scripts/probe-design-system.sh` checks |
| Accessibility (axe-core) | Run axe `wcag2a`, `wcag2aa`, `wcag21aa` on `/design-system` across light and dark at 1366x768 and 390x844 | 0 serious or critical violations found | `scripts/probe-design-system.sh` checks |
| Console and page logs | Monitor browser console and page errors across all walks | 0 console errors and 0 page errors across every viewport and interaction | `walk.mjs` desktop/phone logs; `scripts/probe-design-system.sh` no console errors |
| Repo test suites against deployed site | Run `walk-design-system.sh`, `probe-design-system.sh`, `probe-motion.sh` with `BASE_URL=https://otohime.dev` | `walk: 52 ok, 0 failed`; `probe: 94 ok, 0 failed`; `probe-motion: 510 ok, 0 failed` | Output logs from scripts |

## Deployed sha and delivery verification

- **Deployed SHA:** `06b5b196b3ce145c8f430583e245942707e57544` served on `/`, `/projects` and `/design-system`.
- **Delivery SHA:** `84ec6ed8563c6d1cf7eaeb5500ce4da2513f17d3` (t-1239 delivery sha). `git merge-base --is-ancestor 84ec6ed 06b5b19` exits 0, confirming the deployed commit contains the delivery. Commit `06b5b19` added watercolor sketches and did not modify any `app/(design-system)` files.
- **Done tasks green:**
  - t-1237 (76d1d95): Design system engine and words (pots, parts, turns, contrast, sibling pins, copy).
  - t-1238 (427727d): Design system ink: 27 stamps, board scenes, 3 figures.
  - t-1239 (84ec6ed): Design system at `/design-system`: page, board, hop, walk, probe. Closed fill defect resolved with solid fills on buttons/notes.
- **Author Identity:** `git log 8ab7f92^..HEAD` confirms all commits for pm-216 are authored and committed by `Otohime <quiinthieu@gmail.com>` with no `Co-Authored-By` trailer. No `author.txt` came with delivery evidence; identity read from git.
- **Service logs:** `otohime.dev` is a static/serverless Vercel deployment; browser console and page error telemetry across all visits recorded 0 errors.

## How it was walked

1. Installed `playwright@1.64.0` and `axe-core@4.11.0` in `/tmp/acc216`.
2. Executed independent browser walk `walk.mjs` in headless Chromium across 1366x768, 390x844 (mobile, touch), 320x640, JavaScript-off, and dark mode with reduced motion. 13 full-page screenshots captured in `/tmp/acc216/shots/`.
3. Verified button and note fills by decoding raw PNG screenshot pixels (`decodePng`), proving that `[239, 106, 76]` coral pixels paint the center of the Send button and >0.2% of the note stamp.
4. Executed repo acceptance scripts against production:
   - `BASE_URL=https://otohime.dev EXPECT_SHA=06b5b19... bash scripts/walk-design-system.sh`: 52 ok, 0 failed.
   - `BASE_URL=https://otohime.dev bash scripts/probe-design-system.sh`: 94 ok, 0 failed.
   - `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh`: 510 ok, 0 failed.
5. Ran project tests: `npm test` passed 1419/1419 tests; lint (0 errors) and typecheck passed.
