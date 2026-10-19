# Research: redesign /sun as a simple one-page, hand-drawn infographic (pm-189, run-6362)

**Idea.** Redesign https://otohime.dev/sun. Feedback: (1) too many words, (2) the graphic is poor. Make it a simple one-page infographic in a hand-drawn art style.

**Short answer.** Replace the eight-chapter tour with one static, server-rendered poster: a single rough-inked cutaway of the Sun with six numbered callouts, four stat badges, a three-step life strip and a one-line sources footer, on cream paper in a hand-lettered font. Cut the visible words from about 860 to at most 220. Draw the ink with rough.js on the server (deterministic seed, zero client JavaScript) and keep only a draw-on entrance plus three gentle loops, all off under reduced motion. Keep the sourced fact data, the isolation test, the build-sha meta, the walk script and the owner commit identity. Everything below is from the repo at 49b3e45 and the live page served at that sha on 2026-10-19.

## 1. What is there today (pm-188, shipped at 49b3e45)

- `app/(sun)/`: own root layout and `sun.css` (dark navy "sky", UI sans-serif), `sun/page.tsx` (server) rendering a client `SunApp` (tour reducer at 12 fps, Back/Next/Play, eight dots, live caption, two counters, a facts panel) above eight server-rendered chapter sections that repeat every fact. `stage.tsx` is an 800x500 SVG: six concentric layers (compass-perfect arcs, flat fills, 1.5 px ink, a feTurbulence wobble on the static layers only), a legend block, and eight always-rendered scene groups switched by `data-chapter`. ~30 keyframe families.
- Data: `_lib/sun.ts` has 8 chapters, 32 facts, 3 sources; `sun.test.ts` refuses an unsourced fact or a non-NASA/Wikipedia URL. `tour.ts`/`tour.test.ts` pin the tour rules. `scenes.test.ts` reads `stage.tsx` and `sun.css` as text and demands a `data-scene` and `@keyframes sun-<id>-` per chapter, a reduced-motion block and no raster/video/canvas. `isolation.test.ts` fences imports both ways.
- `scripts/walk-sun.sh` (port 4027, local and `BASE_URL` modes) checks: 8 `data-chapter-section`, 8 `data-scene`, the strings `15.7 million K`, `170,000 years`, `8 min 19 s`, `Next`, `Play`, `aria-live="polite"`, the NASA facts href, one stylesheet with `prefers-reduced-motion` and no Tailwind, plus the site pages.
- `e2e/rbac.test.ts` expects `/projects` to link `/sun` and `/sun` to return 200 without `aria-label="Main"`. `lib/build-stamp.test.ts` expects the layout's `build-sha` meta. `content/site.ts` holds the Projects row ("Eight chapters through a star, one layer at a time."). README documents the route group, the walk and "how to add a chapter".
- No browser runs on this pod; the graphic was judged from the SVG source and pm-188's QA report (qa-t-1077.md), which already noted labels at ~7 px on a 390 px phone, a life scene not to scale and wind lines touching labels.

### Why it reads as "too many words"

Measured on the live HTML (body text, scripts and styles stripped):

| Region | Words |
| --- | --- |
| Whole page | 861 |
| The eight chapter sections (repeat the stage facts) | 611 |
| Labels inside the SVG | 92 |
| Inline "NASA"/"Wikipedia" source links | 32 |

Infographic practice: the most-shared infographics average about 227-230 words, and an A1 poster should stay under 200 (Visme, https://visme.co/blog/infographic-best-practices/; Animate Your Science, https://www.animateyour.science/post/10-tips-for-creating-an-effective-scientific-infographic). The page carries four times that, and says each fact twice (stage panel and chapter section).

### Why the graphic reads as "poor"

- It is a diagram, not a drawing: perfect circles and arcs, flat fills, hairline ink, no stroke character. The wobble filter only jitters the edges; it does not make a hand-drawn line.
- A dark app chrome, not a poster: navy panels, pill buttons, dots, a legend block and an explanatory note are UI, not illustration.
- Eight scenes share one 800x500 box, each with its own lens inset, dashed leader lines and caption text. Any single frame looks busy.
- UI sans-serif text inside the SVG, scaled to ~7 px at 390 px wide.
- The visitor must click through a tour to see the whole story; an infographic shows it at a glance.

## 2. Recommendation

One scrolling page, no tour, no client component: title, one rough-inked cutaway (quarter cut away, six layers in hachure fills, numbered ink badges 1-6, Earth at true ratio), six numbered HTML callouts, four stat badges, a three-step life strip, one sources line. Hand-lettered with Caveat (title) and Patrick Hand (labels) via `next/font/google` with Capsule's cursive stack as fallback; cream paper; ink drawn by rough.js 4.6.6 (`generator` + `toPaths`, fixed seed) on the server; draw-on entrance plus three loops (convection arrows, photon zigzag, wind dashes), all `animation: none` under `prefers-reduced-motion`.

Draft words (about 150 of the 220 budget):

| Where | Text |
| --- | --- |
| 1 Core | 15.7 million K. Hydrogen fuses into helium here. |
| 2 Radiative zone | Light bounces for about 170,000 years to get out. |
| 3 Convection zone | Boiling plasma carries the heat the last 200,000 km. |
| 4 Photosphere | The surface we see: 500 km thin, 5,772 K, dotted with sunspots. |
| 5 Chromosphere | A 2,500 km red rim, seen in a total eclipse. |
| 6 Corona | 1 to 2 million K, hotter than the surface. It streams away as the solar wind. |
| Badges | 109 Earths across · 8 min 19 s · 15.7 million K · 4.6 billion years |
| Strip | Today · Red giant · White dwarf |

Word budget: target 200, hard cap 220, counted on the served HTML of `/sun` (SVG text included), enforced in `scripts/walk-sun.sh` and by a unit test on the data.

Drop: `sun-app.tsx`, the tour, counters, dots, legend block, wobble filter, the eight chapter sections. Keep the route, layout, `build-sha` meta, `isolation.test.ts`, `format.ts`, the Projects row and the walk.

Layout: desktop two columns (drawing ~60 %, callouts right), badges in a row, strip full width; phone one column, badges 2x2, SVG holds only the drawing and number badges (no text under ~12 px); `viewBox` roughly square (640x600); no sideways scroll at 390 px.

## 3. Files to change

`_lib/sun.ts` (reshape; keep SOURCES, per-fact source, LIGHT_SECONDS, PHOTON_YEARS), `sun.test.ts` (keep provenance and tiling; poster shapes and word budget), delete `tour.ts`, `tour.test.ts`, `sun-app.tsx`, `fact-list.tsx`, rewrite `stage.tsx` as a server component, `scenes.test.ts` becomes `poster.test.ts`, `sun.css`, `layout.tsx` (fonts, paper theme colour), `scripts/walk-sun.sh`, `content/site.ts`, `README.md`, `package.json` (`roughjs` exact version). `e2e/rbac.test.ts` and `lib/build-stamp.test.ts` unchanged.

Split: (1) engine and data, qa skip; (2) the poster page, QA required; (3) ink motion, QA required.

## 4. Risks

- **Google Fonts at build.** `next/font/google` downloads at build time; with no egress to fonts.gstatic.com the Turbopack build fails, and `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` does not cover font files (vercel/next.js #99114, #97378). Reversible fallback: swap the two `next/font` calls for Capsule's system cursive stack. No `.woff2` in the repo.
- **Deterministic ink.** Output depends on `seed` and library version; pin `roughjs` exactly and snapshot a hash of one path.
- **Scale honesty survives.** Atmosphere thicker than true scale, callouts carry real thicknesses; Earth at true ratio.
- **Screen readers.** Callouts, badges and strip are plain HTML; SVG is `role="img"` with an `aria-label` naming the six layers.
- The named plan document `projects/20260921222547_plan_manager_chief_of_staff_extraction.md` is not in the repo; AGENTS.md and the pm-188 plan were used instead.
- The pod has no browser; the first QA on task 2 should use one (headless Chrome via playwright-core from a scratch directory) at 1366x768 and 390x844, motion on and off.

## Sources

- Live page and repo: https://otohime.dev/sun at build-sha 49b3e45; `app/(sun)/**`, `scripts/walk-sun.sh`, `projects/create-an-animated-infographic-to-describe-the-sun-its-struc/`.
- Next.js font module: https://nextjs.org/docs/app/api-reference/components/font
- Google Fonts build failures: https://github.com/vercel/next.js/issues/99114, https://github.com/vercel/next.js/issues/97378
- rough.js: https://github.com/rough-stuff/rough (MIT)
- Fonts: Patrick Hand https://fontsource.org/fonts/patrick-hand/about (OFL 1.1); Caveat https://github.com/googlefonts/caveat (OFL 1.1)
- Infographic word counts: https://visme.co/blog/infographic-best-practices/ ; https://www.animateyour.science/post/10-tips-for-creating-an-effective-scientific-infographic
