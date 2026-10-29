# Plan: Ink Mould & Paper Strata (`pm-302`)

- **Plan ID**: `pm-302`
- **Product Title**: Ink Mould & Paper Strata
- **Plan Folder**: `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/`
- **Prerequisites Manifest**: `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/prerequisites.json`
- **Prior Research**: `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/research.md` (`rep-5799`)

## Overview

This plan delivers two tactile paper-and-ink pieces on `otohime.dev`:

1. **Paper Strata (`/strata` and `/play/strata`, cross-linked from `/ledger`, `/work`, and `/play`)** — A cut-paper terrain where weekly activity (repository commits and notes/milestones per ISO week) becomes stacked layers of coloured riso paper with soft drop shadows, pointer parallax, hover + keyboard week inspection (`ArrowLeft`, `ArrowRight`, `Home`, `End` with `aria-live="polite"` details), and a year scrubber (`2024`–`2026`, with graceful single-year degradation) accompanied by an optional Web Audio synthesized paper-rustle sound (`<= -24 dB`).
2. **Ink Slime Mould (`/play/mould` + embedded Physarum vein graphs on `/work` and `/projects`)** — A Jeff Jones (2010) Physarum transport-network simulation rendered as sumi ink on warm washi paper via WebGL2 (with an automatic Canvas 2D fallback and a deterministic seeded CPU core). On `/work` and `/projects`, pipeline stations (`source -> queue -> warehouse -> dashboard`), stack tools, and shipped/active projects act as chemo-attractant food sources so sumi-ink veins grow between them and trace the data-engineering graph, with vein thickness scaled monotonically by real repository commit counts or explicitly labelled illustrative throughput weights. On `/play/mould`, visitors can click to drop food sources, drag to repel/wipe ink veins, switch presets, and reset the petri dish.

Both features are planned together in a single 5-task DAG on `pm-302` (plan splitting is disabled on the platform).

---

## Architecture & Repository Guardrails

1. **Deterministic Core + Client Stage Pattern**:
   - Following `app/(site)/(app)/play/senko/`, each feature pairs a pure, deterministic TypeScript model (`lib/strata.ts` and `lib/mould.ts`, re-exported from each route's `_lib/` folder) with a client-only stage loaded via `next/dynamic(..., { ssr: false })`.
   - Because `package.json` runs `node ... --test 'lib/**/*.test.ts'` (alongside a fixed list of route `_lib` globs), placing the core modules and unit tests in `lib/strata.ts` + `lib/strata.test.ts` and `lib/mould.ts` + `lib/mould.test.ts` guarantees automatic `npm test` execution without touching `package.json`.
2. **Build-Time Data Indexes with Committed JSON Fallback**:
   - No GitHub or external API is ever called from the browser.
   - `scripts/strata-index.ts` (with `--check`) walks local git history, `content/site.ts`, and `content/ledger.json` to emit `content/strata.json` with 52 ISO-week buckets across `2024`–`2026` (tagging real git commits vs pre-repo project/career archive weeks and failing open to the committed `content/strata.json` when git history is shallow).
   - `scripts/mould-graph.ts` (with `--check`) walks local git history and `content/site.ts` to emit `content/mould-graph.json` with per-project commit counts, pipeline station coordinates, edges, and explicitly labelled illustrative throughput weights.
3. **Motion, Sound, and Navigation Invariants (`lib/motion.test.ts`, `lib/sound.test.ts`)**:
   - Every new `page.tsx` under `app/(site)` (`app/(site)/(app)/strata/page.tsx`, `app/(site)/(app)/play/strata/page.tsx`, and `app/(site)/(app)/play/mould/page.tsx`) wraps its root JSX element in `<ViewTransition enter="page-in" exit="page-out" default="none">` imported from `"react"`.
   - `<FigTitle>` on subroutes (`/strata`, `/play/strata`, `/play/mould`) **never** passes a `morph` prop (`morph` is pinned to the 7 `CONSOLE_MENU` pages).
   - `lib/pages.ts` (`PUBLIC_PAGES`, `CONSOLE_MENU`), `app/(site)/globals.css`, and `lib/sound.ts` (`CUES`) are **not** modified.
   - On `app/(site)/(app)/projects/page.tsx`, `<li key={project.title} className="rise cartridge-slot" style={{ "--i": i } as CSSProperties}>` and `className="project-title"` with `"--vt": \`project-${project.href.slice(1)}\`` are preserved verbatim.
   - Paper-rustle and food-drop audio use `playCustomCue` / `play` from `lib/sound-client.ts` after a user gesture with `cue.db <= MAX_DB` (`-18 dB`) and never instantiate a second `new AudioContext(`.
   - Every new feature stylesheet (`strata.css`, `mould.css`, `mould-veins.css`) places `@media (prefers-reduced-motion: reduce)` as its final rule block.

---

## Task Breakdown & Dependency Graph

- **Task 1** (`sequence: 1`, `qa: "skip"`): Paper Strata weekly activity index and pure cut-paper terrain & rustle model (`lib/strata.ts`, `lib/strata.test.ts`, `app/(site)/(app)/strata/_lib/strata.ts`, `scripts/strata-index.ts`, `content/strata.json`)
- **Task 2** (`sequence: 2`, `depends_on: ["1"]`, `qa: "required"`): Paper Strata cut-paper terrain routes (`/strata` and `/play/strata`), parallax stage, week inspector, year scrubber with rustle audio, and E2E tests
- **Task 3** (`sequence: 3`, `depends_on: []`, `qa: "skip"`): Ink Slime Mould deterministic Physarum CPU core and build-time project/pipeline graph index (`lib/mould.ts`, `lib/mould.test.ts`, `app/(site)/(app)/play/mould/_lib/mould.ts`, `scripts/mould-graph.ts`, `content/mould-graph.json`)
- **Task 4** (`sequence: 4`, `depends_on: ["2", "3"]`, `qa: "required"`): `/play/mould` WebGL2 sumi-ink Physarum toy, CPU Canvas 2D fallback, interactive food/repel tools, OG image, `/play` discovery cards, and E2E tests
- **Task 5** (`sequence: 5`, `depends_on: ["4"]`, `qa: "required"`): Work and Projects embedded sumi-ink Physarum vein network (`components/mould-veins.tsx`), commit/throughput vein scaling, cross-links, and E2E verification

---

### Task 1: Paper Strata weekly activity index and pure cut-paper terrain & rustle model

- **Role**: `software_engineer`
- **QA**: `skip` (pure data index, geometry/audio model, and unit tests; no user-visible UI route changes yet)
- **Depends on**: none
- **Interfaces**:
  - `lib/strata.ts`
  - `lib/strata.test.ts`
  - `app/(site)/(app)/strata/_lib/strata.ts`
  - `scripts/strata-index.ts`
  - `content/strata.json`
  - `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-1-evidence.md`
- **Problem**: `content/ledger.json` covers only 3 days and `content/yearly-log.json` is monthly for a single year, so Paper Strata has no weekly activity index across years, no deterministic cut-paper contour polygon generator, no pointer parallax or nearest-week keyboard lookup helper, and no bounded Web Audio paper-rustle cue builder.
- **Action items**:
  1. Create `lib/strata.ts` (and re-export its public API from `app/(site)/(app)/strata/_lib/strata.ts`) implementing:
     - `StrataWeek` (`{ isoYear: number; week: number; startDate: string; endDate: string; commits: number; notes: number; activity: number; shippedProjects: string[]; highlights: string[] }`), `StrataYearArchive` (`{ year: number; source: "git" | "archive"; totalCommits: number; totalNotes: number; peakWeek: number; weeks: StrataWeek[] }`), and `StrataData` (`{ generatedAt: string; years: StrataYearArchive[] }`).
     - `scaleWeekHeight(activity: number, maxActivity: number, minFloor?: number): number` using a square-root curve (`Math.sqrt`) with a non-zero valley floor (`minFloor = 0.08`) so zero-activity weeks still form a visible paper base and heavy weeks do not flatten the rest of the year.
     - `buildStrataLayers(yearArchive: StrataYearArchive, options?: { bandCount?: number; width?: number; height?: number; seed?: number }): StrataLayer[]` that quantises the 52-week terrain into `bandCount` (`6` by default) stacked cut-paper contour bands mapped to the site's riso swatches (`--paper-deep`, `--amber`, `--moss`, `--sky`, `--indigo`, `--vermilion`), generating deterministic seeded wavy SVG polygon path strings (`d`), per-band elevation thresholds, drop-shadow depth metadata, and weekly column anchor coordinates.
     - `computeStrataParallax(pointerX: number, pointerY: number, reducedMotion: boolean): { dx: number; dy: number }[]` returning per-layer translation offsets (`depth * pointerOffset` clamped to `[-14, 14]` px in X and `[-8, 8]` px in Y, or `{ dx: 0, dy: 0 }` when `reducedMotion` is true).
     - `findNearestStrataWeek(weeks: StrataWeek[], normalizedX: number): StrataWeek` and `stepStrataWeekIndex(currentIndex: number, key: string, totalWeeks: number): number` (`ArrowLeft`, `ArrowRight`, `Home`, `End`) for pointer hover and keyboard week inspection.
     - `resolveStrataYearSelection(years: StrataYearArchive[], requestedYear?: number): { current: StrataYearArchive; availableYears: number[]; canScrub: boolean }` so the year scrubber supports multi-year archives (`2024`, `2025`, `2026`) and also degrades gracefully when a single-year archive is passed.
     - `buildPaperRustleCue(yearIndex: number, totalYears: number): Cue` and `shouldTriggerRustle(lastRustleAtMs: number, nowMs: number, cooldownMs?: number): boolean` producing a band-passed white-noise burst `Cue` (`kind: "noise"`, `filter: "bandpass"`, `duration` between `0.055` and `0.095` s, `attack: 0.006`, `db: -24 <= MAX_DB`) compatible with `playCustomCue` in `lib/sound-client.ts`.
  2. Create `scripts/strata-index.ts` (executable via `node --experimental-strip-types`, supporting `--check` like `scripts/yearly-log.ts`) that walks local `git log` commit timestamps, `content/site.ts` (`site.notes`, `site.projects` `started`/`shipped`/`lastActivityAt`, `site.experience`), and `content/ledger.json` to emit `content/strata.json` with 52 ISO-week buckets across `2024`, `2025`, and `2026` (combining real git commits for 2026 with pre-repo project/career/note milestones for 2024–2025 clearly tagged with `source`), falling back cleanly to the committed `content/strata.json` when git history is shallow or unavailable.
  3. Generate and commit `content/strata.json`, add unit tests in `lib/strata.test.ts` covering weekly bucketing, `--check` verification, sqrt height floor scaling, 6-layer SVG path validity, reduced-motion parallax zeroing, keyboard week stepping, 1-year and multi-year scrubber resolution, and paper-rustle `Cue` safety (`cue.db <= MAX_DB`), and write verification output to `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-1-evidence.md`.
- **Non-goals**:
  - Do not modify `package.json`, `lib/pages.ts`, `lib/sound.ts`, `lib/sound-client.ts`, or `app/(site)/globals.css`.
  - Do not build the `/strata` React components or Playwright E2E spec in this task (covered in Task 2).
- **Acceptance criteria**: `scripts/strata-index.ts --check` passes against committed `content/strata.json`, and `lib/strata.test.ts` proves deterministic 6-layer cut-paper SVG polygon generation, sqrt valley-floor scaling, pointer parallax zeroing under reduced motion, nearest-week/keyboard lookup, graceful 1-year/multi-year scrubber resolution, and paper-rustle `Cue` bounds (`<= -18 dB`).
- **Verification**:
  - `strata index check and unit tests`: `TMPDIR=/tmp bash -c '(test -d node_modules || npm ci --prefer-offline --no-audit --no-fund) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/strata-index.ts --check && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/strata.test.ts'`
  - `full test suite`: `TMPDIR=/tmp npm test`

---

### Task 2: Paper Strata cut-paper terrain routes (`/strata` and `/play/strata`), parallax stage, week inspector, year scrubber with rustle audio, and E2E tests

- **Role**: `software_engineer`
- **QA**: `required`
- **Depends on**: `["1"]`
- **Interfaces**:
  - `app/(site)/(app)/strata/page.tsx`
  - `app/(site)/(app)/strata/strata.css`
  - `app/(site)/(app)/strata/opengraph-image.tsx`
  - `app/(site)/(app)/strata/_components/strata-loader.tsx`
  - `app/(site)/(app)/strata/_components/strata-stage.tsx`
  - `app/(site)/(app)/play/strata/page.tsx`
  - `app/(site)/(app)/ledger/page.tsx`
  - `e2e/strata.test.ts`
  - `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-2-evidence.md`
- **Problem**: Visitors cannot view or interact with the Paper Strata cut-paper terrain on `/strata` or `/play/strata`, inspect weekly commits/notes/shipped projects by pointer or keyboard, or scrub across years with a synthesized paper-rustle sound.
- **Action items**:
  1. Create `app/(site)/(app)/strata/_components/strata-stage.tsx` (`"use client"`) and `app/(site)/(app)/strata/_components/strata-loader.tsx` (`next/dynamic` with `ssr: false` and a paper-styled loading frame) rendering the stacked SVG cut-paper layers from `content/strata.json` and `lib/strata.ts`:
     - Render each contour sheet as a `<g className="strata-layer" data-layer-index={idx}>` with a soft paper drop shadow, subtle deckle/grain texture, and CSS custom property translations (`--strata-dx`, `--strata-dy`) updated via `requestAnimationFrame`-throttled `pointermove` (resetting on `pointerleave` and zeroed when `prefers-reduced-motion: reduce` is active). Expose `data-reduced-motion="true" | "false"`, `data-year={currentYear}`, and `data-active-week={activeWeek.week}` on `[data-strata-stage]`.
     - Provide an interactive week column overlay and keyboard-focusable terrain track (`tabIndex={0}`, `role="region"`, `aria-label="Weekly activity strata"`, handling `ArrowLeft`, `ArrowRight`, `Home`, `End`) plus an `aria-live="polite"` inspector card (`[data-strata-inspector]`) showing the selected ISO week number, date range, commits, notes, total activity, and any shipped projects or highlights.
     - Provide a year scrubber (`[data-strata-scrubber]`) with year buttons and a range slider across `availableYears` (`2024`, `2025`, `2026`, degrading cleanly if 1 year is passed), a metric mode toggle (`all` activity vs `commits` vs `notes`), and an explicit sound toggle button (`[data-strata-mute]`) that synthesizes the paper-rustle sound via `playCustomCue(buildPaperRustleCue(...))` from `lib/sound-client.ts` only after a user gesture when unmuted.
  2. Create `app/(site)/(app)/strata/page.tsx` and `app/(site)/(app)/play/strata/page.tsx`, both wrapping their root element in `<ViewTransition enter="page-in" exit="page-out" default="none">`, using `<FigTitle idx="15" title="Paper Strata" />` without a `morph` prop, and linking to `/ledger`, `/work`, and `/play`.
  3. Create `app/(site)/(app)/strata/strata.css` with riso paper layer shadows, inspector typography, scrubber styling, and `@media (prefers-reduced-motion: reduce)` as the final rule block disabling layer transitions and parallax transforms.
  4. Create `app/(site)/(app)/strata/opengraph-image.tsx` (`runtime = "nodejs"`, `1200x630`) rendering a stacked cut-paper strata preview card, and add a discoverable link to `/strata` on `app/(site)/(app)/ledger/page.tsx`.
  5. Add `e2e/strata.test.ts` verifying that `/strata` and `/play/strata` render the SVG cut-paper layers (`[data-strata-stage] svg path`), update the week inspector on hover and `ArrowRight`/`ArrowLeft` keyboard navigation, switch years via `[data-strata-scrubber]` without page errors, and expose `data-reduced-motion="true"` under reduced-motion emulation. Record verification output in `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-2-evidence.md`.
- **Non-goals**:
  - Do not modify `lib/pages.ts`, `app/(site)/globals.css`, `lib/sound.ts`, or `package.json`.
  - Do not call GitHub or any external API from the browser.
- **Acceptance criteria**: `/strata` and `/play/strata` render stacked cut-paper SVG contour layers with drop shadows and pointer parallax, support pointer hover and `ArrowLeft`/`ArrowRight` keyboard week inspection with `aria-live="polite"`, scrub across years with optional Web Audio paper-rustle synthesis, honour `prefers-reduced-motion: reduce`, and pass `npm test` and `npm run build`.
- **Verification**:
  - `unit and motion tests`: `TMPDIR=/tmp bash -c '(test -d node_modules || npm ci --prefer-offline --no-audit --no-fund) && npm test'`
  - `next build`: `TMPDIR=/tmp npm run build`

---

### Task 3: Ink Slime Mould deterministic Physarum CPU core and build-time project/pipeline graph index

- **Role**: `software_engineer`
- **QA**: `skip` (pure simulation core, build-time graph index, and unit tests; no user-visible UI route changes yet)
- **Depends on**: none
- **Interfaces**:
  - `lib/mould.ts`
  - `lib/mould.test.ts`
  - `app/(site)/(app)/play/mould/_lib/mould.ts`
  - `scripts/mould-graph.ts`
  - `content/mould-graph.json`
  - `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-3-evidence.md`
- **Problem**: Neither the `/play/mould` toy nor the embedded Work/Projects Physarum veins have a deterministic seeded Physarum simulation core, a commit/throughput-to-vein-thickness mapping, or a build-time graph index (`content/mould-graph.json`) derived from repository git history and `content/site.ts`.
- **Action items**:
  1. Create `lib/mould.ts` (and re-export its public API from `app/(site)/(app)/play/mould/_lib/mould.ts`) implementing a deterministic seeded Jeff Jones (2010) Physarum transport-network simulation and graph model:
     - `MouldNode` (`{ id: string; label: string; kind: "station" | "stack" | "project" | "food"; href?: string; x: number; y: number; commits: number; throughputWeight: number; depositWeight: number; swatch: string }`), `MouldEdge` (`{ from: string; to: string; weight: number; kind: "pipeline" | "project" }`), and `MouldGraphData` (`{ generatedAt: string; weightBasis: string; workGraph: { nodes: MouldNode[]; edges: MouldEdge[] }; projectsGraph: { nodes: MouldNode[]; edges: MouldEdge[] } }`).
     - `computeVeinWeight(commits: number, throughputWeight: number, mode?: "commits" | "throughput" | "blended"): { depositWeight: number; strokeWidthPx: number }` mapping commit counts and pipeline throughput weights monotonically to trail chemo-attractant deposit weight (`[0.35, 1.0]`) and rendered vein thickness (`[1.25, 5.5]` px).
     - `createMouldWorld(config: MouldWorldConfig): MouldWorld` and `stepMouldWorld(world: MouldWorld, steps?: number): MouldWorld` with seeded PRNG (`mulberry32`), configurable grid dimensions (`width`, `height`), `Float32Array` agent state (`x`, `y`, `angle`, `weight`), `Float32Array` trail map (`trail`, `nextTrail`), 3 forward sensors (`-sensorAngle`, `0`, `+sensorAngle` at `sensorDistance`), chemotactic food-node and graph-corridor attraction deposits so veins reliably connect graph nodes, and 3x3 box blur diffusion + decay (`decayFactor`).
     - Interactive mutations `dropMouldFood(world: MouldWorld, normX: number, normY: number, radius?: number, strength?: number)`, `repelMouldAt(world: MouldWorld, normX: number, normY: number, radius?: number)` (clears trail ink and deflects nearby agents away from pointer drag), `resetMouldWorld(world: MouldWorld, preset?: MouldPresetId)`, and `settleMouldWorld(config: MouldWorldConfig, warmupSteps?: number): MouldWorld` (runs a deterministic warmup, e.g. 90 steps, to produce a converged sumi-ink vein network immediately for `prefers-reduced-motion: reduce` or static snapshots).
     - `sampleSumiInkRgba(trailValue: number, grainNoise: number): [number, number, number, number]` mapping trail intensity through a warm washi paper (`#f6f1e6`) to deep sumi ink (`#171614`) ramp with feathered carbon-bleed edge toning.
  2. Create `scripts/mould-graph.ts` (executable via `node --experimental-strip-types`, supporting `--check`) that inspects local `git log` commit history and `content/site.ts` (`site.projects`, pipeline stations `source -> queue -> warehouse -> dashboard`, and stack nodes) to emit `content/mould-graph.json` with real repository commit counts per project and explicitly documented illustrative pipeline throughput weights, falling back cleanly to committed `content/mould-graph.json` when git history is shallow or absent.
  3. Generate and commit `content/mould-graph.json`, write unit tests in `lib/mould.test.ts` verifying seeded determinism, food chemotaxis (trail density along the corridor between two food nodes exceeds background average after 60 steps), monotonic `computeVeinWeight` thickness scaling with higher commit counts/throughput, `dropMouldFood` / `repelMouldAt` mutations, and `scripts/mould-graph.ts --check`, and write verification evidence to `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-3-evidence.md`.
- **Non-goals**:
  - Do not modify `package.json`, `lib/pages.ts`, or `app/(site)/globals.css`.
  - Do not build the `/play/mould` UI or the Work/Projects embedded overlay in this task (covered in Tasks 4 and 5).
- **Acceptance criteria**: `scripts/mould-graph.ts --check` passes against committed `content/mould-graph.json`, and `lib/mould.test.ts` proves deterministic Physarum stepping, vein corridor formation between food nodes, monotonic vein thickness scaling from commit count and throughput weight, and interactive food-drop and repel/erase operations.
- **Verification**:
  - `mould graph check and unit tests`: `TMPDIR=/tmp bash -c '(test -d node_modules || npm ci --prefer-offline --no-audit --no-fund) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/mould-graph.ts --check && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/mould.test.ts'`
  - `full test suite`: `TMPDIR=/tmp npm test`

---

### Task 4: `/play/mould` WebGL2 sumi-ink Physarum toy, CPU Canvas 2D fallback, interactive food/repel tools, OG image, `/play` discovery cards, and E2E tests

- **Role**: `software_engineer`
- **QA**: `required`
- **Depends on**: `["2", "3"]`
- **Interfaces**:
  - `app/(site)/(app)/play/mould/page.tsx`
  - `app/(site)/(app)/play/mould/mould.css`
  - `app/(site)/(app)/play/mould/opengraph-image.tsx`
  - `app/(site)/(app)/play/mould/_components/mould-loader.tsx`
  - `app/(site)/(app)/play/mould/_components/mould-stage.tsx`
  - `app/(site)/(app)/play/page.tsx`
  - `e2e/mould-toy.test.ts`
  - `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-4-evidence.md`
- **Problem**: `/play/mould` does not exist yet, and `/play` does not link to the new Ink Slime Mould and Paper Strata toys.
- **Action items**:
  1. Create `app/(site)/(app)/play/mould/_components/mould-stage.tsx` (`"use client"`) and `app/(site)/(app)/play/mould/_components/mould-loader.tsx` (`next/dynamic` with `ssr: false`):
     - Implement a WebGL2 sumi-ink renderer that uploads the simulation trail map and food attractor field to a GPU texture (`R8`/`RGBA8` or float texture when available, so it works across all WebGL2 contexts without requiring `EXT_color_buffer_float`) and runs a sumi-ink fragment shader mapping trail intensity through a paper-to-sumi-ink ramp with procedural paper fiber grain and feathered brush-edge bleed, falling back automatically to a 2D canvas renderer using `sampleSumiInkRgba` when WebGL2 is unavailable.
     - Support interactive pointer controls: click/tap to drop a food node (`dropMouldFood`), pointer drag in repel/brush-wipe mode (`repelMouldAt`) to erase ink veins and deflect agents, preset selector (`"work-pipeline"`, `"projects-constellation"`, `"petri-ring"`), tool mode toggle (`"food"` vs `"repel"`), weight mode toggle (`"commits"` vs `"throughput"`), and a `"Reset dish"` button (`[data-mould-reset]`).
     - Honour `prefers-reduced-motion: reduce`, `document.hidden`, and off-screen `IntersectionObserver` by pausing the `requestAnimationFrame` loop and rendering the converged static network from `settleMouldWorld`. Expose `data-reduced-motion="true" | "false"`, `data-renderer="webgl2" | "canvas2d"`, `data-food-count`, and `data-preset` on `<canvas data-mould-canvas>`.
  2. Create `app/(site)/(app)/play/mould/page.tsx` wrapping its root in `<ViewTransition enter="page-in" exit="page-out" default="none">` with `<FigTitle idx="16" title="Ink Slime Mould" />` (no `morph` prop), specimen notes explaining the Jeff Jones Physarum model and sumi-ink rendering, and links to `/work`, `/projects`, and `/play`.
  3. Create `app/(site)/(app)/play/mould/mould.css` with petri-dish paper framing, control bar pills, node pin badges, and a final `@media (prefers-reduced-motion: reduce)` block.
  4. Create `app/(site)/(app)/play/mould/opengraph-image.tsx` (`runtime = "nodejs"`, `1200x630`) rendering a sumi-ink Physarum vein network between project nodes on warm washi paper.
  5. Update `app/(site)/(app)/play/page.tsx` (preserving any concurrent cards on `main`) to add `/play/mould` ("Ink Slime Mould") and `/strata` ("Paper Strata") cards to the `TOYS` list.
  6. Add `e2e/mould-toy.test.ts` verifying `/play/mould` mounts `<canvas data-mould-canvas>`, increments `data-food-count` when clicking the canvas in food mode, supports switching to repel mode and resetting the dish via `[data-mould-reset]`, honours `prefers-reduced-motion: reduce` (`data-reduced-motion="true"`), and is linked from `/play`. Record verification evidence in `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-4-evidence.md`.
- **Non-goals**:
  - Do not modify `lib/pages.ts`, `app/(site)/globals.css`, `lib/sound.ts`, or `package.json`.
  - Do not embed the vein network on `/work` or `/projects` in this task (covered in Task 5).
- **Acceptance criteria**: `/play/mould` renders the WebGL2 (or Canvas 2D fallback) sumi-ink Physarum simulation, lets visitors drop food nodes, drag to repel/erase ink veins, switch presets, and reset the dish, sets `data-reduced-motion="true"` under reduced motion, is linked from `/play` alongside `/strata`, and passes `npm test` and `npm run build`.
- **Verification**:
  - `unit and motion tests`: `TMPDIR=/tmp bash -c '(test -d node_modules || npm ci --prefer-offline --no-audit --no-fund) && npm test'`
  - `next build`: `TMPDIR=/tmp npm run build`

---

### Task 5: Work and Projects embedded sumi-ink Physarum vein network (`components/mould-veins.tsx`), commit/throughput vein scaling, cross-links, and E2E verification

- **Role**: `software_engineer`
- **QA**: `required`
- **Depends on**: `["4"]`
- **Interfaces**:
  - `components/mould-veins.tsx`
  - `components/mould-veins-loader.tsx`
  - `components/mould-veins.css`
  - `app/(site)/(app)/work/page.tsx`
  - `app/(site)/(app)/projects/page.tsx`
  - `e2e/mould-veins.test.ts`
  - `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-5-evidence.md`
- **Problem**: Project and pipeline nodes on `/work` and `/projects` do not yet act as food sources for an embedded sumi-ink Physarum simulation that grows veins tracing the user's data-engineering graph with thickness scaled by commit counts or throughput.
- **Action items**:
  1. Create `components/mould-veins.tsx` (`"use client"`), `components/mould-veins-loader.tsx` (`next/dynamic` with `ssr: false`), and `components/mould-veins.css` implementing an interactive embedded Physarum sumi-ink graph figure (`variant: "work" | "projects"`) powered by `content/mould-graph.json` and `lib/mould.ts`:
     - Render the WebGL2 / Canvas2D sumi-ink Physarum canvas (`[data-mould-veins]`) alongside interactive food-source node pins (`[data-mould-node]`) for the Work pipeline stations + stack nodes (`source`, `queue`, `warehouse`, `dashboard`, plus stack nodes) on `variant="work"` and the shipped/active projects from `site.projects` on `variant="projects"`.
     - Allow visitors to click or hover any project/pipeline node to boost its chemo-attractant food weight, toggle vein thickness weighting (`[data-mould-basis="commits" | "throughput"]`) with an explicit caption stating that commit counts come from repository git history and pipeline throughput weights are illustrative, and follow a direct link to `/play/mould` (and `/strata` from `/work`).
     - Expose `data-mould-veins={variant}`, `data-mould-basis`, `data-node-count`, and `data-reduced-motion="true" | "false"` for deterministic inspection and E2E assertions; pause simulation when off-screen via `IntersectionObserver` or when `prefers-reduced-motion: reduce` is enabled (rendering the settled static vein network immediately).
  2. Integrate `<MouldVeinsLoader variant="work" />` into `app/(site)/(app)/work/page.tsx` below `<Pipeline />` (along with a cross-link to `/strata` and `/play/mould`), and integrate `<MouldVeinsLoader variant="projects" />` into `app/(site)/(app)/projects/page.tsx` while strictly preserving `<li key={project.title} className="rise cartridge-slot" style={{ "--i": i } as CSSProperties}>` and `className="project-title"` with `"--vt": \`project-${project.href.slice(1)}\`` required by `lib/motion.test.ts`.
  3. Add `e2e/mould-veins.test.ts` verifying that both `/work` and `/projects` mount `[data-mould-veins]`, render food-source nodes matching the pipeline stations and projects (`data-node-count >= 4`), toggle `data-mould-basis` between `"commits"` and `"throughput"`, honour `prefers-reduced-motion: reduce`, and link to `/play/mould` and `/strata`, then run `node scripts/check-gate-closure.mjs` and record full verification evidence in `projects/two-new-otohime-dev-ideas-1-ink-slime-mould-a-webgl-physarum/task-5-evidence.md`.
- **Non-goals**:
  - Do not modify `lib/pages.ts`, `app/(site)/globals.css`, `lib/sound.ts`, or `package.json`.
  - Do not remove existing Work or Projects sections or any concurrent components merged from earlier plans.
- **Acceptance criteria**: `/work` and `/projects` both embed the sumi-ink Physarum vein network where pipeline and project nodes act as food sources, vein thickness scales with repository commit counts or illustrative throughput weights, reduced motion renders a settled static vein graph, and `npm test`, `node scripts/check-gate-closure.mjs`, and `npm run build` all pass.
- **Verification**:
  - `unit, motion, and gate-closure checks`: `TMPDIR=/tmp bash -c '(test -d node_modules || npm ci --prefer-offline --no-audit --no-fund) && npm test && node scripts/check-gate-closure.mjs'`
  - `next build`: `TMPDIR=/tmp npm run build`
