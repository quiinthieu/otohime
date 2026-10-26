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
- Marble model (t-1547, `lib/marble.ts`): the pond is an immutable stack of ink rings. `applyOp` returns `{ok:false, reason}` with the untouched pond on a cap (`max_drops`, `max_verts`) or a malformed op. Long image edges are split at the pre-image midpoint, so new vertices sit on the true curve. The renderer, Worker and print should consume `Marble` / `toSvgPaths` as they are.
- Zine model (t-1542, `lib/zine.ts`): `CELLS` is the imposition (CSS degrees, CW=90 for the left column, CCW=-90 for the right), `guides(paper)` gives the folds and cut in mm, `parsePaper` takes `searchParams.paper` as is. `zinePages(site)` returns the 8 pages in reading order: 1 cover, 2 bio, 3-6 `site.zine.projects`, 7 `site.zine.sketch`, 8 back with the newest note, each field cut to `BUDGETS`. It throws on a title the site does not have. The cut parts 4|7 and 3|8. The /zine page should draw these as they are.
- Pond on Play (t-1548): the pond lives in a fixed 600x400 model space (`POND_W`/`POND_H` in `components/pond-static.tsx`), and the live pond starts from the still print's seeded recipe, so the canvas arriving changes nothing visible. Inks: Sumi=`sumi`, Ai=`shade`, Bengara=`coral`, Clear water=`clear`. The water stays `#f2efe7` in both themes. Comb is a full-pond rake (lib/marble's tines are infinite lines) pulled along the drag. Blow is a vortex at the pointer, the model's only local op. `pond.tsx` renders a fragment into the loader's grid (frame row and tools row). Task 8 should add its print and background controls to `.pond-tools` and read the `Marble` from the engine, not from the DOM.
- Press cue (t-1544, `lib/sound.ts`): `Cue` takes an optional `wave` (the client plays `cue.wave ?? "square"`, so every older cue is unchanged). `press` is a triangle 140 Hz then 90 Hz 15 ms later, 3 ms attack, 70 ms decay, at -28 dB, the quietest cue. Triangle over sine because a sine this low is lost on phone speakers. Task 5 should call `play("press")` from its listener and add nothing to the table.
- Grain as background-image, not filter: keeps probe-cartridges' no-filter check and its negative control valid.
- Letterpress CSS (t-1545, `app/(site)/letterpress.css`, imported after seasons.css): one `@layer components` block for `.btn`, `.nav-item` and `.cartridge-label`. Grain specks are paper-ward (white `--grain-light` on light paper, black `--grain-dark` on dark, picked by `--grain`), so they only raise text contrast; ink-coloured specks at 0.06 would sink muted to 4.1:1 on summer paper-2. Labels and `.btn-danger` always take the light grain, and the label's grain is `!important` because globals' cartridge rules are unlayered. Press = 1px + `--deboss-deep` on keys; a cartridge label only deepens, riding the cartridge's own 2px. Task 5's listener can key on `.btn`, `.nav-item` and `.cartridge .project-title` presses; the CSS adds no classes.
- Portrait 2x4 imposition: avoids the iOS landscape `@page` regression.
- Background wash capped at 6% by a contrast unit test with a 20% negative control.

## Risks
Phone CPU at vertex cap (move to a Worker if worst frame > 12 ms); iOS print scaling (100 mm calibration rule); Safari `toBlob` formats (PNG/JPEG only); localStorage quota (caught, message shown).
