# pm-264 research: three paper-and-ink toys (Kamishibai, Peep-box, Bottle)

Repo facts checked: Next 16.4.2 / React 19.3 (`ViewTransition` already used in app/(site)/(app)/play/page.tsx), no CSP header in next.config.ts/proxy.ts, one shared Web Audio context + off-by-default sound switch in lib/sound-client.ts (localStorage.sound, cues from lib/sound.ts), loader pattern `*-loader.tsx` for lazy heavy parts, Postgres via drizzle (db/schema.ts: user, song, askUsage...), no `@mediapipe` dependency yet, projects list in content/site.ts. Unit tests: `npm test` (node --test over lib/** and app/(x)/_lib/*.test.ts, each route group listed explicitly); e2e runs one file at a time; CI footer walk/probe (scripts/walk-end.sh, probe-end.mjs) run with BASE_URL, so any footer change must be rerun with CI=true GITHUB_SHA set. NOTE: node_modules/next/dist/docs is absent in this checkout (AGENTS.md says read it) - implementers must `npm ci` and read it first.

## Recommendation: ship in order 3 -> 1 -> 2 (cheapest/safest first), as three independent plans/tasks.

## 1. Kamishibai Theatre (medium, ~3-4 tasks)
- Where: new `/projects/[slug]` case-study view or a "Theatre" mode on /projects. Cards = data in content (title, caption, inked SVG art ref). Stage frame = CSS wooden frame + SVG turbulence/displacement filter for ink edges.
- Card slide: `<ViewTransition>` with per-card `name`; advance on click/arrow keys. Feature-detect; fallback = instant swap.
- Reduced motion -> plain `<ol>` card list. Make the list the default server-rendered markup and enhance (also the no-JS/SEO/a11y baseline).
- Ink babble: pure function `babble(text, seed) -> events[{t, freq, dur, gain}]` in lib/ (deterministic, unit-testable, no audio): vowel/consonant to pitch via a pentatonic table, seeded jitter, ~60ms blips, punctuation = longer pause, total capped (~2.5s). Play via the existing shared AudioContext (osc + short envelope; lib/sound.ts has `envelope`). Clapper = new CueName (noise burst + low thump). Reuse the global sound switch (default OFF; sound only after a click, satisfying autoplay); add a local mute only if needed.
- Captions stay real text; babble is decoration, no aria-live per card.
- Risks: view-transition name collisions with existing page-in/page-out (unique names per card); stop audio on card change/pagehide.
- Tests: babble determinism/length cap/empty text; reduced-motion renders list; e2e: click advances, mute respected.

## 2. Peep-box Diorama (highest risk, ~4 tasks, two phases)
- Phase A (no camera): layered SVG/CSS diorama on /play (seabed, kelp, fish, turtle) driven by pose {x,y} in [-1,1]. Off-axis math is a pure function `project(layerDepth, pose) -> {dx,dy,scale}` (unit-test). Mouse -> pose; DeviceOrientation -> pose (iOS needs `requestPermission()` from a click). Critically-damped smoothing in rAF; stop rAF when off-screen/hidden; reduced-motion = static layers, minimal amplitude.
- Phase B (camera): `@mediapipe/tasks-vision` FaceLandmarker, dynamically imported only after the user presses "use my camera" (never auto). Wasm (~10 MB class) + model (~3-4 MB): self-host under /public (versioned, no CDN, nothing leaves the device; verify Apache-2.0 licence). VIDEO running mode, ~30fps throttle, GPU delegate with CPU fallback. Pose from eye-midpoint/nose landmark, mirrored; depth from inter-ocular distance optional. Video element hidden, playsInline muted; stop all tracks on toggle off, route change, visibilitychange hidden, pagehide. Visible "camera on" indicator + one-tap off. Denied/no device/model failure -> silent fallback to mouse/gyro with inline message. Nothing uploaded: e2e with Chromium fake media stream (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`) asserting no network request carries frame data.
- Risks: bundle size (own loader, out of main chunk), battery, Safari/iOS quirks, e2e flake - rely on unit-tested pure math plus one fake-stream smoke; keep e2e serial (frame-count tests starve under concurrency).

## 3. Message in a Bottle (small/medium, ~3 tasks)
- Curated list `content/bottles.json` (url, title, note <= ~80 chars, kind: site|toy|art). Validation + test: https only, unique, note length, no tracking params. `pickBottle(list, rand, seenIds)` avoids repeats via a localStorage ring. I did not vet individual links; curation (20-40 entries) is a content task - seed ~12 and flag it. Links `rel="noopener noreferrer" target=_blank`, never iframed.
- Button: cork-bottle SVG, wash-up CSS animation (reduced motion -> instant reveal card). Footer changes risk walk/probe CI - do Pocket first, footer second, rerun walk-end/probe-end with CI env.
- Suggestion queue: drizzle table `bottle_suggestion(id, url, note, status pending|approved|rejected, created_at, ip_hash)` + migration; POST `app/api/bottle` (URL parse, https only, length caps, reject localhost/private hosts, dedupe, honeypot, per-IP rate limit modelled on the askUsage pattern in lib/ask.ts). Moderation via the existing admin area (approve/reject). Pool = JSON-curated union DB-approved, read at request time. Never auto-publish; never fetch submitted URLs server-side (SSRF).
- Tests: validator, picker, API validation/rate limit, admin gate.

## Cross-cutting
- Lazy loading: each toy gets a `*-loader.tsx` (next/dynamic ssr:false in a client component; IntersectionObserver or click trigger) like pond-loader/ink-press-loader.
- Sound: one AudioContext in lib/sound-client.ts; add cues there.
- Put pure logic in `lib/` (already globbed). New route groups need their `_lib` glob added to the package.json `test` script or tests silently don't run. Follow isolation.test.ts patterns for new CSS.

## Defaults the product owner may override
- /shared is read-only in this lease, so answer.md is at /tmp/artifacts/answer.md and the identical text is this body.
- Camera assets self-hosted; bottle links curated by a human; Theatre as a /projects mode vs a new route is open (default: mode on /projects).
