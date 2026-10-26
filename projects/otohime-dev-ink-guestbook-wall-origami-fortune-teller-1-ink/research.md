# pm-273 research: Ink Guestbook wall + Origami Fortune Teller

Note: /shared/artifacts is not writable in this pod (permission denied), so this body is the deliverable. No git push, as instructed.

## What the repo already gives us
- Stack: Next 16.4.2, React 19.3, drizzle-orm + pg (Postgres), better-auth with an admin plugin and roles (lib/permissions, app/(site)/(app)/admin). AGENTS.md warns this Next differs from training data: read node_modules/next/dist/docs/ before coding route handlers or pages.
- Storage precedent: db/schema.ts already has `song` (owner-curated rows) and `ask_usage` (rate-limit buckets: "ip:<hmac>:<UTC hour>", "day:<UTC date>", swept after 2 days, used by app/api/ask/route.ts and lib/ask-llm.ts). The guestbook should reuse that pattern. There is no KV and no Upstash dependency.
- Sound: lib/sound.ts defines cues as pure data (`CueName` union, MAX_DB cap, SOUND_KEY toggle); lib/sound-client.ts plays them on Web Audio, and components/sound-toggle.tsx gates them. A fold sound is one new cue, e.g. "fold", plus a test in lib/sound.test.ts. It needs no new infrastructure.
- Content: content/site.ts holds projects, songs, sketches (via lib/sketches), notes and games as typed data. lib/pages.ts lists the public pages, and there is a console menu (CONSOLE_MENU). The "Pocket" is the pocket terminal/handheld (components/pocket-terminal*, lib/terminal.ts, lib/adventure.ts, snake.ts), so toys are commands or cartridges there.
- Existing ink tooling to borrow from: lib/ink-lab.ts, ink-press.ts, ink-particles.ts and components/ink-*. Look there for brush and palette tokens before inventing any.
- Isolation lessons (from earlier runs): isolated root layouts load extra stylesheets, e2e/ryugu.test.ts counts stylesheets, and probes must live inside the repo tree. A new /guestbook under (site) with its own CSS file avoids touching those isolated roots. Add the CSS the way kame.css, pond.css etc. are added.

## Decision 1: Guestbook storage = Postgres via drizzle (reject KV and JSON-in-repo)
- JSON-in-repo needs a commit per visitor doodle: unreliable, races with concurrent pushes, and it exposes unmoderated content in git history.
- Vercel KV/Upstash adds a vendor, secrets and a second datastore. The repo is on Postgres and the deploy is k3s, so KV is not even the native option.
- Postgres matches the `song` and `ask_usage` precedent and gives pagination, status filtering and transactions for free.

Schema (new migration under drizzle):
```
guestbook_entry(
  id text pk,                 -- crypto.randomUUID()
  name text not null default '',        -- <=24 chars
  note text not null default '',        -- <=80 chars, one line
  ink text not null,                    -- one of 3 palette keys
  strokes jsonb not null,               -- compact vector, see below
  point_count int not null, bytes int not null,
  status text not null default 'pending',  -- pending|approved|rejected
  tilt real not null, tape smallint not null,  -- fixed at insert so layout is stable
  created_at timestamptz default now(), reviewed_at timestamptz, reviewed_by text references user(id) on delete set null
)
index (status, created_at desc, id)
```

Stroke format (compact, replayable): canvas fixed 240x160. Per stroke: `{c: colourIdx, p: [x0,y0,x1,y1,...] as ints in 1/4px or whole px, w: [width per point, 0-15 quantised], t0: ms offset}`. Store widths quantised so the sumi pressure/speed effect is baked in and replay is deterministic. Replay simply re-draws progressively with requestAnimationFrame using point index as time (store a coarse per-stroke duration, not per-point timestamps, to save bytes). Server caps: <=40 strokes, <=1500 total points, <=6 KB JSON, coordinates clamped to the canvas, widths 0-15, and time-of-draw <=60 s (client enforces 60 s; the server only sanity-checks the total duration field).

Rendering: SVG paths (Catmull-Rom or quadratic smoothing, variable width via stroke-width per segment or a polygon outline) rather than canvas bitmaps, so hover-replay is just `stroke-dashoffset` or progressive path reveal. Under `prefers-reduced-motion: reduce`, skip replay and show the finished drawing (also skip any wobble/tape animation). Check how lib/motion.ts and its test handle reduced motion and reuse it.

## Decision 2: Moderation and abuse controls
- Write path: POST /api/guestbook (app/api/guestbook/route.ts, mirroring app/api/ask/route.ts). Validate with a pure function in lib/guestbook.ts (+ guestbook.test.ts) so the rules are unit-testable without a browser: sizes, types, coordinate bounds, name/note length, control characters stripped, HTML never rendered (React escapes; never use dangerouslySetInnerHTML).
- Rate limiting: reuse the ask_usage bucket idiom. Either generalise it or add `guestbook_usage`. Buckets: "gb:ip:<hmac(ip, secret)>:<UTC hour>" (e.g. 3/hour) and a daily global ceiling ("gb:day:<date>", e.g. 100) so a flood cannot fill the queue. Store only an HMAC of the IP, never the raw IP, as ask does. Also a pending cap (e.g. refuse new entries when more than N are pending) as a last backstop.
- Profanity/size filter: small in-repo word list with leetspeak/spacing normalisation applied to name and note (no new dependency; a library like `bad-words` is an option but the list is small and the queue is the real defence). A hit means reject with a friendly message, or accept as `pending` flagged; recommended: reject obvious hits, and everything else still goes through the queue. Also reject links/URLs in name and note.
- Moderation: all entries are `pending` and invisible until approved. Admin queue at app/(site)/(app)/admin/guestbook, a server-component list with approve/reject/delete server actions, gated by the same admin role check the existing admin pages use. Show the replayed doodle in the queue. Optional later: a count badge on /admin.
- Public read: GET page of approved entries only, keyset pagination on (created_at, id), 24 per page; cursor in query. The client "infinite scroll" is an IntersectionObserver that appends pages, with a visible "more" button fallback for keyboard and no-JS users.
- Honeypot field plus a minimum draw time (e.g. >=1 s and >=2 strokes) cheaply blocks naive bots. A captcha is not recommended for the first release.

## Decision 3: Guestbook UI
- Route /guestbook under (site) (public), linked from Pocket (a terminal command / menu entry) and optionally the footer or the console menu via lib/pages.ts. Careful: PUBLIC_PAGES is typed as a union of hrefs and is likely used by nav tests and sitemaps. Prefer adding it the way DESK_PAGE is added, not into PUBLIC_PAGES, so the nav and the existing page-count tests do not change.
- Drawing component (client, lazy-loaded via the existing *-loader.tsx pattern): pointer events with `setPointerCapture`, `touch-action: none` on the canvas, pressure from `PointerEvent.pressure` when the pointer is a pen and speed-based width otherwise (width = clamp(max - k*speed) with exponential smoothing). 3 ink colours from the site palette tokens (read the Swatch/CSS variables rather than hardcoding hex). Undo removes the last stroke; also a clear button. A 60 s countdown starts on first stroke; at 0 the canvas locks and the doodle is submittable. Keyboard: the canvas is not keyboard-drawable, so offer "skip the doodle" (name/note only is not valid, so require >=1 stroke; or allow note-only entries with an empty strokes array, which is a product call, recommend requiring one stroke) and label the controls. Provide aria-live feedback for submit status ("sent, waiting for the owner to approve").
- Wall: corkboard background (CSS gradients plus subtle SVG noise filter), each card has washi tape (CSS gradient strip, one of ~4 variants) and a tilt of -4..4 degrees stored with the entry (not Math.random at render, to avoid hydration mismatches and layout jitter). Hover and focus replay; the card is a focusable element, so replay also runs on focus. Touch: tap to replay. Off-screen cards should not animate (IntersectionObserver).
- Each card needs alt text: name + note and "a doodle" (cannot describe the drawing). Don't put the note only in the drawing.

## Decision 4: Origami Fortune Teller
- Pure data model first: lib/fortune.ts builds the fortune pool from content/site.ts (projects, songs, sketches, notes/articles, games) plus the page list, producing `{label, href, kind}` entries. Keep the selection pure and seedable: `pickFortune(pool, seed, colourIdx, count, numberIdx)`. Fresh because it reads the same data the site renders; add a test asserting every href resolves to a real route (guard against dead deep links, especially for projects with no `href`, for which fall back to /projects). Note that articles and notes may come from files or other loaders: check app/(articles) and how the notes list is built, and use the same loader, otherwise the fortunes drift.
- Game flow (state machine in a small pure reducer, easy to unit-test): closed -> pick colour (4 flaps) -> spell the colour name, toggling open/close by that many letters (the "count") -> pick a number from the revealed flaps -> pick again -> unfold flap -> fortune with a link. Choose a deterministic mapping: the 8 inner flaps each map to a fortune index, shuffled by a per-session seed so repeat plays vary.
- Visual: SVG shapes for the four-pointed cootie catcher with CSS 3D (`transform-style: preserve-3d`, `perspective`) for the pinch open/close; crease shading with linear-gradients overlaid per facet; a subtle paper grain filter. Keep the CSS-3D cost low (a handful of elements). Provide a flat 2D fallback under reduced motion (crossfade between open/closed states; no 3D rotation).
- Controls: click/tap the flaps, plus Left/Right arrow keys to pinch open/closed (axis toggle) and Enter/Space to choose; every choice is a real `<button>` with an aria-label ("Red, 3 letters", "Open the flap numbered 4"); the revealed fortune goes in an aria-live region and the deep-link is a normal anchor. Focus management: move focus to the fortune after the reveal.
- Sound: add a "fold" cue (a short filtered noise or two descending notes) to CUES in lib/sound.ts and call it via the existing sound-client when the toggle is on; extend sound.test.ts (it likely checks every cue's envelope and MAX_DB). Silent when sound is off.
- Placement: a Pocket toy (a command/cartridge in lib/terminal.ts + a component loaded lazily) and a standalone route such as /pocket/fortune or /play/fortune so it is linkable and e2e-testable. The "home easter egg" is optional: recommend deferring it, or limiting to a small paper-fold icon that links to the toy; avoid adding hydration cost to the home page, and note that home e2e tests and the Peek fan hover quirks (lesson: a stretched card link's Peek fan defeats hover-revealed controls) make home changes riskier.

## Suggested task split (each independently shippable, SWE build contracts with verification[])
1. **Guestbook data + API**: migration, lib/guestbook.ts validator (+ unit tests for limits, stroke bounds, profanity normalisation, rate-limit bucket logic with injected clock/store), POST/GET route. Verify: `npm test`, a route test with injected request (per the lesson that probe scripts should expose the request sequence as a lib function with an injected request, not hit the live server).
2. **Admin moderation queue**: /admin/guestbook approve/reject/delete with role gating; tests for the admin guard and for "pending never appears in the public GET".
3. **Guestbook page + drawing client**: canvas, brush, undo, 60 s limit, submit; wall with tape/tilt, hover/focus replay, reduced-motion path, pagination; link from Pocket. e2e: draw, submit, see the pending message; approved entry shows on the wall; reduced-motion media emulation shows no replay.
4. **Fortune data + reducer** (pure): lib/fortune.ts + tests including "all hrefs exist".
5. **Fortune teller UI + fold cue**: SVG/CSS-3D, keyboard and aria, Pocket entry, route; a11y e2e (keyboard-only completion) and reduced-motion check.
6. (optional, later) home easter egg.

## Risks and gotchas
- Moderation is the product risk: user-generated drawings are public once approved, so the owner must see the drawn image in the queue, not only the text. Default-hidden is non-negotiable.
- Privacy: store no raw IPs; HMAC the IP with a server secret (needs an env var, so follow the existing ask-llm env convention; the earlier lesson is that a set-env operator action produced an escalation that tells the run to end, so make the code degrade safely, e.g. disable posting with a clear message if the secret is unset, rather than depend on a person to set it mid-run). Production deploys need the DB migration applied: check how existing migrations are run in deploy (prisma/ and drizzle.config.ts both exist; confirm which is canonical before writing a migration).
- Payload abuse: enforce body size at the route (read text, check length before JSON.parse) in addition to field validation.
- Stylesheet-count e2e (e2e/ryugu.test.ts and _lib isolation tests): any new shared root-layout CSS needs an allowance. Put guestbook/fortune CSS in route-level files under (site) only.
- e2e is slow (~5 min, 118 tests with 1 deliberate skip) and main moves quickly: keep each task small, run `npm test` before the push, and rebase quickly.
- Next.js 16.4 differences: read node_modules/next/dist/docs/ (route handlers, caching defaults, server actions) before writing the API and admin actions. Do not rely on memory of Next 14/15 conventions.
- Pressure support is spotty (mouse reports 0.5 constant; many touch devices report 0 or 1), so width must fall back to speed-only when pressure is unreliable.
- Inspiration links (x.com) were not fetched; the design direction above comes from the feature description alone.
