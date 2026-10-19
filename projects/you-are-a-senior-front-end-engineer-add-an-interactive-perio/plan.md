# Elements: a periodic table with a 3D atom per element (pm-190)

**Idea.** "Add an interactive periodic table feature: render a full periodic
table; clicking an element opens a detail view with an interactive 3D atom, a
short accurate fun fact and key stats."

**Product.** `otohime.dev/elements`, the fourth project on the Projects bench.
A static 18-column table of all 118 elements (lanthanides and actinides in two
rows below), coloured by ten categories, with a legend that dims the rest on
hover. Click an element (or Enter/Space) and a native `<dialog>` opens (a
bottom sheet under 768 px): a Bohr-style atom (SVG first, then a lazily loaded
R3F model), name, symbol, number, category chip, a "Did you know?" card, key
stats, Prev/Next/Close. Every element also has a static page
`/elements/<symbol>`, the no-JS path and the shareable link.

Research: [research.md](research.md) (run-6365, rep-3592), checked against the
repo at 07beebd. It lists the stack conflicts, the four reference projects
(borrow / do differently / licence) and the open questions; they are not
repeated here.

## Decisions

| Decision | Why |
| --- | --- |
| Follow the repo's stack, not the brief's fallback: Next 16 route group `app/(elements)/`, plain CSS, `useReducer`, `node --test`. Add only `three`, `@react-three/fiber`, `@react-three/drei`, pinned exactly. | The brief says to follow the existing stack and report conflicts; the conflicts are in research.md. Nothing in the repo draws WebGL, so R3F is the one new thing. |
| Table is server-rendered HTML (118 `<a>` cells); the 3D chunk is `next/dynamic` with `ssr: false` inside the client dialog, and only `_components/atom-3d.tsx` may import `three`, fiber or drei (an isolation test enforces it). | The table is interactive before any 3D code loads and Lighthouse sees a static page. |
| Dataset is Bowserinator's JSON, 118 of 119 entries, vendored as a generated typed `.ts` module plus its CC BY-SA 3.0 `LICENSE.md`; the page links the Wikipedia source and the licence. | Node needs `with {type:"json"}` and Turbopack documents no such attribute, so a `.ts` literal is how every project here stores data. The Wikipedia summaries make the dataset CC BY-SA, not the npm package's MIT. |
| 118 original facts in `funFacts.json` with a `needsReview` list; the validator is a plain test, no ajv. Facts are our own words; RSC and Los Alamos text is cited, never copied. | The brief says never invent facts and gives a 200-character cap. The repo has no test dependencies. |
| The 3D atom allocates once: one 64-sphere nucleus `InstancedMesh`, one 118-electron `InstancedMesh`, seven pre-made tori shown by `visible`. A procedural `Lightformer` environment, no CDN HDR. | Swapping elements only rewrites matrices, so there is nothing to dispose and no growth over 118 clicks; no runtime fetch. |
| The GLB loader (`bohr_model_3d`) sits behind `NEXT_PUBLIC_ELEMENTS_GLB=1`, off by default. | The files sit in a third-party bucket with no stated licence and cannot be vendored. Open question for the owner. |
| No DOM test runner is added. The "click opens the right fact" component test is split: a pure reducer test (task 2), a static `/elements/fe` page the walk greps, and QA's Playwright click pass. | The repo has no jsdom or RTL and the brief's quality bar allows following the stack. |
| Three tasks: (1) data, facts, pure maths and tests, `qa: skip` (no visible change, the old site keeps building); (2) layout, table, dialog, static pages, SVG atom, walk; (3) the 3D atom. | Task 1 changes nothing a person sees. Task 2 is fully usable without WebGL. Task 3 can fail or be reverted without taking the table down. |
| Each delivery commit is authored and committed as `Otohime <quiinthieu@gmail.com>`; set the four `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables on `git commit` **and** `git push`. | Vercel Hobby deploys only the owner's commits (as in pm-188 and pm-189). |
| Stop servers with `pkill -x next-server`, never `pkill -f "next start"`. No `next/font/google`: a system font stack. | pm-181; the next/font lesson (build needs egress). |

## File tree and components

```
app/(elements)/
  layout.tsx                 own <html>, elements.css, build-sha meta, theme script
  elements.css               custom properties (light/dark), grid, legend, dialog, sheet
  elements/page.tsx          /elements: table, legend, attribution footer
  elements/[symbol]/page.tsx static page per element (generateStaticParams)
  _components/
    table.tsx                client: roving tabindex, arrow keys, legend focus, opens dialog
    cell.tsx                 one <a data-element> cell
    legend.tsx               ten <button data-legend> items
    element-dialog.tsx       client: <dialog>, reducer, prev/next/close, lazy Atom3D or BohrSvg
    element-detail.tsx       name, chip, fact card, stats <dl> (dialog and page)
    bohr-svg.tsx             2D diagram: fallback, loading state, static pages
    atom-3d.tsx              the only file importing three/fiber/drei (task 3)
  _lib/
    elements.ts (generated) · LICENSE.md · funFacts.json · facts.ts
    categories.ts · grid.ts · atom.ts · view.ts · webgl.ts (task 3)
    *.test.ts                elements, facts, grid, atom, view, isolation
scripts/vendor-elements.ts · scripts/walk-elements.sh
content/site.ts (Projects row) · package.json · README.md
```

## Tasks

### 1. Data, facts and the pure maths

- **Role:** software_engineer, `qa: skip`. New files only (plus `package.json`,
  lockfile and README); the existing pages are untouched and keep building.
- **Problem:** The table, the dialog and the atom all rest on a typed dataset
  with its licence, 118 sourced facts, a grid placement function, the
  shell-to-ring and nucleus maths and a dialog reducer. These must be right
  and tested before any page uses them.
- **Action items:**
  1. Read `AGENTS.md` and `app/(sun)/_lib/` (data, tests, `isolation.test.ts`)
     to match the pattern. `npm install --save-exact three@0.186.1
     @react-three/fiber@9.8.2 @react-three/drei@10.7.9 && npm install
     --save-exact --save-dev @types/three@0.186.0` (check the exact
     `@types/three` version exists; use the nearest published). The lockfile
     changes once, here.
  2. `scripts/vendor-elements.ts` (run by hand, output committed): fetch
     `https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json`
     and `…/LICENSE.md`, keep `number <= 118` and the fields `number, symbol,
     name, category, xpos, ypos, atomic_mass, phase, melt, boil, shells,
     electron_configuration, electron_configuration_semantic, discovered_by,
     summary, source, bohr_model_3d`, and write a formatted
     `app/(elements)/_lib/elements.ts` (a typed `Element` interface and an
     `ELEMENTS` array, `export const`, nulls kept as `null`) and
     `app/(elements)/_lib/LICENSE.md`. Run it once and commit the output;
     nothing is fetched at runtime. If the pod has no network, record a
     decision and write the file from the pinned upstream data you can reach;
     never hand-type element data.
  3. `categories.ts`: map the 15 raw category strings to ten legend ids
     (`alkali-metal, alkaline-earth-metal, transition-metal,
     post-transition-metal, metalloid, nonmetal, noble-gas, lanthanide,
     actinide, unknown`) with a label and a colour per id (colour pairs for
     light and dark paper, 3:1 against both); `categoryOf(el)`.
  4. `grid.ts`: `place(el)` returns `{ col: xpos, row: ypos }`; `MARKERS` for
     the two series markers at (3,6) "57–71" and (3,7) "89–103";
     `neighbour(from, dir, all)` returns the nearest element in an arrow
     direction (skipping gaps: Ba → Hf on ArrowRight, Ba ↓ Ra; the
     lanthanide row reachable from below La's gap), plus `rowEnd`/`rowStart`
     for Home/End.
  5. `atom.ts` (no `three` import): `rings(shells, t)` and `nucleus(protons,
     neutrons, cap = 64)` exactly as in research.md ("3D element model", pure
     maths), `project2d()` for the SVG, and `neutronsOf(el) =
     round(atomic_mass) − number`.
  6. `view.ts`: a pure reducer over `{ open: number | null }` with actions
     `open(n)`, `close`, `next`, `prev` (clamped to 1..118).
  7. `facts.ts`: a typed accessor `factOf(n)` over `funFacts.json`, and
     `isNeedsReview(n)`.
  8. `funFacts.json`: `{"1": {"fact": "...", "sourceUrl": "https://..."}, ...,
     "needsReview": [..]}` for 1–118. Each fact is one sentence in our own
     words, at most 200 characters, ends with a full stop, surprising but
     checkable at its `sourceUrl` (Wikipedia, NIST, IUPAC, PubChem, NASA,
     RSC or Los Alamos as a citation only), suitable for all ages. Do not
     invent; when unsure use a conservative documented fact and list the
     number in `needsReview`. Elements 104–118 go in `needsReview` unless
     checked against the source.
  9. Tests (node:test) in `app/(elements)/_lib/`:
     - `elements.test.ts`: exactly 118 entries, numbers 1..118 in order,
       unique symbols, every `source` starts with `https://en.wikipedia.org/`,
       `shells` sums to `number`, every raw category maps to a legend id,
       positions are unique, row counts by `ypos` are 2, 8, 8, 18, 18, 17, 17,
       0, 15, 15, no element 119, `LICENSE.md` contains "Attribution-ShareAlike".
     - `facts.test.ts` (the validator): keys are exactly "1".."118" plus
       `needsReview`; each fact is a non-empty string of at most 200
       characters, ends with `.`, has no `http`; each `sourceUrl` is `https://`
       on an allowlisted host (`en.wikipedia.org, periodic-table.rsc.org,
       www.rsc.org, www.nist.gov, physics.nist.gov, pubchem.ncbi.nlm.nih.gov,
       iupac.org, www.lanl.gov, science.nasa.gov`); facts are unique;
       `needsReview` is an array of unique integers in 1..118. It reads the
       JSON with `readFileSync`, and prints the first offending key on failure.
     - `grid.test.ts`: H at (1,1), He at (18,1), La at (3,9), Lu at (17,9), Ac
       at (3,10), Lr at (17,10), the series rows only use columns 3..17, both
       markers present, `neighbour` cases above, Home/End.
     - `atom.test.ts`: ring count equals `shells.length` for all 118; electrons
       per ring equal the shell entry and the sum equals the atomic number;
       radii strictly increase; electrons evenly spaced; `t = 0` deterministic;
       `nucleus` count is `min(cap, p + n)`, the proton share is preserved
       within one, at least one of each kind when both exist, every point
       inside the radius, `capped` label "showing 64 of 294 nucleons" for
       oganesson; no `NaN` anywhere.
     - `view.test.ts`: `open(26)` then `next` is 27; `prev` from 1 stays 1;
       `next` from 118 stays 118; `close` clears; `next` when closed is a no-op.
     - `isolation.test.ts`: copy Sun's and adapt: files under `app/(elements)/`
       import nothing from `app/(site)`, `app/(shore)`, `app/(capsule)`,
       `app/(sun)` or `components/`; and no file except
       `_components/atom-3d.tsx` imports `three`, `@react-three/fiber` or
       `@react-three/drei`; `_lib/` files import no React.
  10. `package.json`: add `'app/(elements)/_lib/*.test.ts'` to the `test`
      glob and `"elements:validate"` running `facts.test.ts` and
      `elements.test.ts` with the same node flags.
  11. `README.md`: a "Elements" section (layout block line, data sources and
      licences: Bowserinator CC BY-SA 3.0 and the Wikipedia summaries, our
      own-words facts, the three MIT libraries; how to add or edit a fact and
      what `needsReview` means; `npm run elements:validate`; how to rerun the
      vendor script).
  12. Commit and push with the owner identity.
- **Interfaces:** `scripts/vendor-elements.ts`; `app/(elements)/_lib/`;
  `package.json`; `package-lock.json`; `README.md`
- **Non-goals:** any page, layout, CSS or component; `three` imports anywhere;
  a runtime fetch; ajv or any test dependency; changes to other route groups.
- **Acceptance:** `npm test` also runs the Elements tests and they pass: 118
  vendored elements with their licence, 118 sourced facts within the schema
  and length rules, correct grid positions including the lanthanide and
  actinide rows, the shell-to-ring mapping, and the dialog reducer.
  `npm run elements:validate` is the one-command check for facts and data. The
  site is unchanged.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `npm run elements:validate`
  - `grep -q "app/(elements)/_lib/\*.test.ts" package.json`
  - `node -e 'const d=require("./package.json").dependencies;for(const k of ["three","@react-three/fiber","@react-three/drei"]){if(!/^\d+\.\d+\.\d+$/.test(d[k])){console.error("not pinned:",k,d[k]);process.exit(1)}}'`
  - `grep -q "Attribution-ShareAlike" 'app/(elements)/_lib/LICENSE.md'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. The table, the detail view and the SVG atom

- **Role:** software_engineer, depends on 1. QA is required.
- **Problem:** There is no Elements page. Visitors need the table, the legend,
  keyboard navigation and a detail view that works without any 3D code, and
  the repo needs a walk that proves it.
- **Action items:**
  1. Read `AGENTS.md`, the Next 16 docs you touch (`node_modules/next/dist/docs/`
     lazy-loading and routing guides) and `app/(sun)/layout.tsx`,
     `app/(capsule)/_components/album.tsx`, `scripts/walk-sun.sh`.
  2. `app/(elements)/layout.tsx`: own `<html lang="en">`, `elements.css`, the
     `build-sha` meta (as Sun's), a system font stack (no `next/font`), title
     template, `themeColor`, and an inline script applying `localStorage.theme`
     to `data-theme` before paint (re-implemented, not imported).
  3. `elements/page.tsx` (server, `title: { absolute: "Elements" }`): top bar
     with `<a href="/">otohime.dev</a>`, `<h1>`, the legend (ten
     `<button data-legend="<id>">`), the table region
     (`role="region" aria-label="Periodic table"`, scroll container, CSS grid
     of 18 columns × 10 rows, row 8 a spacer), the two marker cells, and a
     footer naming the dataset and CC BY-SA 3.0 with links. `cell.tsx` renders
     `<a data-element="<n>" href="/elements/<symbol>" aria-label="Hydrogen,
     atomic number 1, nonmetal">` with number, symbol, name and mass (3
     decimals), `--cat` set from `categories.ts`.
  4. `table.tsx` (client island, `"use client"`): roving `tabindex` (one tab
     stop), arrow keys via `neighbour`, Home/End, legend hover/focus sets
     `data-focus="<id>"` on the table (CSS dims others to `opacity: .35`),
     click or Enter/Space on a cell calls `preventDefault` and dispatches
     `open(n)`; modified clicks (ctrl/meta/shift/middle) follow the link.
  5. `element-dialog.tsx` (client): native `<dialog>` with `showModal()`, the
     `view.ts` reducer, Esc/Close/backdrop click land in one `closed`
     handler, focus returns to the opening cell, ArrowLeft/ArrowRight and the
     Prev/Next buttons step (disabled at 1 and 118), `aria-labelledby`.
     Layout order: viewport (`BohrSvg` for now), name, symbol, number,
     category chip, then `element-detail.tsx`. Bottom sheet under 768 px
     (`inset: auto 0 0 0; max-height: 90dvh; border-radius: 16px 16px 0 0`,
     slide-in transition, none under reduced motion). The dialog imports the
     dataset; the table page does not ship `elements.ts` to the client beyond
     what the cells already render.
  6. `element-detail.tsx` (shared, server-renderable): a "Did you know?" card
     (visually distinct) with the fact and a "source" link; a `<dl>` of
     atomic mass, phase, electron configuration (semantic), discovered by,
     melting point, boiling point in K with °C in brackets and "not known"
     for nulls; the Wikipedia summary with "Summary from Wikipedia, CC BY-SA
     3.0" linking the element's `source` and the licence URL.
  7. `bohr-svg.tsx`: the 2D diagram from `rings`/`nucleus`/`project2d`
     (nucleus cluster, one circle per shell, electrons at `t = 0`), tinted by
     category, `role="img"` with an `aria-label` such as "Bohr diagram of
     iron: shells of 2, 8, 14 and 2 electrons". It is used by the dialog and
     the static pages and becomes the 3D loading and fallback state in task 3.
  8. `elements/[symbol]/page.tsx`: static via `generateStaticParams` (118
     lowercase symbols), renders the same detail with `BohrSvg`, a back link
     to `/elements`, per-element `generateMetadata` title; an unknown symbol
     calls `notFound()` ("Nothing in this parcel" like the other groups).
  9. `elements.css` by hand, no Tailwind: tokens for light and dark
     (`prefers-color-scheme` plus `[data-theme]`), grid, cells at least 44 px
     (46 px under 768 px), hover/focus scale 1.08 with
     `cubic-bezier(.34,1.56,.64,1)`, focus-visible rings, dialog, sheet,
     `touch-action: pan-x pan-y pinch-zoom` on the scroller, and a
     `@media (prefers-reduced-motion: reduce)` block removing transitions and
     animations. Body text at least 12 px at 390 px; the page itself must not
     scroll sideways at 390 px (only the table scroller may).
  10. `content/site.ts`: add the Projects row `{ title: "Elements", note: "All
      118, each with a spinning atom and one surprising fact.", href:
      "/elements", status: "live", colour: "blue" }` (check the `colour`
      union; use the nearest valid value). `lib/build-stamp.test.ts` gets the
      Elements layout line; `e2e/rbac.test.ts` expects `/projects` to link
      `/elements` and `/elements` to answer 200 without `aria-label="Main"`.
  11. `scripts/walk-elements.sh` (copy of `walk-sun.sh`, port 4029, local and
      `BASE_URL` modes, `check` helper, `grep -c` and numeric compares only,
      no `wc -l`). Checks on `/elements`: 200, `<title>Elements</title>`, no
      `aria-label="Main"`, `build-sha`, exactly 118 `data-element="`, exactly
      10 `data-legend="`, `57–71`, `89–103`, the CC BY-SA licence link, the
      dataset link; the HTML has no `/_next/static/chunks/` script whose name
      contains `three`; one stylesheet with `prefers-reduced-motion` and none
      of `--tw-`. `/elements/fe`: 200, contains iron's fact text and its
      `sourceUrl` (both read from `funFacts.json` with node), "Did you know",
      and the summary attribution. `/elements/xx`: 404 "Nothing in this
      parcel". The site, `/projects`, `/shore`, `/capsule`, `/sun` answer 200.
  12. `README.md`: Elements layout line and the walk line.
  13. Run the walk on this lease; it must exit 0. `pkill -x next-server`
      afterwards. Commit and push with the owner identity.
- **Interfaces:** `app/(elements)/`; `scripts/walk-elements.sh`;
  `content/site.ts`; `lib/build-stamp.test.ts`; `e2e/rbac.test.ts`;
  `README.md`
- **Non-goals:** any `three`, fiber or drei import (task 3); the GLB flag;
  `role="grid"`; property filters; changing the URL from the dialog; a client
  data fetch; changes to `app/(site)/` styling or the other route groups; CI
  workflow changes.
- **Acceptance:** `/elements` serves the full 18-column table with the two
  series rows aligned under the group gap, a legend that dims the other
  categories, hover and focus lift, arrow-key navigation and 44 px targets.
  Click or Enter/Space opens a dialog (a bottom sheet on a phone) with the
  Bohr SVG, name, symbol, number, category chip, a "Did you know?" card with
  the element's own fact, key stats, Wikipedia attribution, working Prev/Next,
  Esc and Close, and focus returns to the cell. `/elements/<symbol>` shows the
  same detail without JavaScript. Dark and light themes both work. The page
  loads no 3D code. `bash scripts/walk-elements.sh` exits 0 on the delivery
  sha. `/projects` links Elements once; other pages are unchanged.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-elements.sh && ! grep -nE 'wc +-l' scripts/walk-elements.sh`
  - `bash scripts/walk-elements.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4029/; then exit 1; fi`
    (no server left behind)
  - `if BASE_URL=http://127.0.0.1:4039 bash scripts/walk-elements.sh; then exit 1; fi`
    (the walk fails when Elements is not there)
  - `! grep -rnE "from ['\"](three|@react-three)" 'app/(elements)'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. The 3D atom

- **Role:** software_engineer, depends on 2. QA is required.
- **Problem:** The dialog shows a flat SVG. The brief asks for an interactive
  3D Bohr atom that loads only on the first click, survives 118 swaps without
  growth, respects reduced motion and falls back when WebGL fails.
- **Action items:**
  1. Read `AGENTS.md`, the Next 16 lazy-loading guide and the R3F/drei docs
     for `Canvas`, `OrbitControls`, `Environment`, `Lightformer`.
  2. `_lib/webgl.ts`: `hasWebGL()` probing `webgl2` then `webgl` on a
     throwaway canvas once (cached); no `three` import.
  3. `_components/atom-3d.tsx` (`"use client"`, default export, the only file
     that imports `three`, `@react-three/fiber`, `@react-three/drei`, with
     named drei imports only): one `<Canvas dpr={[1, 1.5]}>` that stays
     mounted; props `{ element, reducedMotion, onFail }`. Nucleus: one
     `InstancedMesh` (sphere 12×8, capacity 64) from `nucleus()`, protons in
     the category colour and neutrons grey via `setColorAt`, setting
     `instanceMatrix.needsUpdate` and `instanceColor.needsUpdate = true` and
     `mesh.count` on every element change. Electrons: one `InstancedMesh`
     (capacity 118) advanced in `useFrame` from `rings(shells, t)` (different
     speeds and tilts). Rings: seven `TorusGeometry` meshes created once,
     `visible` set by shell count, tinted. Lights: hemisphere light, one key
     point light, `<Environment resolution={64}>` with two `<Lightformer>`s
     (no `preset`, no HDR fetch). `OrbitControls`: `enablePan={false}`,
     `minDistance`/`maxDistance`, `enableDamping`, slow `autoRotate` that
     pauses `onStart` and resumes 4 s after `onEnd`. Reduced motion:
     `autoRotate={false}`, electrons held at `t = 0`, `frameloop="demand"`.
     `webglcontextlost` calls `onFail`. Pause rendering (`frameloop="never"`
     or `demand`) while the dialog is closed.
  4. `element-dialog.tsx`: `const Atom3D = dynamic(() => import("./atom-3d"),
     { ssr: false, loading: () => <BohrSvg …/> })`, rendered only after the
     first open and only if `hasWebGL()` is true; the instance persists across
     prev/next and across close/reopen. `onFail` or no WebGL renders
     `BohrSvg`. Read `prefers-reduced-motion` with `matchMedia` and update on
     change. A small caption "Bohr model: a simplified picture" and, for
     capped nuclei, "showing 64 of N nucleons".
  5. GLB flag: when `process.env.NEXT_PUBLIC_ELEMENTS_GLB === "1"`, try drei
     `useGLTF` on the element's `bohr_model_3d` inside `<Suspense>` with the
     procedural atom as fallback and as the error boundary result; off by
     default; document it. The URL is already in `elements.ts` (task 1).
  6. Extend `scripts/walk-elements.sh`: the `/elements` HTML preloads no chunk
     whose name contains `three`; after `npm run build`, an in-script check
     that some chunk under `.next/static/chunks/` contains the string
     `InstancedMesh` and that the `/elements` HTML does not reference it
     (local mode only).
  7. `README.md`: 3D notes (lazy chunk, fixed allocations, reduced motion,
     fallback, GLB flag and its licence caveat).
  8. Run lint, typecheck, tests, build and the walk; stop servers with
     `pkill -x next-server`. Commit and push with the owner identity.
- **Interfaces:** `app/(elements)/_components/atom-3d.tsx`;
  `app/(elements)/_components/element-dialog.tsx`;
  `app/(elements)/_lib/webgl.ts`; `scripts/walk-elements.sh`; `README.md`
- **Non-goals:** a GLB vendored into the repo; a CDN HDR or any runtime fetch
  of a texture; per-element geometry or material; property filters; changing
  the table page or its bundle; Fiber 10 or WebGPU; CI changes.
- **Acceptance:** Opening the first element requests the 3D chunk and the
  SVG shows meanwhile; the page before the click loads none of it. The atom
  shows a tinted nucleus cluster, one ring per shell with electrons orbiting
  at different speeds, soft light, drag to rotate, wheel/pinch zoom within
  limits and auto-rotate that pauses on interaction. Prev/Next swap the
  contents inside the same Canvas. Under reduced motion nothing moves. With
  no WebGL (or a lost context) the SVG diagram stays. The isolation test and
  the walk prove the table page never pulls `three`.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `npm run build`
  - `bash scripts/walk-elements.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4029/; then exit 1; fi`
  - `test "$(grep -rlE "from ['\"](three|@react-three)" 'app/(elements)' | grep -v 'atom-3d.tsx' | wc -c | tr -d ' ')" = 0`
  - `grep -q "next/dynamic" 'app/(elements)/_components/element-dialog.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA notes (for tasks 2 and 3)

Rerun the task's verification on the delivery sha, then Playwright (playwright-core
from a scratch directory, never in the repo) at 1366×768 and 390×844 with
`reducedMotion` both ways: click hydrogen, the dialog shows "Did you know?" with
hydrogen's fact, Next reaches helium, Esc closes and focus returns to the hydrogen
cell, arrow keys move between cells (Ba → Hf), the legend dims others, the page
has no horizontal overflow at 390 (the table scroller may scroll). Task 3 adds: a
Chrome run with `--use-angle=swiftshader --enable-unsafe-swiftshader` sees a
`<canvas>` with a WebGL context; a run with `--disable-gpu
--disable-software-rasterizer` sees the SVG; click through all 118 sampling
`JSHeapUsedSize` every 20 elements after a GC (last within 10% of first) with an
empty console; Lighthouse desktop 90+ on `/elements`; spot-check ten facts against
their URLs. A missing browser is a note, not a fail. Acceptance walks production
if `build-sha` has caught up, else a local `next start` with a watch on
`https://otohime.dev/elements`.

## Risks

Licence drift (keep summary text, LICENSE.md and page attribution together; facts
must be original wording), the lazy chunk leaking into the page (isolation test +
walk), `instanceColor.needsUpdate` forgotten, drei imported wholesale, headless
Chrome silently taking the SVG fallback, hydration (dialog starts closed, reducer
has no clock).

## Open questions and assumptions

- Route `/elements` and the title "Elements" are assumed.
- GLB models stay behind a flag, off, until the owner confirms the bucket's terms.
- "Key stats" are the six listed plus the attributed Wikipedia summary.
- One `<dialog>` serves desktop modal and mobile sheet; the URL does not change on open.
- The fun-fact source link is taken as enough attribution for own-words facts.
- No clarifying question blocks the work.
