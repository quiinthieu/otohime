# Research: an interactive periodic table with a 3D atom per element (pm-190, run-6365)

Submitted by research run-6365 as a report body (rep-3592). Committed by the product
owner as `research.md`.

Idea: add a full periodic table; clicking an element opens a detail view with an
interactive 3D Bohr atom, one fun fact, and key stats. Everything below is from the
repo at 07beebd (main, 2026-10-19), the Next 16.4.2 docs in `node_modules/next/dist/docs`,
the npm registry and the upstream repos, all read on 2026-10-19.

## Recommendation

Build **Elements**, a fourth row on the Projects bench at `otohime.dev/elements`: a
server-rendered 18-column table of all 118 elements, a `<dialog>` detail view (bottom
sheet under 768 px), and a lazily loaded React Three Fiber atom that mounts only on the
first click. Follow the repo's project pattern exactly (own route group `app/(elements)/`
with its own root layout and stylesheet, no Tailwind, pure data and pure maths under
`_lib/` proved by `node --test`, an isolation test, a walk script, a `build-sha` meta and
a row in `site.projectList`). Add three dependencies only: `three`, `@react-three/fiber`,
`@react-three/drei`.

Four things decide the shape of the work:

1. **The stack is Next 16, not Vite.** The brief's fallback stack (Vite, Tailwind, Framer
   Motion) applies only "if no stack exists". This repo is Next 16.4.2 (App Router,
   Turbopack, `cacheComponents: true`), React 19.3.0, TypeScript, plain CSS per project,
   `useReducer` over pure machines, and `node --test` with type stripping. So: no Vite,
   no Tailwind (the project route groups forbid it and the walk greps the stylesheet for
   `--tw-`), no Framer Motion (CSS transitions and keyframes, as Shore, Capsule and Sun
   do), no Zustand (a reducer). R3F and drei are kept because nothing in the repo draws
   WebGL and they are the brief's own choice.
2. **The table works before any 3D code exists.** The page is static HTML with 118
   `<a href="/elements/<symbol>">` cells; JS upgrades a click into the dialog. The 3D
   module (about 250 kB gzip) is a `next/dynamic` chunk with `ssr: false` requested on
   the first open, and the SVG Bohr diagram that doubles as the WebGL fallback is what the
   visitor sees while it loads. Lighthouse sees a static page.
3. **Nothing is allocated per element in 3D.** One `<Canvas>` mounts once; the nucleus is
   one `InstancedMesh` of at most 64 spheres, the electrons one `InstancedMesh` of at most
   118, and the rings seven pre-made tori toggled by `visible`. Swapping an element writes
   instance matrices and counts. There is nothing to dispose and nothing to leak, which is
   the cheapest way to pass "no memory growth after 118 clicks".
4. **Facts are data with sources, and the text licence is handled.** The dataset's
   summaries are Wikipedia text under CC BY-SA 3.0, so the vendored file carries its own
   LICENSE and the page shows the attribution and link. The 118 fun facts are written in
   our own words from cited sources, never copied from the RSC or Los Alamos tables, whose
   terms forbid reuse.

## Stack check (Step 0): where the brief and the repo disagree

| Brief asks | Repo has | Follow |
| --- | --- | --- |
| React + TS + Vite | Next 16.4.2 App Router, Turbopack, React 19.3.0, TS 5 | Next; a route group `app/(elements)/` |
| Tailwind CSS | Tailwind only in `app/(site)`; each project ships its own plain CSS and the walk fails on `--tw-` | Plain `elements.css` with custom properties |
| Framer Motion | CSS transitions/keyframes posed by state, `prefers-reduced-motion` blocks | CSS |
| Zustand-style store | `useReducer` over a pure `(state, action)` machine (`lib/machines.ts`, Capsule, Sun) | A pure `_lib/view.ts` reducer: open, close, prev, next |
| JSON Schema validator (ajv) | No test dependencies; `node --test` with hand-written checks | A hand-written check in `facts.test.ts`, also exposed as `npm run elements:validate` |
| Component test (RTL/jsdom) | No DOM test runner; QA runs headless Chrome via playwright-core from a scratch dir | Reducer test + static detail page greppable by the walk + QA's Playwright click pass |
| Dark/light theme | The site follows the OS until the toggle pins `data-theme` on `<html>` and `localStorage.theme`; project groups do their own | `prefers-color-scheme` custom properties plus a two-line inline script that honours `localStorage.theme` (re-implemented, not imported: the isolation test forbids importing site code) |
| `@react-three/fiber`, `@react-three/drei` | Nothing draws WebGL; Shore vendored a renderer under Apache-2.0 with a LICENSE file | Add `three@0.186.1`, `@react-three/fiber@9.8.2`, `@react-three/drei@10.7.9` (all MIT), pinned exactly |

Versions checked on the registry: fiber 9.8.2 (published 2026-10-14, peer `react >=19 <19.4`,
so React 19.3.0 fits; 9.8.0 is the release that added 19.3 support), drei 10.7.9 (peer
`react ^19`, `@react-three/fiber ^9`, `three >=0.159`), three 0.186.1. Fiber 10 is alpha
(WebGPU by default) and is not used. The R3F install guide says Next 13.1+ needs
`transpilePackages: ['three']` only for untranspiled add-ons; using `three` and drei's
`OrbitControls` alone needs nothing in `next.config.ts`. Next 16's lazy-loading guide:
`ssr: false` works only inside a Client Component, so the dynamic import lives in the
client dialog component, not the server page.

JSON imports: Node 22.23 needs `with { type: "json" }` for an ESM JSON import, and
Turbopack's documented import attributes are only its loader attributes. So the vendored
dataset is a `.ts` module (`elements.ts`, a typed array literal generated from the upstream
JSON by `scripts/vendor-elements.ts`), which is how every other project here stores its
data. `funFacts.json` stays JSON as the brief asks: the validation test reads it with
`readFileSync`, and the page imports it through a one-line `.ts` wrapper (Next supports
plain JSON imports).

## Reference projects: what to borrow, what to do differently, licences

| Project | Licence (checked via GitHub API) | Borrow | Do differently |
| --- | --- | --- | --- |
| burakkisacik/3D-Periodic-Table (3 stars, last push 2021) | **No licence file** (all rights reserved): patterns only, no code | Hover scale that eases like a spring; click opens an info card; hovering a legend item puts the matching elements into the hover state | The table is DOM, not meshes: HTML cells are accessible, indexable and cost no WebGL; the hover spring is a CSS transition with a `cubic-bezier` overshoot, not a physics library |
| suhdonghwi/3d-periodic-table (174 stars, push 2026-01) | MIT | Bowserinator JSON as the base dataset; the lanthanide/actinide rows placed from the dataset's `xpos`/`ypos` rather than hand-coded | TypeScript and pure functions for grid placement with a unit test; no MUI (plain CSS); no 3D table |
| matt765/atom-animation (170 stars; the brief's "AtomAnimation") | **Personal-use licence**, commercial use needs permission: patterns only, no code | The Bohr-model viewer idea: nucleus cluster, one ring per shell, electrons on tilted orbits at different speeds, honest note that Bohr is a simplification; data cross-checked with NIST/IUPAC | No Zustand (reducer), no per-element meshes (two `InstancedMesh`es and seven tori, allocated once), no property filters in v1 (a category legend instead) |
| Zhilips/Zperiod (281 stars, push 2026-07) | MIT | The split between a data module and a renderer module; the modal with Esc and a close button; CSS split by feature | React, not vanilla; `three` from npm and tree-shaken, not a vendored `three.min.js`; no chemistry tools or ions |
| All four | | A category colour legend, a hover state and a detail card are common to all; copying none of their code | Progressive enhancement (the detail view is also a static page), keyboard navigation, reduced motion, a WebGL fallback and tests, which none of the four document |

Licence constraints in one line: nothing is copied verbatim from any of them; two of the
four could not be copied anyway. Our dependencies are all MIT.

## Data

**Dataset.** `Bowserinator/Periodic-Table-JSON` (727 stars, last push 2026-10-04):
`PeriodicTableJSON.json` is 340 kB and holds **119** entries (element 119, ununennium, is
included and must be dropped). Its `LICENSE.md` is **CC BY-SA 3.0 Unported**, because
"all elements have a three sentence summary from Wikipedia". Fields per element:
`number, symbol, name, category, xpos, ypos, wxpos, wypos, atomic_mass, phase, melt, boil,
shells, electron_configuration, electron_configuration_semantic, discovered_by, named_by,
summary, source, bohr_model_image, bohr_model_3d, cpk-hex, image, block, period, group`
and more. The npm package `periodic-table-data-complete@1.1.0` is a 1.6 MB repackaging
that claims MIT, which cannot override the CC BY-SA summaries inside it; use the GitHub
JSON directly and keep its licence.

Facts from the file that shape the code:

- Positions are already a standard 18-column layout: periods on `ypos` 1–7, the
  lanthanides (57–71) on `ypos` 9 at `xpos` 3–17, the actinides (89–103) on `ypos` 10 at
  `xpos` 3–17, and row 8 empty (the spacer). Row counts are 2, 8, 8, 18, 18, 17, 17, 15,
  15 = 118. Cells (3,6) and (3,7) are empty and get the "57–71" / "89–103" markers.
- `shells` has at most 7 entries for 1–118 (8 only for 119). Neutrons as
  `round(atomic_mass) − number` reach 176 (oganesson).
- `category` has 15 raw strings, five of them "unknown, probably …". Map to ten legend
  categories: alkali metal, alkaline earth metal, transition metal, post-transition metal,
  metalloid, nonmetal (diatomic + polyatomic), noble gas, lanthanide, actinide, unknown.
- Nulls: `discovered_by` is null for aluminium (13); `melt` is null for 105–111 and 118;
  `boil` for 6, 15, 33, 100–103, 105–111. Render "not known" rather than a blank.
- `bohr_model_3d` is a GLB on `storage.googleapis.com/search-ar-edu/…` for 1–118
  (214 kB for hydrogen, 3.5 MB for uranium), with no stated licence.
- A slimmed JSON with only the needed fields for 118 elements is 77 kB; as a `.ts` module it
  is a few kB more, and it lands in the page's client bundle only if a client component
  imports it (the dialog needs it for prev/next; the table itself is server-rendered).

**Vendoring.** `scripts/vendor-elements.ts` downloads the upstream JSON once, keeps the
fields above for `number <= 118`, and writes `app/(elements)/_lib/elements.ts` plus
`app/(elements)/_lib/LICENSE.md` (the upstream CC BY-SA 3.0 text, as Shore keeps the
Apache-2.0 file next to the vendored renderer). The script is run by a person and the
output is committed; nothing is fetched at runtime. The ESLint globalIgnores does not
need the file: it is generated TypeScript, formatted.

**Attribution on the page.** Under each summary: "Summary from Wikipedia, CC BY-SA 3.0"
linking the element's `source` URL and the licence URL. The page footer names the
dataset and its licence. Wikipedia's reuse page asks for a link to the article and a
licence notice; both are present.

**Fun facts.** `app/(elements)/_lib/funFacts.json`: `{ "1": { "fact": "…", "sourceUrl":
"https://…" }, … }` for 1–118, plus a top-level `"needsReview": [ … ]` array of atomic
numbers, which the brief asks for. Rules the validator enforces: exactly the keys 1–118
plus `needsReview`; `fact` is a non-empty string of at most 200 characters, ends with a
full stop, contains no "http"; `sourceUrl` is `https://` on an allowlisted host
(`en.wikipedia.org`, `www.rsc.org`/`periodic-table.rsc.org`, `www.nist.gov`,
`physics.nist.gov`, `pubchem.ncbi.nlm.nih.gov`, `iupac.org`, `www.lanl.gov`,
`science.nasa.gov`); every `needsReview` entry is an integer 1–118. Sourcing rule: each
fact is written in our own words from the element's Wikipedia article (or a NIST, IUPAC or
PubChem page) and the URL is the page the fact can be checked on. The RSC periodic table
("one copy for personal, non-commercial, non-public use") and the Los Alamos table
("Copyright 2026 Triad National Security, LLC. All Rights Reserved") may be cited as a
source URL but not copied. For 104–118 the facts are conservative (who named it, how many
atoms have ever been made) and those numbers go in `needsReview` unless the engineer has
checked them against the source. The validator is `facts.test.ts` (in the `npm test` glob)
and `npm run elements:validate` runs that one file.

## Table UI

- `<main>` holds a `role="region"` with `aria-label="Periodic table"` and a scroll
  container; inside, a CSS grid `grid-template-columns: repeat(18, minmax(44px, 1fr))`
  with 10 rows, row 8 a short spacer. Each element is placed with `grid-column: xpos;
  grid-row: ypos` from `_lib/grid.ts`, which is a pure function with a test (every element
  has a unique cell, the two series rows sit at columns 3–17, the counts above, hydrogen at
  (1,1), helium at (18,1), the two marker cells).
- A cell is an `<a href="/elements/<symbol>">` with `aria-label="Hydrogen, atomic number
  1, nonmetal"`, showing number, symbol, name and `atomic_mass` to three decimals, with
  `--cat` set to the category colour. Ten colours chosen for 3:1 against both paper
  themes; the legend is a `<ul>` of buttons; hovering or focusing a legend item sets
  `data-focus="<category>"` on the table and CSS dims the other cells (`opacity: .35`).
- Hover/focus: `transform: scale(1.08)` and a shadow, `transition: transform 180ms
  cubic-bezier(.34,1.56,.64,1)` (a spring overshoot without a library), none under reduced
  motion.
- Keyboard: roving `tabindex` so the table is one tab stop; arrow keys move to the nearest
  cell in that direction (skipping the gaps, so Ba → Hf on ArrowRight and Ba ↓ Ra), Home/End
  to the row ends; Enter/Space activate the link, which JS intercepts into the dialog. No
  `role="grid"`: explicit grid placement has no DOM rows to mark up, and labelled links with
  arrow handling are what the brief asks for.
- Responsive: under 768 px the scroll container is `overflow-x: auto` with `touch-action:
  pan-x pan-y pinch-zoom` and cells at 46 px minimum (the table is about 880 px wide, so it
  scrolls sideways by design; the walk and QA check the page itself does not). The viewport
  meta keeps the browser's native pinch zoom. A compact list is not needed.
- Themes: custom properties under `:root`, `@media (prefers-color-scheme: dark)` and
  `[data-theme="dark"]`/`[data-theme="light"]`; an inline script in the layout applies
  `localStorage.theme` before paint, the same rule the site uses.

## Detail view

Capsule's album already proves the pattern (`app/(capsule)/_components/album.tsx`): a
native `<dialog>` opened with `showModal()`, Esc and Close both land in one `closed`
handler, focus returns to the opener. Native `<dialog>` gives the focus trap and `inert`
background for free. Layout in order: the viewport (3D canvas or SVG), name, symbol,
number and a category chip, the "Did you know?" card (fact plus "source" link), a `<dl>`
of stats (atomic mass, phase, electron configuration (semantic), discovered by, melting
and boiling points in K with °C in brackets, "not known" for nulls), then Prev / Next /
Close. Under 768 px the dialog is a bottom sheet (`inset: auto 0 0 0; max-height: 90dvh;
border-radius: 16px 16px 0 0`). Prev/Next dispatch to the reducer; ArrowLeft/ArrowRight do
the same while the dialog is open. The URL is not changed by the dialog in v1.

The same `<ElementDetail>` renders `app/(elements)/elements/[symbol]/page.tsx`, a static
page per element via `generateStaticParams` (118 small pages). It is the no-JS path, the
shareable link, and what the walk greps: `GET /elements/fe` must contain iron's fun fact
and its source URL. The reducer test covers the click path without a browser: `open(26)`
then `next` is 27, `prev` from 1 stays, `next` from 118 stays, `close` clears.

## 3D element model

**Pure maths first** (`_lib/atom.ts`, tested, no three import):

- `rings(shells, t)`: one ring per entry; radius `1.2 + i × 0.55`; electrons evenly
  spaced at `2πk/n` plus a phase; angular speed `0.9 / (1 + 0.35 i)` with alternating
  sign; tilt `i × 9°` about x and `i × 13°` about z. Tests: ring count equals
  `shells.length`, electrons per ring equal the entry, the sum is the atomic number, radii
  strictly increase, angles are evenly spaced, `t = 0` is deterministic.
- `nucleus(protons, neutrons, cap = 64)`: a representative cluster when `p + n > cap`
  (protons and neutrons scaled proportionally, at least one of each), packed on a
  Fibonacci sphere in concentric layers with radius ∝ ∛count; returns positions and a
  per-particle kind. Tests: count = min(cap, p + n), the proton share is preserved within
  one, every point inside the radius, a "showing 64 of 294 nucleons" label when capped.

**The viewer** (`_components/atom-3d.tsx`, the lazy chunk): one `<Canvas>` with
`dpr={[1, 1.5]}` and `frameloop="demand"` under reduced motion. Nucleus: one `InstancedMesh`
(sphere geometry of 12×8 segments, capped at 64 instances) tinted with the category
colour for protons and grey for neutrons via `setColorAt`. Electrons: one `InstancedMesh`
of at most 118. Rings: seven `TorusGeometry` meshes made once, `visible` toggled by shell
count. Lighting: a hemisphere light, one key point light, and drei's `<Environment
resolution={64}>` holding two `<Lightformer>`s, which gives a procedural environment
map without fetching an HDR (drei's `preset` environments download from a CDN at
runtime, which the repo's offline builds and the "no runtime fetch" rule rule out).
Controls: drei `OrbitControls` with `enablePan={false}`, `minDistance`/`maxDistance`,
`autoRotate` at a slow speed, paused by `onStart` and resumed 4 s after `onEnd`; drag
rotates, wheel and pinch zoom. Reduced motion: `autoRotate={false}`, electrons placed at
`t = 0` and never advanced, `frameloop="demand"`.

**Loading and lifetime.** `const Atom3D = dynamic(() => import("./atom-3d"), { ssr:
false, loading: () => <BohrSvg … /> })` inside the client dialog, so the chunk (three
185 kB gzip + fiber 58 kB + the drei slice; about 250 kB) is requested on the first open and
the SVG shows until then. The Canvas stays mounted for the page's life once created; prev
and next only change the `element` prop, which rewrites instance matrices and counts.
There is no per-element geometry or material, so nothing needs disposing between elements;
closing the dialog hides it. The context-lost event swaps in the SVG.

**Fallback.** `_lib/webgl.ts` probes `canvas.getContext("webgl2") ?? getContext("webgl")`
once; if null, or if the Canvas's `fallback`/`onCreated` path fails, the dialog renders
`<BohrSvg>`: the same `rings`/`nucleus` positions projected to 2D as an SVG, also used by
the static pages and as the loading state. QA on this pod runs headless Chrome, where WebGL
is SwiftShader (software); the QA pass runs Chrome with `--use-angle=swiftshader
--enable-unsafe-swiftshader` so the 3D path is exercised, and once with `--disable-gpu
--disable-software-rasterizer` for the fallback.

**GLB flag.** `NEXT_PUBLIC_ELEMENTS_GLB=1` makes the viewer try drei's `useGLTF` on the
element's `bohr_model_3d` URL with the procedural atom as `<Suspense>` fallback and on
error. Off by default: the files are on a third-party Google bucket with no stated licence,
up to 3.5 MB each, and cannot be vendored (binaries are forbidden here). Record this as an
open question for the owner.

**Memory check for QA.** Click through all 118 with CDP `Performance.getMetrics`
(`JSHeapUsedSize`) sampled every 20 elements after `HeapProfiler.collectGarbage`; the
last sample must be within 10 % of the first, and the console must stay empty of errors.

## Quality bar mapped to this repo

- `npm test` globs gain `'app/(elements)/_lib/*.test.ts'`: `grid.test.ts`,
  `atom.test.ts`, `facts.test.ts` (schema, length, 118 entries, hosts, needsReview),
  `elements.test.ts` (118 entries, unique numbers and symbols, categories map, shells sum
  to the number, `source` on en.wikipedia.org), `view.test.ts` (the reducer),
  `isolation.test.ts` (Sun's copy, extended both ways; it also forbids any `three` import
  outside `_components/atom-3d.tsx` so the table page can never pull the 3D chunk).
- `lib/build-stamp.test.ts` gets the Elements layout line; `e2e/rbac.test.ts` expects
  `/projects` to link `/elements` and `/elements` to answer 200 without `aria-label="Main"`.
- `scripts/walk-elements.sh` (a copy of `walk-sun.sh`, port 4029): `/elements` 200,
  `<title>Elements</title>`, no sidebar, `build-sha`, exactly 118 `data-element="`,
  exactly 10 `data-legend="`, the strings `57–71` and `89–103`, "Did you know", the CC
  BY-SA link, the dataset link; the page HTML contains no `/_next/static/chunks/` script
  whose name includes `three` (the lazy chunk is not preloaded); `/elements/fe` 200 with
  iron's fact; `/elements/xx` 404 "Nothing in this parcel"; one stylesheet with
  `prefers-reduced-motion` and no `--tw-`; the site pages 200.
- Lighthouse 90+: a static page of 118 links and one small client island; checked by QA
  with the Lighthouse CLI against the local `next start` (desktop preset) and recorded in
  the QA report. No 3D code is in the initial bundle by construction (the isolation test).
- Console errors and memory: the QA Playwright pass above.

## File tree and component list (deliverable 1)

```
app/(elements)/
  layout.tsx                 own <html>, elements.css, build-sha meta, theme script
  elements.css               paper/ink custom properties, light and dark, grid, dialog, sheet
  elements/page.tsx          /elements: server page, table, legend, footer (attribution)
  elements/[symbol]/page.tsx static detail page per element (generateStaticParams)
  _components/
    table.tsx                client: roving tabindex, arrow keys, legend focus, opens the dialog
    cell.tsx                 one <a> cell (server-renderable)
    legend.tsx               the ten categories
    element-dialog.tsx       client: <dialog>, reducer, prev/next/close, lazy Atom3D or BohrSvg
    element-detail.tsx       name, chip, fact card, stats <dl> (shared by dialog and page)
    bohr-svg.tsx             2D fallback and loading state, from _lib/atom.ts
    atom-3d.tsx              the only file that imports three/fiber/drei (lazy chunk)
  _lib/
    elements.ts              generated, typed, 118 entries (CC BY-SA 3.0)
    LICENSE.md               upstream licence text
    funFacts.json            118 facts + needsReview
    facts.ts                 typed accessor over funFacts.json
    categories.ts            raw category → legend category + colour
    grid.ts                  xpos/ypos → grid placement, neighbours for arrow keys
    atom.ts                  rings(), nucleus(), project2d()
    view.ts                  dialog reducer: open/close/prev/next
    webgl.ts                 the WebGL probe
    *.test.ts                grid, atom, facts, elements, view, isolation
scripts/vendor-elements.ts   fetch upstream JSON once, write elements.ts (run by hand)
scripts/walk-elements.sh     the walk
content/site.ts              the Projects row
package.json                 three, fiber, drei; test glob; elements:validate
README.md                    layout line, data sources and licences, editing facts, validation, walk
```

Site row: `{ title: "Elements", note: "All 118, each with a spinning atom and one
surprising fact.", href: "/elements", status: "live", colour: "blue" }`.

## Proposed tasks (for the product owner)

1. **Data, facts and the pure maths** (software_engineer, `qa: skip`).
2. **The table, the detail view and the SVG atom** (software_engineer, depends on 1, QA required).
3. **The 3D atom** (software_engineer, depends on 2, QA required).

QA for 2 and 3: rerun the task's verification on the delivery sha; Playwright at 1366×768
and 390×844 with `reducedMotion` both ways: click hydrogen, the dialog shows "Did you
know?" with hydrogen's fact, Next reaches helium, Esc closes and focus returns to the
hydrogen cell, arrow keys move between cells, the legend dims others, no horizontal
overflow of the page at 390 (the table scroller may scroll); for 3, the SwiftShader run
sees a `<canvas>` with a WebGL context and the no-GPU run sees the SVG, the 118-click heap
check, zero console errors, and a Lighthouse desktop run of 90+ on `/elements`. Acceptance
walks production if `build-sha` has caught up, else a local `next start` with a watch on
`https://otohime.dev/elements`, as pm-184 and pm-188 did.

## Risks

- **Licence drift.** The dataset is CC BY-SA 3.0; keep the summary text and the licence
  file together and the attribution on the page. Fun facts must be our words, or they
  inherit the source's licence. The validator's host allowlist does not prove originality;
  QA spot-checks ten facts against their URLs.
- **The lazy chunk leaking into the page.** One accidental `import { Vector3 } from
  "three"` in a shared file puts 185 kB into the table's bundle. The isolation test's
  three-import rule and the walk's preload check catch it.
- **Instanced colours.** `InstancedMesh.setColorAt` needs `instanceColor.needsUpdate =
  true` after each swap; forgetting it leaves protons the previous element's colour.
- **drei's weight.** Import `OrbitControls`, `Environment`, `Lightformer` by name and
  check the chunk size in the build output; `import * as drei` is 521 kB gzip.
- **Playwright WebGL.** Headless Chrome needs the SwiftShader flags above or the 3D path
  silently takes the fallback and QA proves nothing about it.
- **Fonts.** No `next/font/google` (it needs egress at build); a system stack keeps the
  build offline-safe.
- **Hydration.** The dialog starts closed on server and client and the reducer has no
  clock, so there is no mismatch and no store.
- **Stopping servers.** `pkill -x next-server`, never `pkill -f "next start"` (pm-181).

## Open questions and assumptions

- Assumed route `/elements` and project title "Elements"; the brief names none.
- Assumed the GLB enhancement stays off (flag) until the owner confirms the bucket's terms.
- Assumed "key stats" means the six listed, plus the Wikipedia summary with attribution.
- Assumed desktop modal and mobile bottom sheet are the same `<dialog>` styled by a media
  query, and that the dialog does not change the URL.
- Assumed the fun-fact "source" link is enough attribution for facts written in our own words.
- No clarifying question blocks the work, so none is asked.

## Sources

- Dataset and licence: https://github.com/Bowserinator/Periodic-Table-JSON ;
  https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/LICENSE.md ;
  https://www.npmjs.com/package/periodic-table-data-complete
- Wikipedia reuse terms: https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content
- Fact sources whose terms forbid copying: https://periodic-table.rsc.org/Help/References ;
  https://www.lanl.gov/science-engineering/periodic-table
- Reference projects: https://github.com/burakkisacik/3D-Periodic-Table ;
  https://github.com/suhdonghwi/3d-periodic-table ; https://github.com/matt765/atom-animation ;
  https://github.com/Zhilips/Zperiod
- Libraries: https://registry.npmjs.org (three 0.186.1, @react-three/fiber 9.8.2,
  @react-three/drei 10.7.9) ; https://r3f.docs.pmnd.rs/getting-started/installation
- Next 16 docs: `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`,
  `…/05-config/01-next-config-js/turbopack.md`
- Repo: `README.md`, `AGENTS.md`, `app/(sun)/`, `app/(capsule)/_components/album.tsx`,
  `scripts/walk-sun.sh`, `lib/build-stamp.test.ts`, `e2e/rbac.test.ts`,
  `.github/workflows/ci.yml`, `components/theme-toggle.tsx`, the pm-188 and pm-189 plans
