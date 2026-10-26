# Kame & Crumple: research and recommendation (pm-259)

(/shared/artifacts/answer.md could not be written: /shared is not writable in this lease. The report body is the answer.)

## Verdict
Feasible as two independent, lazy progressive enhancements, with no new dependency. Build order: tear half of Crumple, then Kame, then crumple/basket.

## Repo patterns to reuse (verified in checkout)
- Lazy gate: components/pond-loader.tsx and ink-hero-loader.tsx use next/dynamic ssr:false, load only when in view and idle, and skip on prefers-reduced-motion and Save-Data. Copy this; mount after load + idle so there is no LCP impact and server HTML is unchanged.
- Sound: lib/sound.ts holds cues as pure data (CUES, CueName, MAX_DB=-18); lib/sound-client.ts plays them. Purr = a new cue (low triangle/square, ~110-140 Hz, looped while held), gated by the existing sound toggle. Adding a CueName means updating the cue tests.
- Drag: components/stamp-board.tsx, lost-sheet.tsx, desk/ink-desk.tsx plus lib/desk.ts (versioned localStorage JSON) give pointer-drag and persistence patterns.
- Footer: components/end-footer.tsx hosts the basket and the shell; it already links to Ryugu-jo.
- Lessons: a new app/(group) root layout trips lib/motion.test.ts and design-system siblings.test.ts, so add components under existing layouts only. Do not name helpers use*. Run npm ci first. Run one WebGL e2e context at a time.

## Kame (ink turtle)
- Inline SVG in the site's rough ink style, in a pointer-events:none fixed layer. CSS keyframes for paddle and zZ bubbles keep main-thread cost low.
- Pure state machine in lib (swim | nap | follow | fetch | pet | shell), unit-tested. Idle >45 s => nap. Call by clicking Kame, key K, or a button => follow cursor. Drag-end with velocity on a data-tossable element => fetch: Kame goes to it and animates it back to origin via transform (never mutates content or hrefs).
- Toss starts only after >6 px movement with pointer capture, and the following click is suppressed, so links keep working. Exclude pages with their own drag UIs (/desk, stamp board).
- Mood from local hour plus a visit streak. localStorage key kame:v1 {name, lastVisit, streak, dismissed}, every access in try/catch. Name entered inline in a speech bubble, not prompt().
- Dismiss retracts into a footer shell button; click or Enter restores it.
- Reduced motion: asleep in a corner, no follow or fetch; petting still works with a static bubble.
- Touch: pointer events; press-hold 500 ms = pet; touch-action:none only on Kame and active drags. Keyboard: a real "Call Kame" button; Kame itself is aria-hidden.

## Crumple & Tear
- Tear: drag from a 24 px corner hot zone. Deckled edge = clip-path polygon from a seeded noise polyline (deterministic per card). The hidden layer (margin note or link) is real DOM text under the card, so it is accessible. Cosmetic only; state in sessionStorage.
- Keyboard alternative: focusable "Peel corner", "Crumple" and "Reset" buttons per card (visible on focus-within).
- Crumple: default to 2D canvas, not WebGL. Redraw the card as a vector (avoid html2canvas), deform a small triangle mesh along seeded fold lines with ink crease strokes, tween ~400 ms into a ball sprite. The real card is visibility:hidden (no layout shift) and restored on reset. WebGL stays an optional later upgrade because of context loss and SwiftShader test cost.
- Physics: tiny hand-written circle-vs-segment integrator (gravity, restitution ~0.4, friction, basket rim), fixed timestep, sleeps at rest so rAF stops. No library.
- Basket: footer SVG; landing in the opening counts as "in".
- Reset: "Iron flat" button runs an iron-sweep overlay animation and reverses crumple and tear. Also resets on route change.
- Touch: long-press 600 ms crumples (cancel on >8 px move so scrolling works); flick to toss.
- Reduced motion: instant state swaps, ball drops straight into the basket.

## Performance / LCP
Loaders render null on the server and import dynamically after load + idle. Budgets: Kame <15 kB gz, Crumple <20 kB gz. Add a test that SSR HTML has no data-kame or data-crumple markup, and check LCP and CLS are unchanged. All overlays are fixed or absolute.

## Risks
1. Drag conflicts with links, existing draggables and scroll: opt-in data-tossable and scoped touch-action.
2. Z-index clashes with peek-layer, season layer and Pocket terminal: Kame sits below Pocket, above content.
3. Test pins in motion, siblings and sound cue tests.
4. Crumple fidelity vs cost: canvas first.
5. Purr audio respects the sound toggle; it only starts on a user gesture.

## Suggested tasks
1. lib/kame.ts state machine, mood, storage, with tests.
2. Kame SVG, loader, shell/dismiss, reduced-motion, purr cue.
3. Kame fetch (data-tossable, return animation, click suppression) and touch.
4. lib/tear.ts and tear UI with keyboard alternative and hidden layer.
5. Crumple physics lib, canvas crumple, footer basket, toss.
6. Reset/iron animation and reduced-motion paths.
7. QA: LCP/CLS, touch emulation e2e, a11y, no-SSR-markup test.

Note: the x.com inspiration links were not fetched; the design rests on the idea text and the repo.
