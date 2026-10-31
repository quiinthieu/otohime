# Research Report: Apps Showcase Module (`/apps`) on otohime.dev (`pm-303`)

## Executive Summary

The `/apps` showcase module fits cleanly into `otohime.dev`'s existing Next.js 16.4.2 (`cacheComponents: true`) + React 19.3.0 `(site)/(app)` route architecture with **zero new npm dependencies, zero database migrations, and zero external runtime services**.

Following the prompt's **MVP-first** directive (*"index + detail pages with the four apps first, previews and extras after"*), delivery splits cleanly into three vertical slices:
1. **Task 1 (MVP Core — Data Layer, Four Apps, Main Nav, `/apps` Index & `/apps/[slug]` Detail Pages)**: Per-app JSON manifests in `content/apps/<slug>.json` + `content/apps/_schema.json`, pure schema validator/filter/hanko model in `lib/apps.ts`, `node:fs` directory auto-discovery in `lib/apps-server.ts` (`outputFileTracingIncludes` in `next.config.ts`), `PUBLIC_PAGES` navigation entry, filterable `/apps` card grid with carved hanko status stamps, `/apps/[slug]` detail pages (hero, what it does, key features, copyable install snippet, lifecycle & milestone timeline, changelog, repo/Homebrew/follow links), and unit tests in `lib/apps.test.ts`.
2. **Task 2 (Terminal Previews & Generated Ink Illustrations)**: Lightweight reduced-motion-safe terminal previews (`Niwa` growing ASCII/TUI garden + menu-bar readout, `Shiki` continuous sunrise-to-sunset & seasonal palette drift with live WCAG contrast ratio readout, plus declarative CLI frame previews for `Bento` `bentoctx` and `Kakeibo` `kakeibo` and any future JSON app) alongside hand-inked `<Inked>` SVG illustrations (`bento-box`, `bonsai-garden`, `ledger-book`, `sun-dial`, plus a deterministic parametric fallback for future apps added via JSON alone).
3. **Task 3 (Home Featured Strip, Per-App Satori OpenGraph Cards, Sitemap & E2E Accessibility Suite)**: Pure Server Component featured strip on `app/(site)/(home)/page.tsx`, `/apps` OpenGraph card (`app/(site)/(app)/apps/opengraph-image.tsx`), per-app Satori OpenGraph endpoint (`app/og/apps/[slug]/route.tsx` wired into `generateMetadata`), dynamic `app/sitemap.ts` (+ `public/robots.txt` sitemap pointer), and Playwright E2E + accessibility verification (`e2e/apps.test.ts` across desktop, 390×844 mobile, keyboard navigation, `prefers-reduced-motion: reduce`, and `javaScriptEnabled: false`).

---

## Verified Codebase Facts & Hard Invariants

1. **Framework & Build Rules (`package.json`, `next.config.ts`, `AGENTS.md`)**
   - Stack: `next@16.4.2`, `react@19.3.0`, `roughjs@4.6.6`, `tailwindcss@^4`, `playwright-core@1.64.0`, Node `22.x`.
   - `next.config.ts` enables `cacheComponents: true`, `partialPrefetching: true`, and `experimental: { authInterrupts: true, globalNotFound: true }`.
   - **Next.js 16 route props**: Dynamic routes receive `params: Promise<{ slug: string }>` (use `PageProps<"/apps/[slug]">` after `next typegen`, await `params`, and export `generateStaticParams()`).
   - **AGENTS.md mandate**: Before writing code, SWEs must run `npm ci`, read the relevant guides under `node_modules/next/dist/docs/`, and check git author identity with `bash scripts/setup-owner-git.sh --check` (`--configure` on fresh clones so commits use `Otohime <quiinthieu@gmail.com>`, enforced in CI by `scripts/check-deploy-author.mjs`).

2. **Route Group Placement (`app/(site)/(app)/apps/`)**
   - `otohime` separates standalone art projects (`app/(shore)/`, `app/(articles)/`, `app/(design-system)/`, etc. — each with its own isolated root `layout.tsx` and `isolation.test.ts`) from site rooms under `app/(site)/(app)/` (`/work`, `/play`, `/notes`, `/notes/[slug]`, `/music`, `/projects`, `/sketches`, `/lab`).
   - Placing `/apps` at `app/(site)/(app)/apps/page.tsx` and `/apps/[slug]` at `app/(site)/(app)/apps/[slug]/page.tsx` automatically inherits `Masthead`, the `<nav aria-label="Main">` sidebar (`components/nav-links.tsx` already highlights nested `/apps/*` routes via `pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`))`), `EndFooter`, `ViewTransition`, theme/season/print-run CSS tokens (`--paper`, `--paper-2`, `--field`, `--ink`, `--muted`, `--line`, `--danger`, and `--yellow/--coral/--mint/--blue/--pink`), and `PocketTerminalLoader`.

3. **Critical `PUBLIC_PAGES` vs `CONSOLE_MENU` Physical LCD Invariant (`lib/pages.ts`, `lib/pages.test.ts`, `lib/motion.test.ts`, `lib/terminal.test.ts`)**
   - `CONSOLE_MENU` drives the 7 physical lines on the home page's SVG pocket console (`LCD = { y: -158, h: 56 }`, `MENU_PITCH = 7.5`, `menuBaseline(i) = -150 + i * 7.5`). At `i = 6` (the 7th item), `menuBaseline(6) === -105`, which hits the exact upper bound `LCD.y + LCD.h - 3 = -105` in `lib/pages.test.ts` (line 38). Adding an 8th item to `CONSOLE_MENU` **will fail `lib/pages.test.ts`**.
   - Follow the exact precedent established when `/lab` (`Ink Lab`) joined `PUBLIC_PAGES`:
     - Append `{ href: "/apps", label: "Apps" }` to `PUBLIC_PAGES` **after `"/sketches"`** (index 7, before or after `"/lab"`), preserving `PUBLIC_PAGES[5].href === "/projects"` and `PUBLIC_PAGES[6].href === "/sketches"` pinned by `lib/pages.test.ts` lines 7 and 23.
     - Exclude `"/apps"` from `CONSOLE_MENU`:
       ```ts
       export type ConsoleItem = { href: Exclude<PublicPage["href"], "/" | "/lab" | "/apps"> | typeof DESK_PAGE.href; label: string };
       export const CONSOLE_MENU = [
         ...PUBLIC_PAGES.filter((page) => page.href !== "/" && page.href !== "/lab" && page.href !== "/apps"),
         DESK_PAGE,
       ] as const satisfies readonly ConsoleItem[];
       ```
     - Do **not** pass `morph="/apps"` to `<FigTitle>` on `/apps/page.tsx`: `lib/motion.test.ts` (lines 500–506) asserts that `morph="..."` appears **only** on `CONSOLE_MENU` pages. Use `<FigTitle n="08" hint="...">Apps</FigTitle>` (and `transitionName={`app-${app.slug}`}` on detail pages if desired, matching `notes/[slug]/page.tsx`).
     - Update `lib/pages.test.ts` (line 11 filter + dedicated test that `/apps` is in `PUBLIC_PAGES` and excluded from `CONSOLE_MENU`) and `lib/terminal.test.ts` (line 40 `PLACES.map((p) => p.name)` includes `"apps"`).
     - `lib/terminal.ts` automatically adds `go apps` / `apps` to Pocket Terminal (`/` or `Cmd/Ctrl-K`). Note: `"a"` prefix now matches `"apps"` and `"ask"`, while exact `"ask"` and `"apps"` continue to resolve unambiguously.
     - `content/site.ts` line 297 dynamically computes `` `${PUBLIC_PAGES.length} PAGES` `` (`"9 PAGES"`, 7 chars ≤ `LCD_ROW_CAP = 8`), so `lib/end.test.ts` and `scripts/probe-end.mjs` pass automatically.

4. **CI Footer Probe & Zero External Requests Invariant (`scripts/probe-end.mjs`, `scripts/walk-end.sh`, `lib/postcard.test.ts`)**
   - In CI, `probe-end.mjs` iterates over `PUBLIC_PAGES.map((p) => p.href)` — so **it will automatically visit `/apps` in headless Chromium** and enforce:
     1. HTTP 200 and a visible `main h1` (`observeMainHeading`).
     2. Zero console errors, page errors, or hydration warnings.
     3. **Zero external network requests** (`classifyExternal` rejects every off-origin request on every page except `/music`'s YouTube iframe). Never embed remote GitHub badges, external image URLs, or live GitHub API calls on `/` or `/apps`.
     4. Exactly 1 `<nav aria-label="Main">` on `(app)` pages and **0 `<nav aria-label="Main">`** on `/` (`HomePage`).
   - `lib/postcard.test.ts` (lines 215–217) forbids `app/(site)/(home)/page.tsx`, `app/(site)/(app)/layout.tsx`, and `app/(site)/layout.tsx` from importing `lib/postcard`, `lib/og`, or `postcard/`.
   - Keep `/apps` styles in a co-located `app/(site)/(app)/apps/apps.css` (matching `projects/daruma.css` and `timeline/timeline.css`) rather than editing `app/(site)/globals.css` (`lib/motion.test.ts` line 443 requires `globals.css` to keep its `@media (prefers-reduced-motion: reduce)` rule as its final block).

5. **Unit Test Discovery (`package.json` line 19)**
   - `npm test` globs `'lib/**/*.test.ts'` automatically, whereas tests under `app/(site)/(app)/.../_lib/*.test.ts` are enumerated explicitly in `package.json`.
   - Place all pure data types, schema validation, filtering, hanko status metadata, WCAG contrast math, and terminal preview frame/palette engines in `lib/apps.ts` (browser-safe, zero `node:fs` imports) with tests in `lib/apps.test.ts`, and keep `node:fs` directory loading in `lib/apps-server.ts` (tested from `lib/apps.test.ts`).

6. **Satori OpenGraph vs `sharp` Serverless Exclusion (`next.config.ts`, `lib/og.tsx`)**
   - `next.config.ts` lines 7–20 exclude `./node_modules/sharp/**/*` and `./node_modules/@img/**/*` from Vercel serverless output traces.
   - All OpenGraph cards **must** use Satori `ImageResponse` from `next/og` (flexbox-only inline styles, bundled Geist, SVG postmark/seal — zero `sharp`, zero network fetches), matching `lib/og.tsx`.
   - Add `outputFileTracingIncludes` in `next.config.ts` for `./content/apps/**/*.json` on `/apps`, `/apps/[slug]`, `/og/apps/[slug]`, and `/sitemap.xml` so dynamic serverless invocations always include all JSON app manifests.

7. **Motion Settlement (`scripts/probe-motion-state.mjs`)**
   - `landingSettled()` waits for every finite animation (`endTime !== Infinity`) on `document.timeline` to finish.
   - Terminal previews must drive continuous motion via stepped JS timers / Canvas 2D (paused under `prefers-reduced-motion: reduce`, `document.hidden`, or offscreen) or `infinite` CSS `@keyframes` — **never** long finite CSS transitions/animations on mount.

---

## Architecture & Requirement-by-Requirement Design

### 1. Data-Driven Per-App Manifests (`content/apps/<slug>.json`)

Why JSON manifests + JSON Schema + runtime TypeScript validator instead of `.ts` modules:
- Requirement 1 mandates *"one typed data file (e.g. content/apps) per app ... so new apps can be added without code changes."*
- In Next.js 16 / Turbopack production builds, arbitrary `.ts` files in a folder cannot be dynamically imported via `fs.readdirSync` without either editing a static barrel file (`content/apps/index.ts`, which violates "without code changes") or introducing a prebuild codegen script.
- With `content/apps/<slug>.json` + `content/apps/_schema.json` (`"$schema": "./_schema.json"` for editor autocomplete) + `validateAppManifest(raw, expectedSlug)` in `lib/apps.ts` + `readdirSync` in `lib/apps-server.ts` (ignoring `_*.json`), dropping a new `content/apps/foo.json` file automatically populates `/apps`, `/apps/foo`, the Home featured strip (when `featured: true`), `/og/apps/foo`, `/sitemap.xml`, and `lib/apps.test.ts` validation with **zero code edits**.

#### Proposed TypeScript Schema (`lib/apps.ts`)

```ts
import type { Swatch } from "@/components/figures";
import type { SealShape } from "@/lib/hanko";

export const APP_STATUSES = ["idea", "planned", "building", "beta", "released"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

export const APP_PLATFORMS = ["macos", "cli", "tui", "web", "linux", "ios"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

export type AppFeature = { title: string; detail: string };

export type AppInstall = {
  label: string;          // e.g. "Homebrew Cask" or "CLI preview"
  command: string;        // single copyable command snippet
  note?: string;          // e.g. "In development — cask reserved for first public beta"
};

export type AppLinks = {
  repo?: string;          // https://github.com/... when public
  homebrew?: { cask?: string; formula?: string; command: string; url?: string };
  docs?: string;
  follow?: { label: string; href: string }; // optional override; falls back to repo or mailto:hello@otohime.dev
};

export type AppMilestone = {
  title: string;
  state: "done" | "active" | "next";
  target?: string;
  note?: string;
};

export type AppChangelogEntry = {
  version: string;        // e.g. "0.2.0-dev"
  date: string;           // YYYY-MM-DD
  summary: string;
  highlights?: string[];
};

export type AppIllustration =
  | { kind: "ink"; motif?: "bento-box" | "bonsai-garden" | "ledger-book" | "sun-dial" | "blueprint"; alt: string; caption?: string }
  | { kind: "screenshot"; src: string; alt: string; width: number; height: number; caption?: string };

export type AppTerminalPreview =
  | { kind: "niwa-garden"; title: string; command: string; alt: string }
  | { kind: "shiki-drift"; title: string; command: string; alt: string }
  | { kind: "frames"; title: string; command: string; alt: string; intervalMs?: number; frames: { label: string; lines: string[] }[] };

export type AppManifest = {
  slug: string;           // must match filename <slug>.json and /^[a-z0-9]+(?:-[a-z0-9]+)*$/
  order?: number;         // deterministic sort key, tie-broken by name
  featured?: boolean;     // shown in Home featured strip
  name: string;
  tagline: string;        // one-line summary (<= 140 chars)
  description: string[];  // 1..4 plain-text paragraphs ("What it does")
  platforms: AppPlatform[];
  status: AppStatus;
  swatch: Swatch;
  seal?: { text?: string; shape?: SealShape }; // optional override; defaults to STATUS_META[status]
  techStack: string[];
  features: AppFeature[];
  install: AppInstall;
  links: AppLinks;
  illustration: AppIllustration;
  preview?: AppTerminalPreview;
  milestones: AppMilestone[];
  changelog: AppChangelogEntry[];
};
```

#### Status Mapping & Hanko Stamp Integration (`lib/hanko.ts`)
- The prompt notes: *"initial content, all status 'In development' unless noted"* and *"Niwa ... Status: building."* Requirement 1 specifies the 5-value enum `idea | planned | building | beta | released`.
- Map all four initial apps to `"status": "building"`, and define `STATUS_META`:
  - `idea`: `{ label: "Idea", shortLabel: "Idea", seal: "構想", shape: "round" }`
  - `planned`: `{ label: "Planned", shortLabel: "Planned", seal: "計画", shape: "round" }`
  - `building`: `{ label: "In development", shortLabel: "Building", seal: "開発", shape: "square" }`
  - `beta`: `{ label: "Beta", shortLabel: "Beta", seal: "試作", shape: "square" }`
  - `released`: `{ label: "Released", shortLabel: "Released", seal: "公開", shape: "square" }`
- Reuse `sealModel({ name, shape })` from `lib/hanko.ts` to render a crisp inline SVG carved vermilion hanko stamp (`--danger` / `#b33228` on warm paper chip `#f5eddf` with deterministic FNV-1a edge chips) paired with visible text (`In development`) so status is never conveyed by colour or kanji alone.

#### Initial Four Apps (`content/apps/*.json`)
Keep all facts strictly grounded in the prompt (do not invent unverified repo URLs or programming languages where unstated):
1. **`content/apps/bento.json`** (`order: 1`, `featured: true`, `status: "building"`, `swatch: "coral"`):
   - **Platforms**: `["macos", "cli"]`
   - **Tagline**: `"Audits plugins, skills, MCP servers and rules across AI coding agents, keeping every context budget lean."`
   - **Tech stack**: `["macOS App", "CLI (bentoctx)", "MCP", "Agent Rules & Skills"]`
   - **Install**: `brew install --cask agent-bento` (plus CLI reference `bentoctx`)
   - **Links**: `repo: "https://github.com/quiinthieu/bento"`, `homebrew: { cask: "agent-bento", command: "brew install --cask agent-bento", url: "https://github.com/quiinthieu/bento" }`
   - **Illustration**: `{ kind: "ink", motif: "bento-box", ... }` (compartmented bento tray organizing MCP, skills, plugins, and rules with a token-budget gauge)
   - **Preview**: `{ kind: "frames", command: "bentoctx audit --agents all", ... }`
2. **`content/apps/niwa.json`** (`order: 2`, `featured: true`, `status: "building"`, `swatch: "mint"`):
   - **Platforms**: `["macos", "cli", "tui"]`
   - **Tagline**: `"A cozy idle garden for your terminal and macOS menu bar that quietly grows while you work."`
   - **Tech stack**: `["Rust", "TUI / CLI (niwa)", "Swift", "macOS Menu Bar"]`
   - **Install**: `niwa` (with honest in-development note)
   - **Links**: Zero-backend follow link (`mailto:hello@otohime.dev?subject=Notify%20me%3A%20Niwa` + `@otohime73`)
   - **Illustration**: `{ kind: "ink", motif: "bonsai-garden", ... }`
   - **Preview**: `{ kind: "niwa-garden", command: "niwa --watch", ... }`
3. **`content/apps/kakeibo.json`** (`order: 3`, `featured: true`, `status: "building"`, `swatch: "yellow"`):
   - **Platforms**: `["cli"]`
   - **Tagline**: `"A local-only token budget diary that shows where every coding-agent session spent your quota."`
   - **Tech stack**: `["CLI (kakeibo)", "Local-only", "Token Session Ledger"]`
   - **Install**: `kakeibo summary --today` (with honest in-development note)
   - **Links**: Zero-backend follow link (`mailto:hello@otohime.dev?subject=Notify%20me%3A%20Kakeibo` + `@otohime73`)
   - **Illustration**: `{ kind: "ink", motif: "ledger-book", ... }` (ruled kakeibo diary columns breaking down resumed context, tool output, retries, and cache misses)
   - **Preview**: `{ kind: "frames", command: "kakeibo summary --last 5", ... }`
4. **`content/apps/shiki.json`** (`order: 4`, `featured: true`, `status: "building"`, `swatch: "blue"`):
   - **Platforms**: `["cli"]`
   - **Tagline**: `"Terminal colours that drift slowly with local sunrise, sunset and the seasons, with continuous contrast safety."`
   - **Tech stack**: `["CLI (shiki-term)", "Solar & Seasonal Gradient", "WCAG Contrast Safety"]`
   - **Install**: `shiki-term status` (with honest in-development note)
   - **Links**: Zero-backend follow link (`mailto:hello@otohime.dev?subject=Notify%20me%3A%20Shiki` + `@otohime73`)
   - **Illustration**: `{ kind: "ink", motif: "sun-dial", ... }`
   - **Preview**: `{ kind: "shiki-drift", command: "shiki-term --preview-day", ... }`

---

### 2. `/apps` Index Page (`app/(site)/(app)/apps/page.tsx`)

- **Server shell + small client filter island (`_components/apps-catalog.tsx`)**:
  - Server page loads `const apps = loadApps();` and renders `<FigTitle n="08" hint="in the workshop">Apps</FigTitle>`, intro copy, and `<AppsCatalog apps={apps} />` inside `<ViewTransition enter="page-in" exit="page-out" default="none">`.
  - **SSR & no-JS resilience**: All 4 app cards render immediately in server HTML so crawlers and no-JS users see the complete grid and can open every `/apps/[slug]` link.
  - **Accessible filter toolbar**:
    - Two `<fieldset>` / `role="group"` filter strips with `<button type="button" aria-pressed={selected}>` chips (minimum touch height `2rem` / comfortable spacing, visible `:focus-visible` ring from `globals.css`):
      1. **Platform**: `All` + active platforms (`macOS`, `CLI`, `TUI` — derived dynamically from `apps` or `APP_PLATFORMS` present, so adding a `"web"` app via JSON automatically adds a `Web` filter pill!).
      2. **Status**: `All` + all 5 canonical statuses (`Idea`, `Planned`, `In development`, `Beta`, `Released`) with item counts, plus a `"Reset filters"` action and `aria-live="polite"` result count (`"Showing 2 of 4 apps"`).
    - Empty-filter state uses `<Notice n="—" title="No apps match those filters" figure="parcel" heading="h2">` with a `"Show all apps"` reset button (reusing `components/figures.tsx`).
  - **App Card anatomy**:
    - Paper surface (`border border-ink bg-[var(--field)]` with ink offset shadow `shadow-[3px_3px_0_var(--line)]` and swatch accent strip `--fig`), app name linking to `/apps/${app.slug}`, carved hanko status stamp (seal SVG + status label), one-line tagline, platform badges (`.badge`), compact illustration or terminal mini-header, and CLI/install hint.

---

### 3. `/apps/[slug]` Detail Page (`app/(site)/(app)/apps/[slug]/page.tsx`)

- `generateStaticParams()` returns `loadApps().map(({ slug }) => ({ slug }))`; unknown slugs call `notFound()` (rendering `app/(site)/not-found.tsx` with HTTP 404).
- **Sections**:
  1. **Breadcrumb & Hero**: `← All apps` link, `<FigTitle n="08">{app.name}</FigTitle>`, carved hanko status stamp (`sealModel` SVG + `STATUS_META[app.status].label`), one-line tagline, platform badges, and tech stack chips.
  2. **Visual Showcase**: Generated `<Inked>` SVG illustration (or local screenshot frame if `illustration.kind === "screenshot"`), plus the animated **Terminal Preview** (Requirement 4) for CLI/TUI apps.
  3. **Install / Quickstart Snippet with Copy Button (`_components/copy-snippet.tsx`)**:
     - Monospace paper code block (`$ brew install --cask agent-bento`) with a keyboard-accessible `<button type="button">` (`navigator.clipboard.writeText(command)` with graceful fallback error message if clipboard permission is denied, `aria-live="polite"` `"Copied"` announcement for 2s, and optional availability note below).
  4. **What It Does & Key Features**: Plain-text paragraphs (`app.description`) + structured feature cards/definition list (`app.features`).
  5. **Status Timeline & Roadmap Milestones**:
     - 5-step lifecycle bar (`Idea → Planned → In development → Beta → Released`) marking completed stages, `aria-current="step"` on the active stage, and upcoming stages.
     - Milestone list (`done` / `active` / `next`) with distinct non-colour-only markers (`✓ Done`, `● Active`, `○ Next`).
  6. **Changelog**: Dated entries (`<time dateTime={entry.date}>`, version badge, summary, optional bullet highlights).
  7. **Links & Zero-Backend Follow / Notify CTA**:
     - Renders GitHub repo link and Homebrew cask badge when present (`Bento`: `https://github.com/quiinthieu/bento`, `agent-bento`), using `away(href)` from `lib/end.ts`.
     - Follow / Notify CTA: `"Watch on GitHub"` when `links.repo` exists, plus `"Notify me by email"` (`mailto:hello@otohime.dev?subject=Notify%20me%3A%20<Name>`) and `"Follow @otohime73"` (`https://x.com/otohime73`) when no public repo exists yet — completely static, zero backend required.

---

### 4. Lightweight Terminal Previews & Generated Ink Illustrations (Requirement 4)

- **Pure preview engine in `lib/apps-preview.ts` (tested in `lib/apps.test.ts`)**:
  - **Niwa (`niwa-garden`)**: 5 deterministic ASCII/box-drawing growth stages (seeded bed → cotyledon sprout → bamboo & moss → stone lantern & blossoms → firefly evening) + simulated macOS menu bar header (`🌿 niwa · 48m focus · stage 4/5`). Steps gently every ~1.4s when visible and unpaused.
  - **Shiki (`shiki-drift`)**: Pure solar/seasonal palette interpolator `shikiPaletteAt(progress01, season)` cycling smoothly through `Dawn → Noon → Sunset → Midnight` (Canvas 2D sky/horizon bar or CSS custom properties updated on a low-rate ~10fps rAF/interval) over a sample terminal prompt. Computes real-time WCAG 2.1 contrast ratio `(L1 + 0.05) / (L2 + 0.05)` (same math as `app/(design-system)/_lib/contrast.ts`) and asserts `contrast >= 7.0` across the entire `[0, 1]` cycle for all 4 seasons! Includes interactive time-of-day scrubber / Play-Pause button so keyboard users and reduced-motion users can inspect Dawn/Noon/Sunset/Night on demand.
  - **Declarative `frames` mode (`Bento`, `Kakeibo`, and future JSON apps)**: Cycles `preview.frames` (`bentoctx audit` context budget savings; `kakeibo summary` resumed-context/tool-output/retry/cache-miss bars) with previous/next frame & pause controls.
- **`prefers-reduced-motion: reduce` & lifecycle compliance**:
  - Subscribe to `matchMedia("(prefers-reduced-motion: reduce)")` via `useSyncExternalStore` (matching `components/departures-board.tsx`) and pause on `document.hidden` and unmount.
  - Under reduced motion (and before hydration / without JS), show a complete, rich static frame (`stage 4` mature garden for Niwa; `Sunset · Autumn` palette for Shiki; full summary frame for Bento/Kakeibo) with **zero automatic timers** while keeping manual stage/time buttons interactive.
- **Generated Ink Illustrations (`_components/app-illustration.tsx`)**:
  - Uses `<Inked>` and isometric `box()` from `components/figures.tsx` (respecting the site's ink filters and `--fig` swatches, `aria-hidden="true"` when decorative beside a caption or `role="img"` with `aria-label={illustration.alt}`). Includes 4 bespoke motifs (`bento-box`, `bonsai-garden`, `ledger-book`, `sun-dial`) plus a deterministic `blueprint` fallback hashed from `slug` so any 5th app added via JSON renders a custom ink figure without code changes.

---

### 5. Home Featured Strip, SEO, Per-App OpenGraph & Sitemap (Requirement 5)

- **Home Page Featured Strip (`components/apps-featured-strip.tsx` in `app/(site)/(home)/page.tsx`)**:
  - Pure **Server Component** (zero client JS added to `/`, zero imports from `lib/og`, `lib/postcard`, or `next/image`, and **no** `<nav aria-label="Main">`).
  - Placed as `<section aria-labelledby="home-apps" className="mt-12 border-t border-line pt-8">` above `Elsewhere`, displaying `loadApps().filter((a) => a.featured)` in a responsive 2-column / 4-card ink strip with app name → `/apps/[slug]`, hanko status pill, platform badges, tagline, and `"All apps →"` link to `/apps`.
- **SEO Metadata & Per-App OpenGraph Images**:
  - `/apps`: `export const metadata: Metadata = { title: "Apps", description: "..." }` + `app/(site)/(app)/apps/opengraph-image.tsx` calling `stamp("Apps", "otohime.dev/apps")`.
  - `/apps/[slug]`: `generateMetadata` sets `title: app.name` (rendered as `<App> · Otohime` by root template), `description: app.tagline`, `alternates: { canonical: `/apps/${app.slug}` }`, `twitter: { card: "summary_large_image" }`, and `openGraph.images` pointing to `/og/apps/${app.slug}`.
  - `app/og/apps/[slug]/route.tsx`: Uses Satori `ImageResponse` (`next/og`, 1200×630 PNG, no `sharp`) in the site's stamped paper style (`#f2efe7` / `#faf8f3` paper, `#231e16` ink, `#b03a22` postmark + hanko status stamp, app name, tagline, platform pills, and `otohime.dev/apps/<slug>`). Returns 404 for unknown slugs.
- **Sitemap (`app/sitemap.ts` + `public/robots.txt`)**:
  - Create `app/sitemap.ts` returning `MetadataRoute.Sitemap` with `PUBLIC_PAGES`, `/notes/[slug]`, and every `/apps/${app.slug}` from `loadApps()` (`lastModified` from latest `changelog[0]?.date`), rooted at `process.env.SITE_URL ?? "https://otohime.dev"`.
  - Append `Sitemap: https://otohime.dev/sitemap.xml` to `public/robots.txt`.

---

## Recommended MVP-First Task Plan (for Product Owner)

### Prerequisites (`projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/prerequisites.json`)
- Use `"schema": "platform.plan-prerequisites.v1"`, `"external_dependencies_reviewed": true`, `"prerequisites": []` (all data, illustrations, previews, Satori OG routes, and Playwright tests run locally with existing locked dependencies).
- **Platform lesson**: Include a recognized top-level path (`lib/...` and `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/task-N-evidence.md`) in every SWE task's `interfaces[]` when touching `app/(site)/`, and prefix `npm test`, `check-gate-closure.mjs`, and `scripts/e2e.mjs` commands with `TMPDIR=/tmp`.

### Task 1: Typed Apps Data Layer, Four Initial App Manifests, Main Nav, `/apps` Index & `/apps/[slug]` Detail Pages (MVP)
- **Paths**: `content/apps/_schema.json`, `content/apps/{bento,niwa,kakeibo,shiki}.json`, `lib/apps.ts`, `lib/apps-server.ts`, `lib/apps.test.ts`, `lib/pages.ts`, `lib/pages.test.ts`, `lib/terminal.test.ts`, `next.config.ts`, `app/(site)/(app)/apps/apps.css`, `app/(site)/(app)/apps/page.tsx`, `app/(site)/(app)/apps/[slug]/page.tsx`, `app/(site)/(app)/apps/_components/{apps-catalog,hanko-status,copy-snippet}.tsx`, `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/task-1-evidence.md`.
- **Verification**:
  - `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/apps.test.ts lib/pages.test.ts lib/terminal.test.ts lib/end.test.ts lib/motion.test.ts` (including temp-dir drop-in test proving a 5th JSON file loads without code changes, plus negative tests rejecting bad slugs/statuses/dates/URLs).
  - `npm run typecheck && npm run lint && TMPDIR=/tmp npm test`

### Task 2: Animated Terminal Previews & Generated Ink Illustrations
- **Paths**: `lib/apps-preview.ts`, `lib/apps-preview.test.ts`, `app/(site)/(app)/apps/_components/{terminal-preview,app-illustration}.tsx`, `app/(site)/(app)/apps/apps.css`, `app/(site)/(app)/apps/page.tsx`, `app/(site)/(app)/apps/[slug]/page.tsx`, `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/task-2-evidence.md`.
- **Verification**:
  - Unit tests in `lib/apps-preview.test.ts` proving Niwa growth stage progression, Shiki WCAG contrast ≥ 7.0 across full solar cycle × 4 seasons, declarative `frames` stepping for Bento/Kakeibo/custom apps, parametric `blueprint` fallback illustration for arbitrary slugs, and zero timer scheduling under reduced motion.
  - `npm run typecheck && npm run lint && TMPDIR=/tmp npm test`

### Task 3: Home Featured Strip, Per-App Satori OpenGraph Images, Sitemap & E2E / Accessibility Verification
- **Paths**: `components/apps-featured-strip.tsx`, `app/(site)/(home)/page.tsx`, `app/(site)/(app)/apps/opengraph-image.tsx`, `app/og/apps/[slug]/route.tsx`, `app/(site)/(app)/apps/[slug]/page.tsx`, `app/sitemap.ts`, `public/robots.txt`, `lib/apps-seo.test.ts`, `e2e/apps.test.ts`, `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/task-3-evidence.md`.
- **Verification**:
  - `npm run typecheck && npm run lint && TMPDIR=/tmp npm test && npm run ask:check`
  - `TMPDIR=/tmp node scripts/check-gate-closure.mjs`
  - `TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test e2e/apps.test.ts` (verifying Home featured strip → `/apps` nav highlight, platform/status keyboard filtering & reset, all 4 `/apps/[slug]` pages + unknown slug 404, clipboard copy button, Niwa & Shiki previews paused under `reducedMotion: "reduce"` and readable with `javaScriptEnabled: false`, zero horizontal overflow at `390×844` and `1366×900`, `GET /apps/opengraph-image` & `GET /og/apps/{bento,niwa,kakeibo,shiki}` returning `200 image/png`, `GET /sitemap.xml` listing `/apps` and all 4 app URLs, and `errors.unexpected` empty).
