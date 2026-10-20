# Orrery: the Sun, the planets and five stars, drawn by hand (pm-199)

**Idea.** "Page: https://otohime.dev/sun. Expand this project to cover more
stars, planets in the solar system. Rename the project and url."

**Product.** Sun becomes **Orrery** at `otohime.dev/orrery`. An orrery is a
hand-built model of the Sun and its planets. This one is hand-drawn and also
holds a few stars beyond our own. The pm-189 poster recipe that passed
acceptance stays the same: cream paper, hand lettering, one rough-inked cutaway
with numbered layers, one callout per layer, four stat badges, a one-line
credit, at most 220 visible words, no buttons and no client JavaScript. That
recipe now covers fourteen bodies:

- the **Sun** (the pm-189 poster, unchanged, now at `/orrery/sun`);
- the eight **planets**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus,
  Neptune;
- five **stars**: Proxima Centauri (the nearest), Sirius (the brightest),
  Vega (spun flat), Polaris (the North Star, a pulsing supergiant) and
  Betelgeuse (a red supergiant near its end).

`/orrery` is the index poster. It has one tile per body. Two hand-drawn size
rows each keep a true scale of their own: the planets beside the Sun's edge,
and the stars beside the Sun. The planets come in orbit order, then the stars
by distance. Every poster has Previous / Next links in that order. `/sun`
answers a **308 to `/orrery/sun`**, so old links still work.

Research: [research.md](research.md) (run-6671, rep-3794), checked against the
repo and the live site at 1bafcf6.

## Decisions

| Decision | Why |
| --- | --- |
| Name **Orrery**, URL **`/orrery`**, posters at **`/orrery/<slug>`**. The route group moves with `git mv app/(sun) app/(orrery)`; `sun.css` becomes `orrery.css`; `scripts/walk-sun.sh` becomes `scripts/walk-orrery.sh`. | One word like every other project. It is not generic ("Space") and it does not leave out the stars ("Planets"). `/orrery` is free on the live site. `git mv` keeps the history. |
| `next.config.ts` gets `async redirects()` with one entry: `{ source: "/sun", destination: "/orrery/sun", permanent: true }` (a 308). The exact path only: `/sun/nope` stays the site's plain 404. Nothing under `app/(orrery)/` may serve `/sun`. | The Next 16 guide (`node_modules/next/dist/docs/01-app/02-guides/redirecting.md`) says `redirects` in `next.config` answer 307 or 308 before any route renders, and Vercel honours them. A 308 is cached by browsers, so the target is final: `/orrery/sun` is the Sun's address for good. |
| Slugs and order are fixed: `sun, mercury, venus, earth, mars, jupiter, saturn, uranus, neptune, proxima-centauri, sirius, vega, polaris, betelgeuse`. | The Sun first, then the planets in orbit order, then the stars by distance from us. This one order serves the index, the Previous / Next links and the tests. |
| Five stars, no more in v1. | Alpha Centauri A is a near copy of the Sun. Rigel can be a later sixth. Five stars cover the main kinds: red dwarf, A star, fast rotator, Cepheid supergiant and red supergiant. |
| The Sun's poster moves **unchanged**: same `stage.tsx`, same words, same three loops, same `motion.test.ts`. It gains the "← Orrery" link and Previous / Next only. | It passed pm-189 acceptance. Every other body uses a generic cutaway; the Sun keeps its own stage. |
| One data module, `_lib/bodies.ts`, holds all fourteen bodies. The Sun's entry is **built from** `sun.ts` and `poster.ts`, not copied, so nothing about the Sun moves. Layer ids are strings per body; `Layer` keeps its shape (`from`/`to` are fractions of R inside, km above R outside). | One shape for every poster, one test over all of them, and the Sun's own files and tests stay valid. |
| The cutaway geometry is a **pure `.ts` module** (`_lib/cutaway.ts`) that returns inked paths per layer. A thin server component (`_components/cutaway.tsx`) only maps it to SVG. | `npm test` runs `node --experimental-strip-types`, which cannot import `.tsx`. With the geometry in `.ts`, a unit test can prove every body's drawing (layer count, order, no NaN, inside the viewBox, deterministic). |
| True fractions go in the data. The drawing gives every band at least `MIN_BAND = 0.06` of R and shrinks the others to fit. Callouts state the real thickness ("crust 35 km thin"). | Earth's crust is 0.5 % of R and would not show. The Sun poster already draws its atmosphere thicker than true. Only the text has to be exact. |
| Every poster has a "to scale" comparison drawn at a true ratio, at least 2 px in radius: Earth beside planets, the Moon beside Earth, Jupiter beside Proxima Centauri, the Sun beside Sirius, Vega and Polaris, and **Earth's orbit** (1 AU = 215 R☉) inside Betelgeuse. | A true scale is the cheapest wow on the page, and it worked on the Sun poster. Beside Betelgeuse the Sun would be a dot of 0.3 px, so the orbit arc shows its size instead. |
| Badges by kind. **Planets:** across (in Earths; Earth gives "12,756 km"), a day, a year, light from the Sun (`lightTime`). **Stars:** across (in Suns), distance in light years, surface temperature in K, mass in Suns. **Stars** also get a three-step life strip; planets have none. The Sun keeps its four badges and its strip. | Each fact is on the NASA fact sheet or a Wikipedia infobox. Moons and mean temperature can go in callouts. Life stages are the story of a star; a planet does not have one. |
| Sources stay on **nasa.gov or wikipedia.org**, https only. Each body has its own `sources` record, and every poster item names one key of it. Planets cite the NASA fact sheet for numbers. Stars cite their Wikipedia page and `science.nasa.gov/universe/stars/`. | This is pm-188's provenance rule. Moon counts differ between sources, so each item cites exactly one. |
| Word cap **220 per page**, counted by the existing `visibleWords` on the served HTML. Each poster's data words stay at or under 170 (`textWords`). The index has no callouts. | It is the same rule as pm-189, applied to every page, including the index and its 14 names. |
| Page weight is capped in the walk: the index at most **120,000 bytes** (`size_download`), each poster at most **300,000**. Index bodies are a rough outline with a solid wash, never hachure. | The Sun alone is 200 KB of paths. Hatching fourteen bodies on one page would be about 1 MB. |
| Each delivery commit is authored and committed as `Otohime <quiinthieu@gmail.com>`. Set the four `GIT_AUTHOR_*` / `GIT_COMMITTER_*` variables on `git commit` **and** `git push`. | Vercel Hobby deploys only the owner's commits (pm-189). |
| Four tasks, in sequence: (1) data and geometry, `qa: skip`, adding files under `app/(sun)/_lib/` only; (2) the rename, the posters, a plain index, the redirect and the walk; (3) the index's true-scale rows; (4) the marks that make each body recognisable. | Every push leaves a working site. Task 1 changes nothing a person sees. Task 2 is the first visible change and carries QA in a browser. The scale rows and the marks are judged on their own. |
| No task needs a person or a runtime. The proof is the walk on a local `next start`, the unit tests, and QA in headless Chrome. | There is nothing to wait for. |

## The pages

| URL | What | Rendered |
| --- | --- | --- |
| `/orrery` | Title "Orrery", a tagline, one `data-body="<slug>"` tile per body linking its poster, two rows (`data-row="planets"`, `data-row="stars"`), credit | static |
| `/orrery/<slug>` | one poster per body | prerendered with `generateStaticParams`, `export const ensureStatic = "navigation"`, unknown slug calls `notFound()` (the `app/(elements)/elements/[symbol]/page.tsx` pattern) |
| `/orrery/nope` | `app/(orrery)/not-found.tsx`: 404, "Nothing in this parcel", a link back to `/orrery` | 404 |
| `/sun` | 308, `location: /orrery/sun` | redirect |

A body poster, top to bottom, uses the Sun's grid and CSS:

1. Top bar: `otohime.dev`, "← All projects", "← Orrery" (`href="/orrery"`).
2. Title and tagline from the data.
3. The cutaway: `viewBox="0 0 640 600"`, one `<g data-layer="<id>">` per layer
   (3 to 6), a quarter cut, number pins 1..n, the to-scale comparison and its
   label, `role="img"` and an `aria-label` naming the layers. Every ink path
   has `pathLength="1"`, so the existing draw-on rule in the stylesheet
   applies.
4. `<ol data-callouts>` with one `<li data-callout="<id>">` per layer.
5. Four `<li data-badge>`.
6. Stars only: `<ol data-life>` with three stages.
7. Previous / Next (`<nav aria-label="Other bodies">`) and the credit line,
   which links the body's sources.

### Layers per body (ids in drawing order, inside out)

Source each value from the body's page. The test pins order and tiling, not
the numbers. The fractions are guidance from the research.

| Body | Interior (fractions of R) | Atmosphere (km above R) |
| --- | --- | --- |
| Mercury | `core` 0–0.83, `mantle` –0.98, `crust` –1 | none |
| Venus | `core` 0–0.5, `mantle` –0.99, `crust` –1 | `clouds` 0–70 |
| Earth | `inner-core` 0–0.19, `outer-core` –0.55, `mantle` –0.995, `crust` –1 | `atmosphere` 0–100 |
| Mars | `core` 0–0.49, `mantle` –0.985, `crust` –1 | none |
| Jupiter | `core` 0–0.2, `metallic-hydrogen` –0.8, `molecular-hydrogen` –1 | `cloud-tops` 0–50 |
| Saturn | `core` 0–0.6 (diffuse), `metallic-hydrogen` –0.85, `molecular-hydrogen` –1 | `cloud-tops` 0–60 |
| Uranus | `core` 0–0.2, `icy-mantle` –0.75, `envelope` –1 | none |
| Neptune | `core` 0–0.25, `icy-mantle` –0.8, `envelope` –1 | none |
| Proxima Centauri | `core` 0–0.3, `convective` –1 | `photosphere` |
| Sirius | `convective-core` 0–0.15, `radiative` –1 | `photosphere` |
| Vega | `convective-core` 0–0.15, `radiative` –1 | `photosphere` |
| Polaris | `core` 0–0.05, `shell` –0.1, `envelope` –1 | `photosphere` |
| Betelgeuse | `helium-core` 0–0.01, `shell` –0.05, `convective` –1 | `photosphere` |

Each body has 3 to 6 layers. The Sun keeps its six.

### Data shapes

```ts
// app/(orrery)/_lib/bodies.ts   (task 1 writes it as app/(sun)/_lib/bodies.ts)
import { LAYERS, SOURCES } from "./sun.ts";
import { BADGES, CALLOUTS, LIFE, TAGLINE, TITLE, FOOTER } from "./poster.ts";
export type BodyKind = "star" | "planet";
export type BodyLayer = { id: string; name: string; region: "interior" | "atmosphere";
  from: number; to: number; colour: string; tempK?: [number, number] };
export type Source = { name: string; url: string };
export type BodyCallout = { layer: string; n: number; text: string; source: string };
export type BodyBadge = { big: string; small: string; source: string };
export type Stage = { id: string; label: string; note?: string; source: string };
export type Comparison = { label: string; radiusKm: number; shape: "dot" | "orbit" };
export type Body = {
  slug: string; name: string; kind: BodyKind;
  radiusKm: number;              // equatorial; R☉ = 695,700 km
  layers: readonly BodyLayer[];
  sources: Record<string, Source>;
  compare: Comparison;           // the "to scale" mark
  poster: { title: string; tagline: string; callouts: readonly BodyCallout[];
            badges: readonly BodyBadge[]; life?: readonly Stage[]; footer: string };
};
export const SUN_RADIUS_KM = 695_700;
export const BODIES: readonly Body[];                  // 14, in the fixed order
export function bodyBySlug(slug: string): Body | undefined;
export function neighbours(slug: string): { prev?: Body; next?: Body };
export const ORRERY = { title: "Orrery", tagline: string, footer: string };

// app/(orrery)/_lib/cutaway.ts   (pure; imports ./ink.ts and ./bodies.ts only)
export const VIEW = { w: 640, h: 600 };
export const MIN_BAND = 0.06;
export type CutLayer = { id: string; n: number; paths: InkPath[]; pin: { x: number; y: number } };
export type Cutaway = { layers: CutLayer[]; compare: { label: string; paths: InkPath[]; r: number };
                        outline: InkPath[]; marks: { id: string; paths: InkPath[] }[] };
export function drawnBands(layers: readonly BodyLayer[]): { id: string; r0: number; r1: number }[];
export function cutaway(body: Body): Cutaway;
```

Star life strips (guidance; each stage cites the star's Wikipedia page):
Proxima: Red dwarf · Blue dwarf (in trillions of years) · White dwarf. Sirius:
Today · Red giant · White dwarf (like Sirius B). Vega: Today · Red giant ·
White dwarf. Polaris: Supergiant · … · White dwarf. Betelgeuse: Red supergiant
· Supernova · Neutron star.

## Not in v1

A tour, buttons, client components, new loops or JavaScript animation, moons
as their own posters, dwarf planets, exoplanets, a sixth star, live data,
search, sound, translations, a light/dark toggle, raster images, video or
canvas, and any change to Shore, Capsule, Elements or Vinyl beyond the
`(sun)` → `(orrery)` and `/sun` → `/orrery` renames in their tests and walks.

## Tasks

### 1. Orrery data and cutaway geometry as pure TS

- **Role:** software_engineer, `qa: skip`. It adds files under
  `app/(sun)/_lib/` and changes nothing a person sees. `/sun` keeps building.
- **Problem:** Thirteen more posters need sourced numbers, layers in drawing
  order and a cutaway that works for any body. A unit test has to prove all of
  that before a page uses it.
- **Action items:**
  1. Write `app/(sun)/_lib/bodies.ts` as in Data shapes: all 14 bodies in the
     fixed order, layers per the table, the badges and life strips per the
     Decisions, callouts one per layer, and sources on nasa.gov or
     wikipedia.org. Take the numbers from the NASA fact sheet
     (`https://nssdc.gsfc.nasa.gov/planetary/factsheet/`; parse its one HTML
     table) and the Wikipedia infoboxes (`action=raw`) as listed in
     research.md. Build the Sun's entry from `sun.ts` and `poster.ts`
     (imports, not copies). Planet light times use `lightTime()` from
     `format.ts`.
  2. Write `app/(sun)/_lib/cutaway.ts` as in Data shapes, using `ink.ts`
     only. Keep the Sun's look: a quarter cut, hachure per layer at its own
     angle, colours from the data, the atmosphere as rings and pins 1..n.
     `drawnBands` gives every band at least `MIN_BAND` of R and keeps the
     order. The body's outer radius plus its atmosphere fits the viewBox with
     a 16 px margin. `compare` is drawn at the true ratio
     `compare.radiusKm / body.radiusKm` (a dot, or an orbit arc for
     Betelgeuse). `marks` is an empty array for now; task 4 fills it.
  3. Write `app/(sun)/_lib/bodies.test.ts`:
     - exactly 14 bodies, slugs equal the fixed list in order and match
       `/^[a-z-]+$/`;
     - 8 planets and 6 stars (the Sun is a star);
     - for every body, the interior layers tile `[0, 1]` without gaps or
       overlaps, the atmosphere layers are contiguous from 0, and there are
       3 to 6 layers;
     - callouts: one per layer, ids in layer order, `n` 1..k;
     - exactly four badges;
     - stars have three life stages, planets none;
     - every `source` is a key of that body's `sources`, and every URL is
       https on a host ending in `nasa.gov` or `wikipedia.org`;
     - `textWords` over each poster's title, tagline, callouts, badges, life
       and footer is at most 170;
     - the Sun's entry `deepEqual`s `LAYERS`, `CALLOUTS`, `BADGES` and
       `LIFE`;
     - radii: Jupiter is the largest planet, Mercury the smallest, and the
       stars in radius order are Proxima < Sun < Sirius < Vega < Polaris <
       Betelgeuse;
     - `neighbours("sun").prev` is undefined, `neighbours("betelgeuse").next`
       is undefined, and `neighbours("neptune").next.slug` is
       `"proxima-centauri"`.
  4. Write `app/(sun)/_lib/cutaway.test.ts`. For every body:
     `cutaway(body).layers` ids equal the layer ids in order; each layer has
     at least one path; no `d` has `NaN` or `undefined`; every pin lies inside
     `VIEW`; two calls return identical `d` strings. Also: `drawnBands` keeps
     order and gives each band at least `MIN_BAND`; the comparison `r` is at
     least 2 and equals the true ratio of the drawn body radius within 1 %;
     Betelgeuse's comparison is an `orbit`.
  5. Do not touch `ink.ts`, `sun.ts`, `poster.ts`, `stage.tsx` or any page.
     The ink snapshot in `ink.test.ts` must keep passing unchanged.
  6. `README.md`: one line in the Sun block: `_lib/bodies.ts` holds the 14
     bodies (sourced, tested by `bodies.test.ts`) and `_lib/cutaway.ts` draws
     any of them (tested by `cutaway.test.ts`); no page uses them yet.
  7. Commit and push with the owner identity.
- **Interfaces:** `app/(sun)/_lib/bodies.ts`; `app/(sun)/_lib/cutaway.ts`;
  `app/(sun)/_lib/bodies.test.ts`; `app/(sun)/_lib/cutaway.test.ts`;
  `README.md`
- **Non-goals:** any page, layout, component, CSS, walk or route change; the
  rename; the redirect; changes to `ink.ts`, `sun.ts`, `poster.ts` or
  `stage.tsx`.
- **Acceptance:** `npm test` runs the new bodies and cutaway tests and they
  pass. All fourteen bodies are sourced, layered, within the word budget and
  drawable without NaN. The Sun's data is unchanged and `/sun` still builds.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(sun)/_lib/bodies.test.ts' 'app/(sun)/_lib/cutaway.test.ts' 'app/(sun)/_lib/ink.test.ts' 'app/(sun)/_lib/poster.test.ts'`
  - `git diff --quiet 1bafcf6 HEAD -- 'app/(sun)/_lib/ink.ts' 'app/(sun)/_lib/sun.ts' 'app/(sun)/_lib/poster.ts' 'app/(sun)/_components/stage.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Rename to Orrery: posters for all fourteen bodies, the index and the /sun redirect

- **Role:** software_engineer, depends on 1. QA is required.
- **Problem:** The project is still called Sun and only shows the Sun.
  Visitors need `/orrery` with a poster per body, and every old `/sun` link
  must land on the Sun's poster.
- **Action items:**
  1. Read `node_modules/next/dist/docs/01-app/02-guides/redirecting.md` and
     the `generateStaticParams` / `not-found` docs under
     `node_modules/next/dist/docs/` before writing code (`AGENTS.md`).
  2. `git mv 'app/(sun)' 'app/(orrery)'`, then
     `git mv 'app/(orrery)/sun.css' 'app/(orrery)/orrery.css'` and
     `git mv scripts/walk-sun.sh scripts/walk-orrery.sh`. Remove the
     `app/(orrery)/sun/` route: its markup moves to
     `app/(orrery)/_components/sun-poster.tsx` unchanged.
  3. `layout.tsx`: import `./orrery.css`; set the metadata title to
     `{ default: "Orrery", template: "%s · Orrery" }` and the description to
     the new product. Keep the fonts, `build-sha` and `themeColor`.
  4. `app/(orrery)/orrery/page.tsx`, the index. It has the top bar, the title
     and tagline from `ORRERY`, and two lists, "The planets" and "The stars",
     with one `<li data-body="<slug>">` per body. Each tile holds a small
     rough outline with a solid wash (no hachure) and the name, and links to
     `/orrery/<slug>`. The credit line closes the page. The Sun's tile sits in
     both lists, but `data-body="sun"` appears once: the stars list gets a
     plain link for it. Title `{ absolute: "Orrery" }`.
  5. `app/(orrery)/orrery/[body]/page.tsx`: `generateStaticParams` over
     `BODIES`, `ensureStatic = "navigation"`, `generateMetadata` → the body's
     name, and `notFound()` for an unknown slug. The Sun renders
     `<SunPoster />`; every other body renders
     `_components/body-poster.tsx`, which draws `_components/cutaway.tsx` (a
     server component that maps `cutaway(body)` to SVG, with `pathLength="1"`
     on every path). Both get "← Orrery" and Previous / Next from
     `neighbours`.
  6. `app/(orrery)/not-found.tsx`, as Elements': "404", "Nothing in this
     parcel", "There's no body at this address.", and a link to `/orrery`.
  7. `next.config.ts`: `async redirects() { return [{ source: "/sun",
     destination: "/orrery/sun", permanent: true }]; }`.
  8. `orrery.css`: the poster grid serves every body, and `.index` lays out
     the tiles (wrap, at least 2 per row at 390 px). Keep every Sun rule,
     keyframe name (`sun-*`) and the reduced-motion block. Nothing may scroll
     sideways at 390 px.
  9. Renames in tests and tooling:
     - `package.json`: the test glob becomes `app/(orrery)/_lib/*.test.ts`.
     - `lib/build-stamp.test.ts`: read `app/(orrery)/layout.tsx`.
     - `motion.test.ts`: read `orrery.css`.
     - `isolation.test.ts`: scan `app/(orrery)`; others must not import
       `(orrery)` or `orrery.css`.
     - The Capsule, Elements and Vinyl isolation tests: `(sun)` becomes
       `(orrery)`.
     - The Capsule `ink.ts` / `roughjs.d.ts` comments.
     - `e2e/rbac.test.ts`: `/projects` links `/orrery`; "Orrery is its own
       page" (200, no sidebar, links `/projects`); and
       `fetch(BASE + "/sun", { redirect: "manual" })` is 308 with a
       `location` ending in `/orrery/sun`.
  10. `scripts/walk-orrery.sh`: keep port 4027, the local and `BASE_URL`
      modes, `check`, and `grep -c` with numeric compares only.
      - `/orrery`: 200; title `Orrery`; no sidebar; build-sha; exactly 14
        `data-body="`; an `href="/orrery/<slug>"` for each of the 14 slugs;
        at most 220 visible words; size at most 120,000 bytes.
      - Every `/orrery/<slug>`: 200; exactly as many `data-layer="` as the
        body has layers (read from `bodies.ts` with
        `node --experimental-strip-types`); exactly 4 `data-badge="`; at most
        220 visible words; `href="/orrery"`; at most 300,000 bytes.
      - `/orrery/sun`: every Sun check from `walk-sun.sh` (6 layers, 6
        callouts, 4 badges, life strip, `15.7 million K`, `170,000 years`,
        `8 min 19 s`, `109`, 3 loops, its own stylesheet with `sun-draw` and
        no Tailwind), and `href="/orrery/mercury"`.
      - The stars: `/orrery/betelgeuse` has 3 life stages.
      - `/orrery/nope`: 404 and "Nothing in this parcel".
      - `/sun`: 308, and `curl -s -o /dev/null -w '%{redirect_url}'` ends with
        `/orrery/sun`. `/sun/nope` is still a 404.
      - `/projects` links `/orrery` once and `href="/sun"` zero times.
      - Locally, the prerender manifest lists `/orrery/betelgeuse`.
      - Keep every other site check.
  11. `scripts/walk-elements.sh` and `scripts/walk-vinyl.sh`: `/sun` becomes
      `/orrery`.
  12. `content/site.ts`: `{ title: "Orrery", note: "The Sun, the planets and
      five stars, cut open and drawn by hand.", href: "/orrery" }` (same
      status and colour).
  13. `README.md`: rename the layout block and the test and walk notes.
  14. Run `bash scripts/walk-orrery.sh` on this lease; it must exit 0. Stop
      stray servers with `pkill -x next-server`, never
      `pkill -f "next start"`. Commit and push with the owner identity.
- **Interfaces:** `app/(orrery)/`; `app/(sun)/`; `next.config.ts`;
  `scripts/walk-orrery.sh`; `scripts/walk-sun.sh`; `scripts/walk-elements.sh`;
  `scripts/walk-vinyl.sh`; `content/site.ts`; `package.json`;
  `lib/build-stamp.test.ts`; `e2e/rbac.test.ts`;
  `app/(capsule)/_lib/isolation.test.ts`; `app/(capsule)/_lib/art/ink.ts`;
  `app/(capsule)/_lib/art/roughjs.d.ts`;
  `app/(elements)/_lib/isolation.test.ts`; `app/(vinyl)/_lib/isolation.test.ts`;
  `README.md`
- **Non-goals:** the index's true-scale rows (task 3); rings, bands and other
  marks (task 4); new loops; changes to the Sun's words, stage or motion; a
  client component; a `vercel.json`; CI workflow changes.
- **Acceptance:** `/orrery` lists all fourteen bodies, each linking its own
  hand-drawn poster with numbered layers, four badges and Previous / Next, in
  at most 220 words a page. `/orrery/sun` is the Sun poster as it was. `/sun`
  answers 308 to `/orrery/sun`. `/orrery/nope` is the parcel 404. `/projects`
  lists Orrery, not Sun. There is no sideways scroll at 390 px.
  `bash scripts/walk-orrery.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-orrery.sh && ! grep -nE 'wc +-l' scripts/walk-orrery.sh`
  - `bash scripts/walk-orrery.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4027/; then exit 1; fi`
  - `if BASE_URL=http://127.0.0.1:4037 bash scripts/walk-orrery.sh; then exit 1; fi`
  - `test ! -e 'app/(sun)' && test ! -e scripts/walk-sun.sh && test ! -e 'app/(orrery)/sun'`
  - `! grep -rn '"use client"' 'app/(orrery)'`
  - `! grep -rnE '\(sun\)|walk-sun' --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=projects --exclude-dir=.git .`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. The index's two true-scale rows

- **Role:** software_engineer, depends on 2. QA is required.
- **Problem:** The index shows fourteen same-size tiles, so it says nothing
  about size. In a true scale the Sun's edge dwarfs Jupiter, and Betelgeuse
  would swallow Earth's orbit. An honest picture needs one scale per row and
  a label on everything that does not fit.
- **Action items:**
  1. `app/(orrery)/_lib/rows.ts`, pure:
     `planetRow(): { discs: { slug, cx, cy, r }[]; edge: { r, label } }`, at
     one scale with Jupiter's `r` = 110 and the Sun's edge as an arc of radius
     `110 × SUN_RADIUS_KM / jupiter.radiusKm` on the left, labelled "the Sun's
     edge, to scale". `starRow()` puts the Sun, Proxima, Sirius and Vega as
     discs at one scale (Vega's `r` ≤ 70) and Polaris and Betelgeuse as edge
     arcs labelled "Polaris would reach here" and "Betelgeuse would fill the
     page". Both rows fit `viewBox="0 0 1000 260"`.
  2. `rows.test.ts`:
     - each disc's `r` is proportional to `radiusKm` within 1 %;
     - every disc `r` ≥ 2;
     - discs do not overlap;
     - the planets are in orbit order;
     - the edge arcs' radii are true to scale within 1 %;
     - row labels and edge labels are the strings above.
  3. In `orrery/page.tsx`, draw the two rows as `<svg data-row="planets">`
     and `<svg data-row="stars">`, each with its heading ("The planets, to
     scale" / "The stars, to scale"). Each disc is an outline plus a solid
     wash from `ink.ts` (no hachure), wrapped in a link to its poster and
     carrying `data-body="<slug>"`; the edges carry `data-edge`. The rows
     replace the tiles' discs, so the index still has exactly 14
     `data-body="` (the Sun's disc sits in the stars row; the planets row's
     Sun is its edge). On a phone the rows scroll inside their own box
     (`overflow-x: auto` on the row wrapper only); the page itself never
     scrolls sideways.
  4. `walk-orrery.sh`: `/orrery` has exactly 2 `data-row="`, exactly 3
     `data-edge="`, still exactly 14 `data-body="`, at most 220 words and at
     most 120,000 bytes.
  5. Commit and push with the owner identity.
- **Interfaces:** `app/(orrery)/_lib/rows.ts`; `app/(orrery)/_lib/rows.test.ts`;
  `app/(orrery)/orrery/page.tsx`; `app/(orrery)/orrery.css`;
  `scripts/walk-orrery.sh`
- **Non-goals:** hachure on the index; rings or bands (task 4); animation;
  changes to the posters.
- **Acceptance:** `/orrery` shows the planets at one true scale beside the
  Sun's edge, and the stars at another true scale with Polaris and Betelgeuse
  as labelled edges. Every body still links its poster. The page stays within
  220 words and 120 KB. `bash scripts/walk-orrery.sh` exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(orrery)/_lib/rows.test.ts'`
  - `bash scripts/walk-orrery.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 4. Marks that make each body itself

- **Role:** software_engineer, depends on 3. QA is required.
- **Problem:** With only layers, Saturn looks like Jupiter and Sirius looks
  like Vega. People know these bodies by their features. Each poster (and
  Saturn on the index) needs the one or two marks that make it recognisable.
- **Action items:**
  1. In `cutaway.ts`, fill `marks` from the data (`Body.marks?: string[]`
     in `bodies.ts`):
     - Saturn `rings` (an inked ellipse pair, behind and in front);
     - Jupiter `bands` and `great-red-spot`;
     - Earth `clouds`;
     - Mars `polar-cap`;
     - Uranus `rings` (tilted near-vertical) and `tilt` (axis line);
     - Neptune `dark-spot`;
     - Sirius `companion` (Sirius B to scale, labelled "Sirius B, a white
       dwarf");
     - Vega `flattened` (the outline an ellipse with polar/equatorial
       2.42/2.73);
     - Betelgeuse `lumpy` (an uneven limb);
     - Polaris `pulse-rings` (two dashed outlines, still).
     Each mark is one `<g data-mark="<id>">` in `_components/cutaway.tsx`,
     with `pathLength="1"` on its paths.
  2. Draw Saturn's rings in the index planets row too, outline only.
  3. `cutaway.test.ts`:
     - each body's mark ids equal its data;
     - Saturn and Uranus have `rings`;
     - Vega's outline bounding box ratio is within 0.02 of 2.42 / 2.73;
     - Sirius B's `r` is at least 2 and true to scale, or else labelled as
       not to scale;
     - no NaN, and two calls give identical output.
  4. `walk-orrery.sh`: `/orrery/saturn` has `data-mark="rings"`,
     `/orrery/sirius` has `data-mark="companion"`, `/orrery/vega` has
     `data-mark="flattened"`, and every page stays within 220 words and its
     byte cap.
  5. Commit and push with the owner identity.
- **Interfaces:** `app/(orrery)/_lib/cutaway.ts`; `app/(orrery)/_lib/cutaway.test.ts`;
  `app/(orrery)/_lib/bodies.ts`; `app/(orrery)/_components/cutaway.tsx`;
  `app/(orrery)/orrery/page.tsx`; `app/(orrery)/orrery.css`;
  `scripts/walk-orrery.sh`
- **Non-goals:** new loops or keyframes; moons as bodies; changes to the Sun's
  stage; new words beyond the mark labels.
- **Acceptance:** Saturn has its rings (on its poster and the index). Jupiter
  has its bands and Great Red Spot. Earth has clouds, Mars a polar cap,
  Uranus tilted rings and Neptune a dark spot. Sirius has its white dwarf,
  Vega is flattened, Betelgeuse is lumpy and Polaris shows its pulse. Every
  page stays within its word and byte caps. `bash scripts/walk-orrery.sh`
  exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash scripts/walk-orrery.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA (tasks 2 to 4)

Use headless Chrome (playwright-core in a scratch directory; on a macOS lease
`chromium.launch({ channel: "chrome" })`) at 1366×768 and 390×844, with motion
on and off. Check:

- `/orrery`;
- `/orrery/sun` beside the pm-189 acceptance screenshots (it must look the
  same);
- `/orrery/jupiter`, `/orrery/saturn`, `/orrery/earth`, `/orrery/betelgeuse`
  and `/orrery/vega`;
- `/sun` lands on `/orrery/sun`;
- `/orrery/nope`;
- `document.documentElement.scrollWidth - clientWidth` is 0 at 390 px;
- no text under 12 px.

Read `build-sha` from each page during the walk; production redeploys after
every push. Do not commit screenshots.

## Risks

- **A 308 is cached.** The target `/orrery/sun` is final. If the slug ever
  changes, the old one must redirect too.
- **Rename churn.** A missed `(sun)` path fails `npm test`, the build or the
  grep in task 2's verification, never production silently.
- **Word cap on the index.** Fourteen names, two row labels and three edge
  labels come to about 65 words. The cap is 220, and the walk counts them.
- **Page weight.** The walk enforces the byte caps. If a poster runs over,
  widen `hachureGap` before dropping a layer.
- **Uncertain star numbers.** Wikipedia gives ranges (Betelgeuse is 640 to 764
  R☉). The posters say "about" and cite the page. The tests pin order and
  ratios, not values.
