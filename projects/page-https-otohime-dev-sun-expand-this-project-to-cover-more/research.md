# Research: expand /sun into a renamed solar-system and stars project (pm-199, run-6671)

Submitted as rep-3794 by the research run; committed here by the product owner (run-6677).

**Idea.** Page https://otohime.dev/sun. Expand this project to cover more stars and the planets of the solar system. Rename the project and the URL.

**Short answer.** Rename Sun to **Orrery** at `/orrery`. Keep the Sun poster's recipe (one page per body, a hand-drawn cutaway with numbered layers, one-line callouts, four stat badges, cream paper, at most 220 visible words) and apply it to fourteen bodies: the Sun, the eight planets and five other stars. `/orrery` becomes the index poster (two size rows: the planets beside the Sun's edge, the stars beside the Sun), `/orrery/<body>` is one poster per body, prerendered, and `/sun` answers a 308 to `/orrery/sun` so old links keep working. Numbers come from the NASA planetary fact sheet and Wikipedia star infoboxes, which fit the existing rule that a source must be on nasa.gov or wikipedia.org. Everything below was checked against the repo at 1bafcf6 and the live page at build-sha 1bafcf6e8b146a45ea0c06b80bac73e22526052d on 2026-10-20.

## 1. What is there today (pm-189, shipped at 3bf61ea; live at 1bafcf6)

- `app/(sun)/` is its own root layout (Caveat and Patrick Hand through `next/font/google`, `sun.css`, `build-sha` meta, theme colour `#f6f1e7`). `sun/page.tsx` is a server component with no client JavaScript: title, the cutaway (`_components/stage.tsx`), six callouts, four badges, a three-step life strip and a credit line. Live HTML is 200 KB, almost all rough.js path data (78 `<path>` elements).
- Data: `_lib/sun.ts` (`LAYERS` with `from`/`to`/`tempK`/`colour`, `SOURCES`, `LIGHT_SECONDS`, `PHOTON_YEARS`), `_lib/poster.ts` (`CALLOUTS`, `BADGES`, `LIFE`, `TITLE`, `TAGLINE`, `FOOTER`, `EARTH_LABEL`, each item with a `source` key), `_lib/format.ts` (`kelvin`, `km`, `years`, `lightTime`), `_lib/words.ts` (`WORD_CAP = 220`, `visibleWords`, `textWords`), `_lib/ink.ts` (rough.js on the server, FNV-1a seed per shape name; the only file that imports roughjs).
- Tests pin: layer tiling and temperature order (`sun.test.ts`), the sourced words and a 170-word data budget (`poster.test.ts`), deterministic ink with a SHA-256 snapshot (`ink.test.ts`), the word counter (`words.test.ts`), the motion read from `stage.tsx` and `sun.css` as text: exactly six `data-layer` groups in `LAYERS` order, exactly three `data-loop` groups, four keyframes, reduced motion off, the still is the whole drawing (`motion.test.ts`), and import isolation (`isolation.test.ts`).
- `stage.tsx` is Sun-specific: the quarter cut, the atmosphere drawn thicker than true scale, two sunspots, corona rays, two convection cells, the photon walk, four wind streams, Earth at 1/109 with "Earth, to scale". It takes no props.
- `scripts/walk-sun.sh` (port 4027, `BASE_URL` mode) checks 40 things on `/sun` and the site, including the word cap on the served HTML and that `/sun/nope` is the "Nothing in this parcel" 404.

### Everything a rename touches (outside `app/(sun)/`)

| Where | What refers to Sun |
| --- | --- |
| `content/site.ts:93` | the Projects row `{ title: "Sun", href: "/sun", note: "Our star, cut open and drawn by hand." }` |
| `package.json:18` | `npm test` globs `app/(sun)/_lib/*.test.ts` |
| `lib/build-stamp.test.ts:41` | reads `app/(sun)/layout.tsx` for the `build-sha` meta |
| `e2e/rbac.test.ts:88,109` | `/projects` links `/sun`; `/sun` is 200 without the sidebar and links `/projects` |
| `app/(elements)/_lib/isolation.test.ts:33,107` and `app/(vinyl)/_lib/isolation.test.ts:39,145` | `(sun)` in the list of route groups nobody may import |
| `app/(capsule)/_lib/art/ink.ts:2` and `roughjs.d.ts:1` | comments only ("a copy of app/(sun)/_lib/ink.ts") |
| `scripts/walk-sun.sh` | the whole walk |
| `scripts/walk-elements.sh:267,317,321` and `scripts/walk-vinyl.sh:278,334,337` | `/sun` returns 200 and `/projects` links it |
| `README.md:36-40,97,125,127` | the layout block and the test and walk notes |
| `.github/workflows/ci.yml` | nothing by name; it runs lint, typecheck, `npm test`, build and `test:e2e` |

No `redirects()` exists in `next.config.ts` yet. `/orrery`, `/cosmos`, `/sky`, `/planets`, `/system`, `/solar`, `/space` and `/stars` all 404 on the live site today, so any of them is free.

## 2. Recommendation

### Name and URL: Orrery at `/orrery`

An orrery is a hand-built mechanical model of the Sun and planets, which is what this page becomes: a hand-drawn model of the solar system and a few stars beyond it. It is one word like every other project (Shore, Capsule, Sun, Elements, Vinyl), it is not generic ("Space", "Cosmos") and it does not exclude the stars ("Planets", "Solar"). The Projects row becomes `{ title: "Orrery", note: "The Sun, the planets and five stars, cut open and drawn by hand.", href: "/orrery" }`. The route group moves with `git mv app/(sun) app/(orrery)` and the stylesheet becomes `orrery.css`, so the file names stop lying.

`/sun` keeps working: add `redirects()` to `next.config.ts` with `{ source: "/sun", destination: "/orrery/sun", permanent: true }` (a 308; Next.js redirects doc: https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects). Vercel honours `next.config.ts` redirects, so no `vercel.json`. Keep `/sun/:path*` out of the redirect so `/sun/nope` stays a plain 404.

### Pages

| URL | What | Rendered |
| --- | --- | --- |
| `/orrery` | the index poster: title, two hand-drawn size rows, one tile per body linking its poster, credit | static |
| `/orrery/<body>` | one poster per body, fourteen in all: `sun`, `mercury`, `venus`, `earth`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `proxima-centauri`, `sirius`, `vega`, `polaris`, `betelgeuse` | prerendered with `generateStaticParams`, `ensureStatic = "navigation"`, unknown slug calls `notFound()` (the Elements pattern in `app/(elements)/elements/[symbol]/page.tsx`) |
| `/sun` | 308 to `/orrery/sun` | redirect |

A `[body]` segment under the route group needs `app/(orrery)/not-found.tsx` (as Elements has) so an unknown body gets "Nothing in this parcel" with a 404 under Orrery's own root layout.

Each body poster keeps the Sun's parts: title and tagline, a cutaway with numbered layers (3 to 6 per body), one callout per layer, four badges, one strip, a credit line that links the body's sources, plus the top bar (home, "All projects") and a "← Orrery" link, and Previous / Next links in orbit order (then the stars in distance order), like Elements' element pages. The 220-word cap applies to every page, counted by the same `visibleWords`.

The Sun poster at `/orrery/sun` stays exactly the page that passed pm-189's acceptance (same `stage.tsx`, same words, same three loops). It only moves.

### The index poster's two rows

True scale across the whole set is impossible on one row (Betelgeuse is about 5,000 Earths wide and Mercury 0.38). Two rows, each honest at its own scale, with an "edge" arc for what does not fit, as the Sun poster already does with "Earth, to scale":

1. **The planets** at one scale, Jupiter about 220 px wide on a desktop: Mercury 0.38, Venus 0.95, Earth 1, Mars 0.53, Jupiter 11.2, Saturn 9.45 (with rings), Uranus 4.0, Neptune 3.9 Earth diameters (NASA fact sheet). The Sun's limb is an arc on the left edge at the same scale (109 Earths), labelled "the Sun's edge, to scale".
2. **The stars** at one scale, the Sun as a 1: Proxima Centauri 0.15, the Sun 1, Sirius A 1.71, Vega 2.7 (equatorial), then Polaris 46 and Betelgeuse about 764 as arcs with "Polaris would reach here" and "Betelgeuse would fill the page".

Hatching 14 bodies on one page would make the index heavy (the Sun's cutaway alone is 200 KB of paths). On the index draw each body as a rough outline with a solid wash and no hachure, and keep hachure for the posters.

### Which stars, and why these five

| Star | Why | Class, R, M, T, distance (Wikipedia infobox, fetched 2026-10-20) |
| --- | --- | --- |
| Proxima Centauri | the nearest star; a fully convective red dwarf, so its cutaway has no radiative zone | M5.5Ve, 0.154 R☉, 0.122 M☉, 2,992 K, 4.2 ly |
| Sirius A | the brightest star in the night sky; its white-dwarf companion Sirius B (0.0081 R☉, 25,000 K) is the Sun's own ending drawn beside it | A0mA1 Va, 1.714 R☉, 2.06 M☉, 9,845 K, 8.6 ly |
| Vega | the summer-sky anchor; an A star spinning so fast it is flattened (2.73 equatorial vs 2.42 polar R☉) | A0Va, 2.73 R☉, 2.15 M☉, 10,070 K polar / 8,910 K equatorial, 25 ly |
| Polaris | the North Star; a Cepheid supergiant that pulses, 46 Suns across | F7Ib, 46.3 R☉, 5.13 M☉, 6,015 K, 447 ly |
| Betelgeuse | the red supergiant; a star near the end, shell burning around a helium core, 764 Suns across | M1-M2 Ia-ab, about 764 R☉, 14 M☉, 3,779 K, about 548 ly |

Alpha Centauri A (1.22 R☉, 5,748 K) is a near copy of the Sun and would read as a repeat; Rigel (74 R☉, 12,100 K, a blue supergiant) is the natural sixth if the product owner wants one more. Keep v1 at five.

Star cutaways by structure (sourced to each star's Wikipedia page and NASA's star overview https://science.nasa.gov/universe/stars/): Proxima: core, convection zone, photosphere (fully convective). Sun: as today. Sirius A and Vega: convective core, radiative envelope, photosphere (the Sun's layers in the opposite order, which is the lesson of the page). Polaris: helium-burning core, hydrogen shell, pulsing envelope, photosphere. Betelgeuse: helium core, hydrogen-burning shell, a convective envelope that is most of the star, a loose photosphere.

### The planets' numbers (NASA planetary fact sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/, fetched 2026-10-20)

| Body | Diameter km (Earths) | Day (length of day, h) | Year (days) | Mean T (°C) | Moons | Light from the Sun |
| --- | --- | --- | --- | --- | --- | --- |
| Mercury | 4,879 (0.38) | 4,222.6 | 88.0 | 167 | 0 | 3 min 13 s |
| Venus | 12,104 (0.95) | 2,802.0 | 224.7 | 464 | 0 | 6 min 1 s |
| Earth | 12,756 (1) | 24.0 | 365.2 | 15 | 1 | 8 min 19 s |
| Mars | 6,792 (0.53) | 24.7 | 687.0 | -65 | 2 | 12 min 41 s |
| Jupiter | 142,984 (11.2) | 9.9 | 4,331 | -110 | 95 | 43 min 17 s |
| Saturn | 120,536 (9.45) | 10.7 | 10,747 | -140 | 274 | 1 h 19 min |
| Uranus | 51,118 (4.0) | 17.2 | 30,589 | -195 | 28 | 2 h 39 min |
| Neptune | 49,528 (3.9) | 16.1 | 59,800 | -200 | 16 | 4 h 11 min |

Light times are distance from the Sun on the sheet divided by 299,792 km/s, the same arithmetic as `LIGHT_SECONDS = 499` today, so one `lightTime()` badge works for every planet ("Light from the Sun takes…"). Moon counts differ between sources (the sheet says Uranus 28, Wikipedia 29), so every badge cites exactly one source and the planets use the sheet. The sheet's per-planet pages (`.../factsheet/marsfact.html` and the rest) and https://science.nasa.gov/<planet>/facts/ all answer 200 and are the second NASA source per planet.

Planet cutaways (Wikipedia per planet, fetched 2026-10-20): Mercury: crust, mantle, iron core of about 2,020 km in a 2,440 km radius (57 % of its volume). Venus: crust, mantle, core, inferred from Earth's. Earth: crust, mantle, outer core, inner core, plus an atmosphere layer. Mars: crust 42 to 56 km, mantle, a partly molten core of about 1,650 to 1,675 km, half the radius. Jupiter: cloud tops, molecular hydrogen, metallic hydrogen, a diffuse core. Saturn: the same with a diffuse core reaching 60 % of the way out. Uranus and Neptune: hydrogen and helium envelope, an icy mantle of water, ammonia and methane (10 to 15 Earth masses on Neptune), a rocky core.

### Data shapes

```ts
// _lib/bodies.ts (grows out of sun.ts; sun.ts keeps LAYERS, SOURCES, LIGHT_SECONDS, PHOTON_YEARS as the Sun's entry)
type BodyKind = "star" | "planet";
type Body = {
  slug: string; name: string; kind: BodyKind;
  radiusKm: number;                 // for the index rows and "to scale" labels
  layers: readonly Layer[];         // Layer as today; from/to fractions of R inside, km above R outside
  sources: Record<string, { name: string; url: string }>;   // nasa.gov or wikipedia.org only
  poster: { title: string; tagline: string; callouts: Callout[]; badges: Badge[]; strip: Strip; footer: string };
};
export const BODIES: readonly Body[];   // orbit order, then the stars by distance
```

`Layer` keeps its shape, so the generic cutaway (`_components/cutaway.tsx`, a server component taking a `Body`) draws any body: a quarter cut for the interior fractions, rings for atmosphere layers, one pen (colour, hachure angle, gap) per layer from the data, pins 1 to n, and an "Earth, to scale" or "the Sun, to scale" dot. The Sun keeps `stage.tsx` for its loops. Saturn's rings and Jupiter's bands are extra marks on the body, like the Sun's sunspots.

### Tests and the walk

- `bodies.test.ts`: for every body the interior layers tile `[0, 1]`, the atmosphere is contiguous, every source is https on nasa.gov or wikipedia.org, every poster item names one of the body's sources, each poster's data words are at most 170 (`textWords`), slugs are unique and `/^[a-z-]+$/`, exactly 14 bodies, 9 in the solar system and 6 stars (the Sun counts in both).
- `motion.test.ts`: the Sun's checks stay; the generic draw-on rule is `[data-layer] path` so it already covers every poster; the loops stay Sun-only.
- `ink.test.ts`, `words.test.ts` unchanged. `isolation.test.ts` renamed paths. Elements' and Vinyl's isolation tests swap `(sun)` for `(orrery)`.
- `scripts/walk-orrery.sh` (from `walk-sun.sh`): `/orrery` 200, 14 `data-body` tiles, two `data-row` rows, word cap; `/orrery/sun` the 40 Sun checks as today; `/orrery/jupiter` and `/orrery/betelgeuse` 200 with their layer and badge counts and the cap; `/orrery/nope` 404 "Nothing in this parcel"; `/sun` returns 308 with `location: /orrery/sun` (curl `-o /dev/null -w '%{http_code} %{redirect_url}'`); `/projects` links `/orrery` once and `/sun` never. `walk-elements.sh` and `walk-vinyl.sh` swap `/sun` for `/orrery`; `e2e/rbac.test.ts` swaps the Sun test for Orrery and adds the redirect check (`fetch` with `redirect: "manual"`).

### Split

1. **Data and the generic cutaway, `qa: skip`.** `bodies.ts` with all 14 bodies and their posters, `cutaway.tsx`, tests. Adds files only; `/sun` keeps building.
2. **The rename and the pages, QA required.** `git mv` the route group, `/orrery` index with the two rows, `/orrery/[body]`, `not-found.tsx`, the redirect, `walk-orrery.sh`, the site row, the other walks and e2e, README. QA in headless Chrome at 1366x768 and 390x844: the index rows, one planet, one star, the Sun unchanged, the redirect.
3. **Art and motion per body, QA required.** Saturn's rings, Jupiter's bands, Earth's clouds and the stars' marks; optionally one loop per planet (a slow spin of the bands) and the drawn-on index. Not needed for the cut.

## 3. Risks and notes

- **Page weight.** The Sun's HTML is 200 KB of path data. Fourteen prerendered posters are fine as separate pages, but the index must not hatch 14 bodies; outline plus wash keeps it under about 100 KB. Measure in the walk (`size_download`) and cap it.
- **Scale honesty.** Two rows with two scales need their "to scale" labels and the edge arcs, or the page lies the way the old tour was careful not to. Atmospheres and crusts are drawn thicker than true (Earth's crust is 0.5 % of R), and the callouts carry the real thicknesses, as the Sun poster does today.
- **Word cap per page.** The index has 14 names, two row labels and two edge labels; that is about 60 words before any callouts, so the index carries no callouts, only names, a tagline and the credit.
- **Redirect.** `permanent: true` is a 308 and browsers cache it; the destination must be final before it ships. Keep `app/(orrery)/sun/` out of the tree so `/sun` is only ever the redirect.
- **Rename churn.** A `git mv` keeps history; the test globs in `package.json`, the four tests that name `(sun)` by path and the three walks are the places a missed rename fails CI. `npm test` and `npm run build` catch all of them.
- **Fonts.** `next/font/google` already builds on Vercel for this route group; the move does not change it.
- **The Wikipedia star numbers** come with uncertainty ranges (Betelgeuse's radius is 640 to 764 R☉). Posters say "about" and cite the page; the test pins order, not values.
- The named plan document `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` and `docs/claude/software-development.md` are not in the repo; `AGENTS.md` and pm-189's plan were used. `node_modules` is not installed on this pod, so the Next docs it points to were read online.

## Sources

- Repo at 1bafcf6: `app/(sun)/**`, `scripts/walk-sun.sh`, `scripts/walk-elements.sh`, `app/(elements)/elements/[symbol]/page.tsx`, `content/site.ts`, `e2e/rbac.test.ts`, `next.config.ts`; `projects/page-https-otohime-dev-sun-redesign-this-project-feedback-1/{research,plan,acceptance_report_0}.md`.
- Live: https://otohime.dev/sun at build-sha 1bafcf6e8b146a45ea0c06b80bac73e22526052d (200 KB); the eight candidate URLs above return 404.
- NASA planetary fact sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/ and the per-planet sheets; NASA planet facts https://science.nasa.gov/solar-system/planets/ (each `/<planet>/facts/` answers 200); NASA stars https://science.nasa.gov/universe/stars/
- Wikipedia (infobox fields fetched with `action=raw`): https://en.wikipedia.org/wiki/Proxima_Centauri, /Sirius, /Vega, /Polaris, /Betelgeuse, /Alpha_Centauri, /Rigel; planet interiors from /Mercury_(planet), /Venus, /Earth, /Mars, /Jupiter, /Saturn, /Uranus, /Neptune
- Next.js redirects: https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects
