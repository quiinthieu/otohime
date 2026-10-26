# Riso Print Shop + Ink Lab — research (pm-268)

Basis: the otohime repo as it stands, plus the idea text. I did not fetch the two source links (Heller's portfolio, uixNinja post); their techniques are taken from the idea's description only. /shared/artifacts is read-only in this lease, so answer.md could not be written; this body is the report.

## What already exists (reuse, don't rebuild)
- Per-visitor "re-ink" pattern: lib/seasons.ts, a seasonScript inline in <head> (app/(site)/layout.tsx), data-season on <html>, app/(site)/seasons.css, and setSeason() in components/pocket-terminal.tsx. It stores the choice in localStorage and dispatches a synthetic StorageEvent so the dial follows. A print run should copy this: lib/print-runs.ts, a printRunScript, data-print-run, print-runs.css.
- Pocket console (components/pocket-terminal.tsx) has store()/stored() helpers that survive blocked storage, plus command parsing (parseSeasonChoice). A `print run` command and a small switch belong there.
- Ink filters: lib/ink-modes.ts (HANDS, MATERIALS with turbulence, grain and wash numbers, pinned by ink-modes.test.ts). Other filters are inline SVG in not-found.tsx, ink-radio.tsx and (ryugu)/sea.tsx.
- Paper grain: --grain-light/--grain-dark SVG data-URI in letterpress.css, capped at 0.06 alpha. lib/letterpress.test.ts reads the CSS as text and enforces contrast and the cap. Presets must stay inside those rules.
- Colour tokens: --paper, --ink via light-dark() in globals.css. Presets override these under [data-print-run=...], as seasons does.
- Design system: app/(design-system) has its own isolation.test.ts and motion.test.ts; /lab should follow its conventions.
- Tests: `npm test` is node:test over lib/** and _lib folders. Pure logic goes in lib/*.test.ts so it actually runs. A fresh lease may need `npm ci` first.

## Part 1 — Riso Print Shop
Headings: a <RisoHeading> that renders one visually-hidden plain copy (or aria-label) for screen readers, plus aria-hidden layered spans, one per plate (2-3) with the same text. Plates use mix-blend-mode: multiply with spot colours from --plate-1/2/3. On enter each plate starts translated and staggered (--i) and transitions to a rest offset of ±1-2px. Offsets are deterministic from a hash of the heading text so SSR/hydration match. Prefer CSS-only (transform/opacity). Under prefers-reduced-motion: reduce, skip the slide and render at rest offset. Trigger with IntersectionObserver or animation-timeline: view(), with a no-JS fallback showing the settled state.
- Cost: plates × characters is many nodes; split per word for long headings, apply to h1/h2 only.
- Risk: the existing view-transition TitleMorph (share="console-title") morphs headings between pages. Plate layers must not carry view-transition-name; add an e2e check.
- Keep real text selectable on the bottom plate only.

Print run switch (Sumi black, Riso pink+mint, Indigo night): each preset is a record of plate colours, paper/ink tokens, a filter tweak (turbulence/displacement multipliers fed to the ink materials) and an optional halftone/grain overlay (fixed body::after, pointer-events none, low opacity, radial-gradient halftone or the existing noise data-URI). The pre-paint script sets data-print-run to avoid a flash. Contrast: preset pairs must be tested like letterpress.test.ts (>=4.5:1); pink on mint fails for body text, so spot colours go on plates/headings and body ink stays dark. Carrying presets into SVG filters: feTurbulence attributes cannot take var(), so filters need React props or JS-set attributes.

## Part 2 — Ink Lab (/lab)
- New public route, e.g. app/(site)/lab/page.tsx; check how the (app) group gates routes before placing it.
- Controls: turbulence baseFrequency, displacement scale, wobble speed, grain strength, plate colours, transition timing, stroke style (existing HANDS). Typed ranges in lib/ink-lab.ts with clamp, defaults ("house style" = current MATERIALS.ink) and encode/decode.
- Share URL: compact query string, e.g. ?t=0.035&d=6&w=1.2&g=0.5&p=ff48b0,00a95c&h=ink. Decode strictly: clamp every value, validate hex, ignore unknown keys. It is untrusted input ending up in CSS/SVG attributes, so never inject raw strings.
- Apply to site: write to sessionStorage (session scope), set CSS variables on <html>, read in the same pre-paint script. "Reset to house style" clears the key and variables.
- Preview: real components (card, button, heading) inside the lab with scoped variables and a lab-only filter with a unique id so it does not collide with site filters.
- Perf: live sliders re-rasterise filters, so throttle with rAF and keep the preview small; wobble speed 0 under reduced-motion. Controls are a client component, the shell stays server-rendered.

## Risks / unknowns
1. SVG filter attributes can't use CSS variables, so site-wide re-inking needs JS or inline filter components.
2. Contrast on spot-colour presets.
3. Existing view-transition morphing of headings.
4. Several CSS/lib tests read files as text and pin values (ink-modes.test.ts, letterpress.test.ts); keep house defaults identical or update tests deliberately.
5. The pocket console traps keydown at window; new controls need the bind() route.
6. Mobile cost of multiply blending and a full-page overlay: keep the overlay optional and off under reduced-motion.

## Suggested task split
1. lib/print-runs.ts + tests: presets, parse, contrast check (pure logic).
2. Pre-paint script, print-runs.css, layout wiring, localStorage persistence, e2e for no flash.
3. Pocket console command and switch (`print run <name>`).
4. <RisoHeading> with a11y copy, reduced-motion, TitleMorph e2e check.
5. Overlay and filter carry-through (props/vars into existing filters).
6. lib/ink-lab.ts + tests: schema, clamp, URL encode/decode, hostile-input cases.
7. /lab page: controls, live preview, share URL, apply and reset-to-house-style.
8. QA: contrast across presets, reduced-motion, screen-reader text, URL fuzz.
Order: 1 -> 2 -> (3, 4, 6 in parallel) -> 5 -> 7 -> 8.

