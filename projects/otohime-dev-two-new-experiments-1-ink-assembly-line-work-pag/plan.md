# Paper Star Chart — pm-279

## Outcome
Add an optional `/notes/sky` chart where each existing note is a hand-inked star. Shared tags form named constellations; note length sets size and age sets brightness. A visitor can pan, inspect a title and open the note. Preserve the readable `/notes` list and support keyboard, touch and reduced motion.

This is part 1 of two independent experiments in rep-5288. Part 2, Ink Assembly Line for `/work`, is filed as a follow-on idea after this plan. Its work content must use verified impact numbers or clearly marked qualitative impact; no figures may be invented.

## Repo and evidence
- `app/(site)/(app)/notes/page.tsx` currently renders three notes from `content/site.ts`; those notes have date, title and body but no slug, tags or detail route.
- `app/(site)/(app)/work/page.tsx` has existing ink and factory components. It stays in part 2.
- `npm test` selects explicit test globs in `package.json`; add any new _lib test to that command.
- `AGENTS.md` requires reading `node_modules/next/dist/docs/` before code. This lease has no `node_modules`; implementers must install locked dependencies and read the relevant routing and View Transition guide before editing. The requested chief-of-staff document and `docs/claude/software-development.md` were absent in this checkout; the task contracts below carry the operative requirements.
- Sibling delivery repairs pm-273, pm-275 and pm-276 own CI and deploy files. This part edits none of those paths.

## Design and behavior
Keep the chart in SVG and CSS, with a small client component for interaction. Use stable seeded placement and an explicit reference date for brightness so the server and client render identically. The size scale derives from body length; clamp it so even short notes have a visible keyboard target. Build constellation edges from shared tags and use deterministic playful names derived from the tag. Keep note text, links, stars and lines accessible as real DOM/SVG elements. Decorative marks never represent additional notes.

Pointer capture supports drag and touch pan within clamped bounds; a drag must not accidentally open a note. Hover and focus expose the title; stars are links to `/notes/[slug]`. Recenter is available without dragging. Reduced-motion mode removes twinkle and animated pan, and the list remains the plain alternative. Reuse the site's paper and ink tokens. Route transitions follow the installed Next 16 guidance and existing React `ViewTransition` use.

## Tasks and dependencies
1. **Create addressable tagged notes.** Add stable slugs and editorial tags to the existing three notes, create `/notes/[slug]` with a real not-found state, and link each list item. Preserve the existing note copy. The tags describe the present text; do not create fictitious notes.
2. **Build deterministic sky geometry.** Pure functions calculate stable non-overlapping positions, size, age brightness, shared-tag edges and names. Unit tests cover determinism, bounds, tag overlap, empty/sparse input, and dates. Use no new dependency.
3. **Publish the interactive chart.** Create `/notes/sky`, link it from `/notes`, and implement SVG stars, pan, focus/hover labels, navigation and reduced-motion behavior. Add meaningful interaction verification in the checkout. QA independently walks desktop, mobile, keyboard and reduced-motion cases at the deployed SHA, including a negative control: an untagged pair must not gain a constellation line and a drag must not activate a link.

The work is ordered 1 → 2 → 3 so no task depends on an unmerged content shape. At the default 1h per role task, the overlap-weighted sum and longest path are both 3h, below the 6h plan limit. Every software task is a build contract with `verification[]` and stops at push; deployment and independent interaction evidence belong to green gate, QA and acceptance.

## Acceptance walkthrough
At the delivered SHA: open `/notes` and confirm the three original notes still read correctly and each opens its own `/notes/[slug]`; follow the Sky link and see three ink stars on paper. Their size and brightness reflect length and age, and shared tags visibly connect stars with stable playful constellation names. Hover or focus reveals the title; pointer or keyboard activation opens the correct note with a view transition. Pan and recenter work by pointer and touch; dragging does not activate a note. At `prefers-reduced-motion: reduce`, content and navigation remain available without twinkle or animated pan. The list is still usable as a plain alternative.

## Delivery boundaries
No WebGL, new packages, fabricated notes, invented metrics, API, scheduled behavior, database change or direct production edit. QA must verify behavior independently rather than relying only on an implementer's proof summary. A production CI failure unrelated to the chart is reported with its job and cause, without claiming deployment from a local build. GitHub Actions and Vercel are existing delivery capabilities; the proposal declares and probes their availability. The execution runner's credential and deployment success require separate CI evidence.
