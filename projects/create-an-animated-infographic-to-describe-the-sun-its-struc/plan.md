# Sun: an animated cutaway of our star (pm-188)

**Idea.** "Create an animated infographic to describe the sun, its structure,
etc. This should be a project."

**Product.** Sun is an animated infographic at `otohime.dev/sun`. One
hand-inked SVG cutaway of the Sun sits on a dark stage, and the visitor walks
through it in eight chapters: scale, core, radiative zone, convection zone,
photosphere, chromosphere, corona and solar wind, and the Sun's life story.
Each chapter lights up its layer, loops one small animation (four protons
fusing, a photon's 170,000-year random walk, convection cells rolling, sunspots
drifting, spicules, a coronal mass ejection, the red-giant future) and lists its
facts, each with a link to the NASA or Wikipedia page it came from. **Next**,
**Back**, the arrow keys, eight chapter dots and **Play** drive the tour. Under
`prefers-reduced-motion` every chapter is a still. Below the stage, all eight
chapters are plain server-rendered sections, so the page reads without
JavaScript and a screen reader gets the same story. Sun is the third row on the
Projects bench (`/projects`), after Shore and Capsule.

**Isolation.** Sun copies Shore (pm-181) and Capsule (pm-184). It has its own
root layout `app/(sun)/layout.tsx` with its own `<html>`, `<body>` and
`sun.css`. It uses no Tailwind and imports nothing from `@/components`,
`@/content`, `@/lib`, `app/(site)`, `app/(shore)` or `app/(capsule)`. A unit
test enforces the boundary both ways. The top bar's link home is a plain
`<a href="/">`, because moving between root layouts is a full page load. Read
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`
and the other Next 16 docs you touch before writing code (`AGENTS.md`).

Research: [research.md](research.md) (run-6329). The fact table below is the
research table, reconciled to one basis per number.

## Decisions

| Decision | Why |
| --- | --- |
| Sun is a static page in its own route group: no table, migration, auth, API or persistence. | Shore and Capsule proved the structure on Next 16 in production. It is cheap and reversible, and no person has to act. |
| Animation is CSS `@keyframes` on named SVG groups, switched by `data-chapter` on the stage and posed by a pure tick reducer. No animation library, canvas, video, GIF or raster. | The repo already drives figures this way (`app/(capsule)/_lib/machine.ts`), so the click path is a unit test. Scroll-driven CSS is still behind a flag in Firefox; binaries are forbidden. |
| Every fact is data in `_lib/sun.ts` with a source key, and every source is an `https://` URL on `nasa.gov` or `wikipedia.org`. A test refuses an unsourced fact. | Mixed units and unsourced numbers are how infographics go wrong. NASA material is public domain. |
| One basis per number: composition **by mass**; temperatures in kelvin first with °C in brackets; distances in km. | The NSSDC sheet gives composition by number of atoms (91 % H); the familiar 73.5 % is by mass. The page says which. |
| Convection zone: "from about 0.7 R (about 490,000 km from the centre) to the surface, about 200,000 km deep". | Research wrote "0.7 R (500,000 km)", which reads as a thickness and is wrong by more than 2×. 0.7 × 695,700 = 487,000 km. |
| Tour rules: a manual **Next**, **Back** or dot press stops Play; **Play** at the last chapter restarts from chapter 1; Play stops itself after the last chapter's hold. | A manual press stopping auto-advance is the WCAG 2.2.2 pause behaviour; replay at the end is what a Play press there means. Pinned so the reducer test is exact. |
| Under reduced motion the client dispatches `settle` after every press and tick: transitions are instant, holds still count, and the CSS sets `animation: none`. Each scene's resting pose is its most informative frame. | Same as Capsule. Play still works without motion. |
| Earth is drawn at true scale (1/109 of the Sun's width) beside a magnified inset labelled "Earth, enlarged". | Scale honesty: cheating the ratio is the classic infographic lie. |
| The wobble filter (`feTurbulence` + `feDisplacementMap`) is on the static cutaway only, never on an animated group. | Filtered animation re-rasterises every frame and stutters on phones. |
| Two scenes ship with the page (task 2) and the other six follow (task 3). Coverage is a node test that reads `stage.tsx` and `sun.css` as text. | Proves the mechanism on two scenes before six more copy it. `node --test` cannot import `.tsx`; `lib/build-stamp.test.ts` already reads files as text. |
| Sun has its own `isolation.test.ts` and `scripts/walk-sun.sh` (port **4027**), and edits no Shore or Capsule file. | Shore uses 4019, Capsule 4021, music 4025. A shared checker would couple the plans. |
| The click path is proven by unit tests over `_lib/tour.ts` plus server-rendered markers in the walk. A browser pass is QA, and a missing browser is a note, not a fail. | Headless browsers have been unreliable on some leases (pm-181). |
| Each delivery commit is authored and committed as `Otohime <quiinthieu@gmail.com>`; set the four `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables on `git commit` **and** `git push`. | Vercel Hobby deploys only the owner's commits. |

## Features (v1)

1. **Stage.** A dark sky with the Sun, a quarter cut away to show the core,
   radiative zone and convection zone, the photosphere rim, the chromosphere
   and the corona. The SVG is `role="img"` with an `aria-label` naming the
   current chapter. `data-chapter="<id>"` on the stage switches which scene
   group shows and which layer is lit; the other layers fade back.
2. **Controls.** **Back**, **Next** and **Play**/**Pause** are real
   `<button>`s; eight numbered dots jump to a chapter (`aria-current="step"` on
   the current one); ← and → work when the stage has focus. Back is disabled on
   chapter 1, Next on chapter 8.
3. **Caption and facts.** The chapter title and lede in an `aria-live="polite"`
   region, and the chapter's facts as a list: label, value and a small source
   link (`NASA` or `Wikipedia`) to the page it came from.
4. **Chapters below.** Eight `<section data-chapter-section="<id>">` with an
   `<h2>`, the lede and the full fact list, always server-rendered.
5. **Counters.** Scale shows "8 min 19 s" (light from the Sun to Earth);
   radiative shows "170,000 years". Both are always in the HTML at their final
   value; while a chapter is entering the stage may count up to them.
6. **Footer.** "Facts from NASA (public domain), cross-checked with Wikipedia.
   Drawings are our own." with links to the sources.

Not in v1: scroll-driven animation, sound, a light theme, localStorage resume,
sharing, live solar data, translations, and any change to how `app/(site)/`,
`app/(shore)/` or `app/(capsule)/` look.

### Chapters and scenes

| # | id | Title | Layer lit | Scene (loops; resting pose in brackets) | Task |
| --- | --- | --- | --- | --- | --- |
| 1 | `scale` | How big is it? | all | Sun and Earth at true ratio plus the inset; a light pulse runs from Sun to Earth (pulse arriving) | 2 |
| 2 | `core` | The core | core | Four protons converge into a helium nucleus and a photon leaves (protons joined, photon just out) | 2 |
| 3 | `radiative` | The radiative zone | radiative | A photon zig-zags through a dense dot field (the zig-zag path drawn in full) | 3 |
| 4 | `convective` | The convection zone | convective | Four or five cells roll: rise on the warm side, sink on the cool side (arrows on every cell) | 3 |
| 5 | `photosphere` | The photosphere | photosphere | Granules shimmer; an equator sunspot overtakes a high-latitude one (both mid-disc, the equator one ahead) | 3 |
| 6 | `chromosphere` | The chromosphere | chromosphere | Spicules jet up from the rim and fall back (spicules at full height) | 3 |
| 7 | `corona` | Corona and solar wind | corona | Streamers fan out, a prominence loops, a CME puffs out, wind streams past a small Earth and its magnetic bubble (CME mid-flight) | 3 |
| 8 | `life` | A star's life | all | A timeline from 4.6 billion years ago; the Sun swells to a red giant and shrinks to a white dwarf (all three sizes, labelled) | 3 |

### Facts

Sources: `nssdc` = https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html,
`nasa-facts` = https://science.nasa.gov/sun/facts/, `wikipedia-sun` =
https://en.wikipedia.org/wiki/Sun. (`science.nasa.gov/resource/layers-of-the-sun`
now 404s; do not cite it.)

| Chapter | Label | Value | Source |
| --- | --- | --- | --- |
| scale | Radius | 695,700 km: 109 Earths across, about 1.3 million Earths by volume | nssdc |
| scale | Mass | 1.989 × 10³⁰ kg, 99.86 % of all the mass in the Solar System | nssdc |
| scale | Distance | 149.6 million km; light takes 8 min 19 s | nssdc |
| scale | Type | G2 V, a yellow dwarf on the main sequence | nssdc |
| scale | Made of (by mass) | 73.5 % hydrogen, 24.9 % helium, about 1.7 % heavier elements | wikipedia-sun |
| core | Extent | the centre to about 0.25 R, about 138,000 km thick | nasa-facts |
| core | Temperature | 15.7 million K (15.7 million °C) | nssdc |
| core | Density | 150 g/cm³, about 13 times lead | nssdc |
| core | Pressure | 2.5 × 10¹¹ bar | nssdc |
| core | Fusion | about 3.7 × 10³⁸ protons become helium every second | wikipedia-sun |
| core | Mass into light | 4.26 million tonnes every second; 3.828 × 10²⁶ W | nssdc |
| radiative | Extent | about 0.25 R to 0.7 R | wikipedia-sun |
| radiative | Temperature | falls from about 7 million K to 2 million K | wikipedia-sun |
| radiative | A photon's trip | energy takes about 170,000 years to cross it and reach the convection zone | nasa-facts |
| convective | Extent | from about 0.7 R (about 490,000 km from the centre) to the surface, about 200,000 km deep | wikipedia-sun |
| convective | Temperature | below 2 million K at its base, about 5,800 K at the top | wikipedia-sun |
| convective | Why it churns | hot plasma rises, cools at the surface and sinks, like a pot on the boil | nasa-facts |
| photosphere | Thickness | about 500 km | nssdc |
| photosphere | Temperature | 5,772 K (5,499 °C) | nssdc |
| photosphere | Rotation | about 25 days at the equator, about 36 days near the poles | nasa-facts |
| photosphere | Sunspots | 1,600 to 160,900 km across, cooler than their surroundings, lasting days to months | nasa-facts |
| chromosphere | Thickness | about 2,500 km | nssdc |
| chromosphere | Temperature | rises outward, to about 30,000 K at its top | nssdc |
| chromosphere | Seen in eclipses | a thin red rim around the Moon during a total eclipse | nasa-facts |
| corona | Temperature | 1 to 2 million K, hotter than the surface below it | nasa-facts |
| corona | Solar wind | the corona streams out into space as the solar wind | nasa-facts |
| corona | Flares and CMEs | a flare releases energy like billions of hydrogen bombs; CMEs travel at over a million miles per hour | nasa-facts |
| corona | Solar cycle | about 11 years; the magnetic poles flip each cycle; Cycle 25 began in December 2019 | nasa-facts |
| life | Age | about 4.6 billion years, a little under halfway through its main-sequence life | nasa-facts |
| life | Next 5 billion years | it keeps fusing hydrogen as it does now, slowly brightening | nasa-facts |
| life | Red giant | it swells, perhaps past Earth's orbit, then sheds its outer layers | wikipedia-sun |
| life | White dwarf | a hot, Earth-sized remnant that cools for billions of years | wikipedia-sun |

### Layers

| id | Name | from | to | tempK [inner, outer] | Unit |
| --- | --- | --- | --- | --- | --- |
| `core` | Core | 0 | 0.25 | [15 700 000, 7 000 000] | fraction of R |
| `radiative` | Radiative zone | 0.25 | 0.7 | [7 000 000, 2 000 000] | fraction of R |
| `convective` | Convection zone | 0.7 | 1 | [2 000 000, 5 800] | fraction of R |
| `photosphere` | Photosphere | 0 | 500 | [6 400, 4 400] (5 772 effective) | km above R |
| `chromosphere` | Chromosphere | 500 | 3 000 | [4 400, 30 000] | km above R |
| `corona` | Corona | 3 000 | 5 000 000 | [1 000 000, 2 000 000] | km above R |

### Data shapes

```ts
// _lib/sun.ts
type LayerId = "core" | "radiative" | "convective" | "photosphere" | "chromosphere" | "corona";
type Layer = { id: LayerId; name: string; region: "interior" | "atmosphere";
               from: number; to: number;            // fractions of R inside, km above R outside
               tempK: [number, number]; colour: string };
type SourceId = "nssdc" | "nasa-facts" | "wikipedia-sun";
type ChapterId = "scale" | "core" | "radiative" | "convective" | "photosphere" | "chromosphere" | "corona" | "life";
type Fact = { label: string; value: string; source: SourceId };
type Chapter = { id: ChapterId; title: string; layer: LayerId | "all"; lede: string; facts: Fact[] };
export const LAYERS: readonly Layer[];
export const CHAPTERS: readonly Chapter[];          // the eight above, in order
export const SOURCES: Record<SourceId, { name: string; url: string }>;
export const LIGHT_SECONDS = 499;                   // 149.6e6 km / 299,792 km/s
export const PHOTON_YEARS = 170_000;

// _lib/tour.ts (copied in the style of app/(capsule)/_lib/machine.ts, not imported)
type Tour = { chapter: number; phase: "settled" | "entering"; frame: number; playing: boolean; held: number };
type TourAction = "next" | "back" | "play" | "pause" | "tick" | "settle" | { goto: number };
export const ENTER_FRAMES = 10;                     // the slide between chapters, on twos at 12 fps
export const HOLD_FRAMES = 96;                      // 8 s at 12 fps before Play advances
export const newTour = (): Tour;                    // chapter 0, settled, not playing
export function step(t: Tour, a: TourAction): Tour;

// _lib/format.ts
export function kelvin(k: number): string;  // 15_700_000 → "15.7 million K (15.7 million °C)"; 5772 → "5,772 K (5,499 °C)"
export function km(n: number): string;      // 695_700 → "695,700 km"
export function years(n: number): string;   // 170_000 → "170,000 years"; 1 → "1 year"
export function lightTime(s: number): string; // 499 → "8 min 19 s"
```

`kelvin`: at or above 1 million, one decimal with a trailing `.0` dropped and
°C equal to the K figure; below that, grouped integers and °C = K − 273.15
rounded.

## Tasks

### 1. Sun's engine: facts, layers, tour and number words as pure TS

- **Role:** software_engineer, `qa: skip`. Pure `_lib/` code and tests, nothing
  a person sees; its verification proves it fully.
- **Problem:** The infographic is only as good as its numbers and its
  navigation. Both must be pure, sourced and tested before a page shows them.
- **Action items:**
  1. `app/(sun)/_lib/sun.ts`: `LAYERS`, `CHAPTERS` (titles, ledes and every
     fact from the Facts table, in order), `SOURCES`, `LIGHT_SECONDS`,
     `PHOTON_YEARS`, with the types in Data shapes. Each lede is one or two
     plain sentences.
  2. `app/(sun)/_lib/format.ts`: `kelvin`, `km`, `years`, `lightTime` as
     specified. Use `Intl.NumberFormat("en-US")` for grouping so server and
     client agree.
  3. `app/(sun)/_lib/tour.ts`: `newTour`, `step`, `ENTER_FRAMES`,
     `HOLD_FRAMES`, `CHAPTER_COUNT = 8`. Rules: `next`/`back`/`goto` move to a
     different chapter in `entering` frame 0 and set `playing: false`;
     `next` on the last, `back` on the first and `goto` to the current chapter
     are no-ops; `goto` clamps to [0, 7] and ignores non-integers. `play` sets
     `playing: true`, `held: 0`, and from the last chapter also moves to
     chapter 0 entering. `pause` sets `playing: false`. `tick` advances
     `entering` one frame and settles after `ENTER_FRAMES`; when settled and
     playing it counts `held`, and at `HOLD_FRAMES` it moves to the next
     chapter (still playing) or, on the last, stops playing. `settle` ends
     `entering` at once and leaves `held` and `playing` alone. A frame cap
     guards `settle` as in Capsule.
  4. Tests (node:test) under `app/(sun)/_lib/`:
     - `sun.test.ts`: the three interior layers tile [0, 1] in order with no
       gap or overlap; atmosphere layers are contiguous from 0 km; the
       representative temperatures fall core > radiative > convective >
       photosphere, and chromosphere's and corona's tops are hotter than the
       photosphere; there are exactly eight chapters with the ids in order and
       unique; each has a title, a lede and at least three facts; every fact's
       `source` is a key of `SOURCES`; every source URL starts with
       `https://` and its host ends in `nasa.gov` or `wikipedia.org`; no URL
       contains `layers-of-the-sun`; some fact value contains `15.7 million K`
       and `170,000 years`; `lightTime(LIGHT_SECONDS)` is `8 min 19 s`.
     - `format.test.ts`: the examples in Data shapes, plus `kelvin(30_000)`
       is `30,000 K (29,727 °C)` and `kelvin(2_000_000)` is
       `2 million K (2 million °C)`.
     - `tour.test.ts`: every rule in action item 3, including Play from
       chapter 0 visiting every chapter in order on ticks alone, ending on
       chapter 7 with `playing: false`, and never taking more than
       8 × (`ENTER_FRAMES` + `HOLD_FRAMES`) ticks; Play from the last chapter
       restarting at 0, a manual `next` while playing stopping Play, and
       frames only advancing on `tick`.
     - `isolation.test.ts` (modelled on `app/(capsule)/_lib/isolation.test.ts`):
       nothing under `app/(sun)/` imports `globals.css`, Tailwind,
       `@/components`, `@/content`, `@/lib`, `app/(site)`, `app/(shore)` or
       `app/(capsule)` (by alias or `../`); nothing under `app/(site)/`,
       `app/(shore)/`, `app/(capsule)/`, `components/` or `lib/` imports
       `(sun)` or `sun.css`. It includes the "checker flags what it should"
       self-test, and the scan must find `sun.ts`.
  5. `package.json`: `test` adds `'app/(sun)/_lib/*.test.ts'` after the
     Capsule glob; the strip-types flags stay before `--test`.
  6. `README.md`: in the layout block, `app/(sun)/` is Sun, an animated
     cutaway of the Sun with its own root layout and CSS, whose facts and tour
     are pure data in `_lib/`. The Tests line says `npm test` also covers
     Sun's `_lib/*.test.ts`.
  7. Commit and push with the owner identity.
- **Interfaces:** `app/(sun)/_lib/`; `package.json`; `README.md`
- **Non-goals:** any page, layout, CSS, component or SVG; changes to
  `app/(site)/`, `app/(shore)/` or `app/(capsule)/`; a shared isolation checker.
- **Acceptance:** `npm test` runs Sun's engine tests and they pass: the layers
  tile, the temperatures have the real shape, every fact is sourced from NASA
  or Wikipedia, the number words are right, and the tour's Next/Back/dots/Play
  rules hold.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(sun)/_lib/*.test.ts'`
  - `grep -q "app/(sun)/_lib/\*.test.ts" package.json`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Sun's page: the cutaway, the tour, two scenes and the walk

- **Role:** software_engineer, depends on 1. QA is required.
- **Problem:** The facts and the tour exist but nobody can see them. `/sun`
  needs its own root layout, the inked cutaway, the controls, the chapter
  sections, the first two animated scenes and a place on the Projects bench,
  proven by a checked-in walk any SWE can fix.
- **Action items:**
  1. `app/(sun)/layout.tsx`: its own `<html lang="en">` and `<body>`,
     `import "./sun.css"`, metadata with title template `%s · Sun`, a
     description, `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`
     and a dark theme colour (`viewport` export if Next 16 asks for it).
     `app/(sun)/sun/page.tsx` (server) uses `title: { absolute: "Sun" }`.
  2. `app/(sun)/sun.css`, hand-written: dark sky tokens, a top bar, the stage,
     controls, dots, the facts panel, the chapter sections, the footer, a
     phone layout with no horizontal overflow at 390 px, and
     `@media (prefers-reduced-motion: reduce)` setting `animation: none` and
     `transition: none` on everything. No Tailwind. Scene keyframes are named
     `sun-<chapterId>-<part>` and run only under
     `[data-chapter="<id>"]`. No `overflow: hidden` on a parent of the
     wobble-filtered SVG.
  3. `app/(sun)/_components/stage.tsx`: the SVG cutaway built from `LAYERS`
     (radii from the fractions; the atmosphere drawn at a readable, labelled
     exaggeration), the wobble filter (id from `useId`) on the static layers
     only, a scene group `<g data-scene="<id>">` for `scale` and `core` (Scenes
     table), and the lit-layer styling driven by `data-chapter`. Every scene
     group is always rendered; CSS shows only the one matching
     `data-chapter`, so the server HTML carries all of them. Earth at true
     ratio plus the labelled inset.
  4. `app/(sun)/_components/sun-app.tsx` (client): `useReducer(step,
     newTour())`; a `setInterval(1000 / 12)` tick loop while entering or
     playing, started in an effect; under `prefers-reduced-motion` it
     dispatches `settle` after every press and tick. Renders the stage, Back,
     Next, Play/Pause, eight dots, the `aria-live="polite"` caption, the facts
     panel with source links, and the counters (`lightTime(LIGHT_SECONDS)`,
     `years(PHOTON_YEARS)`). ← and → on the focused stage dispatch back/next.
     The server render is chapter 0, settled, not playing, so hydration
     matches.
  5. `app/(sun)/sun/page.tsx`: the top bar with `<a href="/">otohime.dev</a>`,
     `SunApp`, the eight `<section data-chapter-section="<id>">` with `<h2>`,
     lede and facts (each value through the same text as the data), and the
     footer (Features 6).
  6. `app/(sun)/_lib/scenes.test.ts`: reads `_components/stage.tsx` and
     `sun.css` as text. For each id in `ANIMATED = ["scale", "core"]` it
     asserts `data-scene="<id>"` in the stage and an `@keyframes sun-<id>-`
     in the CSS; it asserts the CSS has a `prefers-reduced-motion: reduce`
     block containing `animation: none`; it asserts no `<image`, `<video`,
     `<canvas` or `.gif`/`.png`/`.mp4` reference under `app/(sun)/`.
  7. `isolation.test.ts` now also asserts the scan finds `layout.tsx` and
     `sun.css`.
  8. `content/site.ts`: append `{ title: "Sun", note: "Eight chapters through
     a star, one layer at a time.", href: "/sun", status: "live", colour:
     "yellow" }` after Capsule.
  9. `lib/build-stamp.test.ts`: assert `app/(sun)/layout.tsx` publishes
     `build-sha` (same regex as Capsule's). `e2e/rbac.test.ts`: the Projects
     test also expects `href="/sun"`, and a new test checks `/sun` returns 200
     without `aria-label="Main"`.
  10. `scripts/walk-sun.sh`, a copy of `scripts/walk-capsule.sh` (bash,
      `set -u`, `check` helper, `grep -c` with numeric compares and never
      `wc -l`, server in its own process group killed on EXIT, local and
      `BASE_URL` modes, `EXPECT_SHA`, `SKIP_BUILD`), `PORT` default **4027**.
      Checks:
      - (local only) `.next/app-path-routes-manifest.json` lists `"/sun"`.
      - `/sun` returns 200 with `<title>Sun</title>`, no `aria-label="Main"`,
        a `build-sha` meta equal to `EXPECT_SHA`, exactly 8
        `data-chapter-section="`, at least 2 `data-scene="`, the texts
        `15.7 million K`, `170,000 years`, `8 min 19 s`, `Next`, `Play`,
        `aria-live="polite"`, an `href="https://science.nasa.gov/sun/facts/"`
        and an `href="/"`.
      - `/sun` links exactly one stylesheet under `/_next/static/`; it returns
        200 with a non-empty body and contains none of `--tw-`, `tailwind` or
        `--color-paper`, and contains `prefers-reduced-motion`.
      - `/projects` returns 200 with `aria-label="Main"`, exactly one
        `href="/sun"`, and at least one `href="/shore"` and `href="/capsule"`.
      - `/shore` and `/capsule` return 200.
      - `/`, `/work`, `/play`, `/notes` and `/music` return 200.
      - `/sun/nope` and `/nonexistent` return 404 with `Nothing in this parcel`.
  11. `README.md`: Sun's layout line names `_components/`; add the walk
      (`bash scripts/walk-sun.sh`; `BASE_URL=https://otohime.dev bash
      scripts/walk-sun.sh`).
  12. Run the walk on this lease; it must exit 0. Stop stray servers with
      `pkill -x next-server`, never `pkill -f "next start"`. Commit and push
      with the owner identity.
- **Interfaces:** `app/(sun)/`; `content/site.ts`; `lib/build-stamp.test.ts`;
  `e2e/rbac.test.ts`; `scripts/walk-sun.sh`; `README.md`
- **Non-goals:** scenes 3–8 (their chapters still light their layer and show
  their facts); scroll-driven animation; a light theme; persistence; any change
  to `app/(shore)/`, `app/(capsule)/` or how `app/(site)/` looks; CI workflow
  changes; a browser test harness.
- **Acceptance:** `/sun` serves its own page: title "Sun", no sidebar, one
  stylesheet with no Tailwind, `build-sha`, the stage with Back/Next/Play and
  eight dots, the facts with NASA links, eight chapter sections in the HTML,
  and animated scale and core scenes that become stills under reduced motion.
  `/projects` links it once; Shore, Capsule and the site pages are unchanged.
  `bash scripts/walk-sun.sh` exits 0 on the delivery sha.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-sun.sh && ! grep -nE 'wc +-l' scripts/walk-sun.sh`
  - `bash scripts/walk-sun.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4027/; then exit 1; fi`
    (no server left behind)
  - `if BASE_URL=http://127.0.0.1:4037 bash scripts/walk-sun.sh; then exit 1; fi`
    (the walk fails when Sun is not there)
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. The other six scenes

- **Role:** software_engineer, depends on 2. QA is required, because a person
  sees the animation.
- **Problem:** Chapters 3–8 light their layer and list their facts but do not
  move, so the infographic animates only a quarter of its story.
- **Action items:**
  1. In `app/(sun)/_components/stage.tsx` add `<g data-scene="<id>">` groups
     for `radiative`, `convective`, `photosphere`, `chromosphere`, `corona`
     and `life`, drawn as the Scenes table says. Animated groups carry no
     filter.
  2. In `app/(sun)/sun.css` add `@keyframes sun-<id>-<part>` for each, scoped
     under `[data-chapter="<id>"]`, with each scene's resting pose (Scenes
     table, in brackets) as the static style that reduced motion shows.
     The equator sunspot crosses the disc faster than the high-latitude one
     (period ratio about 25 : 36).
  3. `app/(sun)/_lib/scenes.test.ts`: `ANIMATED` becomes every id in
     `CHAPTERS`.
  4. `scripts/walk-sun.sh`: `/sun` has exactly 8 `data-scene="`.
  5. `README.md`: one short paragraph on adding a chapter: an entry in
     `CHAPTERS` (with sourced facts), a `data-scene` group in `stage.tsx`, and
     `sun-<id>-` keyframes with a resting pose, checked by `sun.test.ts` and
     `scenes.test.ts`.
  6. Look at every chapter in a browser if one runs on the lease, both with
     and without reduced motion; fix anything that overflows the stage at
     390 px. Do not commit screenshots.
  7. Commit and push with the owner identity.
- **Interfaces:** `app/(sun)/_components/stage.tsx`; `app/(sun)/sun.css`;
  `app/(sun)/_lib/scenes.test.ts`; `scripts/walk-sun.sh`; `README.md`
- **Non-goals:** new facts or chapters; tour rule changes; components other
  than the stage; raster, video or canvas.
- **Acceptance:** all eight chapters animate their scene and rest on their
  most informative frame under reduced motion; the scenes test covers every
  chapter; `bash scripts/walk-sun.sh` sees eight scenes and exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(sun)/_lib/scenes.test.ts'`
  - `test "$(grep -c 'data-scene=' 'app/(sun)/_components/stage.tsx')" -ge 8`
  - `test "$(grep -oE '@keyframes sun-[a-z]+-' 'app/(sun)/sun.css' | sort -u | grep -c .)" -eq 8`
  - `bash scripts/walk-sun.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA and acceptance

- **QA (tasks 2 and 3):**
  1. Rerun the task's verification on the delivery sha.
  2. Read `<meta name="build-sha">` on https://otohime.dev/. If it is the
     delivery sha or a descendant, run `BASE_URL=https://otohime.dev
     EXPECT_SHA=<that sha> bash scripts/walk-sun.sh`.
  3. If a headless browser works (Playwright), at 1366×768 and 390×844, with
     `reducedMotion` both `reduce` and `no-preference`: press Next through all
     eight chapters (the caption and `data-chapter` change each time), Back
     returns, a dot jumps, Play reaches chapter 8 and stops, 0 console errors,
     no horizontal overflow at 390 px. Attach one screenshot per chapter at
     1366×768. A missing browser is a note, not a fail.
  4. Judge the scenes against the Scenes table. Fail (cause=code) only for a
     clear miss: a scene that does not move without reduced motion, moves
     with it, overflows the stage, or contradicts its facts.
  5. The identity check is the author email; do not fail for a
     `Co-Authored-By` trailer or a committer the push helper rewrote.
- **Acceptance:** if otohime.dev serves the final sha, run
  `BASE_URL=https://otohime.dev EXPECT_SHA=<final sha> bash scripts/walk-sun.sh`,
  then follow `/projects` → the Sun row → `/sun` → Next through the eight
  chapters → "otohime.dev" → `/`. Otherwise walk a local
  `bash scripts/walk-sun.sh` of the final sha and pass with a watch on
  https://otohime.dev/sun: the same remote walk with `EXPECT_SHA` set to the
  final sha or a descendant, `not_before` one hour after the push.

## Risks

- **Numbers that look wrong.** One basis per number, stated on the page, a
  source beside each, and `sun.test.ts` guarding the shape.
- **Filter cost on phones.** Wobble on the static cutaway only.
- **Hydration.** The server and the first client render are both chapter 0,
  settled; the tick loop and `matchMedia` start in effects.
- **Scale honesty.** Earth is drawn true with a labelled inset; the atmosphere
  is exaggerated and labelled as such.
- **Shared files.** `README.md`, `package.json`, `content/site.ts` and
  `e2e/rbac.test.ts` change in other plans too. On a non-fast-forward push,
  `git pull --rebase`, rerun the tests and push again; never force-push.
- **Stopping servers.** `pkill -x next-server`, never `pkill -f "next start"`.
- **`AGENTS.md` churn.** `next dev` re-adds its block. Leave it alone.
