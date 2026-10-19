# Research: an animated infographic of the Sun (pm-188)

Submitted by research run-6329 as a report body. The product owner commits it as
`projects/create-an-animated-infographic-to-describe-the-sun-its-struc/research.md`.

Idea: "Create an animated infographic to describe the sun, its structure, etc. This
should be a project."

## Recommendation

Build **Sun**, a third row on the Projects bench at `otohime.dev/sun`. It is one
hand-inked SVG cutaway of the Sun that a visitor walks through in eight chapters
(scale, core, radiative zone, convection zone, photosphere, chromosphere, corona and
solar wind, life story). Each chapter lights up its layer, animates one idea (four
protons fusing, a photon's 170,000-year random walk, convection cells rolling,
sunspots drifting faster at the equator, spicules, a coronal mass ejection, the
red-giant future) and prints its facts with the source each came from. **Next**,
**Back**, the arrow keys and a **Play** button drive it; `prefers-reduced-motion`
shows every chapter as a still.

It copies Shore (pm-181) and Capsule (pm-184) exactly: its own route group
`app/(sun)/` with its own root layout and stylesheet, no Tailwind, no table, no
migration, no auth, no API, pure data and a pure reducer under `_lib/` that
`node --test` proves without a browser, an isolation test, a checked-in walk script
and a row in `site.projectList`.

Three things decide the shape of the work:

1. **Facts are data with sources.** Every number lives in `_lib/sun.ts` next to the
   URL it came from, and a unit test refuses an unsourced fact, a layer table with a
   gap, or a temperature profile that is not shaped like the real one. NASA's text and
   numbers are public domain, so there is no rights question.
2. **Animation is CSS keyframes posed by a reducer, not a library.** The repo already
   drives every figure as `(state, action) => state` with `tick` and `settle`
   (`lib/machines.ts`, `app/(capsule)/_lib/machine.ts`). The tour is the same
   shape, so the click path is a unit test. Scroll-driven CSS animations are still
   behind a flag in Firefox 152 (June 2026), so they are not the mechanism; a later
   enhancement at most. Video, Lottie, PNG sprites and canvas are out: the job rules
   and the CI cache key forbid binaries, and nothing here needs them.
3. **The page reads without JavaScript.** The server renders all eight chapters as
   text under the stage, so the HTML carries the whole infographic, the walk script
   can grep it, and a screen reader gets the same story. JS adds the stage, the
   animation and the chapter switching.

Three software-engineer tasks are enough (data and tour engine; the page with the
cutaway and chapter switching; the eight animated scenes). No build spike is needed:
pm-181 proved a second root layout and pm-184 proved the structure a second time.

## What the Sun is (the content)

Bases matter: the NSSDC fact sheet gives photosphere composition **by number of
atoms** (90.965 % H, 8.889 % He); the familiar figure is **by mass**. The page uses
by mass and says so. Temperatures are kelvin first with °C in brackets.

| Chapter | Fact | Value | Source |
| --- | --- | --- | --- |
| Scale | Mean radius | 695,700 km (109 Earths across; about 1.3 million Earths by volume) | NSSDC |
| Scale | Mass | 1.9884 × 10³⁰ kg, 99.86 % of the Solar System | NSSDC, Wikipedia |
| Scale | Mean distance from Earth | 149.6 million km; light takes 8 min 19 s | NSSDC, Wikipedia |
| Scale | Spectral type | G2 V, a yellow dwarf on the main sequence | NSSDC |
| Scale | Composition by mass | 73.5 % hydrogen, 24.9 % helium, about 1.7 % heavier elements | Wikipedia (photosphere, by mass) |
| Core | Extent | centre to about 0.20–0.25 R (NASA: about 138,000 km thick) | NASA facts, Wikipedia |
| Core | Temperature | 1.571 × 10⁷ K (15.7 million K) | NSSDC |
| Core | Density and pressure | 1.622 × 10⁵ kg/m³ (150 g/cm³); 2.477 × 10¹¹ bar | NSSDC |
| Core | Fusion | about 3.7 × 10³⁸ protons become helium nuclei every second; 4.26 million tonnes of mass become light each second | Wikipedia, NSSDC (mass conversion rate 4260 × 10⁶ kg/s) |
| Core | Luminosity | 3.828 × 10²⁶ W | NSSDC |
| Radiative zone | Extent | about 0.25–0.7 R | Wikipedia |
| Radiative zone | Temperature | falls from about 7 million K to 2 million K | Wikipedia |
| Radiative zone | Photon travel | energy takes about 170,000 years to reach the top of the convection zone | NASA facts |
| Convection zone | Extent | about 0.7 R (500,000 km) to the surface | Wikipedia |
| Convection zone | Temperature | below 2 million K; hot plasma rises, cools, sinks | NASA facts |
| Photosphere | Thickness | about 500 km (NASA: about 250 miles) | NSSDC, NASA facts |
| Photosphere | Temperature | 5,772 K effective (about 5,500 °C) | NSSDC, NASA facts |
| Photosphere | Rotation | about 25 days at the equator, about 36 days at the poles (NSSDC: 609.12 h at 16° latitude) | NASA facts, NSSDC |
| Photosphere | Sunspots | 1,600 to 160,900 km across; last days to months; cooler than their surroundings | NASA facts |
| Chromosphere | Thickness | about 2,500 km | NSSDC |
| Chromosphere | Temperature | rises outward to about 30,000 K at its top | NSSDC |
| Corona | Temperature | 1–2 million K, hotter than the surface below (the coronal heating problem) | Wikipedia, NASA facts (up to 2 million °C) |
| Corona | Solar wind, flares, CMEs | the corona streams out as the solar wind; flares release energy comparable to billions of hydrogen bombs; CMEs travel at over a million miles per hour | NASA facts |
| Corona | Solar cycle | about 11 years (NSSDC: 11.4 yr); the magnetic poles flip each cycle; Cycle 25 began December 2019 | NSSDC, NASA facts |
| Life | Age | about 4.5–4.6 billion years; a little under halfway through its main-sequence life | NASA facts |
| Life | Future | about 5 billion more years as it is, then a red giant, then a white dwarf | NASA facts, Wikipedia |

The layer table that the test checks (fractions of the radius, contiguous from 0 to 1,
then the atmosphere above):

| id | Layer | From | To | Representative temperature |
| --- | --- | --- | --- | --- |
| `core` | Core | 0.00 R | 0.25 R | 15.7 million K |
| `radiative` | Radiative zone | 0.25 R | 0.70 R | 7 million → 2 million K |
| `convective` | Convection zone | 0.70 R | 1.00 R | 2 million → 5,800 K |
| `photosphere` | Photosphere | 1.00 R | +500 km | 5,772 K |
| `chromosphere` | Chromosphere | +500 km | +3,000 km | up to about 30,000 K |
| `corona` | Corona | +3,000 km | millions of km | 1–2 million K |

Shape checks a test can make: core > radiative > convective > photosphere in
temperature; chromosphere and corona each hotter than the photosphere; the three
interior fractions tile [0, 1] with no gap or overlap; every fact's `source` key is in
`SOURCES` and every `SOURCES` URL is `https://` on `nasa.gov` or `wikipedia.org`.

## What the repo gives us

- **A project pattern, twice.** Shore (`app/(shore)/`) and Capsule (`app/(capsule)/`)
  each own a root layout, a stylesheet, a `_lib/` with `node --test` tests, an
  `isolation.test.ts` that forbids imports across the boundary both ways, a `build-sha`
  meta checked by `lib/build-stamp.test.ts`, an e2e check that the page answers 200
  with no `aria-label="Main"`, a `scripts/walk-*.sh` and a row in `site.projectList`.
  README states the rule: "A page with its own design gets its own route group with a
  `layout.tsx`". Capsule's `capsule-app.tsx` shows the client shell: a client
  component that `useReducer`s a pure machine, a `setInterval(1000 / 12)` tick loop
  while busy, and `settle` under `prefers-reduced-motion`.
- **A frame reducer.** `app/(capsule)/_lib/machine.ts` is 41 lines: phases, a frame
  counter, `tick`, `settle` with a 500-frame cap. The tour copies this (never imports
  it, the isolation test forbids it).
- **A hand-drawn look.** `components/figures.tsx` `Inked` and Capsule's `svg.ts`
  wobble line work with `feTurbulence` + `feDisplacementMap`. The same filter, written
  again inside `app/(sun)/`, gives the cutaway its riso edge. Apply it to the static
  layers only, not to the animated groups (filtered animation re-rasterises every
  frame and is slow on phones).
- **A walk script to copy.** `scripts/walk-capsule.sh` (set -u, a `check` helper,
  `grep -c` with numeric compares, never `wc -l`, the server in its own process group
  and killed on EXIT, local and `BASE_URL` modes, `EXPECT_SHA`). `walk-sun.sh` is a
  copy with Sun's markers.
- **CI gates.** `.github/workflows/ci.yml` runs lint, typecheck, `npm test`, a
  migration check, build, and `test:e2e` against `next start` with Postgres. A project
  with no table touches none of the migration steps. Push to main deploys production
  through Vercel; only commits authored as `Otohime <quiinthieu@gmail.com>` deploy, so
  every delivery commit sets the four `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables on
  commit and on push (pm-184's decisions table).
- **The 404.** `app/(site)/not-found.tsx` says "Nothing in this parcel"; the walk
  checks `/sun/nope` and `/nonexistent` still say it.

## Animation options weighed

| Option | Verdict | Why |
| --- | --- | --- |
| CSS keyframes on SVG groups, posed by `data-chapter` and a reducer | **Use** | No dependency, testable, settles to stills under reduced motion, the repo's existing style. |
| Scroll-driven CSS (`animation-timeline: scroll()`/`view()`) | Later, as an enhancement only | Chrome 115+ and Safari 26 have it; Firefox 152 still ships it behind `layout.css.scroll-driven-animations.enabled`. A chapter tour with buttons works everywhere today. |
| Web Animations API from JS | Not needed | Keyframes in CSS do the same with less code; the reducer only changes a class. |
| GSAP, Framer Motion, Lottie | No | A dependency for what CSS does; Lottie also means an exported JSON binary-like asset and an After Effects pipeline. |
| Canvas or WebGL | No | Harder to test, no text in the DOM, no reduced-motion for free; the sea-glass renderer in Shore was a vendored exception with a licence. |
| Video or GIF | No | Binaries are forbidden in the repo, and the content could not be read or sourced. |

## Product proposal: Sun

**Loop.** Open `/sun`. The stage shows the whole Sun, a quarter cut away, with Earth
for scale, and the first chapter's caption. **Next** (or →) slides to the core: the
layers outside it fade back, the core glows, four protons drift together and a photon
pops out, the facts panel lists the core's numbers with "NASA" links. Each chapter has
one such scene. **Play** advances a chapter every 8 s until the end. The chapter list
(eight numbered dots) jumps anywhere. Below the stage, the same eight chapters are
plain sections with the full text, always rendered.

**Chapters and scenes.**

1. **Scale.** Earth and the Sun side by side at true ratio (Earth is 1/109 of the
   width, with a magnified inset). A light pulse leaves the Sun and a counter runs to
   8 min 19 s. Facts: radius, mass share, distance, type.
2. **Core.** The cutaway zooms to the inner 0.25 R. Four protons converge into a helium
   nucleus and a photon leaves. Facts: temperature, density, pressure, protons per
   second, tonnes of mass to light per second.
3. **Radiative zone.** A photon zig-zags through a dense dot field; a year counter
   climbs to 170,000. Facts: extent, temperature fall, travel time.
4. **Convection zone.** Four or five rolling cells (loop: rise on the warm side,
   sink on the cool side). Facts: extent, temperature, why it churns.
5. **Photosphere.** The visible disc with granules; two sunspots cross it, the one
   near the equator faster than the one at high latitude. Facts: thickness,
   temperature, rotation, sunspot sizes and lifetimes.
6. **Chromosphere.** A thin rim above the disc with spicules jetting up and falling
   back. Facts: thickness, temperature rising outward, eclipses.
7. **Corona and solar wind.** Streamers fan out, a prominence loops, one CME puffs
   outward, wind particles stream past a small Earth with its magnetic bubble. Facts:
   temperature paradox, wind, flares, CMEs, the 11-year cycle.
8. **Life story.** A timeline from 4.6 billion years ago to the white dwarf; the Sun
   on the stage swells to a red giant and shrinks to a white dot. Facts: age,
   remaining life, what comes next.

**Motion rules.** Scenes loop with CSS `@keyframes` on named SVG groups, switched by
`data-chapter` on the stage. The transition between chapters is a short reducer-driven
`entering` phase (12 fps on twos, like Capsule) so a test can play Next → tick… →
settled. Under `prefers-reduced-motion: reduce` the stylesheet sets `animation: none`
for everything and the reducer settles each press at once; each scene's resting pose
is its most informative frame (the four protons already joined, the CME mid-flight).
Counters (8 min 19 s, 170,000 years) are text updated by the tick while `playing`,
and shown at their final value when settled.

**Accessibility.** The stage SVG is `role="img"` with an `aria-label` that names the
chapter; the caption is `aria-live="polite"`; Next/Back/Play are real buttons;
← and → work when the stage has focus; the chapter sections under the stage are plain
`<section>`s with `<h2>`s, so nothing is only in the picture. Colours: the stage is a
dark sky by design (space is dark), with the Sun's layers from white-yellow (core)
through orange to a deep red rim, chosen to pass 3:1 against the sky for strokes and
text; one scene, no light/dark toggle in v1.

**Persistence.** None needed. (An optional `localStorage["sun-v1"] = { chapter }`
to reopen where you left off is a two-line nicety; v1 can skip it, which also means
no hydration store.)

**Data shapes.**

```ts
// _lib/sun.ts
type LayerId = "core" | "radiative" | "convective" | "photosphere" | "chromosphere" | "corona";
type Layer = { id: LayerId; name: string; from: number; to: number;   // fractions of R for the interior,
               colour: string; tempK: [number, number] };              // km above R for the atmosphere
type SourceId = "nssdc" | "nasa-facts" | "wikipedia-sun";
type Fact = { label: string; value: string; source: SourceId; note?: string };
type Chapter = { id: ChapterId; title: string; layer: LayerId | "all"; lede: string; facts: Fact[] };
export const LAYERS: readonly Layer[];        // core, radiative, convective tile 0..1
export const CHAPTERS: readonly Chapter[];    // eight, in order
export const SOURCES: Record<SourceId, { name: string; url: string }>;

// _lib/tour.ts, in the style of app/(capsule)/_lib/machine.ts (copied, not imported)
type Tour = { chapter: number; phase: "settled" | "entering"; frame: number; playing: boolean; held: number };
type TourAction = "next" | "back" | "play" | "pause" | "tick" | "settle" | { goto: number };
export const ENTER_FRAMES = 10;  // the slide between chapters, on twos
export const HOLD_FRAMES = 96;   // 8 s at 12 fps before Play advances
export function step(t: Tour, a: TourAction): Tour;

// _lib/format.ts: pure number words for the facts and counters
export const kelvin = (k: number) => string;     // 15700000 → "15.7 million K (15.7 million °C)"
export const km = (n: number) => string;          // 695700 → "695,700 km"
export const years = (n: number) => string;       // 170000 → "170,000 years"
```

**Isolation.** `app/(sun)/layout.tsx` with its own `<html>`, `<body>`,
`import "./sun.css"`, title template `%s · Sun`, `other: { "build-sha": … }` and a
dark theme colour. `sun/page.tsx` uses `title: { absolute: "Sun" }` (pm-181's
lesson). The top bar links home with a plain `<a href="/">`. `isolation.test.ts` is
Capsule's copy with `(sun)` and `sun.css`, and the reverse check also forbids
`(sun)` from `app/(site)`, `app/(shore)`, `app/(capsule)`, `components/` and `lib/`.

**Site touch points.** `content/site.ts` gets `{ title: "Sun", note: "Eight chapters
through a star, one layer at a time.", href: "/sun", status: "live", colour:
"yellow" }` after Capsule; `e2e/rbac.test.ts` expects `/projects` to link `/sun` and
`/sun` to answer 200 without `aria-label="Main"`; `package.json` `test` adds
`'app/(sun)/_lib/*.test.ts'`; `lib/build-stamp.test.ts` asserts Sun's layout
publishes `build-sha`; README's layout block gets the line and the walk command.

## Proposed tasks (for the product owner)

1. **The data and the tour engine** (software_engineer, `qa: skip`). `_lib/sun.ts`
   (LAYERS, CHAPTERS with the facts table above, SOURCES), `_lib/tour.ts`,
   `_lib/format.ts`, their tests (layers tile [0, 1]; the temperature shape; every
   fact sourced and every source an https nasa.gov or wikipedia.org URL; eight
   chapters with unique ids and at least three facts each; `next` at the last
   chapter stays, `back` at the first stays, `goto` clamps, `play` advances after
   `HOLD_FRAMES` ticks and stops at the end, `settle` ends `entering`, illegal
   actions are no-ops; `kelvin`, `km`, `years` words), `isolation.test.ts`, the
   `package.json` glob, README. Verification: `npm ci && npm run lint && npm run
   typecheck && npm test`, the Sun glob alone, `grep -q "app/(sun)/_lib/\*.test.ts"
   package.json`, owner-authored commit.
2. **The page: cutaway, chapters and the walk** (software_engineer, depends on 1,
   QA required). Layout, `sun.css`, the hand-inked cutaway SVG with the six layers
   and Earth, the `SunApp` client shell (reducer, tick loop, reduced-motion settle,
   Next/Back/Play, dots, arrow keys, `aria-live` caption, facts panel with source
   links), the eight server-rendered chapter sections, the Projects row, e2e,
   build-stamp test, `scripts/walk-sun.sh` (copied from Capsule's: `/sun` 200 with
   `<title>Sun</title>`, no `aria-label="Main"`, `build-sha`, exactly 8
   `data-chapter-section="`, the texts `15.7 million K`, `170,000 years`, `Next`,
   `Play`, a `nasa.gov` href; one stylesheet with no `--tw-`; `/projects` links
   `/sun` once and still `/shore` and `/capsule`; site pages 200; the two 404s).
   Scenes 1 (scale) and 2 (core) animated so the mechanism is proven. Verification
   as pm-184 task 2: lint, typecheck, test, `bash -n` plus the `wc -l` grep, the
   walk exits 0, no server left on its port, the walk fails against an empty port,
   owner-authored commit.
3. **The other six scenes** (software_engineer, depends on 2, QA required). Keyframes
   and SVG groups for chapters 3–8, each with a resting pose for reduced motion, a
   one-paragraph README note on adding a chapter (an entry in `CHAPTERS` plus a
   scene group and keyframes), and the walk still green. Verification: lint,
   typecheck, test, a test that every chapter id has a `data-scene` group in the
   stage component (read the file as text, as `build-stamp.test.ts` does), the walk,
   owner-authored commit.

QA for 2 and 3: rerun the task's verification on the delivery sha; a Playwright pass
at 1366×768 and 390×844 with `reducedMotion` both ways: Next through all eight, Play
reaches the end and stops, Back returns, the caption changes, 0 console errors, no
horizontal overflow on the phone size. Acceptance walks production if `build-sha`
has caught up, else a local `next start` with a watch on `https://otohime.dev/sun`,
as pm-184 did.

## Risks

- **Numbers that look wrong.** Mixed bases (by number vs by mass, °C vs K, miles vs
  km) are the usual infographic failure. One basis each, stated on the page, with the
  source beside it; the fact table above is already reconciled.
- **Filter cost.** `feDisplacementMap` on an animated group makes phones stutter.
  Keep the wobble on the static cutaway, animate unfiltered groups on top.
- **Hydration.** The tour starts at chapter 0, `settled`, on both server and client, and
  the tick loop starts in an effect, so there is no mismatch and no store is needed.
- **Scale honesty.** Earth at true ratio is 1/109 of the Sun's width, about 4 px on a
  phone. Draw it true and add a magnified inset labelled as such, rather than
  cheating the ratio.
- **Fonts.** Capsule's hand font falls back on Linux; the same will show here. Not a
  failure (pm-184 acceptance note), but pick a fallback stack that still reads.
- **Stopping servers in verification.** `pkill -x next-server`, never `pkill -f
  "next start"` (pm-181's lesson).
- **Rights.** None: NASA material is public domain, Wikipedia text is only used as a
  cross-check, and every drawing is our own SVG.

## Decisions recorded in this run

- Own route group `/sun`, the Shore/Capsule pattern; no table, auth, API, library,
  video or canvas. CSS keyframes posed by a pure reducer; scroll-driven CSS is a later
  enhancement because Firefox still gates it.
- Facts from NASA (NSSDC fact sheet, science.nasa.gov/sun/facts) cross-checked with
  Wikipedia, stored as data with a source per fact; composition by mass.
- The preamble's plan document and `docs/claude/software-development.md` do not exist
  in this repo; AGENTS.md, README.md and the pm-181/pm-184 plans are the standing
  rules. No local test run (no node_modules; research changes no code).
- Lesson: NSSDC composition is by number of atoms, its rotation is 609.12 h at 16°
  latitude, and `science.nasa.gov/resource/layers-of-the-sun` now 404s.

## Sources

- NASA NSSDC Sun fact sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
- NASA Science, Sun: Facts: https://science.nasa.gov/sun/facts/
- Wikipedia, Sun (cross-check for composition by mass, zone extents, fusion rate,
  light travel time, corona temperature, life phases): https://en.wikipedia.org/wiki/Sun
- Scroll-driven animations support: https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/ ;
  https://connect.mozilla.org/t5/ideas/implement-css-scroll-driven-animations-animation-timeline/idi-p/116931 ;
  https://design.dev/guides/scroll-timeline/
- Repo: `README.md`, `AGENTS.md`, `app/(shore)/`, `app/(capsule)/` (`_lib/machine.ts`,
  `_lib/isolation.test.ts`, `_lib/art/svg.ts`, `_components/capsule-app.tsx`),
  `scripts/walk-capsule.sh`, `lib/machines.ts`, `components/figures.tsx`,
  `lib/build-stamp.test.ts`, `e2e/rbac.test.ts`, `.github/workflows/ci.yml`,
  `projects/add-a-new-project-input-some-coins-to-draw-cards-cards-are-c/{research,plan,acceptance_report_1}.md`
