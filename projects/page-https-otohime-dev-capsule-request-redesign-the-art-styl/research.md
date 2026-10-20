# Research: redesign Capsule's art and make the draw intriguing (pm-196, run-6624)

**Idea.** Page https://otohime.dev/capsule. "Redesign the art style (more sophisticated), make the spinning process more intriguing because right now users can already guess what the cards are."

**Short answer.** Keep the engine, the twelve drawings as path data, the economy and every walk marker. Change two things. (1) Swap the sticker renderer for a "printed ink" renderer: thin single-stroke rough.js outlines, hatched shade, a muted printed palette, paper grain, a numbered trading-card frame with a hand-set serif name plate, and the machine redrawn the same way. A spike on five real cards shows this reads as a clear step up with no redrawing. (2) Remove the three leaks that let a visitor read the card before Open: the capsule shell coloured by tier, the album silhouettes of every unowned card, and the one-step face-up reveal. Replace them with uniform shells, a seeded crank length, a capsule that visibly falls out of the dome, and a staged reveal (shake, part, card back, tier edge draws on, flip) where the tier signal arrives last. Everything below is from the repo at 3e01a0a and the live page served at fda37fa on 2026-10-20.

## 1. What is there today (pm-184, live at fda37fa)

- `app/(capsule)/`: own root layout and `capsule.css` (cream paper, coral, a system cursive stack with no webfont), `capsule/page.tsx` (server) rendering the client `CapsuleApp`. `_lib/` is pure: `cards.ts` (12 cards, RATES 70/25/5, PITY 20), `rng.ts` (mulberry32 by index), `gacha.ts`, `ledger.ts` (localStorage `capsule-v1`), `actions.ts` (Turn commits the draw), `machine.ts` (reducer: idle, loaded, turning 12 frames, ready, opening 8 frames, revealed; `tick` and `settle`). `_lib/art/<id>.ts` hold each drawing as absolute-path shapes filled by palette role (`ink`, `paper`, `blush`, `white`, `main`, `shade`, `none`); `art/svg.ts` turns them into a card face under a feTurbulence wobble, and `npm run capsule:sheet` prints the set.
- Tests: `art.test.ts` (every card drawn, absolute commands inside 0 0 120 160, role fills, an ink outline, no raster/gradient/link on the sheet), `machine.test.ts`, `gacha.test.ts`, `ledger.test.ts`, `actions.test.ts`, `rng.test.ts`, `isolation.test.ts` (Capsule imports nothing from the site, Shore, `lib/`, `components/`, `content/`; Sun's own isolation test also forbids importing Capsule, so Sun's `ink.ts` must be copied, not imported).
- Guards a redesign must keep: `scripts/walk-capsule.sh` wants `<title>Capsule</title>`, no `aria-label="Main"`, the build-sha meta, exactly 12 `data-slot="`, the strings `Insert coin`, `Turn`, `Open`, `Legend 5%`, `Reset album`, `Not affiliated`, `href="/"`, and exactly one stylesheet with no `--tw-`; `e2e/rbac.test.ts` and `lib/build-stamp.test.ts` check the sidebar and the meta; `content/site.ts` holds the Projects row.
- pm-184's own QA already flagged two things this plan can close: the cursive stack has no match on Linux or Android (headings fall to the default sans), and the art was reviewed as "matching the chibi brief", not as good.

### Why the art reads as unsophisticated

I rendered the sheet and the live machine with resvg-js (no browser on this pod) and looked at them.

- One uniform 3.5 px outline on everything, the heaviest line weight on the page, with round caps: the sticker look of clip-art packs.
- Flat saturated fills (coral `#ef8a72`, gold `#efc64a`, mint, periwinkle, candy pink) and the same pink blush ovals on every face, including Totoro, No-Face and a flame.
- The wobble filter jitters edges but adds no line character, no texture and no shading beyond one flat darker shape.
- The frame is a rounded rect with a cursive name under a squiggle; the "foil" is a plain gold stroke. Nothing says printed card: no number, no plate, no edge detail, no card back.
- The machine is the same style at page scale: one thick outline, a coral body, a navy chute, and the dome's capsules in the exact three tier colours.
- Type: the headline, buttons and status are the system cursive stack, which on most visitors' machines is Comic Sans or the default sans.

### Why the draw is guessable

1. **The shell tells the tier.** `machine.tsx` colours the dropping capsule with `CAPSULE[tier]` from the drawn card, from turning frame 8 of 12 and through the whole `ready` phase. The three colours are the same ones the enlarge dialog uses for its tier badges (`.tier-common`, `.tier-rare`, `.tier-legend`), so the mapping is learned after one legend. Open then confirms what the shell already said.
2. **The album shows every card in advance.** `svg.ts` draws an unowned slot as the card's exact silhouette in grey with its tier name under it, in a grid that is already grouped by tier (slots 11 and 12 are the legends). A visitor sees the whole set, its shapes and its rarities before the first coin.
3. **The reveal is one step.** Open runs 8 frames (0.67 s); the card then pops in face-up beside the machine, in a side box that held a "?" placeholder, with name, film and year at once. The turn is always 12 frames (1.0 s), the dome's eight capsules only jiggle, and the capsule that drops appears from nowhere in the chute.

## 2. Recommendation

### 2a. Art: a printed-ink trading card

Keep every drawing's path data and change how it is drawn. The spike (`/tmp/resvg/spike.ts`, rendered to PNG, not committed) put five real cards (Totoro, Kiki, Calcifer, Soot sprite, No-Face) through three renderers:

| Renderer | What it did to the drawings |
| --- | --- |
| Current | Sticker look as above |
| **Printed ink** (recommended) | Thin wobbly ink, hatched shade, muted fills, numbered frame: reads as an illustrated card; faces stay clear |
| Full sketch (multi-stroke outlines, hatched colour fills) | Faces unreadable; rejected |

The printed-ink brief:

- **Line.** rough.js `generator.path` on each stroked shape with `roughness 0.55`, `bowing 0.6`, `disableMultiStroke: true`, width about 1.9 at card scale, ink `#2b2320`. Seeded per `(card id, shape index)` with the FNV-1a trick from Sun's `ink.ts`, so every render is identical and a new shape never redraws the others. Copy `ink.ts` and Sun's `roughjs.d.ts` shim into `app/(capsule)/_lib/art/`; do not import across the isolation line.
- **Shade.** A new role `hatch` (shade areas drawn as rough hachure in the card's shade colour darkened 25 %, gap about 2.4, angle about -48, no outline). The existing `shade` shapes become `hatch` in the retouch pass. Keep `blush` as a flat fill for things that are not blush (Kiki's bow, the soot sprite's star); real blush becomes a light hatch in `#d98a9a` or is dropped on characters that should not have it (No-Face, Calcifer, Totoro).
- **Colour.** Each card's `colour` mixed 12 % toward paper, paper `#f3ecdd`, ink `#2b2320`; a page palette of cream, ink, one muted coral `#c9684f` for the machine body and one slate blue `#6b7f9e`; gold only as a legend foil `#b8862b`. No gradients (the hatching replaces them), no raster.
- **Grain.** One shared feTurbulence grain overlay at about 7 % opacity on the reveal card, the enlarge card and the machine; not on the twelve album thumbnails (filter cost on phones).
- **Frame.** Double rule (outer 1.6, inner 0.8), a name plate line, `No. 07` top right from the album index, the film and year in small text, and a tier edge: common inner rule in ink; rare inner rule in slate; legend inner rule in gold at 2.2 with hatched gold corner ornaments. A **card back** (one design for all: a small crank-and-capsule device on a hatched field) is needed anyway for the reveal and the album.
- **Type.** One display face via `next/font/google` with Sun's `fallback` to the cursive stack and `display: "swap"`: a serif such as Fraunces or Cormorant Garamond (OFL) for the title, name plates, status and buttons; the UI sans stays for small labels. This closes the Linux fallback note from pm-184 QA. Sun shipped this way at pm-189, so the build has egress to Google Fonts on Vercel; the documented one-line fallback applies if a lease cannot fetch.
- **Machine.** Redraw `machine.tsx` in the same renderer: the body as a solid muted coral with a hatched shade edge, the dome glass as a thin rough ellipse with one hatched reflection, the crank, slot and chute in ink. Generate the rough paths once with `useMemo` keyed on nothing (the poses are transforms on groups, so the ink never regenerates per frame).
- **Retouch pass per card** (small, data only): drop blush on Totoro, No-Face and Calcifer; Kiki's bow stays flat; Totoro's belly chevrons become hatch; whisker and fur lines get `weight: "fine"` (a second optional field on `Shape`, 1.2 at card scale). The brief's "big head, small body" and closed shapes stay.

Tests to add: a pinned snapshot hash of one inked card (as Sun's `ink.test.ts` does), every card has at least one `hatch` shape and no `shade` shape left, `svg.ts` output has no `multi-stroke` double paths (count outline paths equals stroked shapes), and the sheet still has no raster, gradient or link. `scripts/capsule-sheet.ts` keeps working unchanged.

Bundle: rough.js 4.6.6 ESM is 27.7 KB raw, 8.9 KB gzipped, and it needs no DOM, so the client `Card` component can call it directly. Pre-rendering the faces on the server would cost about 15 KB of HTML per card instead. Client-side it is.

### 2b. The draw: hide the tier until the last beat

All of this stays in the pure reducer so the tests play it without a browser.

1. **Uniform shells.** Every capsule in the dome and the one that drops is the same shell: paper-white bottom, muted coral top. Delete the `CAPSULE` tier map. The dome's eight capsules lose the tier colours too.
2. **Seeded crank length.** `turnFrames(seed, n)` from `prng(seed ^ TURN_STREAM, n)` in 16..28 frames (1.3 to 2.3 s), stored on the machine state as `frames` when `turn` is pressed. The crank turns on twos as now; the dome capsules tumble (rotate plus a small bounce) while it turns.
3. **A real drop.** One dome capsule, picked by the same prng, falls through the collar into the chute over the last 6 frames along a short curve, so the chute capsule is the one that left the dome. The dome count stays eight (the gap closes on the next Insert).
4. **Staged open.** `opening` grows from 8 frames to a staged sequence read by a pure `openStage(frame, tier)`: shake (0 to 5), halves part (6 to 9), the card back slides up out of the capsule (10 to 15), the tier edge draws on (16 to 21: ink for common, slate for rare, gold with sparks for legend, which adds a 6-frame glow hold), then the card flips face-up (6 frames) into `revealed`, when the name plate letters in and the status line speaks. The tier is first visible at the edge stage, after the capsule has already opened. Reduced motion settles every stage at once, as today.
5. **Reveal in place.** The card rises out of the chute in the machine's own coordinate space, then settles into the slot beside it; the "?" placeholder box goes. One `data-stage` attribute on the booth drives the CSS; no JavaScript animation beyond the reducer's 12 fps tick.
6. **Album backs.** An unowned slot is the card back with `No. 07` only, no silhouette and no tier; `aria-label` "Slot 7, not found yet". The tally, the enlarge dialog, Reset album and the rates line stay.
7. **No fake near-misses.** Tension comes from staging the real outcome later and in steps; the rates line stays and nothing pretends a common was almost a legend.
8. **Optional, a separate task: crank by hand.** Drag the crank handle in a circle (pointer events with a non-passive touchstart, the pm-191 tonearm pattern) to advance the turn; the Turn button stays for keyboards and the walk. Nice, not required for the request.

Status copy for the stages: "Turning…", "Something rolled out. Open it.", "Opening…"; keep "Jiji. Common." at `revealed`.

## 3. Files to change

`_lib/art/types.ts` (role `hatch`, optional `weight`), `_lib/art/ink.ts` and `roughjs.d.ts` (new, copies of Sun's), `_lib/art/svg.ts` (printed renderer, frame, card back, `cardBackSvg`), `_lib/art/*.ts` (retouch pass), `art.test.ts`, `_lib/machine.ts` and `machine.test.ts` (seeded length, stages), `_lib/gacha.ts` (`turnFrames`, `dropIndex`) with a test, `_components/machine.tsx`, `card.tsx`, `capsule-app.tsx`, `album.tsx`, `capsule.css`, `layout.tsx` (font), `README.md` (brief v2), `content/site.ts` (row note, optional). Unchanged: `cards.ts`, `ledger.ts`, `actions.ts`, `rng.ts`, `isolation.test.ts`, `scripts/walk-capsule.sh` (button labels and markers stay), `e2e/`, `lib/build-stamp.test.ts`.

Suggested split: (1) ink renderer, frame, card back and retouch, QA required with an art review of the sheet; (2) page chrome, font, palette, machine redraw and album backs, QA required at 1366x768 and 390x844; (3) the staged draw, QA required with motion on and off and a check that no tier colour appears in the DOM before the edge stage; (4) optional crank drag.

## 4. Risks

- **Taste.** "Sophisticated" is a judgement. The spike's printed-ink row is the evidence; the first QA on task 1 should render the sheet (resvg-js from a scratch dir works on a pod with no browser) and judge it against the brief above, not against the old one.
- **Performance.** Fourteen inked cards on one page is about a thousand path elements; fine, but keep grain off the album thumbnails and memoise `cardFaceSvg` per card id.
- **Google Fonts at build.** Same as pm-189: if a lease cannot fetch, swap to the cursive stack in `layout.tsx` and record a decision. Never vendor a `.woff2`.
- **Determinism.** Pin rough.js at 4.6.6 (already exact) and snapshot a hash of one inked card so a library bump is caught.
- **Longer rounds.** A seeded 1.3 to 2.3 s turn plus a 30-frame open makes a round about 5 s; with 5 coins that is a minute of play, which is the point. Reduced motion stays instant.
- **Walk markers.** Keep the three button labels and `data-slot` on every slot, or update `walk-capsule.sh` in the same commit.

## 5. Decisions recorded in this run

- The guessability is three code leaks (shell colour, silhouettes, one-step reveal), not the seeded draw.
- Printed ink over the existing path data, rejected the full sketch style, on spike evidence; rough.js on the client at 8.9 KB gzipped.
- Honest staging only, no fake near-misses; the rates line stays.
- Lesson (global): resvg-js in a scratch dir rasterises SVG, filters included, on a pod with no browser, and the server-rendered HTML already holds the idle machine SVG.
- The named plan document and the pm-196 folder are not in the repo; AGENTS.md, README.md and pm-184's documents were used.

## Sources

- Live page https://otohime.dev/capsule at build-sha fda37fa; repo `app/(capsule)/**`, `scripts/walk-capsule.sh`, `scripts/capsule-sheet.ts`, `app/(sun)/_lib/ink.ts`, `app/(sun)/layout.tsx`, `projects/add-a-new-project-input-some-coins-to-draw-cards-cards-are-c/` (research, plan, qa-t-1062, qa-t-1063, acceptance_report_1), `projects/page-https-otohime-dev-sun-redesign-this-project-feedback-1/` (research, plan).
- rough.js 4.6.6: https://github.com/rough-stuff/rough (MIT); resvg-js: https://github.com/thx/resvg-js (MPL-2.0).
- Fonts: Fraunces https://github.com/undercasetype/Fraunces (OFL 1.1); Cormorant https://github.com/CatharsisFonts/Cormorant (OFL 1.1); Next font module https://nextjs.org/docs/app/api-reference/components/font.
- Gacha reveal staging and near-miss practice: https://en.wikipedia.org/wiki/Gacha_game ; https://en.wikipedia.org/wiki/Near-miss_effect
