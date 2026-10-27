# Washi Daruma, Emaki, and Hanafuda

Plan `pm-293`, revision 1. Product-owner run `run-9229`. Prior research from `rep-5449` (`run-9228`) is preserved in [research.md](research.md). Per current platform rules, plan splitting is removed and the complete scope for all three paper-and-ink experiments lives in one task DAG on `pm-293`.

## Outcome

Visitors to `otohime.dev` gain three new tactile paper-and-ink experiments backed by a shared build-time yearly digest:

1. **Shared Yearly Shipped Digest (`content/yearly-log.json`)**: A build-time index script (`scripts/yearly-log.ts`) and pure reader (`lib/yearly-log.ts`) aggregate full git commit history across all 12 calendar months along with `content/site.ts` projects/notes and `content/ledger.json` activity counts, keeping a committed fallback in `content/yearly-log.json` so shallow (`depth-1`) or offline builds remain deterministic.
2. **Daruma Project Board (`/projects`)**: Projects in `content/site.ts` carry `started`, `shipped`, `lastActivityAt`, and optional `abandoned` metadata. On `/projects`, visitors can switch to a Daruma Shelf view where each project is a hand-drawn red SVG Daruma doll: its left eye paints in via `stroke-dashoffset` when started, its right eye paints in when shipped, and dolls wobble on hover/focus before rolling upright. Unfinished dolls rest on an unfinished shelf; projects with no activity for 90 days that have not shipped default to abandoned, and an on-demand **Daruma Kuyo** toggle (also reachable via `?kuyo=1` and testable with an injected clock) runs an ink-fire retirement ceremony without waiting for December.
3. **Making-of Emaki (`/making-of`)**: A horizontal handscroll (`emaki`) linked from `/work` and driven by a validated public snapshot (`content/making-of.json`, maintained by `scripts/making-of-index.ts`) groups repository history by `pm-NNN` plan prefixes into scenes. Each scene depicts four reusable ink figures (`researcher`, `product_owner`, `software_engineer`, `quality_engineer`) passing a scroll along, labelled with plan title, date, public model ID per role, and a clickable link to the commit/PR on GitHub. A sticky scroll-scrubbed wrapper (and CSS `animation-timeline` where supported) translates vertical scroll into horizontal parallax while keeping a semantic `<ol>` for assistive technology and no-JS visitors; `prefers-reduced-motion` disables parallax.
4. **Hanafuda Koi-Koi (`/play/hanafuda`)**: A playable 48-card ink-and-washi Hanafuda deck (12 monthly flower suits) vs a deterministic greedy CPU opponent (no LLM) over a 3-round match. Supports drag-to-match, tap-to-match, and full keyboard controls; announces all 12 standard yaku (`Goko`, `Shiko`, `Ame-Shiko`, `Sanko`, `Inoshikacho`, `Tane`, `Akatan`, `Aotan`, `Tan`, `Kasu`, `Hanami-zake`, `Tsukimi-zake`) with a red hanko stamp and brush-stroke `"Koi-koi?"` prompt backed by real `aria-live` text; uses React `ViewTransition` for card deal/flip and opt-in WebAudio paper-shuffle cues via `lib/sound-client.ts`; and lets visitors flip any month's card back to read what the owner shipped that month from `content/yearly-log.json`.

## Architecture and Interfaces

### 1. Shared Yearly Digest (`scripts/yearly-log.ts`, `lib/yearly-log.ts`, `content/yearly-log.json`)
- **Schema (`YearlyLog`)**: `{ version: 1, head: string | null, generatedYear: number, months: Record<"01" | ... | "12", MonthlyLog> }` where each `MonthlyLog` holds `{ month: number, flower: string, commits: number, shippedProjects: { title: string, href?: string, shipped: string }[], notes: { title: string, date: string }[], highlights: { sha: string, date: string, plan: string | null, subject: string }[] }`.
- **Fallback & Strict Check**: Like `scripts/history-index.ts`, `scripts/yearly-log.ts` updates `content/yearly-log.json` from full git history when available, splices or preserves the committed fallback in shallow checkouts, and supports `--check` to verify canonical formatting and bounds.

### 2. Daruma Project Board (`content/site.ts`, `lib/daruma.ts`, `components/daruma-board.tsx`, `app/(site)/(app)/projects/page.tsx`)
- **Data contract**: Extend `Project` in `content/site.ts` with `started?: string`, `shipped?: string`, `lastActivityAt?: string`, `abandoned?: boolean`. Populate realistic dates for the existing projects in `site.projectList` plus at least one started/unfinished and one shelved/abandoned entry so both shelves and Kuyo retirement are populated out of the box. If `site.projectList` text changes, regenerate `public/ask-index.json` and `public/peeks.json`.
- **Pure logic (`lib/daruma.ts`)**: `classifyDaruma(project, nowMs)` computes eye state (`"none" | "left" | "both"`), shelf (`"active" | "shipped" | "unfinished"`), and abandonment (`abandoned === true` or `status !== "live" && !shipped && daysSince(lastActivityAt ?? started, nowMs) >= 90`). `isKuyoSeason(nowMs, kuyoOverride)` returns true in December UTC or when `kuyoOverride` (`?kuyo=1` or toggle button) is active.
- **UI (`components/daruma-board.tsx`)**: Renders accessible radio/toggle buttons on `/projects` (`Cartridges` vs `Daruma shelf`), red SVG Daruma dolls with `stroke-dashoffset` brush-stroke eyes, wobble-and-righting animation (disabled under `prefers-reduced-motion`), an unfinished shelf, and an on-demand `Daruma Kuyo` ink-fire toggle with `aria-live` status announcement.

### 3. Making-of Emaki (`scripts/making-of-index.ts`, `content/making-of.json`, `lib/making-of.ts`, `app/(site)/(app)/making-of/page.tsx`)
- **Data contract (`MakingOfSnapshot`)**: `{ version: 1, head: string | null, scenes: MakingOfScene[] }` where each `MakingOfScene` has `{ planId: string, title: string, date: string, sha: string, commitUrl: string, commitCount: number, areas: string[], roles: { role: "research" | "product_owner" | "software_engineer" | "quality_engineer", label: string, modelId: string }[], summary: string }`. Public fields only; no emails, tokens, or private logs.
- **Generator (`scripts/making-of-index.ts`)**: Groups git history by `pm-\d+` prefixes, merges public plan titles and role model IDs from `projects/*/plan.md` and the committed snapshot, and validates canonical JSON with `--check`.
- **UI (`app/(site)/(app)/making-of/page.tsx`)**: Server-renders a semantic `<ol>` of scenes so no-JS and screen-reader users get every plan, date, role model badge, and commit link. Client wrapper (`_components/emaki-scroll.tsx`) maps vertical scroll progress (`0..1`) to horizontal translation and multi-layer ink parallax (clouds, pine/waves, four reusable ink figures passing a scroll), with keyboard left/right scene stepping and `prefers-reduced-motion` static layout. Linked from `/work`.

### 4. Hanafuda Koi-Koi Engine (`lib/hanafuda/deck.ts`, `lib/hanafuda/yaku.ts`, `lib/hanafuda/engine.ts`)
- **Deck (`lib/hanafuda/deck.ts`)**: All 48 traditional cards across months 1..12 (Pine, Plum, Cherry, Wisteria, Iris, Peony, Bush Clover, Susuki Grass, Chrysanthemum, Maple, Willow, Paulownia) with category (`hikari` bright, `tane` animal/object, `tanzaku` ribbon with `akatan`/`aotan`/`plain`, `kasu` chaff), stable IDs, flower names, and SVG motif descriptors.
- **Yaku (`lib/hanafuda/yaku.ts`)**: Pure detector scoring `Goko` (5 brights), `Shiko` (4 dry brights), `Ame-Shiko` (4 brights with Rain Man), `Sanko` (3 dry brights), `Hanami-zake` (Curtain + Sake Cup), `Tsukimi-zake` (Moon + Sake Cup), `Inoshikacho` (Boar + Deer + Butterflies + bonus tane), `Tane` (5+ animals), `Akatan` (3 poetry ribbons), `Aotan` (3 blue ribbons), `Tan` (5+ ribbons), and `Kasu` (10+ chaff, with Sake Cup counting as tane + kasu).
- **Engine (`lib/hanafuda/engine.ts`)**: Seeded PRNG (`mulberry32`), 3-round default match, hand/field/stock dealing (including immediate 4-of-a-kind / 4-pairs checks), hand-play matching and stock-draw matching phases, yaku detection, `"Koi-koi"` vs `"Shobu"` decision, double score on 7+ points or opponent Koi-Koi reversal, and a deterministic greedy CPU policy (prioritizes bright/tane/tanzaku captures and calls Shobu when ahead or on high-value yaku).

### 5. Hanafuda Koi-Koi Board & Monthly Log Backs (`app/(site)/(app)/play/hanafuda/page.tsx`, `lib/sound.ts`)
- **Audio (`lib/sound.ts`)**: Add a soft `shuffle` cue (or reuse/extend `rustle` + `stamp`) within the `-18 dB` ceiling, triggered only after user gesture when the site sound toggle is on.
- **Board (`app/(site)/(app)/play/hanafuda/`)**: Playable table with CPU hand, field cards, stock pile, captured piles by category, drag-to-match plus tap-to-select and keyboard arrow/Enter matching, `ViewTransition` wrappers on card movements, red hanko stamp overlay and brush-stroke `"Koi-koi?"` modal/banner with `aria-live="polite"` text, seed/new-game controls, and a **Monthly Shipped Log** card-back inspector that flips any month's card to show what shipped that month from `content/yearly-log.json`. Linked prominently from `/play`.

## Task Graph

| Sequence | Title | Depends on | QA | Summary |
| --- | --- | --- | --- | --- |
| 1 | Shared yearly shipped digest | — | `skip` | Build `scripts/yearly-log.ts`, `lib/yearly-log.ts`, and committed `content/yearly-log.json` with unit tests. |
| 2 | Daruma project board and Kuyo shelf | 1 | `required` | Extend `content/site.ts` projects, implement `lib/daruma.ts` and `components/daruma-board.tsx` on `/projects` with `?kuyo=1` ink-fire toggle and Chromium E2E. |
| 3 | Making-of Emaki handscroll | 1 | `required` | Build `scripts/making-of-index.ts`, `content/making-of.json`, `lib/making-of.ts`, and `/making-of` horizontal scroll with 4 ink figures, `<ol>` fallback, and Chromium E2E. |
| 4 | Hanafuda Koi-Koi engine and yaku | 1 | `skip` | Implement 48-card deck, 12 yaku detectors, seeded Koi-Koi reducer, and greedy CPU in `lib/hanafuda/*` with table-driven unit tests. |
| 5 | Hanafuda Koi-Koi board and monthly backs | 1, 4 | `required` | Build `/play/hanafuda` SVG deck, drag/tap/keyboard play, View Transitions, opt-in shuffle sound, hanko/`"Koi-koi?"` live announcements, monthly card-back log flip, and Chromium E2E. |

## Prerequisites and Delivery Evidence

- **External dependencies**: None (`prerequisites: []`, `external_dependencies_reviewed: true`). Every script, data snapshot, SVG component, and test is self-contained inside this repository and uses the existing locked dependencies (`next@16.4.2`, `react@19.3.0`, `playwright-core@1.64.0`).
- **Verification discipline**: Gate verification runs in a fresh checkout where `node_modules` may be absent and `TMPDIR` may exceed Chrome's Unix socket path limit. Every task verification command ensures `test -d node_modules || npm ci` and normalizes `TMPDIR=/tmp`, and restores `content/history.json` if touched by a build.

## Decision Log

- **Single-plan DAG (`scope_adjusted`)**: Kept all three experiments and the shared digest on `pm-293` rather than splitting into three plans, matching current platform rules.
- **Shared yearly digest (`approach_chosen`)**: Added `content/yearly-log.json` and `scripts/yearly-log.ts` because `content/history.json` is capped at 200 commits and cannot span 12 calendar months.
- **On-demand Daruma Kuyo & injected clock (`approach_chosen`)**: Made the December ink-fire ceremony and 90-day abandonment threshold testable on demand via `?kuyo=1`, a UI toggle, and an injectable clock.
- **Reviewed public Making-of snapshot (`approach_chosen`)**: Used a committed `content/making-of.json` snapshot validated by `scripts/making-of-index.ts` so CI and production builds never depend on internal cluster APIs.
- **Two-stage Hanafuda delivery (`approach_chosen`)**: Separated the pure seeded Koi-Koi reducer/yaku/CPU engine (Task 4) from the interactive SVG board, audio, View Transitions, and monthly card backs (Task 5).
