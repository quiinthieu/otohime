# Research: more projects for otohime.dev (pm-202, run-6756)

**Idea.** Research and design more projects into the app.

**Short answer.** The site has five live projects (Shore, Capsule, Orrery, Elements, Vinyl) that all follow one recipe: a one-word name, a physical object you can play with, drawn by hand, in its own root layout with hand-written CSS, a pure engine in `_lib/` proven by `node --test`, a page that works before JavaScript, no account, no uploads, data vendored where it can be and sourced where it is shown. Eight candidates were scored against that recipe (§3). The recommended next three, each its own plan and each one software-engineer task plus QA like the earlier five, are:

1. **Rotor** at `/rotor`: a hand-drawn Enigma I. Type, the lamps light, the rotors turn, a paper tape prints. The whole machine is a pure function, so the no-JavaScript page encodes through a plain form and the tests pin the published test vectors.
2. **Planisphere** at `/planisphere`: tonight's sky for a chosen city, a rotating star chart drawn in ink from the Bright Star Catalogue, with the Moon's phase in the corner. Orrery's natural sibling: the same ink, the same source rule, new maths.
3. **Barometer** at `/barometer`: a brass weather station for a chosen city, read from Open-Meteo on the server every 15 minutes and drawn as dials, with a drawn "no reading" face when the feed is down. The first project with live data, under rules written down in §4.3.

Then, in order: Loom, Depot, Telegraph, Soroban, Drum (§5). Every URL above answered 404 on the live site on 2026-10-20, so all are free. Everything was checked against the repo at 4cbeff1 and the live site that day.

## 1. What is there today, and the recipe a new project must follow

| Project | URL | What it is | Size (non-test lines / test files) | Data | Runtime fetch |
| --- | --- | --- | --- | --- | --- |
| Shore (pm-181) | `/shore` | focus timer; sessions become sea-glass pebbles | 773 / 6 | localStorage ledger | none |
| Capsule (pm-184, pm-196) | `/capsule` | coin-and-crank card machine, 12 fps, printed-ink cards | 2,506 / 9 | cards as path data | none |
| Orrery (pm-188, pm-189, pm-199) | `/orrery`, `/orrery/<body>` | 14 hand-drawn cutaway posters, rough.js ink | 2,680 / 10 | `bodies.ts`, NASA and Wikipedia only | none |
| Elements (pm-190, pm-197) | `/elements`, `/elements/<symbol>` | periodic table, dialog, lazy 3D atom | 1,792 / 9 | vendored CC BY-SA dataset plus own facts | none |
| Vinyl (pm-191, pm-198) | `/vinyl` | crate, turntable, visible YouTube player | 2,927 / 11 | `records.json` | YouTube IFrame API |

So a project is 800 to 3,000 lines and lands in one plan with one or two build tasks. The parts every one of them has, which a new project inherits as its definition of done:

- `app/(<name>)/layout.tsx` with its own `<html>`, `<name>.css`, `build-sha` meta (`lib/build-stamp.test.ts` reads each group's layout), a `themeColor`, and no Tailwind, `globals.css`, `components/`, `content/` or `lib/` import. Light and dark follow `prefers-color-scheme` unless `localStorage.theme` pins one.
- `app/(<name>)/<name>/page.tsx` as a server component; one `"use client"` island at most; a no-JavaScript path that still shows the thing (Elements' 118 links, Vinyl's Watch-on-YouTube list, Orrery's posters are pure HTML).
- `_lib/` free of React: data, maths and a `(state, action) => state` reducer, each with a `*.test.ts`; `isolation.test.ts` modelled on Vinyl's.
- A top bar with `<a href="/">` home and `<a href="/projects">All projects` (plain anchors, because they cross root layouts), kept inside a phone viewport (pm-195).
- A row in `site.projectList` (`content/site.ts`), the `npm test` glob in `package.json`, the `e2e/rbac.test.ts` checks (`/projects` links the route; the route is 200 without `aria-label="Main"`), a `scripts/walk-<name>.sh` in the style of `walk-orrery.sh`, a README block.
- Sources shown on the page link where the number came from. Orrery pins the rule in a test: `https` on nasa.gov or wikipedia.org. Elements pins a host allowlist for facts. A new project with facts does the same with its own allowlist.
- Motion is CSS keyframes, a 12 fps `setInterval` over a pure reducer, or one `requestAnimationFrame` loop; off under `prefers-reduced-motion`. No animation library.
- Hand-drawn ink is rough.js with a fixed seed (`app/(orrery)/_lib/ink.ts`; Capsule has its own copy because of the isolation rule). A third project that wants ink copies the file again.
- Commits authored as `Otohime <quiinthieu@gmail.com>` with subjects `pm-NNN/t-NNNN: …`; CI runs lint, typecheck, `npm test`, build and `test:e2e` in under 15 minutes.

**A cost that grows with every project.** Four of the five isolation tests hard-code the list of other route groups (`GROUPS` in `app/(elements)/_lib/isolation.test.ts:33` and `app/(vinyl)/_lib/isolation.test.ts:39`, `OUTSIDE` in `app/(capsule)/_lib/isolation.test.ts:32`, the Orrery test's title). Orrery's rename touched all of them, and a sixth project means editing five tests, a seventh means six. The first task of the next project should read the list from `readdirSync("app")` (every `(group)` other than itself) in the new test, and the plan after it can bring the old four over. Recorded as a lesson for the plan.

## 2. How the candidates were scored

Each candidate was marked 0 to 3 on five things, 15 at most:

- **House fit**: a physical object, drawable by hand, one-word name, charming without an account.
- **Pure engine**: how much of the behaviour is a pure function with test vectors, so QA is `node --test` and a walk, not a browser.
- **Data and licence**: public domain, CC BY, or own words; no key, no login, no paid tier, no uploads, no binaries.
- **Size**: 2 for Shore-to-Elements size (under 2,000 lines), 3 if under 1,500, 1 if Vinyl-sized, 0 if bigger.
- **New ground**: 3 if nothing on the site does it yet, 1 if it leans on an existing project's territory.

Dropped before scoring: a falling-block puzzle (a trademarked game's rules), a belts-and-assemblers factory (several times Vinyl's size), pinball (physics the tests cannot pin), a photo darkroom (uploads), a tide clock (NOAA covers the US only), an internet radio dial (third-party streams with no licence position, and Vinyl already owns "music plays here"), a metronome (Shore's timer and Vinyl's audio again).

## 3. The shortlist

| # | Name, URL | One line | Fit | Engine | Data | Size | New | Total | Lines (est.) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Rotor `/rotor` | a hand-drawn Enigma I you can type on | 3 | 3 | 3 | 3 | 3 | **15** | 1,400 |
| 2 | Planisphere `/planisphere` | tonight's sky for your city, drawn in ink | 3 | 3 | 3 | 2 | 2 | **13** | 2,000 |
| 3 | Barometer `/barometer` | a brass weather station for your city, live | 3 | 2 | 2 | 3 | 3 | **13** | 1,300 |
| 4 | Loom `/loom` | a four-shaft weaving draft that weaves the cloth as you draw it | 3 | 3 | 3 | 3 | 3 | 15 | 1,200 |
| 5 | Depot `/depot` | parcels sorted on a conveyor by six algorithms, one step at a time | 2 | 3 | 3 | 2 | 3 | 13 | 1,600 |
| 6 | Telegraph `/telegraph` | a Morse key: tap it, or type and hear it | 3 | 3 | 3 | 3 | 2 | 14 | 1,000 |
| 7 | Soroban `/soroban` | a Japanese abacus, beads you flick, sums it sets you | 3 | 3 | 3 | 3 | 2 | 14 | 900 |
| 8 | Drum `/drum` | the last day's earthquakes traced on a seismograph drum | 2 | 2 | 3 | 3 | 2 | 12 | 1,200 |

Loom ties Rotor on points and is not in the top three only because of reach: a weaving draft is a joy for the few who know what a tie-up is, and the first three each speak to anyone who lands on `/projects`. Rotor goes first because it is the only candidate where the no-JavaScript page can do the whole job, and because its test vectors are published, so QA can be exact. Planisphere second because it extends what the owner has asked for twice (the Sun, then the planets and stars) without touching Orrery. Barometer third because it is the smallest safe way to bring live data onto the site and settles the rules for Drum and anything else that follows.

The owner's own line, "The factory must grow. So must the DAG", argues for Depot; it is the one candidate that says "data engineer" on the page. It sits at 5 only because sorting visualisers are common on the web. Give it the parcel motif and the 12 fps conveyor and it would not look common.

## 4. Designs for the top three

### 4.1 Rotor, `/rotor`

**What you see.** A wooden box, lid open, drawn in ink on cream paper like Orrery: three rotor windows across the top showing letters, a lampboard of 26 round lamps, a keyboard of 26 keys below it, and a strip of paper tape coming out of the right side with the typed text above the coded text. Press a key (or type on your real keyboard): the key sinks, the right rotor window steps, one lamp glows amber, the tape grows one letter. A side panel, drawn as the box's inner lid, holds the settings: rotor order (three of I to V), ring settings, start positions, reflector B or C, up to ten plugboard pairs. A "Decode" note explains that the same settings turn the code back into the message, and a "Share" line gives a URL with the settings and the text in it.

**Engine (`_lib/`, pure).**

- `wiring.ts`: rotors I to V and reflectors B and C as 26-letter strings with their turnover notches, from Wikipedia's Enigma rotor details page and Crypto Museum's wiring table (both fetched 2026-10-20; rotor I `EKMFLGDQVZNTOWYHXUSPAIBRCJ` notch Q, rotor II `AJDKSIRUXBLHWTMCQGZNPYFVOE` notch E, and so on). Each entry carries a `source` URL, and the test pins the allowlist to en.wikipedia.org and cryptomuseum.com.
- `enigma.ts`: `step(state)` with the double-step anomaly, `encodeLetter(state, letter) → [state, lamp]`, `encode(settings, text) → string`, `parseSettings(query)`, `toQuery(settings)`. Non-letters pass through unchanged and do not step the machine; lowercase is uppercased.
- `tape.ts`: groups the tape into fives, keeps the last 60 letters visible, says how many were cut.
- `machine.ts`: the reducer for the page (`press`, `release`, `set-rotor`, `set-ring`, `set-start`, `plug`, `unplug`, `reflector`, `clear`), 12 fps frames for the key sink and lamp glow like Capsule's `crank.ts`.

**Tests.** `enigma.test.ts` pins the published vectors: rotors I II III, reflector B, rings AAA, start AAA, no plugs, `AAAAA` → `BDZGO`; the double step from `ADU` to `AEV` to `BFW` (the Wikipedia rotor page's worked example); encoding is its own inverse for 1,000 random messages; a plugboard pair swaps symmetrically; a letter never encodes to itself; a non-letter leaves the state alone. `wiring.test.ts`: every rotor is a permutation of A to Z, every reflector is an involution with no fixed point, notches are single letters, sources are on the allowlist. `machine.test.ts`: a press lights exactly one lamp and steps once; release puts the lamp out; `parseSettings(toQuery(s))` is `s`; a bad query falls back to defaults. The plan should have the engineer confirm `BDZGO` against a second simulator before pinning it, and add that simulator's URL to the test as a comment.

**No JavaScript.** `page.tsx` reads `searchParams` (`?r=I-II-III&ring=AAA&pos=AAA&ref=B&plug=AB,CD&m=HELLO`), encodes on the server with the same `encode`, and renders the box with the rotor windows at the final positions, the tape filled, and the settings as a `<form method="get">` with a `<select>` per rotor and a text input for the message. The island takes over for the live lamps and key presses; without it the form still works end to end. This is also the walk: `curl '/rotor?m=AAAAA'` must contain `BDZGO` on the tape.

**Content rules.** The page says what the machine is in at most 120 words, with one line on why the same settings decode, and links the two sources in the credit. No war imagery beyond the box; the page is about a mechanism, and the words say so.

**Touches outside the group.** `site.projectList` row `{ title: "Rotor", note: "An Enigma, drawn by hand. Type and watch the lamps.", href: "/rotor", colour: "yellow" }` (the five swatches are yellow, coral, mint, blue, pink; Orrery has yellow, so pick coral or add a second yellow; the dot is decoration only), `package.json` test glob, `lib/build-stamp.test.ts`, `e2e/rbac.test.ts`, the other groups' isolation lists (§1), README, `scripts/walk-rotor.sh`.

**Risks.** None technical. The one judgement is tone, settled above.

### 4.2 Planisphere, `/planisphere`

**What you see.** A planisphere is the cardboard star wheel with a window: you turn the date ring to the hour and the window shows the sky. Draw it that way, in rough.js ink on the Orrery's cream paper: a round chart of stars (sized by magnitude, a few named), constellation lines in a thin pen, the horizon window as an oval mask with N, E, S, W on its rim, a date ring around the outside, and a small Moon in one corner drawn at tonight's phase. Controls above the chart: a city `<select>` (the page-styled pickers from pm-198), a date input and an hour slider; a "Use my location" button that asks only when pressed. Press "Now" and it is now. Turning the ring (drag or arrow keys) moves the hour.

**Data (vendored, no runtime fetch).**

- Stars: d3-celestial's `data/stars.6.json` (BSD-3-Clause, Olaf Frohn, 2015; fetched 2026-10-20, 657 KB), itself built from the Yale Bright Star Catalogue (BSC5, public domain at Harvard's TDC). A vendor script in the style of `scripts/vendor-elements.ts` keeps stars to magnitude 4.5 or brighter (about 900 of the 8,900) and writes `_lib/stars.ts` with id, RA, Dec, magnitude and the proper name where there is one, plus the upstream commit in the header. Expect 60 KB, smaller than `elements.ts` (100 KB).
- Constellation lines: `data/constellations.lines.json` from the same repo (27 KB), vendored as `_lib/lines.ts`. The BSD licence text goes in `_lib/LICENSE.md` and the credit on the page links the repo and the catalogue, as Elements does for its dataset.
- Cities: 24 hand-picked cities as `{ name, lat, lon, tz }` in `_lib/cities.ts`, Ho Chi Minh City first (the Open-Meteo probe in §4.3 used it as the owner's likely home), then one or two per continent. `tz` is an IANA name; the page uses `Intl.DateTimeFormat` to turn local date and hour into UTC, which Node 22 and every browser support.

**Engine (`_lib/`, pure).**

- `time.ts`: Julian day from a UTC instant; Greenwich mean sidereal time (Meeus, Astronomical Algorithms, ch. 12); local sidereal time.
- `sky.ts`: RA/Dec to altitude and azimuth for a latitude and LST; stereographic projection from the zenith to chart x, y; `visible(star, place, when)`.
- `moon.ts`: the Moon's phase fraction and age from the mean synodic month anchored at a known new moon (Meeus ch. 49's mean phase is enough for a drawing; the page says "about").
- `sun.ts` (not Orrery's): the Sun's RA/Dec to the nearest degree so the chart can tint the window when the Sun is up and say "Come back after dark".
- `wheel.ts`: the reducer: `city`, `date`, `hour`, `drag`, `now`, `locate(lat, lon)`.

**Tests.** `time.test.ts`: GMST at 2000-01-01 12:00 UTC is 18.697374558 hours (the J2000 value); JD of 2000-01-01 12:00 UTC is 2451545.0. `sky.test.ts`: Polaris's altitude equals the latitude within one degree at any hour from three cities; a star on the equator at LST equal to its RA has altitude 90 minus latitude; azimuth of a rising star is east. `moon.test.ts`: 2000-01-06 18:14 UTC is a new moon (age under 0.1 day); 14.77 days later is full. `stars.test.ts`: every star has RA in [0, 24) or [0, 360) as chosen, Dec in [-90, 90], magnitude at most 4.5, unique ids, and the named ones include Sirius, Vega, Polaris and Betelgeuse (so the chart agrees with Orrery's five stars). `lines.test.ts`: every line endpoint is within the chart's coordinate range. `ink.test.ts` as Orrery's, with a SHA-256 snapshot of one chart. `words.test.ts` with Orrery's 220-word cap, reused by copy.

**No JavaScript.** The server renders the chart for the default city at the request's hour (`export const dynamic = "force-dynamic"` for this one page; Shore's page is dynamic already, so the site has the precedent), with the city and hour as a `<form method="get">` the way Rotor does. The island then takes over. The walk asks for `/planisphere?city=tokyo&hour=21` and counts `data-star` elements and the four compass letters.

**Why not inside Orrery.** Orrery is fourteen prerendered posters with a 220-word cap each; a dynamic chart with a city picker and a drag ring is a different kind of page, and the two would share nothing but the ink file. The pages link each other in their credit lines ("The stars by name: Orrery").

**Risks.** Chart maths is the whole risk and the tests above close it. The 900-star SVG weighs about the same as one Orrery poster. Geolocation is opt-in and never stored.

### 4.3 Barometer, `/barometer`

**What you see.** A brass-rimmed aneroid barometer, a thermometer beside it, a small wind vane and a rain cup, drawn in ink on a wood-grain board, for a chosen city. The barometer needle points at the pressure on a dial marked Stormy, Rain, Change, Fair, Very Dry, with a second brass hand you can turn to mark "where it was" (the real thing's set hand; here it remembers the reading from your last visit in `localStorage`). A line under the dials: "Ho Chi Minh City, 10:00 local, 27.1 °C, 1009.8 hPa, overcast. From Open-Meteo." The city is a `<select>` with the same 24 cities as Planisphere (its own copy; the isolation rule).

**Data.** Open-Meteo's forecast endpoint (`https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,weather_code`), which answered 200 from the pod on 2026-10-20 in 160 ms with no key. Terms fetched the same day: free for non-commercial use under 10,000 calls a day, data under CC BY 4.0, attribution required. otohime.dev is a personal site with no sales or advertising, so it qualifies; the credit line links open-meteo.com on every render.

**Fetch rules (the part that matters for Drum and anything after).**

1. The server fetches, never the browser: `page.tsx` calls `readStation(city)` in a server component with `fetch(url, { next: { revalidate: 900 } })`. Twenty-four cities at one call per 15 minutes is at most 2,304 calls a day, well under the limit, and the browser never sees a third-party host.
2. A city is a `searchParams` value validated against the vendored list; an unknown city is the default city, not a 404 and never a passthrough of user text into the URL.
3. `parseReading(json) → Reading | null` is pure and tested on three fixtures: a good answer, an answer with a null field, and garbage. `null` draws the "No reading" face: the needle rests at the bottom, the line says "The station is quiet. Last reading …" from the set hand's `localStorage` value if there is one.
4. The fetch has a 4-second `AbortSignal.timeout`; a failure or timeout renders the quiet face with a 200, so the page never 5xxs because a third party did.
5. The walk asks for `/barometer` and `/barometer?city=nope` and accepts either a reading or the quiet face, and checks the credit link, the CC BY mention and no `api.open-meteo.com` string in the served HTML or any client chunk (the host appears in server code only).
6. The WMO weather codes 0 to 99 map to twelve words in `_lib/codes.ts` ("clear", "overcast", "drizzle", "thunder" and so on), tested for coverage of every code the endpoint can return.

**Engine (`_lib/`, pure).** `codes.ts`, `dial.ts` (pressure to needle angle on the 950 to 1050 hPa dial, temperature to mercury height, wind direction to vane angle), `reading.ts` (`parseReading`, `describe(reading) → string`), `cities.ts`, `hand.ts` (the set-hand reducer: `set`, `recall`, with the `localStorage` key `barometer.hand`).

**Tests.** `dial.test.ts`: 1013 hPa is "Change" at the top of the dial, 950 and 1050 are the ends, the mapping is monotonic; `reading.test.ts` on the three fixtures; `codes.test.ts` covers every WMO code; `hand.test.ts` round-trips a reading. `isolation.test.ts` as Vinyl's, plus: `fetch(` appears only in `_lib/station.ts`.

**No JavaScript.** Everything is server-rendered; the only client code is the set hand and the city `<select>`'s auto-submit (the form submits with a button without it).

**Risks.** Open-Meteo could change terms or go down; the quiet face and the ISR cache mean the page degrades to a drawing, not an error. If the owner wants no third-party call at all, Drum's USGS feed (US government, public domain) is the same shape with a different source.

## 5. The other five, shorter

- **Loom, `/loom`.** A four-shaft table loom drawn in ink. The draft is three grids you click: threading (which shaft each warp thread is on), tie-up (which shafts each treadle lifts) and treadling (which treadle each pick uses); the drawdown, the cloth, is computed from them (`cloth[i][j] = tieup[treadling[i]][threading[j]]`) and drawn as warp over weft with two yarn colours you pick. Five classic drafts are presets (plain, 2/2 twill, basket, herringbone, point twill). Pure: `draft.ts` (the matrix), `presets.ts`, a reducer; tests pin the five presets' drawdowns and that plain weave alternates. Shareable as a query string, so the no-JavaScript page can render any draft. About 1,200 lines. Sources: Wikipedia's weaving draft article for the terms.
- **Depot, `/depot`.** A conveyor with numbered parcels (the site's own motif, redrawn inside the group) and a sorter at the end. Pick an algorithm (bubble, insertion, selection, merge, quick, heap), press Run, and the belt moves one comparison or swap per frame at 12 fps with the two parcels in hand lifted, a counter of comparisons and moves, and a ledger line under it ("Quick sort: 24 parcels, 93 compares, 31 moves"). Pure: `sorts.ts` as generators yielding `{ kind: "compare" | "swap" | "set", i, j }` steps; `belt.ts` applies steps; tests assert every algorithm sorts 200 random belts and that the step counts for a fixed seed match pinned numbers. About 1,600 lines; the no-JavaScript page shows the belt sorted with the ledger line for `?algo=quick&seed=7`.
- **Telegraph, `/telegraph`.** A brass Morse key on a wooden base and a sounder. Hold Space or press the key: a tone (Web Audio, the one file allowed an `AudioContext`, as Vinyl's `crackle.ts`) and a decoder that reads your dits and dahs against the standard timings and prints the letters on a paper strip; or type a message and watch the key tap it out at a chosen speed. Pure: `morse.ts` (the table, encode, decode with timing tolerance, words per minute to unit length), a reducer for the key; tests pin "SOS" and the Paris standard (50 units per word). About 1,000 lines; the no-JavaScript page encodes `?m=HELLO` to dots and dashes on the strip.
- **Soroban, `/soroban`.** A thirteen-rod Japanese abacus drawn in ink; flick a bead with a click, a tap or the arrow keys, and the number reads out above. A "set me" line asks for a number to set and checks it; "add" gives two numbers and watches you carry. Pure: `beads.ts` (rod state to value and back), `drill.ts` (a seeded sequence of sums); tests round-trip every rod value 0 to 9 and pin a drill. About 900 lines; the no-JavaScript page sets `?n=1234`.
- **Drum, `/drum`.** A seismograph drum with the last 24 hours from the USGS all-day GeoJSON feed (public domain; 212 quakes answered 200 from the pod on 2026-10-20), fetched on the server with the Barometer rules (revalidate 600 s, timeout, quiet face), traced as a pen line whose kicks are scaled by magnitude, with the three biggest named below. Pure: `feed.ts` (parse, sort, bucket by hour), `trace.ts` (magnitude to kick height, the drum's spiral). About 1,200 lines. Build after Barometer so the fetch rules exist.

## 6. How to feed these in

Submit one idea per project, in the order above, in the form the earlier ideas took: "You are a senior front-end engineer. Add Rotor, a hand-drawn Enigma, at /rotor; see projects/research-and-design-more-projects-into-the-app/research.md §4.1." The research run for each then goes straight to the plan. Three to five tasks per plan have been enough so far: the pure engine with tests, the page and its island, the walk and README, then QA and acceptance.

Two things to put in the first plan whichever project goes first:

1. The new group's isolation test reads the other groups from `app/` instead of a hard-coded list (§1), and the plan notes that the older four can move to the same shape later.
2. A `scripts/vendor-<name>.ts` like `vendor-elements.ts` for any vendored dataset, with the upstream commit in the generated file's header, so the data can be refreshed and its licence file sits beside it.

## 7. Sources checked on 2026-10-20

- d3-celestial, BSD-3-Clause: https://github.com/ofrohn/d3-celestial (LICENSE and `data/stars.6.json`, `data/constellations.lines.json` fetched raw, 200); its readme lists the Yale Bright Star Catalogue and other VizieR catalogues as sources.
- Yale Bright Star Catalogue (BSC5): http://tdc-www.harvard.edu/catalogs/bsc5.html (200).
- Open-Meteo terms: https://open-meteo.com/en/terms (200; non-commercial free tier, 10,000 calls a day, CC BY 4.0); forecast probe for 10.82 N, 106.63 E answered 200 with `temperature_2m: 27.1`, `surface_pressure: 1009.8`.
- USGS all-day earthquake feed: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson (200, 151 KB, 212 features).
- Enigma rotor wiring: https://en.wikipedia.org/wiki/Enigma_machine (200) and https://www.cryptomuseum.com/crypto/enigma/wiring.htm (200; rotor I `EKMFLGDQVZNTOWYHXUSPAIBRCJ`, notch Q; rotor II `AJDKSIRUXBLHWTMCQGZNPYFVOE`, notch E).
- Natural Earth, public domain (kept in reserve for an atlas; not on the shortlist because the 110 m countries file is about 800 KB): https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/LICENSE.md (200).
- Live site: `/projects` links exactly the five live projects; `/rotor`, `/planisphere`, `/barometer`, `/loom`, `/depot`, `/telegraph`, `/soroban`, `/drum` all 404.
