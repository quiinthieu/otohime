# Research: Barometer, `/barometer` (pm-204, run-6765)

**Idea.** Add Barometer, a hand-drawn brass weather station (aneroid dial, thermometer, wind vane, rain cup) for a chosen city, at `/barometer`, with readings from Open-Meteo fetched only on the server (revalidate 900 s, 4 s timeout), a city validated against a vendored list, a pure `parseReading` tested on fixtures, a drawn "quiet" face that still returns 200 when the feed is down, an Open-Meteo credit on every render, and fetch rules that become the site's template for live-data projects.

**Short answer.** Build it as research.md §4.3 describes, with three corrections that this run proved against the real repo and the real feed on 2026-10-20:

1. **The fetch rule has to be written for Cache Components, not for the old `fetch` cache.** `next.config.ts` has `cacheComponents: true`. A page that awaits `searchParams` outside `<Suspense>` fails `next build` here, and the route-segment exports `dynamic`, `revalidate` and `fetchCache` no longer exist. A throwaway build (§3) showed the shape that works and keeps the page whole without JavaScript: `export const instant = false` on `barometer/page.tsx`, `searchParams` read at the top of the page, and a `"use cache"` function `readStation(city)` with `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` around the one `fetch`. The first request to a city took 0.27 s, the next 0.02 s with the same fetch timestamp, and the HTML carried the reading inline. The Suspense shape streams the reading into a `<div hidden>` behind a swap script, so a visitor without JavaScript would see the fallback for ever.
2. **The dial reads `pressure_msl`, not `surface_pressure`.** Mexico City answers 785 hPa at the surface and La Paz 654 hPa, both off a 950 to 1050 dial; sea-level pressure puts every city on it (1021.7 and 1020.8).
3. **The WMO code table has 29 codes, not 28:** Open-Meteo's own table includes 97 (heavy thunderstorm). The coverage test must list it.

Everything else in §4.3 stands: 24 vendored cities, the quiet face, the set hand in `localStorage`, the credit line, the walk that accepts a reading or the quiet face, and `fetch(` only in `_lib/station.ts`. The whole project is about 1,300 lines, one plan, three build tasks plus QA and acceptance, in the shape of the Rotor plan (`projects/research-and-design-more-projects-into-the-app/plan.md`).

## 1. The repo today (a937f40, 2026-10-20)

- Five projects follow the house recipe in research.md §1 (own root layout and CSS, pure `_lib/` under `node --test`, one client island at most, a no-JavaScript path, plain `<a>` links across root layouts, a row in `content/site.ts`, the `npm test` glob, `e2e/rbac.test.ts`, a `scripts/walk-<name>.sh`, a README block).
- pm-202 (Rotor) is in flight. Its task 1 already landed (a937f40): every isolation test now reads the other route groups from `app/`, so Barometer's own `isolation.test.ts` copies `app/(vinyl)/_lib/isolation.test.ts` and no older test needs editing. Rotor's `/rotor` and Planisphere's `/planisphere` are not in the tree yet, so Barometer writes its own 24-city list and Planisphere copies it later (the isolation rule forbids sharing either way).
- Shared lines Barometer edits, which Rotor and Planisphere also edit: `content/site.ts`, `package.json` (test glob), `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `README.md`. On a rebase conflict keep both sides' lines (lesson iss-9).
- Walk ports in use: 4019 Shore, 4021 Capsule, 4025 Music, 4027 Orrery, 4029 Elements, 4031 Vinyl, 4033 probe-selects, 4035 Rotor (4039 is Rotor's "nothing listens" port); Planisphere will take 4037. Barometer takes **4041** and uses 4047 for its negative check (4045 is a port Next refuses).
- The brief names `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md`; neither exists in this checkout and `AGENTS.md` holds only the `next dev` block. Decision recorded; the Rotor plan is the template.
- CI (`.github/workflows/ci.yml`): lint, typecheck, `npm test`, build, `test:e2e` against `next start` with Postgres, 15 minutes; production deploys through `vercel build --prod` and `vercel deploy --prebuilt`. `cacheComponents` means Barometer's page is **not** prerendered, so `next build` never calls Open-Meteo; the e2e run does, over the runner's network, which is why the walk accepts either outcome.

## 2. The feed, probed from the pod on 2026-10-20

| What | Result |
| --- | --- |
| `GET https://api.open-meteo.com/v1/forecast?latitude=10.82&longitude=106.63&current=temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation,weather_code&timezone=Asia%2FSaigon` | 200 in 1.0 to 1.1 s (research measured 160 ms from another pod), 570 bytes, `Content-Type: application/json`, no key |
| `current` | `{ time: "2026-10-20T17:30", interval: 900, temperature_2m: 26.9, surface_pressure: 1010.4, wind_speed_10m: 5.3, wind_direction_10m: 336, precipitation: 0.10, weather_code: 51 }` plus `current_units` (°C, hPa, km/h, °, mm, "wmo code") |
| `current.interval` | 900 s: the feed itself moves every 15 minutes, so revalidate 900 matches the data |
| `timezone=<IANA name>` | `current.time` comes back as local wall time with no offset, plus `utc_offset_seconds` and `timezone_abbreviation`; the page shows "17:30 local" straight from it |
| Bad input (`latitude=abc`) | 400 with `{ "error": true, "reason": "Invalid value: …" }`: `parseReading` must treat `error: true` as no reading |
| Several cities in one call (`latitude=a,b,c&longitude=…`) | 200 with a JSON **array**, one object per city; not used (one city per cache entry is simpler), but it is why `parseReading` must reject an array as garbage |
| Pressure at altitude | Mexico City (2,238 m): `surface_pressure` 785.1, `pressure_msl` 1021.7. La Paz (3,767 m): 654.1 and 1020.8. Ho Chi Minh City (7 m): 1010.4 and 1011.2 |
| Terms (`https://open-meteo.com/en/terms`, 200) | Free API for non-commercial use: under 10,000 calls a day, 5,000 an hour, 600 a minute; data under CC BY 4.0 with attribution; `https://open-meteo.com/en/license` and `/en/docs` answer 200 |
| WMO codes the endpoint returns (`/en/docs`) | 0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99 (29 codes; 96 and 99 only from models with a hail forecast) |

Budget: 24 cities, one call per 15 minutes each, is 2,304 calls a day at most per cache, 1.5 % of the hourly limit. Vercel may run more than one function instance with its own in-memory entry; even ten instances stay under the daily limit, and the walk's own calls are a handful.

## 3. The fetch rules, written for this Next.js (the part Drum inherits)

**What was tested.** A throwaway route group `app/(zz)` was built with the repo's real `next.config.ts` (Next 16.4.2, `cacheComponents: true`, `partialPrefetching: true`), served with `next start`, probed with curl, and deleted (the tree is clean). Three shapes:

| Shape | Build | Served HTML | Timing |
| --- | --- | --- | --- |
| A. `searchParams` awaited at the top of the page, no Suspense, no `instant` | **fails**: "Route "/zz/block": Next.js encountered uncached or runtime data during prerendering" | – | – |
| B. `searchParams` awaited inside `<Suspense fallback={quiet}>`, `"use cache"` fetch | ok, route marked ◐ (partial prerender) | the fallback is in the visible HTML; the reading arrives in `<div hidden id="S:0">` with a `$RC` swap script. **No JavaScript means the quiet face for ever** | 1.27 s |
| C. `export const instant = false`, `searchParams` at the top, `"use cache"` `readStation(city)` with `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` and `AbortSignal.timeout(4000)` | ok, route marked ƒ (dynamic) | the reading is inline in `<p id="reading">`; two requests carried the same `fetched=` timestamp (one upstream call); 200 | 0.27 s first, 0.02 s next |
| D. `/zz/[city]` with `generateStaticParams` and a page-level `"use cache"` | ok, ○ static per city; an unlisted city was a 200 App Shell upgraded on the first request | inline, but the reading is baked at build time until revalidate, and a no-JavaScript city `<select>` cannot navigate to a path | 0.005 s |

**Chosen: C.** It is the research's design (`?city=`, unknown city falls back, form submits without JavaScript) with the one export the build message itself names ("[block] Set `export const instant = false` to allow a blocking route"). The page renders on the server per request, which is cheap; the only slow thing, the upstream call, is cached. D would be faster but breaks the no-JavaScript select and bakes a build-time reading. B is the documented default and is wrong for a page that must work before JavaScript.

**The rules, as the plan should state them (research §4.3 rules 1 to 6, revised):**

1. The server fetches, never the browser. `app/(barometer)/_lib/station.ts` is the only file that contains `fetch(` and the only file that contains `api.open-meteo.com`. It exports `readStation(city: CitySlug): Promise<Reading | null>` marked `"use cache"`, which calls `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })` after a good reading and `cacheLife({ stale: 30, revalidate: 60, expire: 300 })` after a failure (one `cacheLife` call per invocation, in different branches, which the `cacheLife` reference allows). So a good reading is shared for 15 minutes and refreshed in the background (stale-while-revalidate up to an hour), and an outage is retried once a minute instead of on every view. `station.ts` imports only `next/cache`; the isolation test lets that one file do so.
2. `barometer/page.tsx` exports `instant = false`, awaits `searchParams`, maps `city` through `cities.ts` (`findCity(slug) ?? CITIES[0]`; the slug never reaches the URL, the city's own `lat`, `lon`, `tz` do), calls `readStation(city.slug)`, and renders the whole page, reading or quiet face, with the credit line. Never a 4xx or 5xx for a bad city or a dead feed.
3. `fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } })`; any throw, non-200, non-JSON or `parseReading` null is the quiet face.
4. `parseReading(json: unknown): Reading | null` is pure and tested on four fixtures: the real 570-byte answer, the same with `pressure_msl: null`, the 400 `{ error: true, reason }` body, and garbage (a string, an array, `{}`). A field missing or non-finite is `null` for the whole reading (the drawing is one instrument, not five).
5. The walk asks for `/barometer`, `/barometer?city=tokyo` and `/barometer?city=nope`, accepts `data-face="reading"` or `data-face="quiet"` on each, and checks the credit link, the words "CC BY 4.0", one `"use client"` file, and that neither the served HTML nor any `/_next/static/chunks/*.js` the page loads contains `api.open-meteo.com`.
6. `_lib/codes.ts` maps all 29 WMO codes to twelve words; `codes.test.ts` asserts every one of the 29 and that an unknown code reads "unsettled".
7. New for the template: no network at build (the route is dynamic, so `next build` never calls the feed), and every live-data page prints the time of its reading ("17:30 local") so a stale cache is visible.

**Code sketch, so the engineer and the walk agree:**

```ts
// app/(barometer)/_lib/station.ts: the only fetch on the project
import { cacheLife } from "next/cache";
import { findCity, type CitySlug } from "./cities.ts";
import { parseReading, type Reading } from "./reading.ts";

const HOST = "https://api.open-meteo.com/v1/forecast";
const FIELDS = "temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,precipitation,weather_code";

export async function readStation(slug: CitySlug): Promise<Reading | null> {
  "use cache";
  const city = findCity(slug);
  const url = `${HOST}?latitude=${city.lat}&longitude=${city.lon}&current=${FIELDS}&timezone=${encodeURIComponent(city.tz)}`;
  let reading: Reading | null = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { accept: "application/json" } });
    reading = res.ok ? parseReading(await res.json()) : null;
  } catch {
    reading = null;
  }
  if (reading) cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  else cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  return reading;
}
```

```tsx
// app/(barometer)/barometer/page.tsx
export const instant = false; // a blocking route: whole HTML per request, works without JavaScript
export default async function BarometerPage({ searchParams }: PageProps<"/barometer">) {
  const p = await searchParams;
  const city = findCity(typeof p.city === "string" ? p.city : "") ?? CITIES[0];
  const reading = await readStation(city.slug);
  return <Station city={city} reading={reading} />; // reading null draws the quiet face
}
```

`Reading` is `{ at: string; temperatureC: number; pressureHpa: number; windKmh: number; windFromDeg: number; rainMm: number; code: number; interval: number }`, plain JSON, so it crosses the cache and the island boundary.

## 4. The page

**What you see.** A wood-grain board in rough.js ink (Orrery's `ink.ts` and `roughjs.d.ts` copied with `SEED = 204`, drawn on the server; the board, rim, scale and instrument bodies are module-level constants so the ink is computed once per process, not per request). On it: a brass-rimmed aneroid dial with Stormy, Rain, Change, Fair, Very Dry around the arc and a black needle; a glass thermometer with a red column; a small wind vane with N, E, S, W; a tin rain cup with a water line. Under the dials, one line: "Ho Chi Minh City, 17:30 local, 26.9 °C, 1011.2 hPa, light drizzle." and the credit "Weather data by Open-Meteo.com, CC BY 4.0" linking `https://open-meteo.com/`. Above, the top bar with `<a href="/">otohime.dev` and `<a href="/projects">← All projects`, the title, and `<form method="get" action="/barometer">` with a `<select name="city">` (page-styled with `appearance: base-select` behind `@supports`, as Vinyl's genre picker) and a "Read" button; the island auto-submits on change.

**Quiet face.** Needle resting at the bottom-left stop, mercury at the bulb, vane at north, cup empty, and the line "The station is quiet. Last reading: 1009.8 hPa on your last visit." when the set hand remembers one, else "The station is quiet." Status 200, `data-face="quiet"`.

**Set hand.** The second brass hand on the dial. "Set" moves it to the needle and stores `{ city, hpa, at }` under `localStorage["barometer.hand"]`; on the next visit the hand sits where you left it, so the dial reads rising or falling at a glance, like the real thing. The island is the only client code: `useReducer(hand)`, the city select's auto-submit, and nothing else. Reduced motion stops the needle's CSS swing.

**Engine (`_lib/`, pure, no React).**

- `cities.ts`: 24 cities `{ slug, name, lat, lon, tz }`, Ho Chi Minh City first; `findCity(slug)`; slugs are `[a-z-]+`. The list: Ho Chi Minh City (10.82, 106.63, Asia/Ho_Chi_Minh), Hanoi (21.03, 105.85), Bangkok (13.76, 100.50, Asia/Bangkok), Singapore (1.35, 103.82), Tokyo (35.68, 139.69), Seoul (37.57, 126.98), Mumbai (19.08, 72.88, Asia/Kolkata), Dubai (25.20, 55.27), Istanbul (41.01, 28.98), Moscow (55.76, 37.62), Berlin (52.52, 13.41), Paris (48.86, 2.35), London (51.51, -0.13), Reykjavik (64.15, -21.94, Atlantic/Reykjavik), Cairo (30.04, 31.24), Lagos (6.52, 3.38), Nairobi (-1.29, 36.82), Cape Town (-33.93, 18.42, Africa/Johannesburg), New York (40.71, -74.01), Mexico City (19.43, -99.13), Los Angeles (34.05, -118.24), São Paulo (-23.55, -46.63), Buenos Aires (-34.60, -58.38), Sydney (-33.87, 151.21). Mexico City is on purpose: the altitude case for `pressure_msl`.
- `codes.ts`: the 29 WMO codes to twelve words: clear (0), mainly clear (1), partly cloudy (2), overcast (3), fog (45, 48), drizzle (51, 53, 55, 56, 57), rain (61, 63, 65, 66, 67, 80, 81, 82), snow (71, 73, 75, 77, 85, 86), thunder (95, 96, 97, 99); `wordFor(code)`; unknown reads "unsettled".
- `dial.ts`: `needleAngle(hpa)` linear from 950 hPa at -135° to 1050 hPa at +135°, 1000 hPa straight up, clamped; the words sit at 955 Stormy, 975 Rain, 1000 Change, 1025 Fair, 1045 Very Dry. `mercuryHeight(c)` -20 to 45 °C to 0 to 1, clamped. `vaneAngle(fromDeg)`: the arrow points into the wind, so the angle is the direction the wind comes from. `cupLevel(mm)`: 0 to 5 mm in the 15-minute interval to 0 to 1, clamped.
- `reading.ts`: `parseReading`, `describe(city, reading) → string` (the one-line sentence, Intl-free, `at` printed as `HH:MM local`).
- `hand.ts`: `STORAGE_KEY = "barometer.hand"`, `normalizeHand(raw) → Hand | null` (as Shore's `normalizeLedger`: never trusts the browser), reducer `set(reading)`, `recall(raw)`, `clear`.
- `station.ts`: §3. `ink.ts`, `roughjs.d.ts`: copies. `words.ts`: Orrery's counter, cap 120 for the explainer.

**Tests.** `dial.test.ts` (950 → -135, 1000 → 0, 1050 → 135, 900 and 1100 clamp, monotonic over 950..1050 step 1; mercury and cup clamp; vane of 0 is 0 and of 336 is 336). `codes.test.ts` (all 29 codes, every code maps to one of the twelve words, unknown → "unsettled"). `reading.test.ts` (four fixtures under `_lib/fixtures/*.json`; `describe` of the real fixture is the exact sentence above; a reading with `error: true` is null). `cities.test.ts` (24, unique slugs, slugs match `/^[a-z-]+$/`, lat in [-90, 90], lon in [-180, 180], `tz` accepted by `Intl.DateTimeFormat`, Ho Chi Minh City first, Mexico City present). `hand.test.ts` (round trip through JSON, garbage → null, `set` then `recall` gives the reading). `station.test.ts` reads `station.ts` as text: it contains `"use cache"`, two `cacheLife(` calls with `revalidate: 900` and `revalidate: 60`, `AbortSignal.timeout(4000)`, and `pressure_msl`; the function is not called (no network in `npm test`). `ink.test.ts`, `words.test.ts` as Orrery's. `isolation.test.ts` as Vinyl's (groups from `app/`), plus: `fetch(` and `api.open-meteo.com` appear in `_lib/station.ts` only; `next/cache` is the only `next` import under `_lib/` and only in `station.ts`; exactly one `"use client"` under `app/(barometer)/`; `localStorage` appears only in the island and `hand.ts` never touches it (it takes the raw string).

**Walk, `scripts/walk-barometer.sh` (port 4041, Vinyl's style, `grep -c`, no `wc -l`).** `/barometer`, `/barometer?city=tokyo`, `/barometer?city=mexico-city` and `/barometer?city=nope` are 200 with the build-sha meta, no `aria-label="Main"`, a `/projects` link, exactly one `data-face=` which is `reading` or `quiet`; when it is `reading`, the pressure in the sentence is between 950 and 1050 (so `pressure_msl` is in use even for Mexico City); `?city=nope` names Ho Chi Minh City; the credit link to `open-meteo.com` and the words `CC BY 4.0` appear once; `<form method="get"` and `<select name="city"` with 24 options; `api.open-meteo.com` appears in none of the served HTML and none of the `/_next/static/chunks/*.js` files the page references; `/projects` links `/barometer` once; the explainer is at most 120 words. Negative: `BASE_URL=http://127.0.0.1:4047` exits non-zero.

## 5. Plan shape (for the product owner)

```
app/(barometer)/
  layout.tsx                  own <html>, barometer.css, Orrery's two next/font/google calls, build-sha meta, themeColor #2b1d14 (dark wood) with a light scheme too
  barometer.css               tokens (brass, wood, cream dial, light/dark via prefers-color-scheme and the localStorage.theme pin), dial, thermometer, vane, cup, form, top bar, @media (prefers-reduced-motion: reduce)
  barometer/page.tsx          instant = false; searchParams → city → readStation → <Station>; credit; <HandApp>
  _components/station.tsx     server SVG: board, dial, needle at needleAngle, set hand, thermometer, vane, cup, sentence, quiet face
  _components/hand-app.tsx    the one "use client" island: set hand + city auto-submit
  _lib/ cities.ts codes.ts dial.ts reading.ts hand.ts station.ts ink.ts roughjs.d.ts words.ts fixtures/*.json *.test.ts
scripts/walk-barometer.sh · content/site.ts · lib/build-stamp.test.ts · e2e/rbac.test.ts · package.json · README.md
```

Tasks, in the Rotor plan's form (each with `verification[]`):

1. **Engine and fixtures** (software_engineer, `qa: skip`): `_lib/` with every test above, the four fixtures captured from the live feed by the engineer with the exact URL in a comment, the `npm test` glob, the README test line. Verification: `npm ci && npm run lint && npm run typecheck && npm test`; the five `node --test` files by name; `grep -c 'fetch(' app/(barometer)/_lib/*.ts` equals 1 and it is `station.ts`; `grep -q pressure_msl app/(barometer)/_lib/station.ts`; `grep -q '"97"\|\b97\b' app/(barometer)/_lib/codes.test.ts`; `! grep -rn '"use client"' app/(barometer)/_lib`; `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`.
2. **The page, the island and the walk** (software_engineer, QA required; depends on 1): layout, CSS, page with `instant = false`, `station.tsx`, `hand-app.tsx`, `content/site.ts` row `{ title: "Barometer", note: "A brass weather station for your city, read every quarter hour.", href: "/barometer", status: "live", colour: "blue" }`, build-stamp and rbac tests, the walk, README. Verification: the usual four; `bash -n scripts/walk-barometer.sh && ! grep -nE 'wc +-l' scripts/walk-barometer.sh`; `bash scripts/walk-barometer.sh`; `if curl -s -o /dev/null --max-time 2 http://localhost:4041/; then exit 1; fi`; `if BASE_URL=http://127.0.0.1:4047 bash scripts/walk-barometer.sh; then exit 1; fi`; `grep -q 'export const instant = false' app/(barometer)/barometer/page.tsx`; `test "$(grep -rln '"use client"' 'app/(barometer)' | grep -c .)" -eq 1`; `! grep -rn 'api.open-meteo.com' app/(barometer) --include=*.tsx`; `grep -q 'href: "/barometer"' content/site.ts && grep -q '/barometer' e2e/rbac.test.ts`.
3. **The quiet face under a dead feed, proven on demand** (software_engineer, `qa: skip`; depends on 2): a `scripts/walk-barometer.sh` mode `QUIET=1` that starts the server with `BAROMETER_HOST=http://127.0.0.1:9` (a `station.ts` override read once at module load, default the real host, allowed by the isolation test only in `station.ts`) and asserts `data-face="quiet"`, 200, the credit line, and the response under 5 s; and the same with `BAROMETER_HOST` pointing at a one-line Node server that sleeps 10 s, proving the 4 s timeout. No waiting for a real outage. Verification: `QUIET=1 bash scripts/walk-barometer.sh` and the timeout variant, both exit 0.

QA (task 2) in headless Chrome at 1366×768, 390×844 and 320×640, light and dark, motion on and off: the needle, hand and sentence agree with the fixture pressure; the city select changes the reading without JavaScript (submit) and with it (auto-submit); "Set" survives a reload; Tab reaches every control with a visible ring; nothing scrolls sideways at 320 px; `/projects` shows the row; no console errors; Lighthouse accessibility ≥ 95. Acceptance walks production with `BASE_URL=https://otohime.dev bash scripts/walk-barometer.sh`, then checks a reading's time is within the last 30 minutes of the city's local clock (the cache's visible proof), and files the Drum idea pointing at research.md §5 with "the Barometer fetch rules, §3 of pm-204's research".

## 6. Risks and what to record

- **The cache on Vercel.** `"use cache"` entries live in memory per function instance unless a cache handler is configured; a cold instance makes one upstream call per city it is asked for. The budget in §2 covers that many times over, and the page shows the reading's time, so staleness is visible rather than silent.
- **Terms change or outage.** The quiet face and the 60-second retry life bound both; the credit line is the attribution the licence asks for. If the owner later wants no third party at all, Drum's USGS feed is public domain with the same rules.
- **Fonts.** Orrery's Google fonts build in CI already; the same two calls are reused.
- **Rebase conflicts** with pm-202 and Planisphere on the five shared files: keep both sides.
- Lesson recorded (global): under `cacheComponents`, `searchParams` outside Suspense fails the build; `instant = false` is the escape for a page that must be whole without JavaScript; research.md §4.2's `force-dynamic` for Planisphere is void for the same reason and should use the same export.

## 7. Sources checked on 2026-10-20

- Open-Meteo forecast endpoint (200, 1.0 s, 570 bytes), `/en/terms` (200: non-commercial, 10,000 a day, 5,000 an hour, 600 a minute), `/en/license` (200), `/en/docs` (200: the WMO table with 29 codes).
- Repo at a937f40: `next.config.ts` (`cacheComponents: true`), `app/(vinyl)/_lib/isolation.test.ts`, `app/(orrery)/layout.tsx`, `scripts/walk-vinyl.sh`, `e2e/rbac.test.ts`, `lib/build-stamp.test.ts`, `content/site.ts`, `.github/workflows/ci.yml`, `projects/research-and-design-more-projects-into-the-app/{research,plan}.md`.
- Next 16.4.2 docs in `node_modules/next/dist/docs/01-app/`: `03-api-reference/05-config/01-next-config-js/cacheComponents.md`, `03-api-reference/01-directives/use-cache.md`, `03-api-reference/04-functions/cacheLife.md` (one `cacheLife` per invocation, branches allowed; prerender thresholds), `03-api-reference/03-file-conventions/02-route-segment-config/{index,instant}.md` (`dynamic`/`revalidate`/`fetchCache` removed; `instant`), `01-getting-started/08-caching.md`, `02-guides/incremental-static-regeneration-cache-components.md`.
- The throwaway build `app/(zz)` (three pages, `next build` + `next start -p 4099`, curl), deleted afterwards; `git status` clean.
