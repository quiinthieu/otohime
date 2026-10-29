# Research: three paper-and-ink pieces for otohime.dev (pm-301)

## Headline
All three are new, independent client islands with pure-logic cores. Suggested order: Senko (smallest, self-contained), then the Departures board (touches the existing Work/Projects pages), then Ennichi (needs the most art and design work). Each can ship alone.

## Repo facts verified
- Routes live in app/(site)/(app)/{work,projects,play}. play has hanafuda, inkblot, booth and pachinko subroutes. /play/senko and /play/ennichi should follow the hanafuda pattern: page.tsx, _components and a route .css, plus a link section on play/page.tsx.
- Work and projects are server components using ViewTransition and FigTitle.
- Convention: pure logic goes in lib/<name>.ts with node:test (lib/pipeline.ts, inkblot.ts, crumple.ts, ink-particles.ts, daruma.ts). `npm test` globs lib/**/*.test.ts and a fixed list of _lib dirs. Logic placed under app/ needs its glob added to package.json.
- Existing building blocks: lib/ink-particles.ts (DOM-free particle field), lib/sound.ts and sound-client.ts (audio and mute handling), lib/pipeline.ts, roughjs, and lib/motion.test.ts (pins motion rules).
- Next 16.4 and React 19. AGENTS.md requires reading node_modules/next/dist/docs before coding.
- Earlier lessons: give SWE task interfaces a recognised top-level path (scripts/ or projects/<plan>/task-N-evidence.md) when touching app/(site)/ route groups. Keep one top-level .css per route group. Check what motion.test.ts pins.

## 1. Ink Departures Board
- Data: lib/departures.ts, pure. A row is {name, schedule, status}. Status is ON TIME | DELAYED | BACKFILLING, plus CANCELLED only if it means something. Rows come from content/site (real projects and pipelines), with a deterministic status from a static field and no live fetch.
- Flap model: each cell is a character drum (A-Z, 0-9, space). A pure flipPath(from, to) returns the characters passed through. Test that it terminates and wraps.
- Scroll: CSS `animation-timeline: view()` inside `@supports`, with per-row animation-range. Fallback (unsupported or reduced motion): rows render final text at once, and a click or Enter on a row triggers a JS flip of at most 12 steps per cell. The server render outputs final text, so no-JS and crawlers see real content.
- A11y: the board is a real table or list with true text in the DOM. Flaps are aria-hidden. Status is text, not colour only. Reduced motion means no flip and no sound.
- Sound: muted by default, with an aria-pressed toggle. Web Audio noise-burst clack, created only after a user gesture, throttled to about one per 60 ms.
- Look: paper tile, hairline ink gap, hanko red for DELAYED, using existing tokens. Check contrast in both themes.
- Risks: scroll-driven animation combined with ViewTransition. Verify the fallback path explicitly in a probe. Keep to about 12 rows.

## 2. Senko Hanabi /play/senko
- Core: lib/senko.ts, a pure state machine. idle, then lit (bead grows), then stages by held time: botan (few thick slow sparks), matsuba (branching needles), yanagi (long drooping arcs), chiri-giku (faint sparse fall), then out. Thresholds are constants, tested with a fake clock.
- Steadiness: track pointer displacement per frame. If jitter exceeds a budget over N ms, the bead drops and goes out. Use a larger tolerance for pointerType=touch. Release means out.
- Sparks: a particle pool of about 200, reusing ink-particles. Branching means a spark spawns 2-3 short-lived children. Canvas 2D, a single rAF loop, DPR capped at 2, no libraries, about 10KB gzipped behind a dynamic loader.
- Visibility: stop rAF on document.hidden, pointercancel and blur. Use ResizeObserver for canvas size.
- Audio: Web Audio filtered-noise crackle at spark rate. Muted by default, and the press is the user gesture. Reduced motion gets a calmer render (fewer sparks, no shake) but stays playable.
- A11y: add a keyboard path (hold Space or Enter to light, with steadiness trivially met). Add a text alternative and live status ("lit, matsuba"). Use touch-action:none and suppress long-press context menus.

## 3. Ennichi Night /play/ennichi
- Art: one inline SVG scene, no raster. Four plate groups (C, M, Y, K) with mix-blend-mode:multiply and a few px of offset for misregistration, and halftone via SVG pattern or radial-gradient mask. Budget about 60-100KB. Offset animates only on hover or pan, never under reduced motion.
- Motifs: about 7 (turtle, tamatebako, mascot bits from components/figures). Each is a small SVG group with a hit target of at least 44px effective. Positions are fixed data in lib/ennichi.ts {id, x, y, r, hint}.
- Logic: pure lib/ennichi.ts. The found set is persisted in localStorage under a versioned key with tolerant parsing. The hint lantern picks the nearest unfound motif and returns a direction or region (not coordinates), with a cooldown. The stamp unlocks when found equals total. All of it is tested.
- Pan/zoom: pointer events plus a transform on the SVG group, clamped to bounds. Pinch with two pointers, wheel, +/-/reset buttons and arrow keys. touch-action:none. No library.
- Keyboard: motifs are focusable in DOM order with labels revealed only once found. A keyboard lantern describes the area. Finalise with design.
- Stamp: an ink-stamp SVG overlay, reusing the StampHeading styling. No server persistence is claimed.
- Risk: this is the largest scope. Cap it at one scene, and ship the art as a second task if needed.

## Suggested task split
- A (Senko): lib/senko.ts and tests, canvas island, loader and CSS, page and link, probe (hold, drop, hidden tab).
- B (Departures): lib/departures.ts and tests, board with scroll-driven CSS and JS fallback, sound toggle, wired into work and projects, probe both paths.
- C (Ennichi): lib/ennichi.ts and tests, scene SVG, pan/zoom viewport, lantern, stamp, persistence, page and link, mobile probe.

Verification for each: `npm test`, `npm run typecheck`, `npm run lint`, browser probes at 390px and 1280px, and a reduced-motion probe. Add test globs to package.json if logic lives under app/.

## Decisions (advisory)
- Logic lives in lib/ so the existing test glob picks it up.
- No new dependencies.
- No live data for the board.
- Audio is muted by default and gated by a user gesture.
- Reduced motion keeps Senko playable but calmer.
- Ennichi motifs are findable by keyboard.

## Caveats
- The three X inspiration links were not fetched.
- /shared/artifacts/answer.md could not be written because /shared is read-only on this lease. This body is the same content, and the decision is recorded.
