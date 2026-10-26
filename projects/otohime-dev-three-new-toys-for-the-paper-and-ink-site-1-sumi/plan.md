# Plan pm-251: Paper Toys Trio (Suminagashi Pond, Letterpress Keys, Fold-a-Zine)

Run: run-8624. Research: research.md (rep-5009).

## Goal
Three independent additions to the paper-and-ink otohime.dev site:
1. **Suminagashi Pond** on /play: a vector marbling toy (drip, comb, blow), four inks, pull a PNG print, set as page background.
2. **Letterpress Keys**: debossed, grainy, press-depth buttons / nav items / cartridge labels with a quiet paper-thunk cue.
3. **Fold-a-Zine**: `/zine`, a print-ready one-sheet 8-page fold zine (A4 or Letter).

## Principles
- No operator steps, no waiting. Every claim is proven now: node unit tests, a fake AudioContext, Playwright on a local build, PDF parsing.
- No new dependencies. No `Math.random` (seeded hashes). New CSS in new files; do not touch `globals.css` or `lib/pages.ts` (pm-250 is editing them).
- Run `npm ci` first. Quote `app/(site)/...` paths. Commit with `git -c user.name=Otohime -c user.email=quiinthieu@gmail.com`, no trailers.
- Existing probes (probe-cartridges, probe-motion, probe-peeks) must stay green.

## Tasks and order
| # | Task | Depends |
|---|------|---------|
| 1 | Zine model (`lib/zine.ts`, `site.zine`) | - |
| 2 | `/zine` page, print CSS, Print island, footer link, walk + PDF probe | 1 |
| 3 | `press` cue and `wave` on Cue | - |
| 4 | Letterpress CSS | - |
| 5 | Press sound listener + probe-letterpress + regression probes | 3, 4 |
| 6 | Marble model (`lib/marble.ts`) | - |
| 7 | Pond on Play: static SVG, loader, renderer, tools, keyboard | 6 |
| 8 | Prints: pull a print, set as background, probe-pond | 7 |
| 9 | Ambient water sound (optional, last) | 8, 3 |

## Decisions
- Vector closed-form marbling over stable fluids: exact rings, deterministic, testable, resolution-free.
- Grain as background-image, not filter: keeps probe-cartridges' no-filter check and its negative control valid.
- Portrait 2x4 imposition: avoids the iOS landscape `@page` regression.
- Background wash capped at 6% by a contrast unit test with a 20% negative control.

## Risks
Phone CPU at vertex cap (move to a Worker if worst frame > 12 ms); iOS print scaling (100 mm calibration rule); Safari `toBlob` formats (PNG/JPEG only); localStorage quota (caught, message shown).
