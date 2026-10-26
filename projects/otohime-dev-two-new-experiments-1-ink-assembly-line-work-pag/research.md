# Research: Ink Assembly Line (/work) and Paper Star Chart (/notes/sky)

Caveats: /shared/artifacts is read-only here, so this body is the deliverable. The plan doc named in the prompt and the plan folder do not exist in the checkout. I did not fetch the two X links, so the inspiration is taken from the idea text only. Findings come from reading the repo.

## Repo facts
- Next 16.4.2, React 19.3; three 0.186 and @react-three/fiber/drei are already deps. AGENTS.md warns of breaking Next changes, but node_modules/next/dist/docs is absent in this lease: implementers must `npm ci` and read the docs first.
- /work is app/(site)/(app)/work/page.tsx (52 lines): FigTitle, site.work, Pipeline, Conveyor, site.stack list, ServerRack, wrapped in ViewTransition. components/pipeline.tsx, conveyor.tsx and server-rack.tsx already give an ink/factory visual language.
- Gap: no per-job data exists. The ingest/clean/transform/load/serve jobs with details, tech and impact numbers must be authored in content/site.ts. Impact numbers need the owner's real figures; use flagged placeholders, never invented values.
- /notes is app/(site)/(app)/notes/page.tsx, listing site.notes ({date,title,body}). No slug, no tags, no per-note route, so "click to open the note" has no target yet.
- `npm test` is a node --test glob list; new _lib tests need their glob added to package.json. Known flaky gates (CI=true + Chrome, Google Fonts fetch) are environment issues, not fix cycles.

## Experiment 1: Ink Assembly Line
- Inline SVG + CSS scroll-driven animation (animation-timeline: view()), small client island for the crate. No WebGL.
- Sticky stage, five stations, scroll progress maps crate position and active station. Gears rotate with scroll, belts use dashed stroke-dashoffset, stamps use step() animation to match the site's twelve-fps look.
- Station cards are real DOM text (SEO, screen readers, print).
- Visitor crate: input (maxlength ~16). Pure `processCrate(word)` returns per-stage outputs (raw, cleaned, chopped, sorted, boxed with count/checksum); deterministic, unit-testable.
- Reduced motion: static five-column diagram with all cards and the crate result as text; also gate JS via matchMedia. Fallback for browsers lacking scroll-timeline: IntersectionObserver or scroll listener setting --p.
- Mobile: vertical belt. a11y: stage aria-hidden, aria-live for the crate result.
- Risks: iOS sticky/scroll-timeline jank (use only transform/opacity); content authoring gates the work.
- ~3 tasks: content model + processCrate + tests; AssemblyLine component/CSS/reduced-motion; swap into /work + desktop/mobile/reduced-motion checks.

## Experiment 2: Paper Star Chart (/notes/sky)
- SVG pannable viewport rather than WebGL (tens of notes; crisp ink strokes, free hover/focus/a11y). R3F is a later upgrade; fake parallax with 2-3 layered groups.
- Pure lib sky.ts: seeded-hash position (jittered grid / Poisson-disc, stable across builds); size = clamped sqrt(body length); brightness = exponential age decay with a floor; constellations = minimum spanning tree per shared tag; deterministic playful names from word lists seeded by tag.
- Interaction: pointer-capture drag pan with clamped bounds; hover/focus tooltip; stars are links so keyboard works; click navigates with ViewTransition.
- Prerequisites: add tags and slug to site.notes, create /notes/[slug], link "sky" from /notes.
- Reduced motion: no inertia/twinkle; /notes list is the plain fallback. Mobile: touch-action none on chart only, hint and recenter button.
- Look: paper texture, feTurbulence wobble on stroke paths only (cost), Planisphere style reuse.
- Risks: sparse chart with few notes (seed tagged notes or add decorative non-note stars); touch pan vs page scroll.
- ~3 tasks: data model + note route; sky lib + unit tests; SkyChart component + entry link + reduced-motion check.

## Recommendation
- Two independent plans; only content/site.ts is shared, so sequence those edits. Check sibling plans' file ownership first (pm-273/275/276 lesson).
- No new dependencies; new logic under _lib with node:test tests registered in package.json.
- Owner input needed (or flagged placeholders): real impact numbers per station, note tags.
- Order: Star Chart first (small, adds slugs), Assembly Line second (content-gated).
- Verification per task: npm test, npm run lint, npm run typecheck, next build, reduced-motion rendering check.
