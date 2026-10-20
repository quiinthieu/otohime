# Research: Planisphere, tonight's sky at /planisphere (pm-203, run-6764)

**Idea.** "Add Planisphere, tonight's sky for a chosen city drawn in ink as a rotating star wheel, at /planisphere. The full design is in research.md §4.2 (pm-202)."

**Short answer.** Build it as the pm-202 design says, with five corrections found by checking the data, the maths and a real build on 2026-10-20 against main at f31389e:

1. **The no-JavaScript page needs one line.** `next.config.ts` has `cacheComponents: true`. A page that reads the query must either sit in `<Suspense>` (then its answer streams in behind an inline script, so a visitor without JavaScript sees the fallback) or export `instant = false` and await `searchParams` at the top. I proved the second with two builds and a served probe (§5). `dynamic = "force-dynamic"` errors under Cache Components. The Rotor plan (pm-202, task 3) has the same GET form and needs the same line; recorded as a global lesson.
2. **The stars are Hipparcos, not Yale.** d3-celestial's `stars.6.json` is built from XHIP (the Extended Hipparcos Compilation), ids are HIP numbers, and the features carry only magnitude and colour. Proper names live in `starnames.json`. The credit line and the vendor script change accordingly (§2).
3. **The Moon by a seven-term series, not a mean month.** The mean synodic month is 0.7 day off at the 2026-10-10 new moon; the Astronomical Almanac low-precision longitude series lands every 2026 phase within 20 minutes and also places the Moon on the chart (§3.3).
4. **The chart is a real planisphere.** A pole-centred star disc in equidistant projection, turned by sidereal time, under a frame whose window is the horizon curve for the latitude (the classic oval). The research mixed this with a zenith-centred stereographic chart; the two are different objects, and the disc is the one that rotates with one transform (§3.2).
5. **Stars and lines are plain SVG.** Rough.js ink draws the frame, the rings, the window rim, the compass and the Moon only. 921 inked stars per request would be slow and unreadable.

Everything else holds: own route group, hand fonts and cream paper from Orrery, a pure engine in `_lib/` proven by `node --test`, 24 cities, a GET form, one client island, a walk, the isolation test reading the other groups from `app/`. Size estimate: 2,100 lines over three build tasks plus QA (§7).

## 1. What was checked

- The repo at f31389e: the five live groups, their layouts, `ink.ts`, `words.ts`, the isolation tests (still hard-coded lists; Rotor's task 1 has not landed), `walk-orrery.sh`, `vendor-elements.ts`, `content/site.ts`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, the Elements theme-pin script, the Orrery `[body]` page's `ensureStatic`.
- The live site: `/planisphere` 404, `/rotor` 404, `/projects` 200.
- d3-celestial at master `7e720a3de062059d4c5400a379146a601d9010e0`: `stars.6.json` (657 KB, 5,044 stars), `starnames.json` (681 KB, 4,869 entries), `constellations.lines.json` (27 KB, 89 features, 150 polylines, 893 points), `LICENSE` (BSD-3-Clause, Olaf Frohn 2015), the two readmes.
- The maths, each vector computed in Node against a published reference (§3.5).
- Next 16.4 docs from the canary branch: `migrating-to-cache-components.mdx`, `route-segment-config/instant.mdx`, `guides/streaming.mdx`, `page.mdx`.
- A local `npm ci`, two `npm run build`s and a `next start` with a throwaway `app/(planisphere)` group (§5), removed afterwards. Nothing was committed or pushed.

## 2. Data, vendored, no runtime fetch

`scripts/vendor-planisphere.ts [ref]`, in the shape of `vendor-elements.ts` (`npm run planisphere:vendor`). `ref` defaults to the current master commit from the GitHub API and is written into every generated header. It fetches four raw files from `https://raw.githubusercontent.com/ofrohn/d3-celestial/<ref>/`:

| File | Used for | Shape found |
| --- | --- | --- |
| `data/stars.6.json` | stars | GeoJSON points; `id` = Hipparcos number; `properties.mag`, `properties.bv`; coordinates `[lon, lat]` with lon = RA in degrees in [-180, 180] (0–12h → 0–180, 12–24h → -180–0), lat = Dec |
| `data/starnames.json` | proper names | object keyed by HIP id; `name` is the English proper name ("" when none); Sirius 32349, Vega 91262, Polaris 11767, Betelgeuse 27989, Canopus 30438, Arcturus 69673, Rigel 24436 |
| `data/constellations.lines.json` | lines | 89 MultiLineString features (Serpens is two), `id` the IAU three-letter code, `properties.rank` "1"–"3"; same coordinate convention |
| `LICENSE` | `_lib/LICENSE.md` | BSD-3-Clause |

What it writes under `app/(planisphere)/_lib/`:

- `stars.ts`: `STARS: readonly Star[]`, `Star = [hip, ra, dec, mag, name?]` with RA converted to [0, 360) and four decimals, kept to **magnitude 4.5 or brighter: 921 stars** (519 at 4.0, 1,627 at 5.0). Names only where `starnames.json` has one. About 35 KB. The script refuses a count outside 900–1,000 or a missing one of the seven named stars above.
- `lines.ts`: `LINES: readonly { id: string; rank: 1 | 2 | 3; segments: [ra, dec][][] }[]`, RA converted the same way, about 30 KB.
- `LICENSE.md`: the BSD text under a header naming the three files, the ref and the upstream sources.

The credit line on the page: "Stars: XHIP (Anderson & Francis 2012) and star names, via d3-celestial (Olaf Frohn, BSD-3-Clause). Constellation lines after the IAU, via d3-celestial. The stars by name: Orrery." It links `https://github.com/ofrohn/d3-celestial`, `http://cdsarc.u-strasbg.fr/viz-bin/Cat?V/137D`, `https://www.iau.org/public/themes/constellations/` and `/orrery`. The data test pins the allowlist: `github.com`, `cdsarc.u-strasbg.fr`, `www.iau.org`, `en.wikipedia.org`.

`cities.ts`, hand-written: 24 cities as `{ slug, name, lat, lon, tz, source }`, Ho Chi Minh City first, then Tokyo, Seoul, Singapore, Bangkok, Mumbai, Dubai, Istanbul, Cairo, Nairobi, Cape Town, London, Paris, Berlin, Madrid, Reykjavík, New York, Los Angeles, Mexico City, São Paulo, Buenos Aires, Sydney, Auckland, Honolulu. Five southern cities exercise the south-pole disc, Singapore the equator, Reykjavík a high latitude. `tz` is an IANA name; `source` is the city's `https://en.wikipedia.org` page. Node 22 ships full ICU: `Intl.DateTimeFormat` with `timeZone: "Asia/Ho_Chi_Minh"` was checked here.

## 3. The engine, `_lib/`, pure TypeScript, no React

### 3.1 `time.ts`

- `julianDay(ms)`: `ms / 86_400_000 + 2_440_587.5`.
- `gmstHours(ms)`: Meeus 12.4, `280.46061837 + 360.98564736629 (JD − 2451545) + 0.000387933 T² − T³/38710000`, normalised, over 15.
- `lstHours(ms, lon)`: GMST + lon/15, normalised to [0, 24).
- `offsetMinutes(tz, ms)` and `localToUtc(date, hour, tz)`: the offset read from `Intl.DateTimeFormat(…, { timeZone, timeZoneName: "shortOffset" })` or from the formatted parts; `localToUtc` takes a guess at UTC, reads the offset at the guess, corrects once (DST days). `todayIn(tz, ms)` gives the local calendar date and decimal hour.

### 3.2 `sky.ts`: the wheel's geometry

- `altAz(ra, dec, lat, lstHours) → { alt, az }`, azimuth from north through east.
- The disc is centred on the near celestial pole (`hemisphere = lat >= 0 ? "north" : "south"`; the equator counts as north). A star's polar distance `p` is `90 − dec` (north) or `90 + dec` (south). Its radius on the disc is `R · p / pMax` with `pMax = 180 − |lat|`, so the farthest star that ever rises sits on the rim; anything beyond never rises and is left off. Its angle is its RA, mirrored in the south so that east is still left of north when the chart is held overhead. `discPoint(star, lat) → { x, y } | null`.
- `discRotation(lstHours, hemisphere)`: the one angle a `<g transform="rotate(…)">` applies so that RA = LST lies on the meridian (centre to the south horizon point in the north, the north point in the south).
- `horizon(lat)`: 72 points of the altitude-0 circle in frame coordinates (hour angle, not RA): `sin dec = cos lat · cos az`, hour angle from `cos H = −tan lat · tan dec` with the sign of the azimuth. Checked for lat 10.82: the north point is at Dec +79.2, the south point at −79.2, the east point at Dec 0 and hour angle −90°. Returned as an SVG path for the window's `<clipPath>` and its inked rim.
- Rings: `hourTickAngle(hour, city, date)` places local clock hour `h` on the frame at `(h − 12) · 15° + lon − offsetMinutes / 4`, so the frame's hour ring is right for the city and its zone. `dateTickAngle(date)` places a calendar date on the disc rim at the Sun's RA that day. With the disc turned for (city, date, hour), the rim's date mark meets the frame's hour mark within the equation of time (16 minutes, 4°). That is how a paper planisphere is set, and it is a test.
- `visible(star, place, ms)` for the no-JS counts and the tests.

### 3.3 `moon.ts`

Low-precision geocentric longitude and latitude (Astronomical Almanac, T in Julian centuries from J2000): `λ = 218.32 + 481267.881 T + 6.29 sin(135.0 + 477198.87 T) − 1.27 sin(259.3 − 413335.36 T) + 0.66 sin(235.7 + 890534.22 T) + 0.21 sin(269.9 + 954397.70 T) − 0.19 sin(357.5 + 35999.05 T) − 0.11 sin(186.5 + 966404.03 T)`, `β = 5.13 sin(93.3 + 483202.02 T) + 0.28 sin(228.2 + 960400.89 T) − 0.28 sin(318.3 + 6003.15 T) − 0.17 sin(217.6 − 407332.21 T)`. Phase angle = λ − λ☉ mod 360 (0 new, 90 first quarter, 180 full, 270 last), illuminated fraction `(1 − cos phase) / 2`, age in days `phase / 360 · 29.530588853`, and RA/Dec through the obliquity 23.439° so the Moon is drawn on the disc too. Measured against seven almanac phases (2000-01-06 18:14, 2000-01-21 04:40, 2026-10-10 15:50, 2026-10-18 16:13, 2026-10-26 04:12, 2026-11-01 20:28, 2026-11-09 07:02 UTC): worst error 0.13° of phase, under 20 minutes. The page still says "about".

### 3.4 `sun.ts` (Planisphere's own; Orrery's `sun.ts` is layer data)

Meeus ch. 25 low precision: `L = 280.460 + 0.9856474 n`, `g = 357.528 + 0.9856003 n`, `λ = L + 1.915 sin g + 0.020 sin 2g`, RA/Dec through the obliquity. Checked: 2026-03-20 14:46 UTC (the equinox) gives RA 0.005°, Dec 0.002°; 2026-10-20 14:00 UTC gives RA 205.24°, Dec −10.47°. `sunAltitude(place, ms)`; the page calls it day when the Sun is above −6° (civil twilight) and tints the window, keeps the stars faint and says "The Sun is up over Tokyo at this hour. Come back after dark, or turn the ring." The ecliptic is drawn on the disc as a dashed circle from the same function sampled at 24 longitudes, and the Sun sits on it.

### 3.5 Vectors to pin (all computed here, 2026-10-20)

| Test | Value |
| --- | --- |
| JD of 2000-01-01 12:00 UTC | 2451545.0 |
| GMST at 2000-01-01 12:00 UTC | 18.697374558 h |
| GMST at 1987-04-10 00:00 UTC (Meeus example 12.a) | 13.1795463 h |
| Tokyo (35.68 N, 139.69 E), 2026-10-20 12:00 UTC | LST 23.2435 h; Polaris alt 36.16°, az 0.69° |
| Ho Chi Minh City (10.82 N, 106.63 E), 2026-10-20 14:00 UTC (21:00 local) | LST 23.0450 h; Sirius alt −27.43°, az 103.34°; Vega alt 25.06°, az 307.93°; Sun alt −51.1° |
| Sun, 2026-10-20 14:00 UTC | RA 205.24°, Dec −10.47° |
| Sun, 2026-03-20 14:46 UTC | RA 0.005°, Dec 0.002° |
| Moon, 2026-10-18 16:13 UTC | phase 90.06° (first quarter), illuminated 0.501 |
| Moon, 2026-10-26 04:12 UTC | phase 179.87° (full) |
| Moon, 2026-10-20 14:00 UTC | λ 318.28°, β −0.87°, RA 321.00°, Dec −16.18° |
| Local to UTC | 2026-10-20 21:00 Asia/Ho_Chi_Minh is 14:00 UTC |

Property tests: Polaris's altitude equals the latitude within 1° at any hour from five northern cities; a star on the equator at LST = RA has altitude 90 − |lat|; a star 6 h east of the meridian with Dec 0 has azimuth 90 ± 1 at the equator; every star with `discPoint` non-null and `alt > 0` lies inside the horizon path, and every star with `alt < −2` lies outside; `discRotation` advances 15.04° per clock hour; the date ring meets the hour ring within 4.5° for all 24 cities on the 1st of each month at 21:00.

### 3.6 `wheel.ts`, the reducer

`State = { city | place, date, hour, hemisphere, lst, daylight }`; actions `city(slug)`, `date(iso)`, `hour(h)` (clamped to 0–23.75 in quarter hours), `turn(deltaHours)` (wraps, moves the date across midnight), `now()`, `locate(lat, lon, tz)`. `parseQuery(record) → State` with each field falling back on its own: `city` must be a slug, `date` a real calendar date between 1900 and 2100, `hour` a number in range rounded to a quarter; `lat`/`lon`/`tz` together override the city, with `tz` accepted only if `Intl.DateTimeFormat` takes it. `toQuery(state) → string` is canonical and round-trips. Default when nothing is given: Ho Chi Minh City, today, now, in its zone.

## 4. The page

- `app/(planisphere)/layout.tsx`: own `<html lang="en">`, `planisphere.css`, Orrery's two `next/font/google` calls with the same literal options and cursive fallbacks, `metadata.title` `{ default: "Planisphere", template: "%s · Planisphere" }`, `other: { "build-sha": … }`, `viewport.themeColor` light and dark, the Elements `pinTheme` inline script with `suppressHydrationWarning`.
- `app/(planisphere)/planisphere/page.tsx`, a server component with **`export const instant = false`**, awaits `searchParams` first, then reads the clock (`new Date()` is only reached at request time). It renders: the top bar (`<a href="/">`, `<a href="/projects">`); the chart (`_components/wheel.tsx`, server-safe SVG, `viewBox 0 0 720 760`: the frame, the hour ring, the disc with its month rim, `data-star` per star with `r = 1.2 + 0.7 (4.5 − mag)`, `data-line` per constellation, `data-name` labels for the named stars, `data-moon`, `data-sun`, `data-ecliptic`, the window as a `<clipPath>` with `data-compass="N|E|S|W"` on its rim, `data-hemisphere`, `data-daylight` when the Sun is up); the Moon in the corner (`data-phase`, the illuminated fraction and age in words); the `<form method="get" action="/planisphere">` with the city `<select>` (page-styled under `@supports (appearance: base-select)`, as pm-198), `<input type="date" name="date">`, `<input type="range" name="hour" min="0" max="23.75" step="0.25">` with its value in words, a "Show" submit; a credit line (§2) and an explainer of at most 120 words; `<PlanisphereApp initial={state}>`.
- `_components/planisphere-app.tsx`, the one `"use client"` island (task 3): `useReducer(wheel)`; the hour ring becomes `role="slider"` (`aria-valuemin 0`, `aria-valuemax 23.75`, `aria-valuetext "21:30"`), turned by pointer drag (angle from the chart's centre, quarter-hour steps) or arrow keys (±15 min, Shift ±1 h); "Now" and "Use my location" buttons appear only once hydrated (the location button asks `navigator.geolocation` when pressed, never before, and stores nothing; the zone comes from `Intl.DateTimeFormat().resolvedOptions().timeZone`); the form's inputs stay and are kept in sync; the URL follows through `history.replaceState`; a polite live region reads the time. The island re-projects on the client with the same `_lib`, so no round trip. The ring turn is a 0.4 s CSS transition on the transform, off under `prefers-reduced-motion`. No timers.
- `planisphere.css`: Orrery's paper and ink tokens with a night-blue window fill, a dark scheme, the two-column layout from 900 px (chart, controls) that stacks on phones, nothing wider than 100vw at 320 px, visible focus rings, `@media (prefers-reduced-motion: reduce)` killing all motion.
- Served weight: 921 circles, 150 polylines and about 60 inked paths come to roughly 110 KB of HTML; the walk caps the body at 200 KB. The island ships the engine and the two data files, about 70 KB before compression, comparable to Vinyl's.
- `content/site.ts`: `{ title: "Planisphere", note: "Tonight's sky for your city, on a star wheel drawn in ink.", href: "/planisphere", status: "live", colour: "blue" }` after Vinyl (or after Rotor if it has landed). The swatches are yellow, coral, mint, blue, pink only; blue is also Elements' dot, and the dot is decoration.

## 5. The no-JavaScript proof

Throwaway `app/(planisphere)/layout.tsx` and `planisphere/page.tsx` reading `city` and `hour` from `searchParams` and the clock, built with the walk's placeholder env:

| Variant | Build | Route | GET `/planisphere?city=tokyo&hour=21` (browser UA, `Accept-Encoding: identity`) |
| --- | --- | --- | --- |
| `export const instant = false` | exit 0 | `ƒ /planisphere` (Dynamic) | 200, 21,735 bytes, `data-probe="city=tokyo;hour=21;now=2026-10-20T10:27:55.946Z"`, 0 `<template id="B:`, 0 `id="S:`, 0 `$RC`, 1 `method="get"`, build-sha present; a second request echoed a different query and a later clock |
| without the line | exit 1: `Route "/planisphere": Next.js encountered uncached or runtime data during prerendering.` | — | — |

So the page must carry `instant = false` and must not wrap the query read in `<Suspense>`. The walk asserts the served body has no `<template id="B:` and no `$RC`, which is the no-JavaScript guarantee in one grep. The same applies to Rotor's form (lesson recorded).

## 6. Tests, isolation, walk

- `time.test.ts`, `sky.test.ts`, `moon.test.ts`, `sun.test.ts`: the table in §3.5 and the property tests; tolerances 1e-6 h for GMST, 1° for altitudes, 0.5° for the Sun, 0.5° of phase for the Moon.
- `stars.test.ts`: 921 stars, RA in [0, 360), Dec in [-90, 90], mag ≤ 4.5, unique HIP ids, the seven named stars present, Polaris at Dec 89.26, no star without a finite coordinate, the generated header names the ref. `lines.test.ts`: 89 constellations, 150 segments, every point in range, ranks 1–3, ids three letters. `cities.test.ts`: 24 entries, unique slugs, lat in [-90, 90], lon in [-180, 180], every `tz` accepted by `Intl`, every `source` `https` on `en.wikipedia.org`, Ho Chi Minh City first.
- `wheel.test.ts`: every action, the fallbacks one field at a time, `parseQuery(toQuery(s))` round-trips for 500 seeded states, `turn` across midnight moves the date.
- `ink.test.ts` as Orrery's with `SEED = 203` and a SHA-256 snapshot of the inked frame. `words.test.ts` with `WORD_CAP = 120`.
- `isolation.test.ts` modelled on Vinyl's, with `GROUPS` built from `readdirSync(join(ROOT, "app"))` (every `(name)` except `(planisphere)`), plus: `_lib/` imports no React or Next; only `ink.ts` imports `roughjs`; `stars.ts` and `lines.ts` have no import at all; no `fetch(` under the group; nothing outside imports Planisphere; exactly one `"use client"` after task 3.
- `scripts/walk-planisphere.sh` in the style of `walk-orrery.sh`, **port 4037**, local build-and-start or `BASE_URL`, `EXPECT_SHA`, process-group cleanup, `grep -c` only. Checks: `/planisphere` 200 with the build-sha meta, no `aria-label="Main"`, one `method="get"`, no `<template id="B:` and no `$RC`; `/planisphere?city=tokyo&date=2026-10-20&hour=21` has at least 400 `data-star`, 80 `data-line`, the four `data-compass` letters, one `data-moon`, Tokyo's option `selected`, no `data-daylight`; `?city=hcmc&date=2026-10-20&hour=12` has `data-daylight`; `?city=sydney` has `data-hemisphere="south"`; `?city=nope&date=x&hour=99` is 200 and shows Ho Chi Minh City; the body is under 200 KB; the stylesheet is the group's own with `prefers-reduced-motion` and no `--tw-`; `/projects` links `/planisphere` exactly once; the credit links are present; explainer at most 120 words. Task 3 adds: exactly one `"use client"`, one `role="slider"`, no `roughjs` in any client chunk the page loads.
- Shared lines: the `npm test` glob and `planisphere:vendor` in `package.json`; "Planisphere's root layout publishes BUILD_SHA" in `lib/build-stamp.test.ts`; `/projects` links `/planisphere` and "Planisphere is its own page" in `e2e/rbac.test.ts`; a README tree block, the `npm test` sentence, the walk line and a paragraph on the sky maths and its sources.

## 7. Tasks for the plan

1. **Data and engine** (software_engineer, `qa: skip`): `scripts/vendor-planisphere.ts` and its npm script, the generated `stars.ts`, `lines.ts`, `LICENSE.md`, `cities.ts`, `time.ts`, `sky.ts`, `moon.ts`, `sun.ts`, `wheel.ts`, `ink.ts` + `roughjs.d.ts` copied with `SEED = 203`, `words.ts`, every test above, the isolation test reading `app/`, the `npm test` glob, the README test sentence. Verification: `npm ci && npm run lint && npm run typecheck && npm test`, the pinned vectors grep-able in the tests, no `"use client"` under `_lib`, no `fetch(` under the group, author email check.
2. **The page without JavaScript** (software_engineer, `qa: skip` or a light QA): layout, CSS, `wheel.tsx`, `page.tsx` with `instant = false`, the form, the credit and explainer, `content/site.ts`, `build-stamp.test.ts`, `rbac.test.ts`, the walk and README. Verification: the full gate, `bash scripts/walk-planisphere.sh`, `grep -q 'export const instant = false' 'app/(planisphere)/planisphere/page.tsx'`, `! grep -rn 'Suspense' 'app/(planisphere)/planisphere/page.tsx'`, zero `"use client"` under the group, the port-4037 dead-port negative check as Rotor's.
3. **The island** (software_engineer, QA required): `planisphere-app.tsx`, the ring drag and keys, Now, Use my location, `replaceState`, the live region, the walk's island checks. QA in headless Chrome at 1366×768, 390×844 and 320×640, light and dark, motion on and off: with JavaScript off, submit the form for Tokyo at 21:00 and count the stars and compass letters; with JavaScript, drag the ring a quarter turn (six hours), press the arrows, press Now, grant a mocked geolocation (`context.setGeolocation`) and see the city line change to "Your location"; Tab through with visible focus rings; no sideways scroll at 320 px; Lighthouse accessibility ≥ 95; no console errors.

Acceptance: `BASE_URL=https://otohime.dev bash scripts/walk-planisphere.sh` exits 0 after CI deploys, then the no-JavaScript form and the ring drag on otohime.dev.

Commits as `Otohime <quiinthieu@gmail.com>`, subjects `pm-203/t-NNNN: …`. Rotor's commits will touch the same shared lines; keep both sides on rebase (iss-9).

## 8. Risks

- **Rotor in flight.** If pm-202's task 1 lands first, nothing changes here; if it lands after, its rewrite of the five old tests does not touch Planisphere's. The project-list row, the test glob, the rbac test and the README will conflict textually; both sides are kept.
- **Chart orientation.** East-left-of-north and the south-hemisphere mirror are the places a sign error hides. The horizon-containment property test and the Tokyo/Ho Chi Minh City vectors catch them; QA also eyeballs Orion on 2026-12-15 at 22:00 in Tokyo (south, Betelgeuse upper left of Rigel).
- **Fonts.** Google fonts are fetched at build time as for Orrery; a fetch failure fails Orrery's build too, an environment cause.
- **Page weight.** About 110 KB of SVG per page; the walk's 200 KB cap holds the line. If it grows, cut to magnitude 4.0 (519 stars) by one constant in the vendor script.

## 9. Sources checked on 2026-10-20

- d3-celestial: `https://github.com/ofrohn/d3-celestial` at `7e720a3de062059d4c5400a379146a601d9010e0`; `readme.md` §Sources ([1] XHIP, [1b] name cross indexes, [3] IAU), `data/readme.md` (format), `LICENSE`, the three data files (all 200).
- XHIP, VizieR V/137D: `http://cdsarc.u-strasbg.fr/viz-bin/Cat?V/137D`. IAU constellations: `https://www.iau.org/public/themes/constellations/`.
- Meeus, Astronomical Algorithms, ch. 12 (sidereal time, example 12.a) and ch. 25 (the Sun, low precision); the Astronomical Almanac's low-precision lunar series (as reproduced in Montenbruck & Pfleger and on the USNO pages).
- Next.js canary docs: `docs/01-app/02-guides/migrating-to-cache-components.mdx`, `03-api-reference/03-file-conventions/02-route-segment-config/instant.mdx`, `02-guides/streaming.mdx`, `03-file-conventions/page.mdx` (all 200).
- Live site: `/planisphere` 404, `/rotor` 404, `/projects` 200.
