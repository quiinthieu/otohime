# Vinyl: a crate, a turntable and a visible YouTube monitor (pm-191)

**Idea.** "Add a Vinyl Player: users browse a crate of vinyl records, pick one,
and play it on a virtual turntable. Each record's music comes from YouTube."
The brief adds eight YouTube compliance rules that win over everything else.

**Product.** `otohime.dev/vinyl`, the next project on the Projects bench. On a
desktop there are three columns: on the left a crate of 12 procedurally drawn
sleeves with search and a genre filter, in the middle a turntable (plinth,
grooved platter, label, spindle, strobe ring, power LED, 33/45 switch,
tonearm), and on the right a retro "monitor" frame drawn *around* a visible
16:9 YouTube player (at least 480×270). Under the turntable sit the
now-playing LCD and the transport. On a phone the columns stack: crate, then
turntable, then monitor (full width, never below 200 px tall), then transport.
Pick a record ("Place on turntable", or drag it) and it lands on the platter
with its own label. Press Play (or drop the tonearm): the arm swings in,
hovers while YouTube buffers, lowers when playback starts, and the platter
spins up with inertia. Pause and the arm lifts and the platter spins down.
The platter follows YouTube's real player state, not the buttons.

Research: [research.md](research.md) (run-6370, rep-3595), checked against
the repo at bafc5dd. It holds the stack conflicts (§1), the five reference
projects with what we borrow and their licences (§2), the compliance table
(§3), the data model (§4) and the draft state diagram (§5). They are not
repeated here except where this plan changes them.

## Step 0: stack conflicts (the brief asked to be told)

The brief's fallback stack (Vite, Tailwind, Framer Motion, a component-test
harness) does **not** apply. The repo is Next.js 16.4 App Router with React
19.3, and every independent project is an isolated route group with its own
root layout, hand-written CSS, pure reducers in `_lib/` and `node --test`.
Vinyl follows that. No new dependency is added: `requestAnimationFrame`
replaces Framer Motion, and "component tests with a mocked player" become
reducer tests plus effect-runner tests against a fake player (see Decisions).

## Reference projects, in five bullets

- **shadcn.io Vinyl Player block**: borrow the shape (label art, arm swings in
  on play, RPM selector, transport, track info). We drive rotation from
  YouTube's state with rAF instead of a restarting CSS animation, and drop 78.
  No licence on the block; shadcn.io's licence forbids redistribution: copy
  nothing.
- **shadcn.io Vinyl Collection block**: borrow the sleeve grid with RPM/year
  badges and a hover lift; ours are procedural SVG sleeves with a focus lift,
  a genre filter and a drag source. Same licence position: reference only.
- **Fitbert/the-shelf**: borrow the visual recipe (plinth, platter, strobe
  ring, LED, pointer-event tonearm that works on touch, drop arm to play).
  Ours plays a visible YouTube embed, not uploads. No LICENSE file (all rights
  reserved): study the look, write our own code.
- **thebuggeddev/vinyl**: three.js; licence not visible. Not used; a 3D skin
  is a later project.
- **bitu467/record-player**: confirms the minimal disc + arm + button shape;
  bundles an mp3, no licence. Reference only. Nothing is copied from any of
  the five; the README says so.

## YouTube rules: where each one is enforced

| Rule | Enforced by | Proved by |
| --- | --- | --- |
| 1. Visible, ≥ 200×200 (target ≥ 480×270) | Monitor is its own grid cell: desktop `min-width: 480px; aspect-ratio: 16/9`; phone `width: 100%; height: max(200px, 56.25vw)`; space reserved before the API loads | `geometry.test.ts` at 1440, 1366, 1024, 768, 390, 320 px; walk greps the CSS; QA measures the iframe |
| 2. Nothing in front of the player | Frame is padding on a wrapper around the host `<div>`; host has `position: relative; z-index: 1; isolation: isolate`; no pseudo-element on the host or frame interior; tonearm SVG clipped to the turntable cell | `geometry.test.ts` (monitor box disjoint from crate, platter, tonearm sweep, LCD, transport); walk greps CSS for `overflow: hidden` on the turntable cell; QA `elementsFromPoint` at five points returns the iframe |
| 3. No audio isolation, no downloads | Video always visible; crackle (task 3) is its own Web Audio source and never touches the iframe | `isolation.test.ts` asserts no `download` attribute, no `AudioContext` outside `crackle.ts` |
| 4. Documented params only; no thumbnails | `playerVars` limited to `playsinline: 1, rel: 0, origin`; sleeves and labels are procedural SVG | `player.test.ts` snapshot of `playerVars`; `validateRecords` rejects `ytimg.com`/`youtube.com` art URLs |
| 5. Play only from a user action; one player | Reducer emits `play` only for actions carrying `user: true`; one `YT.Player`, created lazily on the first selection, reused via `cueVideoById`/`loadVideoById` | `deck.test.ts` property: no action without `user: true` ever yields `play`; walk: no `iframe_api` in the server HTML |
| 6. No background play | `visibilitychange` (hidden) → `pause`; `pagehide`/unmount → `destroy` | `deck.test.ts` (`hidden`, `unmount`); `player.test.ts` with the fake player; QA tab switch |
| 7. Referer sent, `origin` passed | No `Referrer-Policy` anywhere; `origin: location.origin` | Walk: no `Referrer-Policy: no-referrer` header, no `referrerpolicy=` in HTML; `player.test.ts` checks `origin` |
| 8. Watch link; graceful errors | Each record has "Watch on YouTube"; `onError` 2/5/100/101/150/153 → LCD message, "Skip" and "Watch on YouTube", auto-skip after 4 s; autoplay refusal → `tap` phase "Tap to play" | `deck.test.ts` per code; `scripts/vinyl-check.ts` (oEmbed) |

No requirement in the brief conflicts with these, with one adjustment: the
brief's "tonearm dropped → YouTube plays" is honoured only because the drop is
itself a pointer gesture; a keyboard tonearm "drop" is also a gesture.
Programmatic plays (auto-advance after `ended`, auto-skip after an error)
**cue** the next record and wait for Play, rather than calling `playVideo()`
without a gesture. That is the YouTube rules winning over "automatic skip".

## Decisions

| Decision | Why |
| --- | --- |
| Route group `app/(vinyl)/` serving `/vinyl`, own root layout, `vinyl.css` by hand, system font stack, `build-sha` meta. | House style for independent projects; `next/font/google` needs build-time egress (lesson). |
| All behaviour lives in pure `_lib/` modules: `deck.ts` (reducer returning `{state, effects}`), `spin.ts`, `geometry.ts`, `records.ts`, `oembed.ts`; `player.ts` runs effects against a `PlayerLike` interface; `youtube.ts` loads the API given an injected `window`/`document`. | node:test can then prove "selecting a record loads it", "pause stops the spin", "error shows the fallback" and the loader's strict-mode/HMR behaviour with a fake player and a fake DOM, without adding jsdom. |
| `records.json` is data only. `records.ts` exports types and pure functions (`validateRecords`, `parseRecords`, `genres`, `filterRecords`, `watchUrl`, `labelArt`); the server page imports the JSON and calls `parseRecords`; tests read it with `readFileSync`. | Node and Turbopack disagree on JSON import attributes; keeping imports out of `_lib` sidesteps it. |
| Twelve placeholder records cycle the owner's three `/music` ids (`IXA6bQsVNjs`, `agneRtEe-t8`, `vR49dHUwMUA`), flagged `placeholder: true`; duplicates are a warning, not an error. | Real, embeddable ids (oEmbed 200 on 2026-10-19) so the page works today; the README lists them for replacement. |
| `youtubePlaylistId` and `tracks[]` are in the type and validator; the UI shows tracks as Side A / Side B when present; one sample record uses `tracks[]` (single video ids, no playlist API). | The brief marks playlists optional; `tracks[]` gives Side A/B without `cuePlaylist`'s index semantics. |
| Auto-advance and auto-skip cue the next record, they never call `playVideo()`. | Rule 5 wins over "automatic skip"; flagged above. |
| No DOM test runner. Real geometry, console, memory and Lighthouse are QA steps with playwright-core from a scratch directory. | The pod has no browser; pm-189/pm-190 did the same. |
| Three tasks: (1) engine, data and validator, `qa: skip`; (2) the page with click placement, keyboard, rAF spin and reduced motion; (3) drag-and-drop, draggable tonearm scrub, crate-to-platter flight, crackle flag. | Task 1 changes nothing a visitor sees. Task 2 is a complete, compliant, accessible player. Task 3 is input and motion polish that can be reverted without breaking compliance. |
| Commits authored and committed as `Otohime <quiinthieu@gmail.com>` (set `GIT_AUTHOR_*` and `GIT_COMMITTER_*`). | Vercel Hobby deploys only the owner's commits. |
| Walk port 4031 (Sun 4027, Elements 4029). Stop servers with `pkill -x next-server`, never `pkill -f "next start"`. | No clash with other walks; pm-181. |
| pm-190 (Elements) edits the same shared lines (`package.json` test glob, `content/site.ts`, `lib/build-stamp.test.ts`, `e2e/rbac.test.ts`, `README.md`). On a rebase conflict keep both projects' lines. | Concurrent plans push to main. |

## File tree and components

```
app/(vinyl)/
  layout.tsx                  own <html>, vinyl.css, build-sha meta, themeColor
  vinyl.css                   tokens, 3-column grid / stacked phone layout, sleeves,
                              turntable, monitor frame, LCD, transport, focus rings,
                              @media (prefers-reduced-motion: reduce)
  vinyl/page.tsx              server: header + home link, <VinylApp records>, list of
                              records with "Watch on YouTube" (no-JS path), credits
  _components/
    vinyl-app.tsx             client shell: useReducer(deck), effect runner, lazy API,
                              rAF spin, visibility/pagehide, keyboard map, 250 ms poll
    crate.tsx                 search input, genre <select>, grid of <Sleeve> buttons,
                              "Place on turntable"; drag source (task 3)
    sleeve.tsx                procedural SVG sleeve (seeded by id, colours)
    turntable.tsx             plinth, platter + grooves, label art, spindle, strobe
                              ring, power LED, 33/45 radio group, tonearm (role=slider)
    monitor.tsx               retro frame around the player host <div data-monitor>
    transport.tsx             play/pause, stop, prev, next, eject, volume, seek bar
    lcd.tsx                   now playing + status, aria-live="polite"
  _lib/
    records.json · records.ts · deck.ts · spin.ts · geometry.ts · oembed.ts
    player.ts · youtube.ts · crackle.ts (task 3)
    *.test.ts                 records, deck, spin, geometry, oembed, player, youtube,
                              isolation
scripts/vinyl-check.ts · scripts/walk-vinyl.sh
content/site.ts (Projects row) · lib/build-stamp.test.ts · e2e/rbac.test.ts
package.json · README.md
```

## State diagram (`deck.ts`)

Phases: `empty`, `loaded` (record on the platter, video cued), `starting`
(user pressed play, waiting for YouTube), `buffering`, `playing`, `paused`,
`ended`, `tap` (autoplay refused), `error`.

```
empty ──select(i)──▶ loaded ──play{user}──▶ starting ──yt BUFFERING──▶ buffering ──yt PLAYING──▶ playing
                       ▲  ▲                    │  └──yt PLAYING───────────────────────────────▲      │ │
                       │  │                    │ playTimeout (1.5 s, still CUED/UNSTARTED)    │      │ │ pause{user} / hidden / yt PAUSED
                       │  │                    ▼                                               │      │ ▼
                       │  │                   tap ──play{user} or yt PLAYING──────────────────┘   paused ──play{user}──▶ starting
                       │  │                                                                     playing/paused ──yt BUFFERING──▶ buffering
                       │  └── stop{user} (from starting, buffering, playing, paused, tap, ended)
                       └───── select / next / prev (from any phase but empty): cue the record, phase loaded
playing ──yt ENDED──▶ ended ──(1.5 s)──▶ next record cued, phase loaded   (never auto-plays)
any ──ytError{code}──▶ error ──skip{user} or skipTimeout (4 s)──▶ next record cued, phase loaded
any ──eject{user}──▶ empty        any ──unmount──▶ (effect destroy)
```

Derived (pure functions in `deck.ts`, the UI reads only these):

- `tonearm(state)`: `rest` in `empty`, `loaded`, `ended`, `error`; `hover` in
  `starting`, `buffering`, `tap`; `down` in `playing`; `lifted` in `paused`.
- `targetRpm(state)`: the record's rpm (or the 33/45 override) in `playing`,
  0 otherwise. `spin.ts` eases the angle towards it.
- `lcd(state)`: title, artist, status line ("Buffering…", "Tap the video to
  play", "This video can't be played here", …) and time.

Effects the reducer emits, run by `player.ts` against the one player:
`ensurePlayer`, `cue {videoId, startSeconds?, endSeconds?}`, `play`, `pause`,
`stop` (`stopVideo` then re-`cue`), `seek {seconds}`, `volume {0..100}`,
`destroy`, `timer {name: "play" | "skip" | "advance", ms}`, `clearTimer {name}`.

## Tasks

### 1. Engine, records and the validator

- **Role:** software_engineer, `qa: skip`. New files under `app/(vinyl)/_lib/`
  and `scripts/`, plus `package.json` and `README.md`. No page, layout or
  route is added, so nothing a visitor sees changes.
- **Problem:** The page, the turntable and the player all rest on typed
  records, a player state machine that obeys the YouTube rules, rotation
  easing, layout geometry that keeps the player clear, a safe API loader and
  a way to find dead video ids. These must exist and be tested before any
  page uses them.
- **Action items:**
  1. Read `AGENTS.md`, `components/television.tsx` (the loader and player
     pattern to copy, not import), `lib/songs.ts` (id regex) and
     `app/(sun)/_lib/` (test and isolation style).
  2. `_lib/records.json`: 12 records `{ id, title, artist, year, genre,
     coverArtUrl, labelColor, accentColor, rpm, youtubeVideoId,
     startSeconds?, endSeconds?, placeholder: true }` across at least five
     genres, both rpms, `coverArtUrl: "procedural:<id>"`, ids cycling
     `IXA6bQsVNjs`, `agneRtEe-t8`, `vR49dHUwMUA`; one record also has
     `tracks: [{side:"A",…},{side:"B",…}]`; one has `startSeconds`/`endSeconds`.
     Titles and artists are invented placeholder names (no real album art or
     trademarks).
  3. `_lib/records.ts`: `VinylRecord` type (research §4 plus `tracks`,
     `youtubePlaylistId`, `placeholder`); `validateRecords(raw: unknown):
     { errors: string[]; warnings: string[] }` (array of ≥ 12; unique `id`;
     required strings non-empty; `year` integer 1900..current; `rpm` 33|45;
     `youtubeVideoId` and track ids match `/^[A-Za-z0-9_-]{11}$/`; optional
     `youtubePlaylistId` matches `/^[A-Za-z0-9_-]{10,64}$/`; colours
     `#rrggbb`; `0 ≤ startSeconds < endSeconds`; `coverArtUrl` is
     `procedural:` or a relative `/` path and never contains `ytimg.com` or
     `youtube.com`; WCAG contrast of the label text colour on `labelColor`
     ≥ 4.5 (pick black or white text, `labelText(record)`); duplicate video
     ids are warnings); `parseRecords(raw)` throws with all errors joined;
     `genres(records)`; `filterRecords(records, { query, genre })`
     (case-insensitive title/artist); `watchUrl(record)` →
     `https://www.youtube.com/watch?v=<id>`; `labelArt(record)` → deterministic
     SVG parameters (ring radii, text arc, seed from `id`).
  4. `_lib/deck.ts`: the reducer and derived functions exactly as in this
     plan's state diagram. `reduce(state, action): { state; effects }`.
     Actions carry `user: true` when they come from a gesture. The first
     `select` emits `ensurePlayer` before `cue`. `hidden` in `starting`,
     `buffering` or `playing` emits `pause`; `unmount` emits `destroy`. Error
     messages per code: 2 "That video id looks wrong", 5 "The player hit an
     error", 100 "That video is gone or private", 101/150 "The owner doesn't
     allow playing it here", 153 "The browser didn't send a referrer"; any
     other code is generic. Volume clamps to 0..100; seek clamps to
     0..duration.
  5. `_lib/spin.ts`: `advance(spin: { angle; rpm }, dtMs, targetRpm, reduced)`.
     `dt` is clamped to 100 ms; rpm eases exponentially (τ = 300 ms spinning
     up, 450 ms spinning down) and snaps to the target within 0.05 rpm; angle
     advances by `rpm × 6 × dt / 1000` degrees and is kept in [0, 360). With
     `reduced` the rpm jumps to the target and the angle does not move.
  6. `_lib/geometry.ts`: the layout constants (`MONITOR_MIN_W = 480`,
     `MONITOR_MIN_H = 200`, the phone breakpoint, column widths, gaps,
     platter and tonearm sweep sizes) and `layout(viewportWidth)` returning
     boxes `{ crate, turntable, platter, tonearmSweep, lcd, transport,
     monitor }`; `intersects(a, b)`. The CSS in task 2 uses the same numbers.
  7. `_lib/oembed.ts`: `oembedUrl(id)`, `classify(status)` → `embeddable`
     (200), `malformed` (400), `embedding-disabled` (401, 403), `not-found`
     (404), `network` (anything else / fetch failure).
  8. `_lib/player.ts`: `PlayerLike` (the IFrame API subset used),
     `PLAYER_VARS(origin)` → `{ playsinline: 1, rel: 0, origin }`,
     `mapState(n)` (-1, 0, 1, 2, 3, 5 → actions), `runEffect(player, effect)`
     mapping each effect to API calls (`cue` → `cueVideoById({videoId,
     startSeconds, endSeconds})`, etc.).
  9. `_lib/youtube.ts`: `loadYouTubeApi(win, doc): Promise<YTNamespace>`.
     Resolves at once when `win.YT?.Player` exists; otherwise keeps one
     promise on `win` (survives HMR module re-evaluation), appends exactly one
     `<script src="https://www.youtube.com/iframe_api">` (reuses one already
     in the document), chains any previous `onYouTubeIframeAPIReady`, and on
     script `error` rejects and clears the stored promise so a later call can
     retry.
  10. Tests (node:test, `app/(vinyl)/_lib/`):
      - `records.test.ts`: the shipped JSON validates with zero errors and
        ≥ 12 records; each rule above has a failing fixture; `ytimg.com` art
        is rejected; contrast picks readable text for all 12; filter/genres.
      - `deck.test.ts`: every arrow in the diagram; `select` → `ensurePlayer`
        + `cue` and phase `loaded` with no `play` ("selecting a record loads
        it"); `playing` + `pause{user}` → `targetRpm` 0 ("pause stops the
        spin"); each error code → phase `error` with its message and a skip
        timer ("error shows fallback"); `playTimeout` while still waiting →
        `tap`; `ended` and `skipTimeout` cue the next record and never emit
        `play`; a property loop over every phase × every action without
        `user: true` asserts no `play` effect; `hidden` → `pause`;
        `unmount` → `destroy`; `tonearm()` per phase.
      - `spin.test.ts`: spin-up reaches 98 % of 33⅓ within 1.3 s at 16 ms
        frames, spin-down to 0 within 2 s; rpm is monotone towards the
        target; no frame moves the angle more than `rpm×6×0.1` degrees (no
        snap); reduced motion freezes the angle; a 5 s `dt` is clamped.
      - `geometry.test.ts`: at 1440, 1366, 1024, 768, 390 and 320 px the
        monitor is ≥ 200×200, and ≥ 480×270 at ≥ 1024 px; the monitor box
        intersects none of the other boxes.
      - `oembed.test.ts`: the status table.
      - `player.test.ts`: a fake player records calls; `runEffect` maps each
        effect; `PLAYER_VARS` has exactly `playsinline`, `rel`, `origin` and
        no `autoplay`, `controls`, `mute` or `iv_load_policy`.
      - `youtube.test.ts`: fake `win`/`doc` objects: two calls share one
        promise and one script; an existing `win.YT.Player` resolves without a
        script; a previous `onYouTubeIframeAPIReady` still runs; an `error`
        event rejects and the next call appends a fresh script.
      - `isolation.test.ts`: adapted from Sun's: nothing under `app/(vinyl)/`
        imports `components/`, `content/`, `lib/`, `app/(site)`, `(shore)`,
        `(capsule)`, `(sun)`, `(elements)` or Tailwind, and no other group
        imports `app/(vinyl)`; `_lib/` files import no React; no file uses a
        `download` attribute; only `crackle.ts` may mention `AudioContext`.
  11. `scripts/vinyl-check.ts`: reads `records.json`, prints validation
      errors and warnings, then (unless `--offline`) fetches oEmbed for each
      distinct video id (concurrency 4, 8 s timeout) and prints a table
      `record · videoId · status · verdict`. Exit 1 on any validation error or
      any `malformed`/`embedding-disabled`/`not-found`; exit 2 if only
      `network` failures; else 0. Run it online once on the lease and paste
      the table into the commit message body.
  12. `package.json`: add `'app/(vinyl)/_lib/*.test.ts'` to `test`, and
      `"vinyl:check"` with the `capsule:sheet` node flags.
  13. `README.md`: a short "Vinyl records" section: how to add a record
      (fields, colours, contrast), `npm run vinyl:check` and its exit codes,
      and the placeholder table (12 rows: record id, title, video id).
  14. Commit and push with the owner identity.
- **Interfaces:** `app/(vinyl)/_lib/`; `scripts/vinyl-check.ts`;
  `package.json`; `README.md`
- **Non-goals:** any layout, page, CSS or component; a runtime fetch from the
  site; a DOM test library; the crackle module; changes to `/music`.
- **Acceptance:** `npm test` runs the Vinyl tests and they pass: 12 valid
  records, a state machine whose transitions, errors, tap-to-play, visibility
  pause and "never plays without a gesture" rule are proven, inertia easing
  without snaps, a layout that keeps the player ≥ 200×200 and clear of every
  other element, and an API loader safe under strict mode and HMR.
  `npm run vinyl:check` reports every video id's embeddability. The site is
  unchanged.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `npm run vinyl:check -- --offline`
  - `grep -q "app/(vinyl)/_lib/\*.test.ts" package.json`
  - `test ! -e 'app/(vinyl)/layout.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. The Vinyl page: crate, turntable, monitor and transport

- **Role:** software_engineer, depends on 1. QA is required.
- **Problem:** There is no Vinyl page. Visitors need the crate, the
  turntable, a visible compliant YouTube monitor, transport controls, a
  now-playing display and keyboard access, and the repo needs a walk that
  proves the served page.
- **Action items:**
  1. Read `AGENTS.md`, the Next 16 docs you touch in
     `node_modules/next/dist/docs/` (layouts, metadata, client components),
     `app/(sun)/layout.tsx`, `components/television.tsx`,
     `scripts/walk-sun.sh`.
  2. `layout.tsx`: own `<html lang="en">`, `vinyl.css`, title template
     `%s · Vinyl`, description, `other: { "build-sha": … }` as Sun's,
     `themeColor`. No `referrer` metadata.
  3. `vinyl/page.tsx` (server, `title: { absolute: "Vinyl" }`): top bar with
     `<a href="/">otohime.dev</a>`, `<h1>Vinyl</h1>`, `<VinylApp
     records={parseRecords(json)} />`, and below it a plain list of all
     records with a "Watch on YouTube" link each (the no-JS path), and a
     credits line (procedural art, reference projects studied, nothing
     copied).
  4. `crate.tsx`: search `<input type="search">`, genre `<select>` ("All"
     plus `genres()`), a grid of `<Sleeve>`s, each an
     `<article data-record="<id>">` with a button "Place on turntable"
     (`aria-label="Place <title> by <artist> on the turntable"`), year and
     `33`/`45` badges, and its "Watch on YouTube" link. Hover and
     `:focus-within` lift with `transform: translateY(-6px)`. An empty filter
     shows "No records match".
  5. `sleeve.tsx` and `turntable.tsx`: SVG drawn from `labelArt` and the
     record colours (no images). Turntable: plinth, platter with grooves,
     label with title/artist, spindle, strobe ring dots, power LED (lit when
     a record is loaded), a 33/45 radio group (defaults to the record's rpm),
     and the tonearm rotated by CSS `transform: rotate()` per `tonearm()`
     (`rest` / `hover` / `down` / `lifted`) with a 600 ms transition. The
     turntable cell has `overflow: hidden` so the arm never leaves it. The
     platter `<g>` takes `transform: rotate(<angle>deg)` from the rAF loop.
  6. `monitor.tsx`: a `<section data-monitor aria-label="YouTube player">`
     whose frame (bezel, knobs, a "Watch on YouTube" link below the screen)
     is drawn with borders and padding **around** the host
     `<div data-player-host>`; the host is `position: relative; z-index: 1;
     isolation: isolate`, sized by the geometry constants
     (`min-width: 480px; aspect-ratio: 16 / 9` on desktop; on phones
     `width: 100%; height: max(200px, 56.25vw)`), never hidden. Before a
     record is chosen it shows a placeholder card "Pick a record to load the
     player" in the same reserved box (no layout shift). In `error` it shows
     the message with "Skip" and "Watch on YouTube" *next to* the player,
     not over it; in `tap` it shows "Tap the video to play" next to it.
  7. `transport.tsx`: buttons play/pause (one toggle, `aria-pressed`), stop,
     previous, next, eject, a volume `<input type="range">`, and a seek
     `<input type="range">` with `mm:ss / mm:ss`; all with `aria-label`s
     and disabled when meaningless.
  8. `lcd.tsx`: retro LCD with title, artist, status and time;
     `aria-live="polite"` announces record changes and status (not the
     ticking time).
  9. `vinyl-app.tsx` (`"use client"`): `useReducer` over `deck.ts`; an effect
     runner that executes `ensurePlayer` by calling `loadYouTubeApi(window,
     document)` (first selection only) and creating **one** `YT.Player` in the
     host with `PLAYER_VARS(location.origin)`, `width/height: "100%"`, and
     `onReady/onStateChange/onError` dispatching `ready`, `mapState`, and
     `ytError`; a `live` ref so late events after `destroy` are ignored; the
     named timers from the effects; a 250 ms poll of
     `getCurrentTime()`/`getDuration()` while a record is loaded; a rAF loop
     calling `spin.advance` with `targetRpm(state)` that stops when rpm is 0
     and the target is 0; `matchMedia("(prefers-reduced-motion: reduce)")`
     (live) passed as `reduced` (the platter stays still and a "playing"
     lamp pulses via opacity instead); `visibilitychange` → `hidden`;
     `pagehide` and unmount → `unmount` + `destroy`. Keyboard on the deck
     region (`onKeyDown` on the app wrapper, ignored when focus is in an
     input/select): Space play/pause, ArrowLeft/ArrowRight previous/next,
     Escape eject.
  10. `vinyl.css` by hand, no Tailwind: tokens, three-column grid
      (`crate | turntable+lcd+transport | monitor`) from 1024 px, stacked
      below; turntable scales with `width: min(100%, 420px)` and
      `aspect-ratio`; visible `:focus-visible` rings (3 px, ≥ 3:1); text
      colours ≥ 4.5:1; `@media (prefers-reduced-motion: reduce)` removing
      transitions and the lift; transforms and opacity only for motion.
  11. `content/site.ts`: add `{ title: "Vinyl", note: "Dig the crate, drop
      the needle, watch it play.", href: "/vinyl", status: "live", colour:
      "pink" }` (use a valid `Swatch`). `lib/build-stamp.test.ts`: Vinyl's
      layout publishes `build-sha`. `e2e/rbac.test.ts`: `/projects` links
      `/vinyl`; `/vinyl` answers 200 without `aria-label="Main"`.
  12. `scripts/walk-vinyl.sh` (copy of `walk-sun.sh`, port 4031, local and
      `BASE_URL` modes, `grep -c` and numeric compares, no `wc -l`). On
      `/vinyl`: 200; `<title>Vinyl</title>`; no `aria-label="Main"`;
      `build-sha`; exactly 12 `data-record="`; exactly 1 `data-monitor`;
      exactly 1 `data-player-host`; `Place on turntable`; at least 12
      `youtube.com/watch?v=`; `aria-live="polite"`; no `iframe_api` and no
      `<iframe` in the server HTML; no `Referrer-Policy` header containing
      `no-referrer` and no `referrerpolicy=` in the HTML; exactly one
      stylesheet, which contains `prefers-reduced-motion`, `aspect-ratio: 16
      / 9` (or `16/9`), `min-width: 480px`, `max(200px` and no `--tw-`; the
      stylesheet does not contain `display: none` or `visibility: hidden`
      inside a rule whose selector mentions `data-player-host` or `monitor`.
      `/projects` links `/vinyl`; `/`, `/projects`, `/shore`, `/capsule`,
      `/sun`, `/music` answer 200.
  13. `README.md`: Vinyl layout line, the walk line, the **YouTube compliance
      checklist** (the brief's eight rules, each with where it is enforced),
      and **licensing notes** (all art procedural and ours; the five
      reference projects studied, nothing copied, their licence positions).
  14. Run lint, typecheck, tests and the walk on this lease; the walk must
      exit 0. `pkill -x next-server` afterwards. Commit and push with the
      owner identity.
- **Interfaces:** `app/(vinyl)/`; `scripts/walk-vinyl.sh`; `content/site.ts`;
  `lib/build-stamp.test.ts`; `e2e/rbac.test.ts`; `README.md`
- **Non-goals:** drag-and-drop, tonearm dragging, the crate-to-platter flight
  and crackle (task 3); a database or owner-editable records; changes to
  `/music` or other groups; any `playerVars` beyond the three; CI changes.
- **Acceptance:** `/vinyl` shows the crate (search, genre filter, lift on
  hover and focus), the turntable, the monitor and the transport, stacked on
  a phone. "Place on turntable" loads the record (label on the platter, the
  player script loads only now, one iframe, no layout shift). Play swings the
  arm in, it hovers while buffering and lowers on playing; the platter spins
  up and down with inertia following YouTube's real state; pause, stop,
  prev/next, eject, volume and seek work; Space, arrows and Escape work.
  Under reduced motion the platter is still with a playing lamp. A bad id
  shows the friendly message with Skip and Watch on YouTube; a refused play
  shows "Tap the video to play". Hiding the tab pauses. Nothing covers the
  player at any width. `bash scripts/walk-vinyl.sh` exits 0 on the delivery
  sha and `/projects` links Vinyl once.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-vinyl.sh && ! grep -nE 'wc +-l' scripts/walk-vinyl.sh`
  - `bash scripts/walk-vinyl.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4031/; then exit 1; fi`
  - `if BASE_URL=http://127.0.0.1:4041 bash scripts/walk-vinyl.sh; then exit 1; fi`
  - `! grep -rnE "autoplay|referrerpolicy|no-referrer" 'app/(vinyl)/_components' 'app/(vinyl)/layout.tsx'`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 3. Drag, scrub and the crate-to-platter flight

- **Role:** software_engineer, depends on 2. QA is required.
- **Problem:** Records can only be placed by button and the tonearm only
  moves by itself. The brief asks for drag-and-drop from the crate, a
  draggable tonearm that drops to play and scrubs, a record that visibly
  travels to the platter, and an optional crackle, all with non-drag
  alternatives and without touching the player.
- **Action items:**
  1. Read `AGENTS.md` and the task 2 components.
  2. `_lib/tonearm.ts` (pure): `angleToProgress(angle)` and
     `progressToAngle(p)` between the arm's lead-in and run-out angles,
     `pointerToAngle(pivot, point)`, `dropAction(angle, state)` → `play{user}`
     when released over the record from `rest`/`lifted`, `seek{user,
     seconds}` when moved while `down`, `pause{user}` when lifted back to the
     rest zone. Tests in `tonearm.test.ts` (round trips, clamping, drop
     outside the record does nothing, never a `play` without `user`).
  3. Tonearm in `turntable.tsx`: pointer events with `setPointerCapture`,
     `touch-action: none` on the arm only; while dragging the arm follows the
     pointer and the seek bar previews the time; release dispatches
     `dropAction`. The arm keeps `role="slider"` with `aria-valuenow` (seconds),
     `aria-valuetext` (`mm:ss of mm:ss`), Arrow keys ±5 s, PageUp/PageDown
     ±30 s, Home/End, Enter to drop (play) — the non-drag alternative. The
     seek bar stays as the accessible fallback.
  4. Drag-and-drop from the crate: pointer-based (works on touch), started by
     a drag on the sleeve (the "Place on turntable" button stays the
     alternative); the platter is the drop target with a highlighted ring;
     dropping dispatches `select{user}`; dropping elsewhere cancels.
  5. Flight: on `select`, animate a disc from the sleeve's rect to the
     platter's rect with a FLIP transform (`transform`/`opacity` only, about
     450 ms, via the Web Animations API on a fixed-position layer clipped to
     the crate and turntable columns, never crossing the monitor cell; skip
     it when the monitor would be crossed — on phones it moves down to the
     turntable which sits above the monitor). No flight under reduced motion.
  6. `_lib/crackle.ts`: `CRACKLE_ENABLED = process.env.NEXT_PUBLIC_VINYL_CRACKLE
     === "1"` (default off); a synthesised noise-burst generator on its own
     `AudioContext` and gain node at a low level (≤ −30 dB), started only
     from a user gesture while `playing`, stopped on pause, hidden and
     unmount. It never reads from or routes the YouTube iframe. A UI toggle
     appears only when the flag is on. Test the pure parts (envelope, level
     clamp, start/stop decisions from phases) in `crackle.test.ts`.
  7. Leak hardening: every listener, rAF id, timer and animation registered
     in `vinyl-app.tsx` is released on unmount (one cleanup per effect); the
     player is created once and destroyed once.
  8. Extend `scripts/walk-vinyl.sh`: the served HTML has a
     `role="slider"` tonearm and `data-drop-target`; the stylesheet has
     `touch-action: none` only on the arm selector; no `.mp3`, `.wav` or
     `.ogg` under `app/(vinyl)` or `public/`.
  9. `README.md`: drag and scrub notes, the crackle flag and why it is
     synthesised.
  10. Run lint, typecheck, tests and the walk; `pkill -x next-server`. Commit
      and push with the owner identity.
- **Interfaces:** `app/(vinyl)/_components/`; `app/(vinyl)/_lib/tonearm.ts`;
  `app/(vinyl)/_lib/crackle.ts`; `app/(vinyl)/vinyl.css`;
  `scripts/walk-vinyl.sh`; `README.md`
- **Non-goals:** a 3D skin; recorded audio files; HTML5 drag-and-drop API
  (it does not work on touch); any change to how the player is created or
  its `playerVars`; 78 rpm.
- **Acceptance:** A sleeve can be dragged onto the platter (mouse and touch)
  and flies there; the button still works. Dragging the tonearm onto the
  record starts playback, moving it while playing scrubs, lifting it to rest
  pauses; the arm is also a keyboard slider. Nothing is ever drawn over the
  player, and reduced motion removes the flight and the spin. With
  `NEXT_PUBLIC_VINYL_CRACKLE=1` a faint crackle plays only while the record
  plays; without it there is no audio code path. The walk exits 0.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash scripts/walk-vinyl.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4031/; then exit 1; fi`
  - `test -z "$(find 'app/(vinyl)' public -type f \( -name '*.mp3' -o -name '*.wav' -o -name '*.ogg' \) 2>/dev/null)"`
  - `test "$(grep -rl AudioContext 'app/(vinyl)' | grep -v '_lib/crackle' | grep -v isolation.test.ts | wc -c | tr -d ' ')" = 0`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA notes (tasks 2 and 3)

Rerun the task's verification on the delivery sha, then Chrome via
playwright-core from a scratch directory (never in the repo) at 1366×768,
1024×768, 390×844 and 320×640, with `reducedMotion` both ways:

- Before any click: no request to `youtube.com/iframe_api`, no `<iframe>`, CLS
  0 when the player later loads.
- Place a record: exactly one `<iframe>`; its `getBoundingClientRect()` is
  ≥ 200×200 (≥ 480×270 at ≥ 1024 px); `document.elementsFromPoint` at its
  four corners (inset 2 px) and centre returns the iframe first; no other
  element's rect intersects it.
- Play (with `--autoplay-policy=no-user-gesture-required` and again with
  `user-gesture-required`): tonearm `hover` then `down`, platter angle changes
  between frames while playing and stops changing within 2 s of Pause; with a
  refused play the LCD says "Tap the video to play".
- Set one record's id to an unavailable id via a test copy served locally:
  the error message, Skip and Watch on YouTube show; after 4 s the next record
  is cued, not playing.
- `page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))`
  with `document.hidden` stubbed true: player state becomes paused.
  Navigate away: no audio continues (no iframe remains).
- Click through all 12 records twice; `JSHeapUsedSize` after a forced GC is
  within 10 % of the first sample; one iframe; empty console (no errors).
- Keyboard only: Tab reaches every control with a visible ring; Space, arrows
  and Escape work; task 3 adds the tonearm slider and drag/touch drop.
- Lighthouse desktop performance ≥ 90 on `/vinyl` (`npx lighthouse` from the
  scratch directory). A missing browser is a note, not a fail.

Acceptance walks production if `build-sha` has caught up, else a local
`next start`, with a watch on `https://otohime.dev/vinyl`.

## Risks

- Error 153 if anyone adds a `no-referrer` policy (the walk guards it).
- iOS refusing a gesture-started play (the `tap` phase handles it).
- The flight or the arm drawing over the player (geometry test, `overflow:
  hidden` on the turntable cell, QA `elementsFromPoint`).
- HMR or strict mode creating a second player (loader test, `live` ref,
  QA iframe count).
- Placeholder ids going private (`npm run vinyl:check`; runtime `onError`).

## Open questions and assumptions (none blocking)

- Route `/vinyl` and the title "Vinyl" are assumed.
- Records are static JSON; owner-managed records (like `/music` channels)
  would be a follow-up.
- 33/45 only; 78 is one union member away.
- Auto-skip and auto-advance cue the next record but wait for Play (the
  YouTube gesture rule wins over the brief's "automatic skip").
- Placeholder video ids reuse the owner's three `/music` songs; replace them
  in `records.json` and run `npm run vinyl:check`.
- Crackle is synthesised and off by default; a CC0 recording would add a
  binary, so it is not used.
