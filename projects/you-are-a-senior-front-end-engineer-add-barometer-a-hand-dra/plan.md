# Barometer: a brass weather station for your city, drawn by hand (pm-204)

**Idea.** "Add Barometer, a hand-drawn brass weather station (aneroid dial,
thermometer, wind vane, rain cup) for a chosen city, at /barometer. The full
design is in projects/research-and-design-more-projects-into-the-app/research.md
§4.3 (pm-202). Readings come from Open-Meteo (CC BY 4.0, no key) and are
fetched only on the server, with revalidate 900 s and a 4 s timeout. The city
is validated against a vendored list. A pure parseReading is tested on
fixtures. When the feed is down, a drawn 'quiet' face still returns 200. The
page credits Open-Meteo on every render. These fetch rules become the site's
template for live-data projects."

**Product.** `otohime.dev/barometer`, the next project on the Projects bench.
A wooden board drawn in ink holds four brass instruments for one city: an
aneroid barometer dial (Stormy, Rain, Change, Fair, Very Dry) with a black
needle, a glass thermometer, a wind vane and a tin rain cup. One line under
them says what they read ("Ho Chi Minh City, 17:30 local, 26.9 °C, 1011.2 hPa,
drizzle.") and the credit names Open-Meteo and CC BY 4.0. Pick one of 24
cities with a plain form, which works without JavaScript. With JavaScript, the
select reads on change, and **Set** moves the dial's second brass hand to the
needle and remembers it, so on the next visit the dial shows at a glance
whether the pressure has risen or fallen, as a real barometer does. When the
feed is down or slow, the board still draws, at rest: "The station is quiet."

Research: [research.md](research.md) (run-6765, rep-3859), checked against
the repo at a937f40 and rechecked by the product owner at c6b86fe. §2 is the
feed, §3 the fetch rules and the build proof, §4 the page and tests. This plan
repeats only what the contracts need and records where it departs.

## Decisions

| Decision | Why |
| --- | --- |
| Route group `app/(barometer)/` serves `/barometer`, with its own root layout and hand-written `barometer.css`, and Orrery's two `next/font/google` calls (Caveat titles, Patrick_Hand text, literal options and cursive fallbacks). | House recipe (pm-202 research §1). The fonts already build in CI. |
| **The page exports `instant = false`, awaits `searchParams` as its first statement, outside any `<Suspense>`, and calls a `"use cache"` function `readStation(slug)` for the one upstream call.** | `cacheComponents: true`: the plain page fails `next build`, the Suspense shape leaves no-JavaScript visitors on the fallback for ever, and the segment options `revalidate`/`dynamic`/`fetchCache` are gone (research §3, four throwaway builds). |
| "Revalidate 900 s" is `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` after a good reading, and `cacheLife({ stale: 30, revalidate: 60, expire: 300 })` after a failure, one call per invocation. The 4 s timeout is `AbortSignal.timeout(4000)` on the `fetch`. | The feed's own `current.interval` is 900 s. A failure cached for a minute stops an outage from costing one upstream call per view. The `cacheLife` reference allows a call in each branch. |
| The dial reads **`pressure_msl`**, never `surface_pressure`. | Mexico City answers `surface_pressure` 785.0 and `pressure_msl` 1021.7 (product owner probe, 2026-10-20). Only sea-level pressure sits on a 950–1050 dial. |
| **29 WMO codes, twelve words**, and "unsettled" for anything else: clear (0), mainly clear (1), partly cloudy (2), overcast (3), fog (45, 48), drizzle (51, 53, 55), freezing rain (56, 57, 66, 67), rain (61, 63, 65), showers (80, 81, 82), snow (71, 73, 75, 77, 85, 86), thunder (95, 97), thunder with hail (96, 99). | The research said twelve words but listed nine, and its sample sentence said "light drizzle" for 51. The product owner read Open-Meteo's `/en/docs` table on 2026-10-20 (it has 97, "Heavy thunderstorm") and checked that the twelve groups cover the 29 codes exactly once. Decision recorded. |
| `BAROMETER_HOST` (an origin, default `https://api.open-meteo.com`) is read once at module load in `station.ts`, used only if it parses as an `http:`/`https:` URL. | The on-demand proof of the quiet face and the timeout (task 3) points the server at a dead port and a slow fake, rather than waiting for a real outage. The env var is server-only and set only by whoever starts the server. |
| City slugs, in this order: `hcmc`, `hanoi`, `bangkok`, `singapore`, `tokyo`, `seoul`, `mumbai`, `dubai`, `istanbul`, `moscow`, `berlin`, `paris`, `london`, `reykjavik`, `cairo`, `lagos`, `nairobi`, `cape-town`, `new-york`, `mexico-city`, `los-angeles`, `sao-paulo`, `buenos-aires`, `sydney`. Coordinates as research §4. An unknown or missing `city` draws `hcmc`, always 200. | The walk and the tests name the slugs. `hcmc` matches Planisphere's slug. Mexico City is the altitude case. |
| Walk port **4051**; dead-port check **4053**; task 3's slow fake feed listens on **4057**. | 4019–4037 are taken, and Planisphere's plan treats 4041 as Vinyl's reserved-port fallback. Departure from the research's 4041/4047, recorded. |
| Walk counts use attribute forms (`data-face="`, `href="https://open-meteo.com/"`, `<option value="`); visible-text checks (`CC BY 4.0`, the city name) only require presence. | The App Router repeats server text in the inline RSC payload, so "exactly once" on plain text would fail; `attr="` only occurs in HTML. |
| The walk accepts either face on every page; when the face is `reading`, the sentence's pressure must be in **900–1100 hPa**. | CI and the gate reach the real feed, which may be down. 900–1100 tolerates a deep storm and still rejects `surface_pressure` at altitude (785). Departure from 950–1050, recorded. |
| The island imports no `roughjs` and no `ink.ts`. It wraps the server-drawn board as children, sets the set hand's angle with a CSS custom property (`--hand`) on its wrapper, and auto-submits the city form through a delegated `onChange`. | Global lesson: keep rough.js and the SVG out of client chunks. |
| `localStorage` appears only in `_components/hand-app.tsx` and the layout's theme-pin script. `_lib/hand.ts` takes and returns strings and never touches storage. | Every root layout carries the theme pin (`app/(elements)/layout.tsx:25`), so the research's "only in the island" rule would fail on day one. |
| Site row `{ title: "Barometer", note: "A brass weather station for your city, read every quarter hour.", href: "/barometer", status: "live", colour: "yellow" }`, last in the list. | Brass reads yellow; blue is Elements and Planisphere. |
| The fetch rules land in the README as a `## Live data` section (task 3) that later live-data projects cite. | Makes "the site's template" a checked artefact rather than a sentence in a plan. |
| Three build tasks: engine (`qa: skip`), page and island (QA), on-demand quiet-face proof and the template (`qa: skip`). No operator action. | The feed needs no key; fixtures are captured once and committed; nothing needs a person. |
| Commits are authored and committed as `Otohime <quiinthieu@gmail.com>` (set `GIT_AUTHOR_*` and `GIT_COMMITTER_*`). Subjects start `pm-204/t-NNNN:`. | Vercel Hobby deploys only the owner's commits. |
| Rotor (pm-202) and Planisphere (pm-203) edit the same shared lines: `content/site.ts`, `package.json`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `README.md`. On a rebase conflict, keep both sides. | Lesson iss-9. |

## File tree

```
app/(barometer)/
  layout.tsx                 own <html>, barometer.css, hand fonts, build-sha meta, themeColor light/dark, theme pin
  barometer.css              wood, brass, cream-dial tokens; dark scheme; instruments; form; focus rings;
                             base-select styling; @media (prefers-reduced-motion: reduce)
  barometer/page.tsx         instant = false; await searchParams; findCity; readStation; <HandApp><Station/></HandApp>;
                             form, sentence, credit, explainer
  _components/station.tsx    server SVG: board, dial, needle, set hand, thermometer, vane, cup; data-face
  _components/hand-app.tsx   the one "use client" island
  _lib/
    cities.ts codes.ts dial.ts reading.ts hand.ts station.ts ink.ts roughjs.d.ts words.ts
    fixtures/hcmc.json fixtures/no-pressure.json fixtures/error.json fixtures/garbage.json
    *.test.ts                cities, codes, dial, reading, hand, station, ink, words, isolation
scripts/walk-barometer.sh · content/site.ts · lib/build-stamp.test.ts · e2e/rbac.test.ts · package.json · README.md
```

## Tasks

### 1. Barometer's engine: cities, codes, dial maths, parseReading on fixtures, and the one cached fetch

- **Role:** software_engineer, `qa: skip`. Only `_lib/` files, the test glob
  and the README test line. No route is added, so visitors see no change.
- **Problem:** The page needs a validated city list, a pure parser for the
  feed's answer, the dial geometry and the single server fetch with its cache
  lives and timeout. None of it exists, and all of it must be proven without
  the network before anything draws it.
- **Action items:**
  1. Read `AGENTS.md`, `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md`,
     `04-functions/cacheLife.md`, `app/(orrery)/_lib/ink.ts`, `words.ts`,
     `app/(shore)/_lib/` (`normalizeLedger`) and `app/(vinyl)/_lib/isolation.test.ts`.
  2. `cities.ts`: `CITIES` (24, the plan's slug order) of
     `{ slug, name, lat, lon, tz }` with research §4's coordinates and IANA
     zones (Hanoi `Asia/Ho_Chi_Minh`, Buenos Aires
     `America/Argentina/Buenos_Aires`, Cape Town `Africa/Johannesburg`),
     `type CitySlug`, `findCity(slug: string): City | undefined`.
  3. `codes.ts`: the 29 codes in the plan's twelve groups, `wordFor(code)`,
     "unsettled" otherwise.
  4. `dial.ts`: `needleAngle(hpa)` = `clamp((hpa − 1000) · 2.7, −135, 135)`;
     `DIAL_WORDS` at 955 Stormy, 975 Rain, 1000 Change, 1025 Fair, 1045 Very
     Dry; `mercuryHeight(c)` = clamp((c + 20) / 65, 0, 1);
     `vaneAngle(fromDeg)` = fromDeg mod 360; `cupLevel(mm)` = clamp(mm / 5, 0, 1);
     `QUIET` angles (needle −135, mercury 0, vane 0, cup 0).
  5. `reading.ts`: `type Reading = { at, temperatureC, pressureHpa, windKmh, windFromDeg, rainMm, code, interval }`;
     `parseReading(json: unknown): Reading | null` (null for a non-object, an
     array, `error: true`, or any of `time`, `temperature_2m`, `pressure_msl`,
     `wind_speed_10m`, `wind_direction_10m`, `precipitation`, `weather_code`,
     `interval` missing or non-finite; `at` must match `YYYY-MM-DDTHH:MM`);
     `describe(city, reading)` = `"<name>, HH:MM local, <t.toFixed(1)> °C, <p.toFixed(1)> hPa, <word>."`.
  6. Fixtures: capture `fixtures/hcmc.json` once from
     `https://api.open-meteo.com/v1/forecast?latitude=10.82&longitude=106.63&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation,weather_code&timezone=Asia%2FHo_Chi_Minh`
     (write the URL and date into `reading.test.ts`), `no-pressure.json` (the
     same with `pressure_msl: null`), `error.json`
     (`{ "error": true, "reason": "Invalid value" }`), `garbage.json`
     (`["x", 1]`).
  7. `hand.ts`: `STORAGE_KEY = "barometer.hand"`, `type Hand = { city: CitySlug; hpa: number; at: string }`,
     `normalizeHand(raw: string | null): Hand | null` (known slug, hpa finite
     in 800–1200, `at` in the reading's format), `serializeHand(h)`, and a
     reducer over `set(city, reading)`, `recall(raw)`, `clear`.
  8. `station.ts`: `import { cacheLife } from "next/cache"` (its only
     import from Next); `HOST` from `BAROMETER_HOST` when it parses as an
     http(s) URL, else `https://api.open-meteo.com`; path `/v1/forecast`;
     `readStation(slug)` marked `"use cache"`, the research §3 sketch with
     `fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } })`,
     any throw, non-200 or null parse giving `null`, and the two `cacheLife`
     branches. Nothing calls it in tests.
  9. Copy `ink.ts` and `roughjs.d.ts` from Orrery with `SEED = 204`; copy
     `words.ts` with `WORD_CAP = 120`.
  10. Tests (`node:test`):
      - `cities.test.ts`: 24 in the plan's order, unique slugs matching `/^[a-z-]+$/`, ranges, every `tz` accepted by `Intl.DateTimeFormat`, `findCity("nope")` undefined.
      - `codes.test.ts`: lists all 29 codes literally, including 97; every one maps to one of the twelve words; the twelve words each used; 4 and 98 read "unsettled".
      - `dial.test.ts`: 950 → −135, 1000 → 0, 1050 → 135, 1011.2 → 30.24 (±1e-9), 1021.7 → 58.59, 900 and 1100 clamp, monotonic over 950..1050; mercury 26.9 → 0.7215 (±1e-4) and clamps; cup 0.1 → 0.02 and clamps; vane 336 → 336, 360 → 0.
      - `reading.test.ts`: `hcmc.json` parses with `pressureHpa` equal to the fixture's `pressure_msl`; the other three give null; `{}`, `"x"`, `null` give null; `describe(hcmc, { at: "2026-10-20T17:30", temperatureC: 26.9, pressureHpa: 1011.2, windKmh: 5.3, windFromDeg: 336, rainMm: 0.1, code: 51, interval: 900 })` is exactly `Ho Chi Minh City, 17:30 local, 26.9 °C, 1011.2 hPa, drizzle.`
      - `hand.test.ts`: round trip, garbage and out-of-range give null, `set` then `recall` returns the hand.
      - `station.test.ts` reads `station.ts` as text: `"use cache"`, two `cacheLife(` calls with `revalidate: 900` and `revalidate: 60`, `AbortSignal.timeout(4000)`, `pressure_msl`, `BAROMETER_HOST`, `api.open-meteo.com`.
      - `ink.test.ts`, `words.test.ts` as Orrery's.
  11. `isolation.test.ts`, Vinyl's with `GROUPS` from
      `readdirSync(join(ROOT, "app"))`, plus: `fetch(`, `api.open-meteo.com`,
      `process.env` and any `next` import appear under `_lib/` only in
      `station.ts` (and only `next/cache`); `_lib/` imports no React;
      only `ink.ts` imports `roughjs`; no `localStorage` under `_lib/`; at
      most one `"use client"` file in the group, never under `_lib/`.
  12. Add `'app/(barometer)/_lib/*.test.ts'` to the `npm test` glob and name
      Barometer's tests in the README's `npm test` sentence.
- **Interfaces:** `app/(barometer)/_lib/`; `package.json`; `README.md`.
- **Non-goals:** the page, layout, CSS, components or island; forecasts or
  history; units other than °C, hPa, km/h, mm; calling the feed in tests.
- **Acceptance:** `npm test` runs Barometer's engine tests and they pass,
  with no network: 24 validated cities, all 29 WMO codes including 97,
  the dial vectors, `parseReading` on the four fixtures, and a `station.ts`
  that is the project's only fetch, cached 900 s (60 s on failure) with a 4 s
  timeout on `pressure_msl`.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(barometer)/_lib/*.test.ts'`
  - `test "$(grep -rl 'fetch(' 'app/(barometer)' | grep -c .)" -eq 1 && grep -q 'fetch(' 'app/(barometer)/_lib/station.ts'`
  - `grep -q pressure_msl 'app/(barometer)/_lib/station.ts' && grep -q 'AbortSignal.timeout(4000)' 'app/(barometer)/_lib/station.ts' && grep -q 'revalidate: 900' 'app/(barometer)/_lib/station.ts'`
  - `grep -qw 97 'app/(barometer)/_lib/codes.test.ts' && grep -q '30.24' 'app/(barometer)/_lib/dial.test.ts' && grep -q '1011.2 hPa, drizzle.' 'app/(barometer)/_lib/reading.test.ts'`
  - `test "$(ls 'app/(barometer)/_lib/fixtures/'*.json | grep -c .)" -eq 4`
  - `grep -q 'readdirSync(join(ROOT, "app")' 'app/(barometer)/_lib/isolation.test.ts' && grep -q "app/(barometer)/_lib/\*.test.ts" package.json`
  - `! grep -rn '"use client"' 'app/(barometer)/_lib'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Barometer at /barometer: the inked station, the GET form, the set hand and the walk

- **Role:** software_engineer. Depends on 1. QA is required.
- **Problem:** The engine is invisible. Visitors need `/barometer`: the
  instruments drawn for a city's current reading, a city picker that works
  without JavaScript, a quiet face instead of an error when the feed fails,
  the Open-Meteo credit on every render, and a set hand that remembers. It
  must be listed on `/projects` and fit a phone.
- **Action items:**
  1. Read `node_modules/next/dist/docs/` on `instant`, Cache Components and
     `page.tsx`; `app/(orrery)/layout.tsx`, `app/(elements)/layout.tsx` (theme
     pin) and `scripts/walk-vinyl.sh`.
  2. `layout.tsx`: own `<html lang="en">`, `barometer.css`, Orrery's two font
     calls, `metadata.title { default: "Barometer", template: "%s · Barometer" }`,
     a description, `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`,
     `viewport.themeColor` light and dark (dark `#2b1d14`), the theme-pin
     script with `suppressHydrationWarning`.
  3. `barometer/page.tsx`: **`export const instant = false`**;
     `const q = await searchParams` first; `findCity(...) ?? CITIES[0]`;
     `await readStation(city.slug)`; no `<Suspense>`. Render the top bar
     (`<a href="/">otohime.dev</a>`, `<a href="/projects">← All projects</a>`),
     the title, `<form method="get" action="/barometer">` with
     `<select name="city">` (24 options, the current one `selected`, styled
     under `@supports (appearance: base-select)`) and a "Read" button, the
     station, the sentence in `<p data-sentence>` (`describe`, or "The
     station is quiet."), the credit
     `Weather data by <a href="https://open-meteo.com/">Open-Meteo.com</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>`
     on both faces, and an explainer of at most 120 words on how an aneroid
     barometer reads (`data-explainer`).
  4. `_components/station.tsx` (server): `viewBox` board in rough.js ink from
     module-level constants (computed once per process), the dial with the
     five words and a black needle at `needleAngle`, the brass set hand
     `<g data-set-hand>` rotated by `var(--hand)` and hidden until the
     wrapper has `data-hand="set"`, the thermometer column at
     `mercuryHeight`, the vane at `vaneAngle` with N/E/S/W, the cup at
     `cupLevel`. Exactly one `data-face="reading"` or `data-face="quiet"`
     (quiet: the `QUIET` angles). The SVG has a `<title>` and `<desc>` that
     repeat the sentence.
  5. `_components/hand-app.tsx`, the only `"use client"` file: wraps the
     station as children in `<div data-station data-hand>`; imports only
     `_lib/hand.ts`, `_lib/dial.ts` and `_lib/cities.ts`. On mount it reads
     `localStorage[STORAGE_KEY]` through `normalizeHand`; a hand for the same
     city sets `--hand` to `needleAngle(hand.hpa)` and `data-hand="set"`,
     and on the quiet face adds "Last reading: <hpa> hPa on your last
     visit." A **Set** button (shown only after hydration, only on the reading
     face) stores `{ city, hpa, at }` and moves the hand; a **Clear** button
     removes it. A delegated `onChange` on the wrapper calls
     `form.requestSubmit()` when `name === "city"`. Announce changes in an
     `aria-live="polite"` region. The needle swings by CSS transition, off
     under `prefers-reduced-motion`. No timers, no fetch.
  6. `barometer.css`: wood, brass and cream tokens, a dark scheme
     (`prefers-color-scheme` and `[data-theme]`), board and form stacking on
     phones, nothing wider than 100vw at 320 px, visible focus rings,
     `@media (prefers-reduced-motion: reduce)`. No Tailwind.
  7. `content/site.ts`: the plan's row, last among the projects.
     `lib/build-stamp.test.ts`: "Barometer's root layout publishes BUILD_SHA
     as <meta name=build-sha> too". `e2e/rbac.test.ts`: `/projects` links
     `/barometer`; "Barometer is its own page, without the site's sidebar"
     (200, no `aria-label="Main"`, links `/projects`, one `data-face="`,
     `href="https://open-meteo.com/"`).
  8. `scripts/walk-barometer.sh`, in the style of `walk-vinyl.sh` (port 4051,
     local build and start or `BASE_URL`, `EXPECT_SHA`, process-group
     cleanup, `grep -c` counts, no `wc -l`, no `set -e`). For `/barometer`,
     `?city=tokyo`, `?city=mexico-city` and `?city=nope`: 200, the build-sha
     meta, no `aria-label="Main"`, a `href="/projects"`, exactly one
     `data-face="` whose value is `reading` or `quiet` (print which), exactly
     one `href="https://open-meteo.com/"`, `CC BY 4.0` present, exactly one
     `method="get"`, 24 `<option value="`, no `<template id="B:` and no
     `$RC`, body under 200 KB; on the reading face, the `data-sentence`
     pressure is in 900–1100; `?city=nope` and `/barometer` have `hcmc`
     selected and name Ho Chi Minh City; `?city=tokyo` has Tokyo selected.
     `api.open-meteo.com` appears in no served HTML and in no
     `/_next/static/chunks/*.js` the page references. The page links only
     its own stylesheet, which has `prefers-reduced-motion` and no `--tw-`.
     The explainer has at most 120 words (via `_lib/words.ts`). Exactly one
     `"use client"` file under `app/(barometer)`, and it names no `roughjs`
     or `ink`. `/projects` links `/barometer` exactly once.
  9. README: the route-group line, the walk line, and a paragraph on the feed
     and its licence.
- **Interfaces:** `app/(barometer)/`; `scripts/walk-barometer.sh`;
  `content/site.ts`; `lib/build-stamp.test.ts`; `e2e/rbac.test.ts`;
  `README.md`.
- **Non-goals:** forecasts, charts or history; geolocation; unit switching;
  client-side fetching; a quiet-face proof against a dead feed (task 3); any
  change to another project's look.
- **Acceptance:** `/barometer` draws the station for Ho Chi Minh City with
  the current reading, a sentence that matches the needle, and the
  Open-Meteo credit; it is listed on `/projects` with a yellow dot. With
  JavaScript off, choosing Tokyo and pressing Read draws Tokyo; Mexico City
  reads near 1020 hPa, not 785; `?city=nope` draws Ho Chi Minh City with 200.
  With JavaScript on, the select reads on change and Set keeps the brass hand
  across reloads. The page fits 320 px and reads in light and dark.
  `bash scripts/walk-barometer.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-barometer.sh && ! grep -nE 'wc +-l' scripts/walk-barometer.sh`
  - `bash scripts/walk-barometer.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4051/; then exit 1; fi`
  - `if BASE_URL=http://127.0.0.1:4053 bash scripts/walk-barometer.sh; then exit 1; fi`
  - `grep -q 'export const instant = false' 'app/(barometer)/barometer/page.tsx' && ! grep -n 'Suspense' 'app/(barometer)/barometer/page.tsx'`
  - `test "$(grep -rl '"use client"' 'app/(barometer)' | grep -c .)" -eq 1 && ! grep -nE 'roughjs|_lib/ink' 'app/(barometer)/_components/hand-app.tsx'`
  - `! grep -rn 'api.open-meteo.com' 'app/(barometer)' --include=*.tsx`
  - `grep -q 'href: "/barometer"' content/site.ts && grep -q '/barometer' e2e/rbac.test.ts && grep -q 'Barometer' lib/build-stamp.test.ts`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. The quiet face under a dead and a slow feed, proven on demand, and the live-data template

- **Role:** software_engineer, `qa: skip`. Depends on 2. It adds a walk
  mode and a README section; the page a visitor sees does not change.
- **Problem:** "When the feed is down, a drawn quiet face still returns 200"
  and "a 4 s timeout" are only claims until a server is shown a feed that is
  down and one that hangs. Waiting for a real outage proves nothing, and the
  rules must be written where the next live-data project will find them.
- **Action items:**
  1. `scripts/walk-barometer.sh`: `QUIET=1` builds once (or `SKIP_BUILD=1`)
     and runs two servers in turn on 4051:
     - **dead:** `BAROMETER_HOST=http://127.0.0.1:9 next start`. `/barometer`
       and `?city=tokyo` are 200, have exactly one `data-face="quiet"`, the
       credit link and `CC BY 4.0`, the sentence "The station is quiet.",
       the build-sha meta, and each answer in under 3 s (`curl -w '%{time_total}'`).
     - **slow:** a Node one-liner on 127.0.0.1:4057 that accepts the request
       and answers only after 10 s, and `BAROMETER_HOST=http://127.0.0.1:4057`.
       `/barometer?city=paris` (a city not asked before on this server) is
       200 with `data-face="quiet"` in **3.5–6.5 s**: slower proves the
       request reached the fake, faster than 10 s proves the 4 s abort fired.
       The fake logs each request; the walk asserts it saw at least one
       `/v1/forecast?` with `pressure_msl`.
     Kill both servers by process group on every exit path. The default mode
     is unchanged.
  2. README `## Live data`: the rules every live-data page on this site
     follows, with Barometer as the worked example: (1) one server-only
     module holds the only `fetch(` and the host; (2) the page exports
     `instant = false` and awaits `searchParams` outside Suspense; (3) the
     upstream call sits in a `"use cache"` function with `cacheLife` matched
     to the feed's interval and a short life for failures; (4)
     `AbortSignal.timeout` on every fetch; (5) a pure parser tested on
     captured fixtures, null on anything unexpected; (6) a drawn quiet face
     with 200, never a 4xx/5xx for bad input or a dead feed; (7) the
     licence credit on every render; (8) the reading's time on the page; (9)
     no network at build; (10) a host override and a `QUIET=1` walk that
     proves the dead and slow cases on demand.
- **Interfaces:** `scripts/walk-barometer.sh`; `README.md`.
- **Non-goals:** retries or circuit breakers; a shared live-data library
  across route groups (the isolation rule forbids it); a status page; any
  change to the rendered page.
- **Acceptance:** `QUIET=1 bash scripts/walk-barometer.sh` exits 0: with the
  feed's host on a dead port the page is the quiet face with 200 and the
  credit in under 3 s, and with a feed that hangs for 10 s the page is the
  quiet face in 3.5–6.5 s. The README's "Live data" section states the
  rules.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-barometer.sh && ! grep -nE 'wc +-l' scripts/walk-barometer.sh`
  - `QUIET=1 bash scripts/walk-barometer.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4051/; then exit 1; fi; if curl -s -o /dev/null --max-time 2 http://localhost:4057/; then exit 1; fi`
  - `grep -q '^## Live data' README.md && grep -q 'instant = false' README.md && grep -q 'cacheLife' README.md && grep -q 'QUIET=1' README.md`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA (task 2)

Headless Chrome (playwright-core in a scratch directory; on a macOS lease
`chromium.launch({ channel: "chrome" })`) at 1366×768, 390×844 and 320×640,
light and dark, motion on and off. Note which face each check saw; if the
feed is down, the reading-face checks run against a server started with
`BAROMETER_HOST` pointing at a local stub that serves `fixtures/hcmc.json`.

- The needle, the sentence's pressure and `needleAngle` agree (within 1°).
- JavaScript off: choose Tokyo, press Read; the URL is `?city=tokyo` and the
  board redraws. Mexico City reads 900–1100 hPa (not 785).
- JavaScript on: changing the select reads without pressing Read; Set shows
  the brass hand, survives a reload, and is hidden on another city; Clear
  removes it.
- Tab reaches the select, Read, Set and Clear with a visible ring; the live
  region announces Set.
- Nothing scrolls sideways at 320 px; under reduced motion the needle does
  not swing.
- `/projects` shows Barometer with a yellow dot; other projects unchanged.
- No console errors; Lighthouse accessibility ≥ 95.

## Acceptance

After CI deploys: `BASE_URL=https://otohime.dev bash scripts/walk-barometer.sh`
exits 0. Request `https://otohime.dev/barometer?city=tokyo` twice, 5 s apart;
on the reading face, the second answer's "HH:MM local" is within 35 minutes
of Tokyo's clock (feed interval plus cache life: the visible proof that the
cache refreshes). Repeat QA's no-JavaScript Tokyo round trip and the Set
reload on otohime.dev, and confirm `/projects` lists Barometer once. Task 3's
dead and slow proofs are not repeated in production; they ran on demand at
the delivery sha.

## Risks

- **The feed is down during a gate or acceptance.** The walk accepts the
  quiet face, prints which face it saw, and task 3 proves the quiet path
  independently. A reading-face check that cannot run is recorded, not
  waited for.
- **`"use cache"` on Vercel is per instance.** Each cold instance makes one
  call per city; 24 cities every 15 minutes is 2,304 calls a day per
  instance against a 10,000-a-day free limit. The page shows the reading's
  time, so staleness is visible.
- **Env read under `"use cache"`.** `BAROMETER_HOST` is a module constant,
  not an argument, so it is not part of the cache key; each server process
  has one host, which is all task 3 needs.
- **Fonts.** If Google fonts fail at build time, Orrery fails too: an
  environment cause.
- **Rotor and Planisphere in flight.** Keep both sides on the five shared
  files; put the Barometer row after whichever rows have landed.
