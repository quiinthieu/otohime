# Research: three new bits for otohime.dev (pm-248)

Captured verbatim from research report rep-4881 (run-8433 input). The
deliverable body is kept here so the planning commit carries it.

## Headline
Bit 1 largely EXISTS already (pm-243: lib/ask.ts, lib/ask-llm.ts, app/api/ask/route.ts, components/ask-console.tsx, public/ask-index.json, `npm run ask:index` / `ask:check`). It is a delta (typewriter, cheaper model, canned answers, citation polish), not a build. Bits 2 (seasons) and 3 (404) are new and independent. Suggested order: 404 → seasons → ask delta (ask delta can run parallel to 404).

## Repo facts verified
- Next 16.4.2, React 19.3, cacheComponents on. AGENTS.md: read node_modules/next/dist/docs before coding.
- Tokens in app/(site)/globals.css: --paper/--paper-2/--ink via light-dark(); theme pinned with data-theme on <html> (theme-toggle.tsx, pre-paint script in layout and global-not-found).
- Ink look: lib/ink-modes.ts (SVG-filter hands), lib/ink-particles.ts (DOM-free particle field, tested), roughjs is a dependency.
- Ask today: BM25 offline answerer; model tier off unless ASK_LLM=1 + ANTHROPIC_API_KEY; model may cite passage ids only; 10/hr per IP, 150/day site-wide (Postgres askUsage); 8 s timeout, 1 retry; any failure falls back to the offline answer. POST is non-streaming. MODEL = "claude-opus-5-5" (not cheap).
- 404: app/global-not-found.tsx renders app/(site)/not-found.tsx; own server-rendered document, works without JS, view-transition hop.
- app/(site)/(app)/play + lib/snake.ts show the pure-logic + test split for games.

## Bit 1 — Ask the Ink (delta)
1. Typewriter: keep non-streaming call, type out client-side. SSE conflicts with validate-then-show of cited ids.
2. Cheap model: switch MODEL to claude-haiku-5-5; check ask-llm.test.ts for model pins.
3. Canned answers: extend the existing rule-based stock questions.
4. Citations: each source as a link.
5. Index covers Work, Projects, Notes (ask:check guards drift).
Risk: no ANTHROPIC_API_KEY in prod means offline-only (acceptable). Keep ids-only citation.

## Bit 2 — Paper almanac seasons
- seasonFor(date, hemisphere): meteorological seasons, flipped in the south.
- Hemisphere without geolocation: Intl timezone → small southern-zone list, default north; manual dial fixes misses.
- Persist in localStorage `season`, apply data-season on <html> via the pre-paint script.
- Tints: per-season overrides of existing tokens with light-dark() pairs; contrast ≥4.5:1 per season × scheme.
- Ambient layer: one fixed, pointer-events:none, aria-hidden SVG layer; ≤40 elements, transform/opacity only, paused when hidden. Reduced motion: static tint, layer hidden with animation: none.
- Dial in masthead next to ThemeToggle, radio-group semantics.
- Traps from lessons: lib/motion.test.ts and design-system tests pin what may follow EndFooter and one top-level .css per route group; avoid usePathname in layouts; several root layouts exist, so v1 scope = (site) + global-not-found; use plain keyframes.

## Bit 3 — Playful 404
- Keep global-not-found + server-rendered, no-JS-safe page; replace the Notice figure with a crumpled, torn sheet.
- Smooth it out: rubbing reduces crumple 1→0; the links are plain HTML always reachable; the game never gates navigation.
- Pure logic in lib/lost.ts with node:test.
- Shader bubbles (codrops) deferred.
- A11y: keyboard "smooth" button; reduced motion = flat sheet.

## Suggested split
A (404): logic+tests; sheet figure+island+CSS; probe.
B (seasons): lib/seasons.ts+tests; tokens+pre-paint+test updates; ambient layer; masthead dial; joint probe.
C (ask delta): Haiku+test pins; client typewriter; stock answers+index coverage.

## Decisions (advisory)
Timezone heuristic over geolocation; client-side typewriter over SSE; seasons scoped to (site)+404 in v1; shader bubbles deferred; Haiku assumed sufficient.
