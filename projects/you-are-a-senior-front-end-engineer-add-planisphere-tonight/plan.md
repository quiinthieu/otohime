# Planisphere: tonight's sky on a star wheel drawn in ink (pm-203)

**Idea.** "Add Planisphere, tonight's sky for a chosen city drawn in ink as a
rotating star wheel, at /planisphere. The full design is in
projects/research-and-design-more-projects-into-the-app/research.md §4.2
(pm-202)."

**Product.** `otohime.dev/planisphere`, the next project on the Projects
bench. It is a paper planisphere drawn in ink on cream paper. A star disc,
centred on the pole you can see, sits under a frame with an oval window: the
window is the horizon for the chosen city, so whatever shows through it is
above the horizon at that moment. Pick a city (24 of them, Ho Chi Minh City
first), a date and an hour, and the disc turns to match. The real stars are
there (921, down to magnitude 4.5), with the constellation lines, the names of
the bright stars, the ecliptic, the Sun and the Moon. A corner shows the
Moon's phase in words ("about two days past first quarter, 68 % lit"). A line
under the chart names the bright stars that are up. When the Sun is up, the
window turns pale and the page says so.

All of this works before JavaScript loads: a plain `<form method="get">`
draws the chart on the server. Once JavaScript is there, you can drag the disc
or use the arrow keys to turn the hours. "Now" jumps to the present, and
"Use my location" draws the sky for where you are.

Research: [research.md](research.md) (run-6764, rep-3857), checked against
the repo at f31389e. It holds the data shape (§2), the maths and its formulas
(§3), the page (§4), the no-JavaScript build proof (§5) and the tests (§6).
This plan repeats only what the contracts need, and records where it departs
from the research.

## Decisions

| Decision | Why |
| --- | --- |
| Route group `app/(planisphere)/` serves `/planisphere`, with its own root layout and `planisphere.css` written by hand. It uses Orrery's hand fonts (Caveat for titles, Patrick_Hand for text) through `next/font/google`, with the same literal options and cursive fallbacks. | House recipe (pm-202 research §1). Orrery's fonts already build in CI. |
| **The page exports `instant = false` and awaits `searchParams` at the top, outside any `<Suspense>`.** | With `cacheComponents: true`, a page that reads the query without it fails the build. A Suspense-wrapped read builds, but its answer streams in behind a script swap that never runs without JavaScript (research §5: two builds and a served probe). `dynamic = "force-dynamic"` is an error under Cache Components. |
| The stars are XHIP (Hipparcos) through d3-celestial, not the Yale catalogue. `scripts/vendor-planisphere.ts` fetches `data/stars.6.json`, `data/starnames.json`, `data/constellations.lines.json` and `LICENSE` at a pinned commit and writes `stars.ts`, `lines.ts` and `LICENSE.md`. The generated files are committed, and nothing fetches at runtime. | That is what d3-celestial's `stars.6.json` actually is (research §2). Proper names live in a separate file. The vendor script is the `vendor-elements.ts` pattern. |
| Magnitude 4.5 or brighter, **921 stars**. The script refuses a count outside 900–1,000, or a missing Sirius, Vega, Polaris, Betelgeuse, Canopus, Arcturus or Rigel. | Enough stars to find every constellation without making the chart unreadable. One constant drops it to 4.0 (519 stars) if the page grows too heavy. |
| Positions are J2000, with no precession. | The idea pins J2000. Precession over 26 years is about 0.36°, inside the 1° altitude tolerance. The explainer says "about". |
| The chart is a real planisphere: a disc centred on the pole, in equidistant projection (radius `R · p / (180 − |lat|)`), turned by one `rotate()`, under a frame whose window is the horizon curve for the latitude. The near pole is north for `lat >= 0` and south otherwise. In the south, the disc is mirrored so that east stays left of north. | Research correction 4. Only this form turns with a single transform. |
| The Moon uses the Astronomical Almanac's seven-term longitude series. The Sun uses Meeus ch. 25 low precision. | The mean synodic month was 0.7 day off at the 2026-10-10 new moon. The series lands every 2026 phase within 20 minutes (research §3.3). |
| The pinned vectors are the research's §3.5 table. **The product owner recomputed every one in Node on 2026-10-20, and they agree** (decision recorded). | Global lesson: a vector quoted in research was once wrong. |
| Rough.js ink draws only the frame, the hour ring, the date rim, the window rim, the compass letters' marks and the Moon's outline. Stars, lines, the ecliptic, the Sun marker and the Moon's lit part are plain SVG. `app/(orrery)/_lib/ink.ts` and `roughjs.d.ts` are **copied** with `SEED = 203`. `ink.ts` is the only file that imports `roughjs`. | 921 inked stars would be slow and unreadable. Copying follows the isolation rule. Server-drawn ink ships no rough.js to the browser. |
| **The island imports no `roughjs`, no `stars.ts` and no `lines.ts`.** The server renders the inked frame, the window and the star disc and passes them to the island as children. On hour and date changes, the island sets only the disc's rotation, the Sun and Moon markers, the daylight flag, the Moon's lit path and the "up now" line, all from `time.ts`, `sky.ts`, `sun.ts`, `moon.ts` and `wheel.ts`. A city change or "Use my location" navigates (`router.push` with the canonical query), so the server draws the window for the new latitude again. | The window and the disc's scale depend on latitude, which needs ink. Turning time needs only one transform. This keeps the client chunk small, and the walk can check it: no star data and no rough.js in any client chunk. Recorded as a decision. Vinyl's island is in the same range. |
| The query is `?city=<slug>&date=YYYY-MM-DD&hour=<0–23.75>`, or `?lat=&lon=&tz=` in place of `city`. Each field falls back to its default on its own, never with a 4xx. The defaults are `hcmc`, today and now, in the city's zone. | A half-good link still draws a sky. The page reads the clock only at request time. |
| City slugs, in this order: `hcmc`, `tokyo`, `seoul`, `singapore`, `bangkok`, `mumbai`, `dubai`, `istanbul`, `cairo`, `nairobi`, `cape-town`, `london`, `paris`, `berlin`, `madrid`, `reykjavik`, `new-york`, `los-angeles`, `mexico-city`, `sao-paulo`, `buenos-aires`, `sydney`, `auckland`, `honolulu`. | The walk and the tests name the slugs, so the plan fixes them. |
| The day test is Sun altitude above −6° (civil twilight). | The window tints and the stars fade then. The research's wording stays. |
| The walk caps the served HTML at **400 KB uncompressed**, not 200 KB. Coordinates are rounded to one decimal place. | The App Router serialises server markup a second time in the inline RSC payload, so about 110 KB of SVG becomes about 220 KB of HTML. 400 KB still catches a runaway, such as all 5,044 stars. Recorded as a decision. |
| Colour swatch `blue`. Project-list note: "Tonight's sky for your city, on a star wheel drawn in ink." The row goes last in the projects list (after Vinyl, or after Rotor if Rotor has landed). | The swatch is decoration. Blue is a night sky. |
| Walk port **4037**. The dead-port check uses 4039. | Ports 4019–4033 and 4035 (Rotor) are taken, and 4041 is Vinyl's fallback. |
| The isolation test builds `GROUPS` from `readdirSync(join(ROOT, "app"))`, as pm-202/t-1158 did for the other five (landed at a937f40). | The idea asks for it, and it is the house pattern now. |
| Three build tasks. Task 1 is the engine (`qa: skip`, `_lib/` only, nothing visible). Task 2 is the page without JavaScript (QA required). Task 3 is the island (QA required). | Task 2 is the first thing a visitor sees, so it gets its own QA, and `qa: skip` on a front-end path would be refused. The no-JavaScript page is complete and useful on its own before the island lands. |
| No operator action. The vendor script reads public GitHub raw URLs, and its output is committed. | Nothing in this plan needs a person. |
| Commits are authored and committed as `Otohime <quiinthieu@gmail.com>` (set `GIT_AUTHOR_*` and `GIT_COMMITTER_*`). Subjects start `pm-203/t-NNNN:`. | Vercel Hobby deploys only the owner's commits. |
| Rotor (pm-202) edits the same shared lines: `content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts` and `README.md`. On a rebase conflict, keep both sides. | Lesson iss-9. |

## File tree

```
app/(planisphere)/
  layout.tsx                   own <html>, planisphere.css, hand fonts, build-sha meta,
                               themeColor light/dark, theme-pin inline script
  planisphere.css              paper + ink tokens, night-blue window, dark scheme, two columns from 900 px,
                               focus rings, base-select styling, @media (prefers-reduced-motion: reduce)
  planisphere/page.tsx         server: instant = false; await searchParams; parseQuery; renders
                               the top bar, chart, Moon corner, "up now" line, GET form, credit, explainer
  _components/
    wheel.tsx                  server-safe SVG: frame, hour ring, disc (stars, lines, names, ecliptic,
                               date rim), window clipPath + inked rim, compass, Sun, Moon
    moon-corner.tsx            server-safe: inked outline + plain lit path + words
    planisphere-app.tsx        (task 3) the one "use client" island
  _lib/
    stars.ts · lines.ts · LICENSE.md     generated by scripts/vendor-planisphere.ts
    cities.ts                  24 cities {slug, name, lat, lon, tz, source}
    time.ts                    julianDay, gmstHours, lstHours, offsetMinutes, localToUtc, todayIn
    sky.ts                     altAz, discPoint, discRotation, horizon, hourTickAngle, dateTickAngle,
                               visible, upNow
    sun.ts                     sunPosition (RA/Dec/λ), sunAltitude, eclipticPoints
    moon.ts                    moonPosition (λ, β, RA, Dec), phase, illuminated, age, phaseWords, litPath
    wheel.ts                   State, reducer (city, date, hour, turn, now, locate), parseQuery, toQuery
    ink.ts · roughjs.d.ts      copied from Orrery, SEED 203
    words.ts                   word counter, WORD_CAP 120
    *.test.ts                  time, sky, sun, moon, stars, lines, cities, wheel, ink, words, isolation
scripts/vendor-planisphere.ts · scripts/walk-planisphere.sh
content/site.ts · lib/build-stamp.test.ts · e2e/rbac.test.ts · package.json · README.md
```

## Tasks

### 1. Planisphere's engine: vendored stars, sky maths and the wheel reducer, pinned to computed vectors

- **Role:** software_engineer, `qa: skip`. The task adds only `_lib/` files,
  the vendor script, the test glob, the npm script and the README test line.
  No route or layout is added, so visitors see no change.
- **Problem:** The page, the no-JavaScript form and the island all need the
  same correct sky: real stars and constellation lines, sidereal time, alt-az,
  the disc projection and horizon window, the Sun and the Moon, and a state
  that round-trips through a URL. None of it exists yet, and all of it must be
  proven before anything draws it.
- **Action items:**
  1. Read `AGENTS.md`, `node_modules/next/dist/docs/` for anything `_lib`
     touches, `scripts/vendor-elements.ts`, `app/(orrery)/_lib/ink.ts`,
     `app/(orrery)/_lib/words.ts` and `app/(vinyl)/_lib/isolation.test.ts`.
  2. `scripts/vendor-planisphere.ts [ref]`, in the shape of
     `vendor-elements.ts`, and `"planisphere:vendor"` in `package.json`.
     `ref` defaults to d3-celestial master's head commit from the GitHub API.
     Fetch `data/stars.6.json`, `data/starnames.json`,
     `data/constellations.lines.json` and `LICENSE` from
     `https://raw.githubusercontent.com/ofrohn/d3-celestial/<ref>/`. Convert RA
     from [-180, 180] to [0, 360). Keep stars with mag ≤ 4.5 (constant
     `MAG_LIMIT`). Write `app/(planisphere)/_lib/stars.ts`
     (`export const STARS: readonly Star[]`, `Star = readonly [hip, ra, dec, mag, name?]`,
     four decimals, names from `starnames.json` only when not empty),
     `lines.ts` (`export const LINES: readonly { id: string; rank: 1 | 2 | 3; segments: readonly (readonly [number, number])[][] }[]`)
     and `LICENSE.md`. Each file gets a header naming the ref and the upstream
     sources. The script exits non-zero on a star count outside 900–1,000, or
     a missing Sirius (32349), Vega (91262), Polaris (11767), Betelgeuse
     (27989), Canopus (30438), Arcturus (69673) or Rigel (24436). Run it once
     and commit the output. The generated files have no imports.
  3. `cities.ts`: the 24 cities in the plan's slug order, with `lat`, `lon`,
     an IANA `tz` and an `https://en.wikipedia.org/wiki/…` `source`. Ho Chi
     Minh City is `{ slug: "hcmc", lat: 10.82, lon: 106.63, tz: "Asia/Ho_Chi_Minh" }`
     and Tokyo is `{ lat: 35.68, lon: 139.69, tz: "Asia/Tokyo" }`.
  4. `time.ts`, `sky.ts`, `sun.ts` and `moon.ts`, with the formulas in
     research §3.1–3.4. `sky.ts` also exports
     `upNow(place, ms) → string[]`: the named stars above 0° altitude, by
     magnitude. `moon.ts` also exports `phaseWords(phase)` (for example
     "about two days past first quarter") and `litPath(phase, r)`, the SVG
     path of the lit part for a disc of radius r. `time.ts`, `sky.ts`,
     `sun.ts`, `moon.ts` and `wheel.ts` must not import `stars.ts`,
     `lines.ts` or `ink.ts`. Stars are passed in as arguments.
  5. `wheel.ts`: `State`, the reducer (`city`, `date`, `hour` clamped to
     0–23.75 in quarter hours, `turn(deltaHours)` wrapping across midnight
     and moving the date, `now(ms)` with the clock passed in, `locate(lat, lon, tz)`),
     `parseQuery(record, nowMs)` with each field falling back on its own
     (city a known slug; date a real calendar date from 1900 to 2100; hour a
     number in range, rounded to a quarter; `lat`, `lon` and `tz` together
     override the city only if all three are valid and `Intl` accepts `tz`),
     and `toQuery(state)` (canonical).
  6. Copy `ink.ts` and `roughjs.d.ts` from Orrery with `SEED = 203`. Copy
     `words.ts` with `WORD_CAP = 120`.
  7. Tests (`node:test`): `time.test.ts`, `sky.test.ts`, `sun.test.ts` and
     `moon.test.ts` pin every row of the §3.5 table below, with tolerances of
     1e-6 h for GMST, 1e-3 h for LST, 1° for altitudes and azimuths, 0.5° for
     the Sun and 0.5° of phase for the Moon. They also run the property tests
     from research §3.5: Polaris altitude ≈ latitude within 1° at 6 hours ×
     5 northern cities; an equator star at LST = RA has altitude 90 − |lat|;
     every star with a disc point and alt > 0 is inside `horizon(lat)`, and
     every one with alt < −2 is outside, for Tokyo, Ho Chi Minh City, Sydney,
     Singapore and Reykjavík; `discRotation` advances 15.04° ± 0.01 per clock
     hour; the date rim meets the hour ring within 4.5° for all 24 cities on
     the 1st of each month at 21:00. The tests also pin
     `upNow(hcmc, 2026-10-20 14:00 UTC)`: it includes Vega and excludes
     Sirius. `stars.test.ts` (exactly 921 stars at the committed ref, RA in
     [0, 360), Dec in [−90, 90], mag ≤ 4.5, unique HIP ids, the seven named
     stars present, Polaris Dec 89.26 ± 0.01, the header names the ref),
     `lines.test.ts` (89 constellations, 150 polylines, points in range, ranks
     1–3, three-letter ids), `cities.test.ts` (24 entries in the plan's
     order, unique slugs, ranges, `Intl` accepts every `tz`, every `source`
     is `https://en.wikipedia.org/`), `wheel.test.ts` (every action, each
     field falling back alone, `parseQuery(toQuery(s))` round-trips for 500
     seeded states, `turn(+3)` from 22:00 lands on 01:00 the next day,
     `?city=nope&date=x&hour=99` gives `hcmc` with today and now),
     `ink.test.ts` (same seed gives the same path data) and `words.test.ts`.
  8. `_lib/isolation.test.ts`, modelled on Vinyl's, with `GROUPS` read from
     `readdirSync(join(ROOT, "app"))` (every `(name)` except
     `(planisphere)`). It asserts: `GROUPS` includes `(site)` and
     `(orrery)` and excludes `(planisphere)`; Vinyl's rules (no import reaches
     another group, by alias or by `../`; only the group's own CSS); `_lib/` imports no React or
     Next; only `ink.ts` imports `roughjs`; `stars.ts` and `lines.ts` have no
     import; `time`, `sky`, `sun`, `moon` and `wheel` do not import `stars`,
     `lines` or `ink`; no `fetch(` anywhere under `app/(planisphere)/`;
     nothing outside the group imports it; and at most one `"use client"`
     file in the group.
  9. Add `'app/(planisphere)/_lib/*.test.ts'` to the `npm test` glob in
     `package.json`. Name Planisphere's tests in the README's `npm test`
     sentence, and add the vendor command to the README.
- **Interfaces:** `app/(planisphere)/_lib/`; `scripts/vendor-planisphere.ts`;
  `package.json`; `README.md`.
- **Non-goals:** the page, layout, CSS, components or island; the
  project-list row; precession or nutation; planets; any runtime fetch;
  stars fainter than 4.5.
- **Acceptance:** `npm test` runs Planisphere's engine tests and they pass.
  They pin the computed vectors (GMST at J2000 and Meeus 12.a, Tokyo and Ho
  Chi Minh City alt-az, the Sun at the 2026 equinox, the Moon at first
  quarter and full) and the horizon-containment property. The committed star
  file holds 921 stars from a named d3-celestial ref, and the isolation test
  reads its group list from `app/`.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(planisphere)/_lib/*.test.ts'`
  - `grep -q '18.697374558' 'app/(planisphere)/_lib/time.test.ts' && grep -q '13.1795463' 'app/(planisphere)/_lib/time.test.ts'`
  - `grep -q '36.16' 'app/(planisphere)/_lib/sky.test.ts' && grep -q '103.34' 'app/(planisphere)/_lib/sky.test.ts' && grep -q '307.93' 'app/(planisphere)/_lib/sky.test.ts'`
  - `grep -q '90.06' 'app/(planisphere)/_lib/moon.test.ts' && grep -q '179.87' 'app/(planisphere)/_lib/moon.test.ts' && grep -q '205.24' 'app/(planisphere)/_lib/sun.test.ts'`
  - `grep -q 'readdirSync(join(ROOT, "app")' 'app/(planisphere)/_lib/isolation.test.ts'`
  - `grep -q "app/(planisphere)/_lib/\*.test.ts" package.json && grep -q 'planisphere:vendor' package.json`
  - `! grep -rn '"use client"' 'app/(planisphere)/_lib' && ! grep -rn 'fetch(' 'app/(planisphere)'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Planisphere at /planisphere without JavaScript: the inked wheel, the GET form, the walk

- **Role:** software_engineer. Depends on 1. QA is required.
- **Problem:** The engine is invisible. Visitors need `/planisphere`: a
  star wheel drawn in ink for a city, date and hour, which they can set with
  a plain form and no JavaScript. It must be listed on `/projects`, fit a
  phone and stay within a sensible page weight.
- **Action items:**
  1. Read `node_modules/next/dist/docs/` on `instant` (route segment
     config), Cache Components and `page.tsx`, and
     `app/(orrery)/layout.tsx`, `app/(elements)/layout.tsx` (the theme pin)
     and `scripts/walk-orrery.sh`.
  2. `app/(planisphere)/layout.tsx`: its own `<html lang="en">`,
     `planisphere.css`, Orrery's two `next/font/google` calls (literal
     options and fallbacks), `metadata.title`
     `{ default: "Planisphere", template: "%s · Planisphere" }`, a
     description, `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`,
     `viewport.themeColor` for light and dark, and the theme-pin inline
     script with `suppressHydrationWarning`.
  3. `app/(planisphere)/planisphere/page.tsx`: **`export const instant = false`**,
     `const q = await searchParams` as the first statement, and no
     `<Suspense>`. Read the clock after that, then call
     `parseQuery(q, Date.now())`. Render the top bar (`<a href="/">`,
     `<a href="/projects">All projects</a>`) and the chart
     (`_components/wheel.tsx`, `viewBox="0 0 720 760"`): the inked frame
     and hour ring for the city and zone; the disc in a
     `<g data-disc transform="rotate(…)">` with `data-star` circles
     (`r = 1.2 + 0.7·(4.5 − mag)`), `data-line` polylines, `data-name`
     labels, the dashed `data-ecliptic`, `data-sun`, `data-moon` and the date
     rim; the window as a `<clipPath>` from `horizon(lat)` with its inked rim
     and `data-compass="N|E|S|W"` letters; `data-hemisphere` on the chart;
     and `data-daylight` when the Sun is above −6°, with the line "The Sun is
     up over <city> at this hour. Come back after dark, or turn the ring."
     Round coordinates to one decimal. Also render the Moon corner
     (`moon-corner.tsx`, `data-phase`, illuminated percent, age and
     `phaseWords`); a `data-up` line naming `upNow` stars ("Up now: Vega,
     Altair, …"); and the
     `<form method="get" action="/planisphere">` with the city `<select name="city">`
     (styled under `@supports (appearance: base-select)` as in pm-198), the
     `<input type="date" name="date">`, the
     `<input type="range" name="hour" min="0" max="23.75" step="0.25">` with
     its value in words, and a "Show" submit. Add the credit line and links
     from research §2 (d3-celestial, VizieR V/137D, IAU, `/orrery`) and an
     explainer of at most 120 words on how to read a planisphere. The SVG
     star layers are `aria-hidden`, and the chart has a text title and
     description.
  4. `planisphere.css`: paper and ink tokens, a night-blue window fill and a
     pale daytime fill, a dark scheme, the two-column layout from 900 px
     (chart, controls) that stacks on phones, nothing wider than 100vw at
     320 px (top bar included), visible focus rings, and
     `@media (prefers-reduced-motion: reduce)`. No Tailwind.
  5. `content/site.ts`: add
     `{ title: "Planisphere", note: "Tonight's sky for your city, on a star wheel drawn in ink.", href: "/planisphere", status: "live", colour: "blue" }`
     as the last project.
  6. `lib/build-stamp.test.ts`: add "Planisphere's root layout publishes
     BUILD_SHA as <meta name=build-sha> too". In `e2e/rbac.test.ts`,
     `/projects` links `/planisphere`, and add "Planisphere is its own page,
     without the site's sidebar" (200, no `aria-label="Main"`, links
     `/projects`).
  7. `scripts/walk-planisphere.sh`, in the style of `walk-vinyl.sh` (port
     4037, local build and start or `BASE_URL`, `EXPECT_SHA`,
     process-group cleanup, `grep -c` counts, no `wc -l`, no `set -e`). It
     checks:
     - `/planisphere` is 200 with the build-sha meta, no `aria-label="Main"`,
       exactly one `method="get"`, no `<template id="B:` and no `$RC`.
     - `/planisphere?city=tokyo&date=2026-10-20&hour=21` has at least 400
       `data-star`, at least 80 `data-line`, all four `data-compass`
       letters, one `data-moon`, `data-hemisphere="north"`, Tokyo's option
       `selected`, no `data-daylight`, and `Vega` but not `Sirius` inside
       `data-up`.
     - `?city=hcmc&date=2026-10-20&hour=12` has `data-daylight`.
     - `?city=sydney&date=2026-10-20&hour=21` has
       `data-hemisphere="south"`.
     - `?city=nope&date=x&hour=99` is 200 and selects Ho Chi Minh City.
     - Every body is under 400 KB.
     - The page links only its own stylesheet, which contains
       `prefers-reduced-motion` and no `--tw-`.
     - The explainer has at most 120 visible words (counted with
       `_lib/words.ts`).
     - The four credit links are present, and `/projects` links
       `/planisphere` exactly once.
     - Zero `"use client"` files under `app/(planisphere)` (task 3 changes
       this to one).
  8. README: a Planisphere line in the route-group tree, the walk line, and
     one paragraph on the sky maths and its sources.
- **Interfaces:** `app/(planisphere)/`; `scripts/walk-planisphere.sh`;
  `content/site.ts`; `lib/build-stamp.test.ts`; `e2e/rbac.test.ts`;
  `README.md`.
- **Non-goals:** the client island, dragging, "Now" or geolocation; planets;
  printing; accounts or saved places; any change to another project's look.
- **Acceptance:** `/planisphere` shows an inked star wheel for Ho Chi Minh
  City now, and it is listed on `/projects` with a blue dot. With JavaScript
  off, choosing Tokyo, 2026-10-20 and 21:00 and pressing Show draws Tokyo's
  sky: the north disc, Vega up and Sirius not. Noon in Ho Chi Minh City shows
  the daytime window. Sydney shows the south disc. Bad query values fall back
  to the defaults. The page fits 320 px, reads in light and dark, and is under
  400 KB. `bash scripts/walk-planisphere.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-planisphere.sh && ! grep -nE 'wc +-l' scripts/walk-planisphere.sh`
  - `bash scripts/walk-planisphere.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4037/; then exit 1; fi`
  - `if BASE_URL=http://127.0.0.1:4039 bash scripts/walk-planisphere.sh; then exit 1; fi`
  - `grep -q 'export const instant = false' 'app/(planisphere)/planisphere/page.tsx' && ! grep -n 'Suspense' 'app/(planisphere)/planisphere/page.tsx'`
  - `test "$(grep -rl '"use client"' 'app/(planisphere)' | grep -c .)" -eq 0`
  - `grep -q 'href: "/planisphere"' content/site.ts && grep -q '/planisphere' e2e/rbac.test.ts && grep -q 'Planisphere' lib/build-stamp.test.ts`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Turn the wheel: the Planisphere island, with drag, keys, Now and Use my location

- **Role:** software_engineer. Depends on 2. QA is required.
- **Problem:** A paper planisphere is used by turning it. On the page, every
  change of hour or date means a form round trip, and there is no way to say
  "now" or "here". Visitors with JavaScript should be able to turn the disc
  directly and watch the sky move.
- **Action items:**
  1. `_components/planisphere-app.tsx`, the only `"use client"` file in the
     group. It wraps the server-rendered chart (passed in as children) and
     runs `useReducer` on `_lib/wheel.ts`. It imports only `time`, `sky`,
     `sun`, `moon`, `wheel` and `cities` from `_lib`. It never imports
     `stars`, `lines` or `ink`.
  2. The disc `<g data-disc>` becomes `role="slider"` with `tabindex="0"`,
     `aria-label="Hour"`, `aria-valuemin="0"`, `aria-valuemax="23.75"` and
     `aria-valuetext` such as "21:30". Pointer drag uses the angle from the
     chart's centre, snaps to quarter hours, uses `setPointerCapture`, and
     sets `touch-action: none` on the disc only. Arrow keys move ±15 minutes,
     and Shift+Arrow ±1 hour. `turn` crosses midnight and moves the date.
  3. On every hour or date change, update the disc's `rotate()`, the
     `data-sun` and `data-moon` positions, the Moon corner's lit path and
     words, `data-daylight` and its line, the `data-up` line, and the form's
     date and hour inputs. Update the URL with `history.replaceState` (the
     canonical `toQuery`). Announce the time in an `aria-live="polite"`
     region. The disc's turn is a 0.4 s CSS transition, off under
     `prefers-reduced-motion`. No timers.
  4. The "Now" and "Use my location" buttons render only after hydration.
     "Now" applies `now(Date.now())`. "Use my location" calls
     `navigator.geolocation.getCurrentPosition` only when pressed, takes the
     zone from `Intl.DateTimeFormat().resolvedOptions().timeZone`, stores
     nothing, and navigates with `router.push` to
     `/planisphere?lat=…&lon=…&tz=…&date=…&hour=…` (two decimals). The server
     then draws the window for that latitude and labels the place "Your
     location". On denial or error, say so in the live region and leave the
     sky as it is. Changing the city `<select>` with JavaScript on navigates
     to its canonical query.
  5. Extend `scripts/walk-planisphere.sh`: exactly one `"use client"` under
     `app/(planisphere)`, one `role="slider"` in the served page, no
     `roughjs`/`rough.js` and no `Betelgeuse` (the star data) in any
     `/_next/static/chunks/*.js` the page references, and
     `?lat=10.82&lon=106.63&tz=Asia/Ho_Chi_Minh&date=2026-10-20&hour=21`
     shows "Your location" with `data-hemisphere="north"`.
  6. `_lib/isolation.test.ts`: exactly one `"use client"` file in the group,
     `planisphere-app.tsx`, and it imports none of `stars`, `lines`, `ink` or
     `roughjs`.
  7. README: the island in one sentence, plus the walk's new checks.
- **Interfaces:** `app/(planisphere)/_components/planisphere-app.tsx`;
  `app/(planisphere)/planisphere/page.tsx`;
  `app/(planisphere)/_components/wheel.tsx`;
  `app/(planisphere)/planisphere.css`; `app/(planisphere)/_lib/isolation.test.ts`;
  `scripts/walk-planisphere.sh`; `README.md`.
- **Non-goals:** animation timers or a "play the night" mode; storing the
  location; a compass or device orientation; re-inking on the client; any
  change to the no-JavaScript output beyond the slider attributes and the two
  buttons' mount points.
- **Acceptance:** With JavaScript on, dragging the disc or pressing the
  arrow keys turns the sky in quarter hours. The time, the Sun, the Moon, the
  daytime tint and the "up now" line follow, and the URL updates. "Now"
  jumps to the present. "Use my location" draws the sky for the browser's
  position, labelled "Your location". With JavaScript off, the page is exactly
  task 2's. No rough.js and no star data ship to the browser.
  `bash scripts/walk-planisphere.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash scripts/walk-planisphere.sh`
  - `if BASE_URL=http://127.0.0.1:4039 bash scripts/walk-planisphere.sh; then exit 1; fi`
  - `test "$(grep -rl '"use client"' 'app/(planisphere)' | grep -c .)" -eq 1`
  - `! grep -nE "_lib/(stars|lines|ink)|roughjs" 'app/(planisphere)/_components/planisphere-app.tsx'`
  - `grep -q 'slider' 'app/(planisphere)/_components/planisphere-app.tsx'`
  - `grep -q 'export const instant = false' 'app/(planisphere)/planisphere/page.tsx' && ! grep -n 'Suspense' 'app/(planisphere)/planisphere/page.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## Vectors pinned in task 1 (research §3.5, recomputed by the product owner 2026-10-20)

| Test | Value |
| --- | --- |
| JD of 2000-01-01 12:00 UTC | 2451545.0 |
| GMST at 2000-01-01 12:00 UTC | 18.697374558 h |
| GMST at 1987-04-10 00:00 UTC (Meeus example 12.a) | 13.1795463 h |
| Tokyo (35.68 N, 139.69 E), 2026-10-20 12:00 UTC | LST 23.2435 h; Polaris (RA 37.9546, Dec 89.2641) alt 36.16°, az 0.69°; Vega alt 36.0°; Sirius alt −27.9° |
| Ho Chi Minh City (10.82 N, 106.63 E), 2026-10-20 14:00 UTC | LST 23.0450 h; Sirius (RA 101.2872, Dec −16.7161) alt −27.43°, az 103.34°; Vega (RA 279.2347, Dec 38.7837) alt 25.06°, az 307.93°; Sun alt −51.1° |
| Sun, 2026-10-20 14:00 UTC | RA 205.24°, Dec −10.47° |
| Sun, 2026-03-20 14:46 UTC | RA 0.005°, Dec 0.002° |
| Moon, 2026-10-18 16:13 UTC | phase 90.06°, illuminated 0.501 |
| Moon, 2026-10-26 04:12 UTC | phase 179.87° |
| Moon, 2026-10-10 15:50 UTC | phase 359.94° (new) |
| Moon, 2026-10-20 14:00 UTC | λ 318.28°, β −0.87°, RA 321.00°, Dec −16.18°, phase 111.1° |
| Local to UTC | 2026-10-20 21:00 Asia/Ho_Chi_Minh is 14:00 UTC; Australia/Sydney is UTC+11 on that date |

The test file gives each star its J2000 coordinates as literals, so the sky
tests do not depend on the vendored file. `stars.test.ts` separately checks
that the vendored Polaris, Sirius and Vega match those literals within
0.01°.

## QA

**Task 2.** Use headless Chrome (playwright-core in a scratch directory; on
a macOS lease `chromium.launch({ channel: "chrome" })`) with JavaScript
disabled, at 1366×768, 390×844 and 320×640, in light and dark. Check:

- `/planisphere` draws Ho Chi Minh City now. Choose Tokyo, 2026-10-20 and
  21:00, then press Show. The URL carries the query, the chart redraws,
  Vega is named in the "up now" line, and the four compass letters sit on
  the window rim.
- Ho Chi Minh City at 12:00 shows the pale window and the daytime line.
  Sydney shows the south disc, with the Southern Cross area inside the
  window.
- Tokyo, 2026-12-15, 22:00: Orion is in the south part of the window, with
  Betelgeuse upper left of Rigel. This is the orientation check.
- Nothing scrolls sideways at 320 px. Every control has a visible focus ring.
- `/projects` shows Planisphere with a blue dot, and the other projects
  look unchanged.
- Lighthouse accessibility is at least 95, and there are no console errors.

**Task 3.** The same viewports, with JavaScript on, and with motion on and
off. Check:

- Drag the disc a quarter turn: the hour moves by six hours, and the URL,
  the live region and the form's hour follow.
- Press the arrow keys (±15 min) and Shift+Arrow (±1 h). Turning from 23:45
  to 00:00 moves the date.
- Press Now.
- Grant a mocked geolocation (`context.setGeolocation({ latitude: -33.87, longitude: 151.21 })`
  with permission): the place reads "Your location", and the disc becomes
  the south disc.
- Deny geolocation: a polite message appears, and the sky stays as it was.
- Under reduced motion, the disc jumps without a transition.
- Turn JavaScript off again: task 2's checks still pass.
- No console errors. Lighthouse accessibility is at least 95.

## Acceptance

Walk the plan on production after CI deploys:
`BASE_URL=https://otohime.dev bash scripts/walk-planisphere.sh` exits 0. Then
repeat task 2's no-JavaScript form round trip (Tokyo, 2026-10-20, 21:00) and
task 3's disc drag and Use my location (mocked) on otohime.dev. Confirm that
`/projects` lists Planisphere once, and that every isolation test still reads
its group list from `app/`.

## Risks

- **Orientation sign errors.** East-left-of-north and the south mirror are
  where a sign error hides. The horizon-containment property test, the
  alt-az vectors and QA's Orion check catch them.
- **Page weight.** If the body nears 400 KB, set `MAG_LIMIT` to 4.0 (519
  stars) in the vendor script, re-run it, and update `stars.test.ts`'s
  count. Record that as a decision.
- **d3-celestial changes upstream.** The ref is pinned in the generated
  headers. A re-run at a newer ref that moves the star count fails
  `stars.test.ts` on purpose.
- **Rotor in flight (pm-202).** It touches the same shared lines. Keep both
  sides on rebase, and put the Planisphere row after Rotor's if Rotor's has
  landed.
- **Fonts.** If the Google fonts fail to fetch at build time, Orrery's build
  fails too. That is an environment cause, not this plan's code.
