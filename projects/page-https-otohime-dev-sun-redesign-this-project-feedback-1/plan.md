# Sun, redrawn: a one-page hand-drawn poster (pm-189)

**Idea.** "Page: https://otohime.dev/sun. Redesign this project. Feedback:
1. It contains too many words. 2. The graphic is poor. Make it like a simple
one-page infography with hand-drawn art style."

**Product.** `otohime.dev/sun` becomes a poster, not a tour. One scroll, no
buttons. On cream paper, in hand lettering, a single rough-inked cutaway of the
Sun (a quarter cut away, six layers hatched in pen colours, numbered 1 to 6),
with Earth at true size beside it. Six one-line callouts say what each numbered
layer is. Four stat badges give the headline numbers (109 Earths across ·
8 min 19 s of light to Earth · 15.7 million K at the core · 4.6 billion years
old). A three-step strip shows the Sun's life (Today → Red giant → White
dwarf). One footer line credits NASA and Wikipedia. The ink draws itself on
once, then three small loops keep it alive (convection arrows, a photon's
zig-zag, solar-wind dashes). Under `prefers-reduced-motion` it is a still
drawing. The visible page is **at most 220 words**, down from 861, and the walk
counts them.

Research: [research.md](research.md) (run-6362, rep-3585). It was checked
against the repo at 49b3e45.

## Decisions

| Decision | Why |
| --- | --- |
| Replace the eight-chapter tour with one static, server-rendered poster. No client component, no tour reducer, no interval. | Feedback 1 and 2 are both about the tour: it says every fact twice (611 of 861 words repeat the stage) and hides the story behind clicks. An infographic shows it at a glance. |
| Ink is rough.js on the server with a fixed seed, `roughjs` pinned to one exact version. The ink helper imports `roughjs/bundled/rough.cjs.js`, not `roughjs/bin/generator`. | `roughjs@4.6.6` has no `exports` map and no `"type":"module"`; its `main` is the CJS bundle. Plain Node (the `npm test` runner) cannot import `bin/generator` (extensionless ESM), so a unit test could not prove the ink is deterministic. The bundle runs in Node and in Next, and only the server uses it, so nothing ships to the browser. |
| Hand lettering: `next/font/google` Caveat (title, numbers) and Patrick Hand (labels), `variable` fonts, `fallback` set to `"Chalkboard SE", "Comic Neue", "Comic Sans MS", cursive`. If `next build` cannot fetch the fonts, swap the two calls for the same cursive stack in `layout.tsx` and record a decision; never vendor a `.woff2`. | Self-hosted at build, no browser request to Google, no binary in the repo. A lesson from earlier runs: Turbopack downloads font files itself, so an offline lease fails the build. The fallback is one reversible edit. |
| Callouts, badges, strip and footer are HTML text beside the drawing; the SVG holds only ink, six number badges and one "Earth, to scale" label. | Text inside an 800 px SVG shrank to 7 px on a phone. HTML text stays readable at 390 px and reads in order without JavaScript. |
| Word budget: a hard cap of **220** visible words (target 200), counted by one shared function on the served HTML. Counted: text of `<body>` with `<script>`, `<style>`, `<template>`, comments and tags removed, HTML entities decoded, split on whitespace, keeping only tokens that contain a letter or digit (so `·` and `—` separators are free). `aria-label`s are not visible and not counted. | One definition, used by the unit test (data side) and the walk (served HTML), so the two cannot drift. |
| Keep `_lib/sun.ts` `LAYERS`, `SOURCES`, `LIGHT_SECONDS`, `PHOTON_YEARS`; the poster's words live in a new `_lib/poster.ts`, each with a `source` key; a test still refuses an unsourced fact or a non-NASA/Wikipedia URL. | Provenance is the part of pm-188 that worked. Number words (`kelvin`, `km`, `years`, `lightTime`) stay in `format.ts`. |
| Earth stays at true ratio (1/109 of the Sun's width). The atmosphere is drawn thicker than true scale and not apologised for in text; the callouts carry the real thicknesses (500 km, 2,500 km). | Scale honesty is the cheapest wow on the page, and the explanatory note cost words. |
| Motion is CSS only: `pathLength="1"` plus `stroke-dashoffset` draw-on (about 2 s, staggered), then three loops named `sun-<part>-…`. Every `animation` is `none` under `prefers-reduced-motion: reduce`. No filter on an animated group. | A tenth of the old keyframes; the page keeps the animated feel the original idea asked for. |
| Three tasks: (1) pure engine, `qa: skip`; (2) the static poster and the walk; (3) the motion. Task 1 only adds files, task 2 deletes the tour and the old chapters. | Task 1 must leave the old page building, or `qa: skip` would ship a broken site. Task 2 is the first change a person sees, so it carries QA with a browser; motion is judged separately. |
| The walk and the tests are the proof. The pod has no browser, so the first QA on task 2 uses headless Chrome (playwright-core from a scratch directory) at 1366×768 and 390×844, motion on and off. A missing browser is a note, not a fail. | Same as pm-188. |
| Each delivery commit is authored and committed as `Otohime <quiinthieu@gmail.com>`; set the four `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables on `git commit` **and** `git push`. | Vercel Hobby deploys only the owner's commits. |

## The poster

Top to bottom, one column on a phone and two from 900 px:

1. **Title.** "The Sun" (Caveat) and "A star, cut open."
2. **Cutaway** (left, about 60 %). `viewBox="0 0 640 600"`. Six layers
   `<g data-layer="core|radiative|convective|photosphere|chromosphere|corona">`
   inked with rough.js: hachure fills at a different angle per layer, 2 to
   2.5 px pen strokes, warm yellows and oranges. A quarter is cut away so the
   interior shows; the cut faces the callouts. A number badge 1–6 sits on each
   layer. A small blue Earth dot at 1/109 of the Sun's width, with "Earth, to
   scale". `role="img"` and an `aria-label` that names the six layers.
3. **Callouts** (right): an `<ol data-callouts>` of six `<li
   data-callout="<layer>">`, each one line.
4. **Badges:** four `<li data-badge>` in rough-drawn frames, two by two on a
   phone.
5. **Life strip:** three rough circles, Today · Red giant (about 5 billion
   years from now) · White dwarf, drawn in size order.
6. **Footer:** "Numbers from NASA and Wikipedia · drawn by hand in code", with
   links to the three sources and `<a href="/">otohime.dev</a>`.

### Words (draft, about 150 of 220)

| # | Layer | Callout |
| --- | --- | --- |
| 1 | Core | 15.7 million K. Hydrogen fuses into helium here. |
| 2 | Radiative zone | Light bounces for about 170,000 years to get out. |
| 3 | Convection zone | Boiling plasma carries the heat the last 200,000 km. |
| 4 | Photosphere | The surface we see: 500 km thin, 5,772 K, dotted with sunspots. |
| 5 | Chromosphere | A 2,500 km red rim, seen in a total eclipse. |
| 6 | Corona | 1 to 2 million K, hotter than the surface. It streams away as the solar wind. |

Badges: `109` Earths across · `8 min 19 s` light to Earth · `15.7 million K`
at the core · `4.6 billion` years old. Strip: Today · Red giant · White dwarf.

Sources (as in pm-188): `nssdc` https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html,
`nasa-facts` https://science.nasa.gov/sun/facts/, `wikipedia-sun`
https://en.wikipedia.org/wiki/Sun. (`science.nasa.gov/resource/layers-of-the-sun`
404s; do not cite it.) Only the numbers above are shown; each has a source key
in `poster.ts` and the existing fact table from
`projects/create-an-animated-infographic-to-describe-the-sun-its-struc/plan.md`
is the place to read them from.

### Data shapes

```ts
// _lib/poster.ts (new; imports LayerId, SourceId, SOURCES from ./sun)
type Callout = { layer: LayerId; n: 1|2|3|4|5|6; text: string; source: SourceId };
type Badge   = { big: string; small: string; source: SourceId };
type LifeStage = { id: "today" | "giant" | "dwarf"; label: string; note?: string };
export const TITLE = "The Sun"; export const TAGLINE = "A star, cut open.";
export const CALLOUTS: readonly Callout[];   // six, in layer order
export const BADGES: readonly Badge[];       // four
export const LIFE: readonly LifeStage[];     // three
export const FOOTER = "Numbers from NASA and Wikipedia · drawn by hand in code";
export const EARTH_LABEL = "Earth, to scale";

// _lib/words.ts (new)
export const WORD_CAP = 220;
export function visibleWords(html: string): number;   // the rule in Decisions
export function textWords(text: string): number;      // same tokenising for plain strings

// _lib/ink.ts (new; the only file that imports roughjs)
export const SEED = 189;
export type InkPath = { d: string; stroke: string; strokeWidth: number; fill?: string };
export type InkOptions = { seed?: string | number; roughness?: number; bowing?: number;
  stroke?: string; strokeWidth?: number; fill?: string; fillStyle?: "hachure" | "solid" | "zigzag";
  hachureAngle?: number; hachureGap?: number };
export function inkCircle(cx: number, cy: number, r: number, o?: InkOptions): InkPath[];
export function inkPath(svgPath: string, o?: InkOptions): InkPath[];   // sectors, arcs, wedges
export function inkRect(x: number, y: number, w: number, h: number, o?: InkOptions): InkPath[];
export function inkLine(x1: number, y1: number, x2: number, y2: number, o?: InkOptions): InkPath[];
```

`seed` strings (a shape's name, e.g. `"core"`) are hashed to an integer, so
every shape has its own stable wobble and adding a shape never redraws the
others.

## Features (v1)

1. The poster above, at `/sun`, with its own root layout, `sun.css`, the
   `build-sha` meta and no Tailwind (as pm-188).
2. A visible-word count of at most 220 on the served HTML.
3. Draw-on entrance and three loops, still under reduced motion.
4. `/projects` row note: "Our star, cut open and drawn by hand."

Not in v1: a tour, buttons, a client component, sound, a light/dark toggle,
live solar data, translations, sharing, a raster, video or canvas, and any
change to `app/(site)/`, `app/(shore)/` or `app/(capsule)/`.

## Tasks

### 1. Poster engine: words, ink and data as pure TS

- **Role:** software_engineer, `qa: skip`. New `_lib/` files and tests; the old
  page is not touched and keeps building.
- **Problem:** The redesign rests on three things that must be right before a
  page uses them: the poster's sourced words, a word counter that both the
  tests and the walk share, and rough.js ink that is deterministic under Node
  and Next.
- **Action items:**
  1. `npm install --save-exact roughjs@4.6.6`. `package.json` must hold
     `"roughjs": "4.6.6"` with no `^` or `~`.
  2. `app/(sun)/_lib/ink.ts` as in Data shapes. Create one generator with
     `rough.generator()` from `roughjs/bundled/rough.cjs.js`, build each shape
     with `generator.circle/path/rectangle/line` and an explicit integer
     `seed`, and map `generator.toPaths(drawable)` to `InkPath[]`. Defaults:
     `roughness` 1.4, `bowing` 1, `strokeWidth` 2.2, ink `#3a2a28`. If
     TypeScript has no types for the deep import, add a small
     `app/(sun)/_lib/roughjs.d.ts` that re-exports the types of `roughjs`;
     do not use `any`. `ink.ts` imports nothing else (no `document`, no
     `window`).
  3. `app/(sun)/_lib/words.ts` as in Data shapes: strip `<script>`,
     `<style>`, `<template>` and comments, cut to the part after `<body`,
     replace tags with a space, decode `&amp; &lt; &gt; &quot; &#39; &#x27;
     &nbsp;`, split on whitespace, count tokens that match `/[\p{L}\p{N}]/u`.
  4. `app/(sun)/_lib/poster.ts` as in Data shapes, with the six callout
     lines, four badges and three life stages from The poster / Words. Keep
     `LAYERS`, `SOURCES`, `LIGHT_SECONDS`, `PHOTON_YEARS` in `sun.ts`
     unchanged.
  5. Tests (node:test) in `app/(sun)/_lib/`:
     - `ink.test.ts`: the same call twice returns identical `d` strings; two
       different seed strings return different `d`; no `d` contains `NaN` or
       `undefined`; every `d` starts with `M`; a hachure-filled circle returns
       at least two paths (outline and fill); a pinned snapshot: the SHA-256
       (`node:crypto`) of the concatenated `d` strings of
       `inkCircle(100, 100, 50, { seed: "core", fillStyle: "hachure", fill: "#f4b400" })`
       equals a constant in the test (run once to get it; a changed value
       means the Sun was redrawn on purpose); the file `ink.ts` contains no
       `document` or `window`.
     - `words.test.ts`: `visibleWords` of a fixture page ignores scripts,
       styles, comments and tags, counts `a·b` split by spaces as two words
       and a lone `·` as zero, decodes `&amp;`, and counts text after
       `<body` only (a `<title>` in `<head>` is free).
     - `poster.test.ts`: exactly six callouts with `n` 1..6 and layer ids
       equal to `LAYERS` ids in order; four badges; three life stages with
       ids `today`, `giant`, `dwarf`; every `source` is a key of `SOURCES`;
       the callouts contain `15.7 million K` and `170,000 years`; a badge big
       value is `109`, one is `lightTime(LIGHT_SECONDS)` (`8 min 19 s`), one is
       `15.7 million K`, one starts with `4.6`; `textWords` over title,
       tagline, callouts, badges, life labels, footer and `EARTH_LABEL` is at
       most 170 (leaves room for headings and the home link under the 220
       cap).
     - `sun.test.ts` keeps passing unchanged (source URL host rule, layer
       tiling); `isolation.test.ts` keeps passing (the new files import only
       from `./`, `roughjs` and `node:` modules).
  6. `README.md`: in the Sun layout block add one line: the poster's words are
     `_lib/poster.ts`, the ink is `_lib/ink.ts` (rough.js, fixed seed), and
     `words.ts` is the shared word counter.
  7. Commit and push with the owner identity.
- **Interfaces:** `app/(sun)/_lib/ink.ts`; `app/(sun)/_lib/words.ts`;
  `app/(sun)/_lib/poster.ts`; `app/(sun)/_lib/ink.test.ts`;
  `app/(sun)/_lib/words.test.ts`; `app/(sun)/_lib/poster.test.ts`;
  `package.json`; `README.md`
- **Non-goals:** any page, layout, CSS, component or SVG change; deleting the
  tour or the chapters; fonts; changes to the other route groups.
- **Acceptance:** `npm test` also runs the ink, word-count and poster tests and
  they pass: the ink is deterministic and NaN-free under plain Node, the word
  counter has one definition, and every poster word is sourced. The old `/sun`
  still builds.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node -e 'const v=require("./package.json").dependencies.roughjs; if(!/^\d+\.\d+\.\d+$/.test(v)){console.error("roughjs not pinned:",v);process.exit(1)}'`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(sun)/_lib/ink.test.ts' 'app/(sun)/_lib/words.test.ts' 'app/(sun)/_lib/poster.test.ts'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. The poster page: layout, ink, callouts, fonts and the walk

- **Role:** software_engineer, depends on 1. QA is required.
- **Problem:** Visitors still get the dark eight-chapter tour with 861 words
  and a flat diagram. `/sun` must become the hand-drawn poster, and the walk
  must stop checking the old tour and start enforcing the word cap.
- **Action items:**
  1. Read `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`
     (and any Next 16 doc you touch) before writing code (`AGENTS.md`).
  2. `app/(sun)/layout.tsx`: load Caveat and Patrick Hand with
     `next/font/google` (`variable: "--font-title"` / `"--font-hand"`,
     `display: "swap"`, `fallback: ["Chalkboard SE", "Comic Neue", "Comic Sans MS", "cursive"]`),
     put both `.variable` classes on `<html lang="en">`, keep the `build-sha`
     meta and the title template, and set `themeColor` to the paper colour
     `#f6f1e7`. Update the description to match the poster. If `npm run build`
     cannot fetch the fonts on this lease, apply the documented fallback (the
     same cursive stack, no `next/font`), record a decision, and say so in the
     commit message.
  3. `app/(sun)/_components/stage.tsx`: rewrite as a **server component**
     (no `"use client"`, no hooks). Build the cutaway from `LAYERS` with
     `ink.ts`: six `<g data-layer="<id>">` groups, hachure fills at a
     different `hachureAngle` per layer, a quarter cut away, number badges
     1–6 as small inked circles with a digit, the Earth dot at 1/109 of the
     Sun's width and the label `EARTH_LABEL`. `viewBox="0 0 640 600"`,
     `role="img"`, `aria-label` naming the six layers. No `<filter>`, no
     `<image>`, `<canvas>`, `<video>`. Every ink `<path>` carries
     `pathLength="1"` so task 3 can draw it on.
  4. Delete `app/(sun)/_components/sun-app.tsx`, `fact-list.tsx`,
     `app/(sun)/_lib/tour.ts`, `tour.test.ts` and `scenes.test.ts`. In
     `sun.ts` delete `CHAPTERS`, `Chapter` and `Fact` (and their tests in
     `sun.test.ts`: keep layer tiling, temperature order, source URL host rule,
     `lightTime(LIGHT_SECONDS)` and add that `sun.ts` exports no `CHAPTERS`).
     Nothing may still import the deleted names.
  5. `app/(sun)/sun/page.tsx` (server): top bar with `<a href="/">otohime.dev</a>`,
     the title and tagline, `Stage`, `<ol data-callouts>` with six
     `<li data-callout="<layer>">` (number, then text), four `<li data-badge>`
     in a `<ul>`, the life strip (`<ol data-life>` with three stages, each
     with an inked circle drawn by `ink.ts`, sized in order small, large,
     small) and the footer with the three source links. `title: { absolute: "Sun" }`.
     All words come from `poster.ts`.
  6. `app/(sun)/sun.css`, rewritten by hand, no Tailwind: paper tokens
     (`--paper #f6f1e7`, `--ink #3a2a28`, warm Sun yellows/oranges, one blue
     for Earth), optional paper grain as an inline-SVG data URI, the hand
     fonts via the `next/font` variables, a poster grid (two columns from
     900 px, one column below), badges 2×2 on a phone, uneven-radius frames
     (`14px 12px 15px 11px`) for HTML boxes, `.visually-hidden` kept, and a
     `@media (prefers-reduced-motion: reduce)` block with
     `animation: none !important; transition: none !important`. No text under
     12 px at 390 px. `scrollWidth - clientWidth` must be 0 at 390 px: no
     `overflow: hidden` on a parent of the SVG, SVG `max-width: 100%`.
  7. `scripts/walk-sun.sh` (keep port 4027, local and `BASE_URL` modes, the
     `check` helper, `grep -c` and numeric compares only). Remove the checks
     for 8 chapter sections, 8 scenes, `Next`, `Play`, `aria-live="polite"`.
     Add, for `/sun`: exactly 6 `data-layer="`, exactly 6 `data-callout="`,
     exactly 4 `data-badge`, exactly 3 stages in `data-life`; the texts
     `15.7 million K`, `170,000 years`, `8 min 19 s` and `109`; the NASA
     facts href; `href="/"`; **at most 220 visible words**, computed by
     importing `visibleWords` and `WORD_CAP` from `app/(sun)/_lib/words.ts`
     under `node --experimental-strip-types` (the check prints the count);
     no `"use client"`-only chunk for the page: the HTML contains no
     `data-tour` or `aria-live` marker and no `<button`; one stylesheet under
     `/_next/static/` that contains `prefers-reduced-motion` and none of
     `--tw-`, `tailwind`, `--color-paper`. Keep every other site check
     (`/projects`, `/shore`, `/capsule`, the site pages, both 404s).
  8. `content/site.ts`: the Sun row note becomes "Our star, cut open and
     drawn by hand." (same href, status and colour).
  9. `README.md`: Sun's layout line says poster, not tour; replace "how to add
     a chapter" (if present) with "the poster's parts and callouts live in
     `_lib/poster.ts`; the ink is rough.js with a fixed seed in `_lib/ink.ts`;
     `bash scripts/walk-sun.sh` counts the words (cap 220)".
  10. Run the walk on this lease; it must exit 0. Stop stray servers with
      `pkill -x next-server`, never `pkill -f "next start"`. Commit and push
      with the owner identity.
- **Interfaces:** `app/(sun)/`; `scripts/walk-sun.sh`; `content/site.ts`;
  `README.md`
- **Non-goals:** the draw-on entrance and loop animations (task 3); a client
  component; a tour or buttons; a light/dark toggle; changes to
  `app/(shore)/`, `app/(capsule)/` or how `app/(site)/` looks; a vendored font
  file; CI workflow changes.
- **Acceptance:** `/sun` serves a cream-paper, hand-lettered poster: a
  rough-inked cutaway with six numbered layers and Earth to scale, six
  one-line callouts, four stat badges, a three-step life strip and a
  one-line credit, in at most 220 words, with no buttons and no client
  JavaScript for the page. It has no sideways scroll at 390 px. `/projects`
  links it once; Shore, Capsule and the site pages are unchanged. `bash
  scripts/walk-sun.sh` exits 0 on the delivery sha.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-sun.sh && ! grep -nE 'wc +-l' scripts/walk-sun.sh`
  - `bash scripts/walk-sun.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4027/; then exit 1; fi`
    (no server left behind)
  - `if BASE_URL=http://127.0.0.1:4037 bash scripts/walk-sun.sh; then exit 1; fi`
    (the walk fails when Sun is not there)
  - `! grep -rn '"use client"' 'app/(sun)'`
  - `test ! -e 'app/(sun)/_lib/tour.ts' && test ! -e 'app/(sun)/_components/sun-app.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Ink motion: draw-on entrance and three loops

- **Role:** software_engineer, depends on 2. QA is required, because a person
  sees the motion.
- **Problem:** The poster is a still. The first idea asked for an animated
  infographic; a draw-on entrance and three small loops give it life without
  words, buttons or JavaScript.
- **Action items:**
  1. In `stage.tsx` add three loop groups drawn with `ink.ts`, none with a
     filter: `<g data-loop="convection">` (curved arrows in the convection
     band), `<g data-loop="photon">` (a zig-zag path in the radiative wedge
     with a small dot that walks it) and `<g data-loop="wind">` (short dashes
     streaming off the corona). Each has a resting pose that reads well as a
     still (arrows complete, zig-zag drawn in full, dashes mid-stream).
  2. In `sun.css` add: the draw-on (`@keyframes sun-draw` on
     `[data-layer] path` with `stroke-dasharray: 1; stroke-dashoffset: 1 → 0`
     over about 2 s, staggered per layer with `animation-delay`, hachure
     fills fading in after), and `@keyframes sun-convection-roll`,
     `sun-photon-walk`, `sun-wind-stream`. The loops start after the draw-on.
     Everything is `animation: none` in the existing reduced-motion block, and
     the resting styles (full dash offset 0, opacity 1) are the base styles,
     so a still reads complete and CSS that never loads cannot hide the
     drawing.
  3. `app/(sun)/_lib/motion.test.ts` (renamed from the idea of
     `poster.test.ts` to avoid clashing with task 1's data test): reads
     `stage.tsx` and `sun.css` as text and asserts: six `data-layer="` ids
     equal `LAYERS`; three `data-loop="` values `convection`, `photon`,
     `wind`; `@keyframes sun-draw`, `sun-convection-roll`, `sun-photon-walk`
     and `sun-wind-stream` exist; the CSS has a `prefers-reduced-motion:
     reduce` block containing `animation: none`; `stage.tsx` has no
     `"use client"`, `<filter`, `<image`, `<video` or `<canvas`; no
     `.gif`/`.png`/`.mp4` reference under `app/(sun)/`; the base (non-media)
     `[data-layer] path` rule does not set `opacity: 0` or
     `stroke-dashoffset: 1` (the still must be complete).
  4. `scripts/walk-sun.sh`: `/sun` has exactly 3 `data-loop="`, and the
     stylesheet contains `sun-draw`.
  5. `README.md`: one line on the motion (draw-on plus three loops, off under
     reduced motion, tested by `motion.test.ts`).
  6. If a browser runs on the lease, look at `/sun` at 1366×768 and 390×844
     with motion on and off; fix any overflow or overlap. Do not commit
     screenshots. Commit and push with the owner identity.
- **Interfaces:** `app/(sun)/_components/stage.tsx`; `app/(sun)/sun.css`;
  `app/(sun)/_lib/motion.test.ts`; `scripts/walk-sun.sh`; `README.md`
- **Non-goals:** new content or words; JavaScript animation; scroll-driven
  animation; filters on animated groups; changes to the layout grid or fonts.
- **Acceptance:** `/sun` draws itself on, then three loops run; under reduced
  motion the poster is complete and still; the page stays at most 220 words;
  `motion.test.ts` covers parts, keyframes and the reduced-motion block;
  `bash scripts/walk-sun.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(sun)/_lib/motion.test.ts'`
  - `test "$(grep -c 'data-loop=' 'app/(sun)/_components/stage.tsx')" -ge 3`
  - `bash scripts/walk-sun.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## Risks

- **Google Fonts egress at build.** Covered by Decisions: one-line fallback,
  recorded as a decision if used. QA should confirm the production page
  shows Caveat and Patrick Hand, not the fallback.
- **rough.js version drift.** Pinned exactly; the ink test's SHA-256 snapshot
  fails loudly if the Sun is redrawn.
- **No browser on the build pod.** Task 2's QA must use one; the walk covers
  structure and the word cap, not looks.
- **Poster too sparse.** If QA finds a callout unreadable at 390 px, widen
  the column before adding words; the cap is 220.
