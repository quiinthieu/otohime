# Research: /play/booth and /play/pachinko (pm-294)

Note: /shared is a read-only filesystem on this lease, so /shared/artifacts/answer.md could not be written. This body is the answer. No git push was done, as instructed.

## Repo findings
- Next 16.4.2, React 19.3, three 0.186.1 already present. AGENTS.md requires reading node_modules/next/dist/docs before writing route code. Note that node_modules/next/dist/docs was not present in this checkout, so the implementer must check it exists after `npm ci`.
- Play lives in `app/(site)/(app)/play/`. `page.tsx` stacks sections (Hanafuda has its own sub-route `play/hanafuda/` with `_components/` and a route CSS file). Copy that shape: `play/booth/` and `play/pachinko/`, each with page.tsx, `_components/`, a CSS file, and a teaser section plus link on `play/page.tsx` (same pattern as the `play-hanafuda-link` test id).
- Reusable pieces: `components/peep-box/camera.ts` already does opt-in getUserMedia with a secure-context guard and rejection fallback, and cleans up tracks on abort. Reuse its guard and cleanup pattern, not the head tracker. `components/press-sound.tsx` and `sound-toggle.tsx` are the existing WebAudio and mute conventions. `RisoText`, `StampHeading` and `ink-press*` give the paper and ink look. `pond-loader` / `ink-press-loader` show the lazy-loading pattern.
- E2E convention: `e2e/*.test.ts` with a fake camera (`peep-box-camera.test.ts`, `peep-box-face-fixture.ts`). Use Chrome `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` or the existing fixture.
- Lessons that apply: start acceptance servers with the env scripts/e2e.mjs sets (bare `next start` 500s without BETTER_AUTH_*); set a short TMPDIR for Chrome; do not commit the build-rewritten content/history.json; assert real viewport visibility at 390x844, not only Playwright's visible state.

## 1. Ink Purikura Booth
Approach: no new dependencies.
- Capture: `getUserMedia({video:{facingMode:"user", width:{ideal:960}}, audio:false})`, started only on a button click ("Open the booth"). Draw each video frame to an offscreen canvas. Nothing is uploaded; add no network calls and say so in the UI copy. Stop all tracks after the 4th shot and on unmount.
- Fallback: if there is no camera, permission is denied or the context is insecure, load a bundled sample paper portrait (a small SVG or WebP in /public, under ~100KB) and run the same pipeline on it. The same fallback serves tests.
- Film stocks as a fragment shader on a single WebGL2 full-screen quad, with three modes:
  - sumi-e: luminance, blurred threshold bands, paper-noise modulation, a dark ink ramp.
  - riso: two-colour (e.g. fluoro pink and teal) rotated halftone screens on separate channels with multiply blend and slight misregistration.
  - newsprint: a single 45-degree dot screen, `smoothstep` dot radius from luminance, grey paper tint.
  - Do not use three.js for this. A raw WebGL2 quad is about 80 lines and keeps the bundle small. If WebGL is unavailable, fall back to a canvas 2D implementation of the halftone (per-cell dots over a downsampled image); this is also the deterministic path for tests.
  - Render the live preview at reduced resolution (~480px wide) and the captured frames at full size by re-running the shader with a higher-resolution target and `canvas.toBlob`.
- Countdown: 3-2-1 with a WebAudio-synthesised shutter clack (noise burst plus click), routed through the existing sound toggle. The ink-flash is a CSS overlay. Under `prefers-reduced-motion`, drop the flash animation and show a static "click" frame; keep the numeric countdown text.
- Strip assembly: a 2D canvas, about 600x1800. A torn-paper edge from a seeded random polyline mask, 4 frames with a slight rotation, a date hanko stamp (red circle with the date in vertical or radial text) and the "otohime.dev" footer. Then purikura decoration: a pointer-events drawing layer (ink pen with several widths and colours, an eraser, undo) plus an emoji or SVG doodle sticker tray with drag, scale and rotate. Redraw the strip as pen strokes and stickers are stored as a vector list, so undo is trivial and export re-renders at full size.
- Export: `canvas.toBlob` then an `<a download="otohime-booth-YYYYMMDD.png">`. Print: an `@media print` stylesheet that shows only the strip at roughly 5x15cm and hides the chrome, plus a "Print" button calling `window.print()`.
- Risks: iOS Safari needs `playsInline` and muted video; WebGL context loss (handle `webglcontextlost` by falling back to canvas 2D); mirrored selfie preview but un-mirrored (or mirrored by choice) capture, so decide and label; large canvases on mobile (cap the capture at 1280px on the long edge).
- Privacy copy: "Your camera stays in this tab. Nothing is uploaded."

## 2. Pipeline Pachinko
Approach: a custom verlet sim, not Matter.js. Reason: the balls are circles, the pegs static circles and the walls static segments, so a custom sim is about 200 lines, adds no dependency (Matter.js is ~80KB min), and gives a deterministic fixed-timestep core that is easy to unit-test and to seed. The stage logic (merge, split, gate) needs custom hooks that are easier to write against our own sim.
- Sim: fixed 1/120 s step with substeps, gravity, circle-vs-circle-peg and circle-vs-segment collision with restitution ~0.5, and a spatial hash for the ball-ball collisions (cap on-screen balls, e.g. 150). Render on canvas 2D with ink-brush styling (wobbly stroke, paper background); no WebGL is needed.
- Board layout (top to bottom): plunger and launch lane, then
  - ingest: a dense peg lattice
  - dedupe gate: a one-way flap or narrow gap where a ball whose id duplicates a recent id gets bounced back, with a visible stamp of "DUP"
  - join funnel: a funnel that holds the first ball until a second arrives, then emits one merged larger ball
  - partition splitter: a wedge splitter into N buckets (e.g. 6) by a hash of the ball id
  - dead-letter queue gutter: a side channel; a random failure rate sends a ball there
  - the buckets feed a live bar chart (heights from counts, drawn on the same canvas or as an SVG strip beneath).
- Readouts: records/sec (rolling 5 s window), late-arrival % (balls whose transit time exceeds a threshold), DLQ count. Use a polite `aria-live` summary updated about once a second, not per ball.
- Controls: plunger as a pointer drag-and-release (power maps to launch speed) plus Space/Enter and a visible Launch button; a "Backfill" button that spawns a capped flood (e.g. 60 balls staggered over 2 s); a mute toggle using the existing sound-toggle.
- Sound: WebAudio, short filtered noise-burst or sine ticks per peg hit, rate-limited (e.g. max 20/s) with pitch jitter; the AudioContext is created only after a user gesture. Mute by default is a safe option, following the repo convention.
- Tilt-to-nudge: `DeviceOrientationEvent`, with the iOS `requestPermission()` call placed behind an explicit button; map gamma to a small horizontal acceleration. Provide keyboard (arrow keys) and on-screen nudge buttons as the desktop equivalent.
- Easter egg: track consecutive DLQ outcomes; at 3 in a row show a paper "on-call pager" gag card (dismissible, focus-managed, role=dialog or a status region) and reset the streak.
- prefers-reduced-motion: do not auto-run anything; the sim advances only on explicit launches, and the backfill is reduced to a smaller batch. Pause the loop when the tab is hidden (`visibilitychange`) or the canvas is off-screen (IntersectionObserver).
- Risks: tunnelling at high speed (cap the velocity, use substeps); the funnel join logic stalling if a lone ball waits forever (add a timeout that releases it as a late arrival); mobile performance (cap the ball count, device-pixel-ratio clamp to 2); canvas touch handling must set `touch-action: none` to stop page scroll during the plunger drag.

## Suggested task split
1. Booth core: camera plus fallback, shader and canvas film stocks, countdown, capture. Touches `play/booth/**`.
2. Booth strip: assembly, hanko, pen and stickers, PNG export, print CSS. Depends on 1.
3. Pachinko sim core with pure-function unit tests (collision, determinism, merge/split/DLQ rules), no DOM.
4. Pachinko UI: canvas render, plunger, backfill, sound, tilt, readouts, bar chart, pager gag.
5. Play-page teasers and links, OG metadata, any site-content registry entries; e2e tests for both (fake camera for the booth, seeded sim for the pachinko).
Tasks 1 to 2 and 3 to 4 are independent of each other and can run in parallel. Each SWE task should list a recognised top-level path (e.g. `app/` or `e2e/`) in its interfaces and use schema='platform.plan-prerequisites.v1' in prerequisites.

## Verification ideas (for build contracts)
- Booth: with a fake media stream, click Open, wait for 4 captures, assert the strip canvas is non-blank and has the expected dimensions, and that the download has PNG magic bytes. With camera denied, assert the sample portrait path produces the same 4-frame strip. Assert no network request carries image data. With reduced motion emulated, assert no flash animation class.
- Pachinko: a unit test where a seeded sim run gives identical bucket counts; a test that the DLQ streak of 3 shows the pager and 2 does not; an e2e check that Backfill raises the total of the bucket counters and that the 390x844 viewport shows the board and controls.
- Common: `npm run typecheck`, lint, `npm test`, and an a11y pass (keyboard operability of the plunger, the labelled controls, a visible focus ring).

## Open questions I resolved myself
- Matter.js vs verlet: verlet (smaller, deterministic, custom stage hooks).
- three.js vs raw WebGL2 for the booth: raw WebGL2 with a canvas 2D fallback.
- Sound default: off until the user unmutes (matches the site's sound toggle convention).
