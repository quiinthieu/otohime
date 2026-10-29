# pm-302 research: Ink Slime Mould and Paper Strata (otohime.dev)

Note: /shared/artifacts/answer.md could not be written because /shared is a read-only filesystem in this pod. This body is the full answer.

Verdict: build both. They are independent, so they can ship as separate plans. Two scope decisions matter:
- Put the Mould on /play/mould first and make the Work/Projects veins a second step. The brief centres on Work/Projects, but the Work page has only four stations.
- Build Strata from a new weekly data index, because the current data is too thin (see Strata).

## What the repo already gives us (checked)
- Next.js 16.4.2, React 19.3, three 0.186.1. Next.js has breaking changes, so read node_modules/next/dist/docs/ first, as AGENTS.md requires.
- The /play toys follow a fixed pattern. app/(site)/(app)/play/senko/ holds page.tsx, _components/senko-loader.tsx and _components/senko-stage.tsx. The loader is a next/dynamic import with ssr:false. A pure, tested _lib/*.ts sits beside it, and there is an opengraph-image.tsx and a CSS file. Both new pages should copy this.
- Senko reads prefers-reduced-motion and sets canvas.dataset.reducedMotion, so e2e can assert on it. Reuse that.
- Tests run with node --test over explicit globs in package.json. Any new _lib/*.test.ts must be added to that glob list, or it will silently not run. There is also test:e2e with playwright-core.
- AudioContext is already used in app/(ryugu)/_components/ambience.tsx and app/(vinyl)/_lib/crackle.ts. The vinyl crackle is the closest model for a synthesised paper rustle.
- Data sources:
  - content/site.ts site.projects[] has title, href, status, colour, started, shipped, lastActivityAt.
  - content/ledger.json, parsed by lib/ledger-data.ts, has per-day {commits, notes, sketches, releases}. It currently holds only 3 days (2026-09-03 to 2026-10-12).
  - content/yearly-log.json, built by scripts/yearly-log.ts, has 12 monthly buckets with commits.
  - scripts/history-index.ts already walks git history at build time.
- components/pipeline.tsx draws the Work page as 4 stations (source, queue, warehouse, dashboard) joined by 3 pipes, in SVG with a simulated packet flow in lib/pipeline.ts. It is illustrative and reads no real throughput.

## 1. Ink Slime Mould

### Approach
Run a physarum simulation on the GPU:
- Agents sense a trail map at three forward probes, turn toward the highest value, step, and deposit.
- The trail map then diffuses and decays. This is the standard Jeff Jones (2010) model.
- Food sources are fixed attractors. They add a constant chemo-attractant to the trail map, so veins form between them.

Rendering as sumi ink:
- Map trail intensity through a paper-white to ink-black ramp with a noise-based edge bleed, so the veins look like brush strokes. Optionally tint with the site's riso swatches.
- A faint grain texture gives the paper feel.

### Implementation options
- A. Raw WebGL2 ping-pong float textures, plus a separate agent pass. Smallest bundle and full control. Agent updates need transform feedback or a data-texture trick. Recommended for the toy.
- B. three.js GPUComputationRenderer. Already a dependency, so there is no extra weight. Slower to tune.
- C. Agent-free trail-only approximation. Cheap and works on weak GPUs, but looks less like a real mould. Use as the fallback path.

Recommendation: A for /play/mould, with a deterministic seeded CPU reference in _lib/mould.ts. The CPU version (about 5-20k agents on a small grid) is the unit-test oracle and also the fallback when WebGL2 or float textures are missing (EXT_color_buffer_float) or reduced motion is set. This matches the repo's "deterministic core + stage" split, as seen in Senko and Ennichi.

### The real-data feature
- Food nodes are the site.projects entries, plus the four pipeline stations on Work.
- Edges to emphasise are derived from the data. Pipeline stations link in order. Projects link by shared tags or colour, or by recency proximity.
- Vein thickness is the deposit weight, taken from per-project commit counts. The counts need a small build-time script, in the style of history-index.ts, that emits content/mould-graph.json (node id, x/y seed, weight). Do not call GitHub from the browser.
- The Work page currently has no throughput data. Honest options are commit counts, or explicitly labelled as "illustrative". Do not present fake throughput as real.

### Risks and mitigations
- GPU variance and mobile battery: cap the agent count by devicePixelRatio and viewport, pause when off-screen (IntersectionObserver) or when the tab is hidden, and honour reduced motion with a static frozen frame.
- Float texture support on iOS: probe at start and fall back to the CPU/trail-only path.
- Layout: placing nodes over DOM elements on Work and Projects means mapping DOM rects to sim coordinates on resize. Start with a self-contained canvas that has its own labelled nodes, then embed it.
- Hydration: keep the stage client-only via the dynamic loader, as Senko does.

### Suggested split
1. _lib/mould.ts: seeded CPU model, node and edge layout, vein weights, with unit tests.
2. WebGL2 renderer plus stage, with the ink shader and fallback.
3. /play/mould toy: click to drop food, drag to repel or erase, reset, reduced-motion state, OG image, and a link from /play.
4. Data script that emits content/mould-graph.json, and the embedded version on Work and Projects.

## 2. Paper Strata

### Approach
Each year is a terrain of stacked cut-paper layers:
- The year's weeks form the x axis (about 52).
- Each week's activity value gives that column's height.
- The terrain is quantised into N contour bands. Each band is one sheet of coloured paper with a wavy cut outline, drawn as a polygon, with a soft drop shadow.
- Rendering: SVG with drop-shadow is accessible and simple. About 5-8 layers of one path each is cheap. Recommended. Canvas 2D is the fallback for many layers. three.js only if real depth parallax is wanted, which is probably unnecessary.
- Pointer parallax: each layer translates by depth * pointerOffset. Use CSS variables updated on a rAF-throttled pointermove, plus device tilt on mobile if permission is granted. Disable it for reduced motion.
- Hover details: a nearest-week lookup shows a tooltip with the week range, commits, notes and any shipped projects. Make it keyboard-reachable with arrow keys moving between weeks, with aria-live text.
- Year scrubber: a range input or a custom slider with years as stops. Stepping plays a short paper-rustle: a filtered noise burst (band-passed white noise with a fast envelope) from the Web Audio API, started only after a user gesture, and with a mute toggle. For reduced motion, cross-fade the layer morph instead of tweening.

### The data problem (the main risk)
- The inspiration says GitHub contributions, but the current data is thin: ledger.json has 3 days, and yearly-log.json is monthly and covers one year.
- Weekly resolution across several years needs a new build-time index. Take it from git log (as history-index.ts does), bucketed by ISO week into content/strata.json.
- The repo's own history may start in 2026, so the scrubber may have a single year. Choices:
  - (a) ship with whatever years exist and make the scrubber degrade gracefully to one year (simple, honest, recommended);
  - (b) add the GitHub GraphQL contributions calendar, which gives multi-year data. This needs a token at build time, so it must fail open to the committed JSON.
- Do not call any API from the browser. Follow the yearly-log fallback model: committed JSON is the fallback when git is shallow or absent. A shallow CI clone must not produce an empty year.
- Add a strata:check script like yearly-log:check if the file is generated.

### Where it lives
A new route, either /strata as its own sibling or /play/strata. It reads best next to the Ledger (/ledger) and Making-of pages, so link it from there. Pure _lib (week bucketing, band quantisation, outline path generation with a seeded wobble) gets the node tests.

### Risks and mitigations
- Sound autoplay is blocked: create the AudioContext on the first gesture and keep the sound optional.
- Many SVG filters can be slow in Safari: use one shared shadow filter, or CSS drop-shadow on a group per layer, and test on a throttled profile.
- Colour contrast: use the site swatch tokens and check contrast against the paper colour so tooltips stay legible.
- Empty weeks make flat terrain: apply a minimum band height and a log or sqrt scale so a few heavy weeks do not flatten the rest.

## Suggested split
1. Weekly index script, schema, committed content/strata.json, a parser with tests, and a check script.
2. _lib/strata.ts: bucketing, scales, band polygons, seeded outline. Tested.
3. Stage component with SVG layers, parallax and hover/keyboard details.
4. Scrubber, rustle audio, reduced-motion and mute handling, OG image, and cross-links.

## Cross-cutting
- Both features need entries in the explicit test globs in package.json, and e2e specs under e2e/ (canvas present, reduced-motion attribute set, no console errors).
- Both need a changelog entry and a link from /play (or Work/Ledger).
- Both should reuse the existing paper/ink design tokens and FigTitle, and add a ViewTransition wrapper like the other pages.
- Order: Strata's data index first (small, unblocks its stage), Mould's CPU model first on its side. The two can run in parallel. Mould is the larger and riskier of the two.
- Estimate: about 4 tasks each. Mould is the heavier, because of the shader and the fallback paths.

## Not verified
I did not open the two inspiration tweets (no fetch was made). The scope above follows the brief's description of them. I did not check how far back the repo's git history goes, which decides whether the Strata scrubber has more than one year.
