# Research: Design system, one drawn page with knobs at `/design-system` (pm-216, run-7079)

Submitted as rep-4059 by the research run; committed unchanged by the product
owner (run-7084). Where the plan departs from it (one count of nine parts,
the spot presets, pots as values, the audit excluding its own sheet),
[plan.md](plan.md) says so and the decision is recorded.

**Idea.** "Add Design System. Explain in simple terms, with illustration and infography to make the idea easier to grab."

**Reading of the idea (decision recorded).** The thing to add is an *explainer* of what a design system is, in the series of drawn pages this site already builds (the Sun, the periodic table, Structures). It is not a shared stylesheet for the site: the repo's own rule is the opposite (every project owns its stylesheet and imports nothing from another, enforced by eleven isolation tests and the pm-206 motion contract), and the idea's second sentence says the *idea* is what needs to be easy to grab. §9 names what the other reading would cost, so the product owner can choose it deliberately.

**Short answer.** Build **Design system**, the eleventh row on the Projects bench, as its own route group `app/(design-system)/` serving one page, `/design-system`, in the house recipe every project since Shore follows: own root layout and stylesheet, no Tailwind, pure data and pure drawing code under `_lib/` proven by `node --test`, an isolation test, a walk script, a browser probe, a row in `content/site.ts`. One page on squared notebook paper in the Orrery hand lettering, four drawings and 180 to 350 plain words:

1. **The box** (infographic): what a design system is made of, drawn as a painter's box. Twelve pots on the top shelf are the *decisions* (paper, ink, spot, three gaps, three corners, two type sizes, one speed), each with a name. From the pots come five *parts* (a button, a field, a card, a tag, a note). From the parts come three *patterns* (a form, a list, a dialog). On the lid, the *rulebook* (words, keyboard, contrast). One arrow runs from a pot through a part into a pattern: "change a pot and everything downstream follows".
2. **The board** (the island): the five parts drawn in ink on a small sample screen, and a row of knobs for the twelve pots. Turn the spot knob from blue to coral and the button, the tag, the link and the field's focus ring change in the same beat, because none of them owns a colour; each says "use the spot". A counter says what happened: "1 knob turned. 9 parts followed." A **No system** switch gives every part its own private values (three near-blues, three corner sizes, gaps that don't match): now the knob moves nothing and the counter says "1 knob turned. 0 parts followed. 9 to fix by hand." A **rule line** under the screen reads the contrast of ink on paper and spot on paper as a number and says *passes* or *fails*, so the rulebook layer is something the reader can break. A **Dress as** row re-paints the same five parts in the real paper, ink, spot, corner and face of six sister projects (Shore, Capsule, Orrery, Elements, the Gazette, Structures).
3. **One knob, nine parts** (infographic): two columns drawn from the same engine the board runs: with a system, one pot fans out to nine parts; without, nine pots and nine hands. The numbers are the engine's, so the card and the board agree.
4. **Right here** (infographic): the honest example. Otohime has eleven stylesheets; ten of them name a `--paper` and all eleven an `--ink`; between them they decide eight different creams. Eleven paper scraps with their hex, a row of small boxes for each sheet's number of named decisions, and the caption: "Otohime has no design system, on purpose: every project is its own object. A system is the tool for when pages must feel like one thing." The figures are pinned data, checked by a test that reads the real stylesheets.

The text follows the Gazette's measured caps (180 to 350 words, Flesch-Kincaid grade 8 or under, no sentence over 35 words), has four parts (*What it is*, *Turn a knob*, *Where you meet it*, *Watch out for*) and a sources box. With JavaScript off the board is still a finished drawing at its default pots with greyed knobs and the default sentences. About 2,200 lines, one plan, three build tasks plus QA and acceptance, in the shape of the Structures plan.

## 1. The repo today (988e07c, 2026-10-21)

- Ten projects follow the house recipe (Shore, Capsule, Orrery, Elements, Vinyl, Rotor, Planisphere, Barometer, Gazette, Structures). Each has its own root layout, a hand-written stylesheet, `_lib/*.test.ts` under `npm test`, an `isolation.test.ts`, a `scripts/walk-<name>.sh`, a row in `site.projectList`, two lines in `e2e/rbac.test.ts` (`href="/structures"` at line 96, a 200 at line 181), a test in `lib/build-stamp.test.ts` (line 76) and a README block. Baseline this run: `npm ci` (21 s) then `npm test` passes **1,186** tests in 17 s.
- `lib/motion.test.ts` reads the groups from `app/` (a directory `(name)` with a `layout.tsx`), asserts `PROJECTS.length === 10` (line 69), and requires the stylesheet's `h1 { view-transition-name: project-<group>; }` to equal the directory name, read with `[\w-]+` (line 154), so a hyphen is allowed; `/projects` names the row `project-${href.slice(1)}` (line 175). So the group is **`app/(design-system)/`** at **`/design-system`** and the name is `project-design-system`. `scripts/probe-motion.mjs` hard-codes the ten slugs (line 30) and "10 row rise animations" (line 504); the new project edits both to eleven.
- The one-island rule is the house pattern for an interactive project: Rotor, Planisphere, Barometer and Structures each assert **exactly one `"use client"` file** and **no rough.js in any client chunk**. Structures (pm-214, landed today) is the closest shape: the server inks a kit of stamps and hands path strings to the island, which draws them once in `<defs>` and places them with `<use>`; the controls sit in `<fieldset disabled>` until a `useSyncExternalStore` hydration flag turns them on (`machine-app.tsx:140,221`). The board copies this.
- Structures also gives the text engine and the figure kit to copy: `readability.ts` (`syllables`, `sentences`, `fkGrade`, `longestSentence`, `meanSentence`, `readingMinutes`), `words.ts`, `ink.ts` (rough.js, fixed seed), `paper.ts` (480 wide, labels 17 or more so 12 px at 390 px) and `kit.ts` (`Figure = { viewBox, paths, spot, labels }`, `figureProblems`). Copied, never imported: a group owes nothing to another.
- The site's own tokens are the right raw material. `app/(site)/globals.css` declares six swatches (`--yellow #f4b829`, `--coral #ef6a4c`, `--mint #93d3b0`, `--blue #76a0e2`, `--pink #f3a6bb`, `--shade`) that `/projects` paints its rows with; the board's spot knob offers these six, so the page's example is the site's own palette.
- The audit for figure 4, computed this run from the eleven top-level stylesheets (`^\s*--name:` lines, distinct names per sheet): site 30, barometer 21, planisphere 16, elements 14, rotor 14, vinyl 13, orrery 13, capsule 12, articles 10, structures 10, shore 7; **97** distinct names overall; `--ink` is declared in all 11, `--paper` in 10 (Vinyl has `--bg`), `--muted` in 6, `--ink-soft` in 5, `--coral` in 5. Light papers: `#f3eee3` (Gazette), `#efe3c8` (Barometer), `#f3ecdd` (Capsule), `#faf8f3` (Elements), `#f6f1e7` (Orrery, Planisphere, Rotor), `#f4f5f0` (Shore), `#f2efe7` (site), `#f6f3ea` (Structures): **8 creams**. Inks: `#3a2a28` four times, seven others. `border-radius` is written as 8px fifteen times, 6px ten, 10px nine, 999px nine and `var(--frame-radius)` eleven. Seven layouts load Google faces (Caveat + Patrick Hand five times, Fraunces, three newspaper faces). The build task's test recomputes these from the files; the research numbers are the pins to start from.
- The brief names `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md`; neither exists in this checkout, and `AGENTS.md` holds only the `next dev` block. The Structures and Gazette plans are the rules.
- No other otohime plan is active, so the shared lines (`content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `lib/motion.test.ts`, `scripts/probe-motion.mjs`, `README.md`) have no competing editor today. On a rebase conflict keep both sides (lesson iss-9).
- Walk and probe ports in use: 4019 to 4073. Design system's walk takes **4075**, 4077 for its "nothing listens" negative check, and its browser probe **4079**; none is on Next's reserved list.
- A fresh checkout has no `node_modules`; every task starts with `npm ci`. `fonts.googleapis.com` answers from the pod, so `next/font/google` can fetch Caveat and Patrick Hand at build as Structures does.

## 2. What was checked, and what was not built

| Question | Answer | How |
| --- | --- | --- |
| Can a group named with a hyphen pass the motion contract and the hop? | Yes: `GROUPS` accepts any `(name)`, the name regex is `[\w-]+`, and the row's `--vt` is built from the href. `scripts/probe-motion.mjs` is a slug list. | Read `lib/motion.test.ts:16-20,111-114,154,175` and `probe-motion.mjs:30,98,165,504`. |
| Can the drawing change corner radius, gaps and colours live while rough.js stays on the server? | Yes. Colours are CSS custom properties on the `<svg>` root, filled with `var(--board-spot)` and friends, which is the literal mechanism a design system uses (a token is a named decision; in CSS it is a custom property). Gaps are `translate` on `<use>` with a transform transition, as Structures does. Corners cannot be re-inked in the browser, so the server inks each part **three times** (sharp, soft, round) and the island swaps `href`: 5 parts × 3 corners × 1 seed = 15 stamps, under 40 KB of paths. | Read `stamps.ts`, `machine-app.tsx` and `structures.css`'s `<use>` rules; the three-corner kit is a design, checked against the one-island and no-rough rules. |
| Does the "no system" drift read as a real difference at 390 px? | Yes if the drift is coarse: spot `#2456b3` / `#2d5fc4` / `#1f4ea0` is too subtle at 12 px; use three visibly different blues (`#2456b3`, `#3b7bd6`, `#1a3f8a`) plus one part in a left-over coral, corners 0 / 6 / 14 mixed, gaps 8 / 12 / 20 mixed. The point is "nothing matches", not "find the difference". | Judgement; the probe reads the computed fills. |
| Is the contrast rule a pure function? | Yes: WCAG 2 relative luminance and `(L1 + 0.05) / (L2 + 0.05)`; `#000` on `#fff` is 21, `#2456b3` on `#f6f3ea` is 6.2, `#76a0e2` on `#f6f3ea` is 2.4 (fails both as text and as a 3:1 UI colour, so the site's blue swatch is a row colour, not a spot), `#2456b3` on the night paper `#161513` is 2.7 (fails) and `#f4b829` on it is 10.2 (passes). Computed this run. | `/tmp/contrast.mjs`, this run. |
| Is the readability cap reachable? | Structures' eight bodies pass FK ≤ 8 on harder words. This page avoids "component", "token" and "typography" in prose (they go in the labels as *part*, *pot*, *face*) and says "the gap", "the corner", "the spot colour". | Judgement from Structures' pinned numbers; the test enforces it. |
| Is any dependency needed? | No. The engine, layouts and contrast are plain TypeScript; ink is rough.js (already a dependency); the island is React; motion is CSS and a 150 ms transition. `package.json` changes only in the `test` glob. | — |
| Throwaway `next build` | **Skipped** (decision recorded). A static group with one island (Structures), Google fonts at build (Orrery), pre-inked props into an island (Rotor, Structures) each already ship on this config. | — |

## 3. The product

**The look.** Structures' sheet, so the two explainers read as one series: `--paper #f6f3ea` with a 24 px grid (two CSS gradients in `--grid #dcd6c6`), `--ink #1d1b17`, `--spot #2456b3`, `--hot #c8402f` for the part a knob just moved; dark from the OS or the pinned `localStorage.theme` (Barometer's script): `#161513` / `#2a2722` / `#ebe5d6` / `#7aa2ff` / `#ff8a73`. Titles in Caveat, everything else in Patrick Hand 19 px/1.5 via `next/font/google` (literal options, `cursive` fallbacks). One `<article>` at 760 px, figures full width on a phone, the knobs under the board.

**The page, `/design-system`.** Top bar as every project (`otohime.dev`, `← All projects`, plain `<a>`). The `h1` "Design system" (the row title on `/projects` morphs into it on the hop), the deck "A box of decisions made once, drawn so you can turn the knobs.", reading time. Then:

- **The box** (`<figure data-figure="box">`): the painter's box above, a `Figure` in the kit shape (480 wide, at most 12 labels of 17 or more, the spot pot and the arrow in `--spot`). Caption: "Twelve pots, five parts, three patterns and a rulebook."
- **The board** (`<figure data-figure="board">`): the island. The drawing: an SVG `role="img"` whose `aria-label` the island keeps current ("A card on cream paper with a coral button, soft corners and even gaps"). Under it the **counter** (`<output aria-live="polite">`) and the **rule line** (`<output>`: "Ink on paper 15.5 to 1, passes. Spot on paper 6.2 to 1, passes."). Then the **knobs**, real radio groups in a `<fieldset disabled data-knobs>` the island enables on hydration: *Paper* (cream, white, night), *Spot* (the six site swatches as inked dots), *Corner* (sharp, soft, round), *Gap* (tight, even, airy), *Size* (small, large), *Speed* (still, quick); the **No system** switch (`<input type="checkbox" role="switch">`); the **Dress as** row (six `<button>`s: Shore, Capsule, Orrery, Elements, Gazette, Structures) that sets paper, ink, spot, corner and face (a generic family: serif, sans-serif, cursive, monospace) from `siblings.ts`; **Reset**. Every knob is a `turn`: a pure function returns the new board, the sentence, and the list of parts that followed.
- **One knob, nine parts** (`<figure data-figure="follow">`): the two columns above, built at render from `follow(board, turn)` on the default board with the system on and off, so the "9" and the "0" are the engine's.
- **Right here** (`<figure data-figure="here">`): the eleven paper scraps and decision counts from `siblings.ts`, the `--paper ×10` and `--ink ×11` call-outs in spot. Caption as above.
- **The words**: 180 to 350 words in four parts: *What it is* (a box of decisions made once: colours, sizes, gaps, corners, speeds, each with a name; parts built only from those; patterns built from parts; rules for words, keys and contrast; all in one place with someone keeping it), *Turn a knob* (the board in prose: the spot knob and the nine parts; the switch and the nine hands), *Where you meet it* (GOV.UK's one look across hundreds of services, Material, Apple's guidelines; and this site, which has none on purpose), *Watch out for* (drift: a system nobody tends goes stale and people route round it; too tight: a system that forbids every exception gets ignored; it is never finished, so it is a product with an owner, not a project with an end). A boxed **Sources** list (`https` on the allowlist: `en.wikipedia.org`, `design-system.service.gov.uk`, `m3.material.io`, `developer.apple.com`, `developer.mozilla.org`, `www.w3.org`), then a colophon linking Structures ("Next door: Structures") and the Gazette.

**Motion.** The house grammar: the box and the two cards draw on at load (`pathLength="1"`, 600 ms, in order pots → parts → patterns); the board's ink is static. A knob turn marks the parts that followed `data-hot` for one beat (the CSS fills with `--hot` and lifts 2 px, 500 ms), colours and gaps change with `transition: fill 150ms, stroke 150ms, transform 150ms` on the `<use>` (`transform-box: fill-box`), and the counter changes text. The *Speed* knob is itself a pot: "still" sets the board's `--board-speed` to 0 ms, so the reader sees that motion is a decision too. Under reduced motion every change lands at once and the stylesheet's last block zeroes every transition and animation (`motion.test.ts`, Orrery's shape).

**No JavaScript, on purpose, still a page.** The server renders the board at the default pots with the system on; the counter reads "Turn a knob and watch what follows." and the rule line reads the defaults' real contrast. The knobs sit in a disabled fieldset, greyed not dead. The walk checks the server HTML holds fifteen stamp `<symbol>`s, five placed parts, both `<output>`s and the default sentences.

**Keyboard and screen readers.** The knobs are radio groups (arrow keys move within a group, Tab between), the switch is a checkbox with `role="switch"`, the dress buttons are buttons. The counter is `aria-live="polite"`, the drawing's `aria-label` restates the board, every stamp label is real `<text>`. The probe runs axe at 390 px and 1366 px.

**What is not here, on purpose:** a code panel, a token export, a colour picker (`<input type="color">` differs by browser and is not a decision made once), a real component library, the sister projects' webfonts, MDX, a quiz, saving the board. Second-chapter candidates in the same shape, each a page: *The type scale*, *The spacing scale*, *Dark mode as one decision*, *Naming the pots*.

## 4. The engine (`_lib/`, pure, no React)

```ts
// app/(design-system)/_lib/board.ts
export type Paper = "cream" | "white" | "night";
export type Spot = "yellow" | "coral" | "mint" | "blue" | "pink" | "shade";
export type Corner = "sharp" | "soft" | "round";
export type Gap = "tight" | "even" | "airy";
export type Pots = { paper: Paper; ink: string; spot: Spot; corner: Corner; gap: Gap; size: "small" | "large"; speed: "still" | "quick"; face: "cursive" | "serif" | "sans-serif" | "monospace" };
export type Board = { pots: Pots; system: boolean; dress?: string; turned: number };
export type Turn = { knob: keyof Pots; to: Pots[keyof Pots] } | { knob: "system"; to: boolean } | { knob: "dress"; to: string } | { knob: "reset" };
export type Followed = { board: Board; say: string; followed: string[]; hot: string[] };
export const PARTS = ["title", "line", "tag", "field", "ring", "button", "ghost", "card", "note"] as const; // nine
export function turn(b: Board, t: Turn): Followed;       // pure; system off → followed is [] and say counts the hands
export function describe(b: Board): string;              // the drawing's aria-label
export function values(b: Board): Record<Part, PartValues>; // what each part draws with: system on → from the pots; off → DRIFT
export const DEFAULT: Board;
export const DRIFT: Record<Part, PartValues>;            // the private values the "no system" screen uses
// contrast.ts
export function luminance(hex: string): number;
export function contrast(a: string, b: string): number;  // WCAG 2, 21 for black on white
export function rule(b: Board): { ink: number; spot: number; say: string; passes: boolean }; // ink ≥ 4.5, spot ≥ 3
// siblings.ts: pinned from the real stylesheets (paper, ink, spot, corner px, face family, decision count, --paper and --ink declared)
export const SIBLINGS: readonly Sibling[]; // the eleven sheets; six carry a dress
// scenes.ts (no rough.js): where every part's stamp, label and gap goes for a Board, in a 480-wide viewBox
export function scene(b: Board): Scene;
// stamps.ts (rough.js, SEED = 216): the five parts × three corners; kit.ts, paper.ts, ink.ts, readability.ts, words.ts: Structures' copies
// figures/box.ts, follow.ts, here.ts: the three Figures; follow.ts and here.ts are built from turn() and SIBLINGS
// copy.ts: the words as data (title, deck, parts { what, turn, where, trap }, captions, sources)
```

Tests (`*.test.ts`, flat): `board.test.ts` (the default board; every knob with the system on lists all nine parts, with it off lists none and says "9 to fix by hand"; a dress sets exactly the pins; reset returns `DEFAULT`; `describe` names the paper, spot, corner and gap; `values` with the system on never equals `DRIFT`), `contrast.test.ts` (21 for black on white, 6.2 ± 0.1 for `#2456b3` on `#f6f3ea`, 2.4 ± 0.1 for `#76a0e2`, 2.7 ± 0.1 for `#2456b3` on `#161513`, symmetric, the rule's thresholds), `siblings.test.ts` (reads each group's one top-level stylesheet as text, as `lib/motion.test.ts` does, and asserts the pinned paper, ink, decision count, and the `--paper` / `--ink` flags; eleven rows; the six dresses name live groups), `scenes.test.ts` (every board reachable by one turn from the default and every dress stays in frame with no overlap, labels 17 or more; the three corners place identically), `stamps.test.ts` (15 stamps, inside their boxes, same bytes on two calls), `figures.test.ts` (the three figures pass `figureProblems`; the follow card's columns are 9 and 0 from `turn`; the here card has eleven scraps), `copy.test.ts` (180 to 350 words, FK ≤ 8, mean ≤ 20, longest ≤ 35, deck ≤ 30 words, every number in prose is one of the engine's: 12, 5, 3, 9, 0, 11, 10, 8; sources `https` on the allowlist, at least three), `motion.test.ts`, `readability.test.ts`, `words.test.ts`, `ink.test.ts`, `isolation.test.ts` (no React or Next in `_lib/`; only `ink.ts` and `stamps.ts` import rough.js and `scenes.ts` reaches neither; exactly one client file, `_components/board-app.tsx`, which reaches no ink, stamps, kit, figures or rough.js; only `layout.tsx` reads `process.env`; no fetch, storage, dice or clock in `_lib/`).

## 5. The page files

```
app/(design-system)/
  layout.tsx                      own <html lang="en">, design-system.css, Caveat + Patrick_Hand via next/font/google, build-sha meta,
                                  the inline @view-transition style, the theme-pin script, themeColor light #f6f3ea / dark #161513
  design-system.css               tokens (light/dark), the squared paper, the article, figures, knobs, the <use> fills from --board-*,
                                  the 150 ms transitions, the hot lift, draw-on, the hop block,
                                  h1 { view-transition-name: project-design-system; }, the reduced-motion block last
  design-system/page.tsx          the page, server only; ensureStatic = "navigation"; generateMetadata
  _components/chrome.tsx          top bar (plain <a> home and /projects), the head, the colophon
  _components/figure.tsx          <figure role="img"> for a Figure (Structures', copied)
  _components/board.tsx           server: inks the 15 stamps, builds the default scene, renders <BoardApp> with { stamps, board } and
                                  the no-JS outputs
  _components/board-app.tsx       the one "use client" file: useReducer over board.ts, the knobs, the two <output>s, the SVG of
                                  <defs> + <use> with --board-* on its root, the hydration flag that enables the fieldset
  _lib/ board.ts contrast.ts siblings.ts scenes.ts stamps.ts kit.ts paper.ts ink.ts readability.ts words.ts copy.ts roughjs.d.ts
        figures/{box,follow,here}.ts  *.test.ts
scripts/walk-design-system.sh     port 4075 (4077 dead-port check)
scripts/probe-design-system.sh    port 4079, Playwright + axe into a temp prefix (probe-structures' shape)
content/site.ts · lib/build-stamp.test.ts · lib/motion.test.ts (10 → 11) · scripts/probe-motion.mjs (slugs and rows, 10 → 11) ·
e2e/rbac.test.ts · package.json · README.md
```

Row in `content/site.ts`, last: `{ title: "Design system", note: "A box of decisions made once, drawn so you can turn the knobs.", href: "/design-system", status: "live", colour: "blue" }`.

**Walk, `scripts/walk-design-system.sh`** (port 4075, Structures' style): `/design-system` is 200 with the build-sha meta, no `aria-label="Main"`, a `/projects` link, one `<h1` naming Design system, four `data-figure="` (`box`, `board`, `follow`, `here`), fifteen `<symbol id="part-` stamps and nine placed `<use`, one `<fieldset disabled`, two `<output`, the default counter and rule sentences, six `data-dress="` buttons, eleven `data-sheet="` scraps, a Sources box of at least three `https://` links on the allowlist, at most 600 visible words, under 200 KB, no `$RC`, no `<template id="B:`, no Tailwind, only its own stylesheet; `/projects` links `/design-system` once; at source, exactly one `"use client"` file and no rough.js in any client chunk of the build; `lib/motion.test.ts` passes with eleven.

**Probe, `scripts/probe-design-system.sh`** (port 4079, 390×844 and 1366×768, motion on and reduced): the fieldset is enabled after hydration; choosing Spot coral makes the counter say "1 knob turned. 9 parts followed." and the button's computed fill equal the coral swatch; the `aria-label` says coral; switching No system on then choosing Spot mint makes the counter say "0 parts followed" and leaves the button's fill unchanged; Corner round swaps the `href` of all five part stamps to `-round`; choosing Paper night makes the rule line say "fails" for spot blue and "passes" after Spot yellow; Dress as Gazette sets the paper to `#f3eee3`; Reset restores the defaults; with motion on a fill change takes 150 ms ± a frame, under reduced motion it lands within one frame; arrow keys move within the Spot group; nothing scrolls sideways at 320 px; no console or page error; axe finds nothing serious.

## 6. Plan shape (for the product owner)

Three build tasks, in order, each with `verification[]`, in the Structures plan's form:

1. **The engine and the words** (software_engineer, `qa: skip`; `_lib/` only, no route): `board.ts`, `contrast.ts`, `siblings.ts` with its pins, `copy.ts` with the page written in full to §3's caps, `readability.ts`, `words.ts`, their tests, the `npm test` glob, the README test line. (`lib/motion.test.ts` skips a group without `layout.tsx`, so an engine-only task is safe.)
2. **The ink: stamps, scenes and the three figures** (software_engineer, `qa: skip`; depends on 1): `ink.ts`, `paper.ts`, `kit.ts`, `stamps.ts` (15), `scenes.ts`, `figures/{box,follow,here}.ts`, their geometry tests.
3. **The page: the board, the hop, the walk and the probe** (software_engineer, QA required; depends on 2): layout, CSS, the page, the components, the `content/site.ts` row, `lib/build-stamp.test.ts`, `lib/motion.test.ts` and `scripts/probe-motion.mjs` to eleven, `e2e/rbac.test.ts`, the walk, the probe, the README block.

QA for task 3 reads the page at 390 px and 1366 px (no sideways scroll, four figures legible, the knobs reachable, light and dark), turns every knob by mouse and by keyboard, flips the switch and checks the counter, breaks and mends the rule line, dresses the board as two siblings and compares with those sites' real pages, reads the page with JavaScript off, and runs the walk, the probe and the motion probe. Acceptance walks `/projects` → Design system → Spot coral → No system → Spot mint → Dress as Gazette → Reset → `← All projects` on the deployed site, with JavaScript off once.

## 7. Decisions this research made (recorded)

The page is an explainer project `(design-system)` at `/design-system`, not a site-wide shared stylesheet (§9 costs the other reading); one page with four figures, not a series; the slug keeps the idea's words and the motion contract accepts the hyphen; the board's live changes are CSS custom properties on the SVG root (the mechanism is the lesson), corners are pre-inked three ways, rough.js stays on the server; the "Right here" audit and the dresses are pinned data checked by a test that reads the sister stylesheets as text, the page imports nothing from them; dresses use generic faces, not the siblings' webfonts; the contrast rule is a pure WCAG function so the rulebook layer is live; no throwaway build; no new dependency; three build tasks.

## 8. Risks

- **The board at 390 px.** Nine parts, two outputs and six knob groups is the densest control panel on the site. The scene is 480 wide with the five parts stacked (card, title, line, field with ring, two buttons, tag, note), the knobs wrap in two columns under it, and the dress row scrolls sideways inside its own box if it must. The probe's 320 px check catches overflow.
- **Transitioning `fill` on `<use>` from a custom property on the root.** Chromium, Firefox and Safari all transition `fill` when it is set on the `<use>` itself (`fill: var(--board-spot)`); the variable change on the root is inherited and the transition runs on the `<use>`. The probe measures it; the fallback is a change with no transition (the still is unchanged).
- **The "9 parts" count must survive the drawing.** `PARTS` is one list; the scene, the counter and the follow card all read it, and `figures.test.ts` asserts the card's column is `PARTS.length`. Adding a part changes all three at once.
- **The audit pins go stale.** Every sister project edits its own sheet; `siblings.test.ts` fails on a changed paper, ink or count, and the fix is to re-pin (the test prints the new values). The README's Design system block says so.
- **Words.** "Consistent", "component" and "guideline" are heavy syllables; the writer keeps them in labels and uses "the same", "part" and "rule" in prose. The FK test says when a paragraph needs another pass.

## 9. The other reading, costed

If the owner meant *give otohime.dev a design system*, the honest answer is that the repo is built against it on purpose: eleven root layouts, each with its own `<html>` and stylesheet, eleven isolation tests that fail on any import across groups, and a motion contract whose hop rule is copied into every sheet rather than shared. A shared token file (`lib/tokens.css`, imported by every layout) would void those tests and the "a group owes nothing to another" rule in every plan since Shore, and would make a change to one pot a change to every project, which is the thing the projects were made to avoid. The useful middle, if ever wanted, is what this page's "Right here" figure shows: the facts of where the sheets agree today (`--paper` ×10, `--ink` ×11, Caveat + Patrick Hand ×5), which is a list to read, not a system to install. The product owner can plan that as a separate idea; this plan does not do it.
