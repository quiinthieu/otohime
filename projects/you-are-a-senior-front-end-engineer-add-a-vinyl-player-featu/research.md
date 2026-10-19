# Research: a Vinyl Player for otohime.dev (pm-191, run-6370)

**Idea.** Add a "Vinyl Player": browse a crate of records, drop one on a virtual turntable, play it; the music is a visible YouTube embed. Match the existing stack; obey YouTube's API Services policies.

**Short answer.** Build it as `app/(vinyl)/` serving `/vinyl`: its own root layout and hand-written stylesheet (no Tailwind), a pure deck reducer in `_lib/` driven by YouTube's player events, SVG/CSS turntable art, one persistent YouTube player sitting in a drawn "monitor" frame beside the turntable with nothing over it, and node:test unit tests plus a walk script. Copy the proven YouTube loader pattern from `/music`'s television into the route group. The idea's defaults (Vite, Tailwind, Framer Motion, component-test harness) do **not** apply; the repo's conventions win and the conflicts are listed in §1. Everything below was checked against the repo at bafc5dd and the live site on 2026-10-19.

## 1. Step 0: the stack, and where it overrides the idea

| Idea said | Repo has | Follow |
| --- | --- | --- |
| React + TypeScript + Vite | Next.js 16.4.2 App Router, React 19.3, TypeScript 5, Turbopack, Node 22 | Next.js route group; pages are server components with one `"use client"` app component |
| Tailwind CSS | Tailwind v4 only inside `app/(site)/`; every independent project (Shore, Capsule, Sun) has its own root layout and hand-written CSS, and an `isolation.test.ts` that fails if the group imports `components/`, `content/`, `lib/`, Tailwind or another group | Hand-written `vinyl.css` with CSS variables, no Tailwind |
| Framer Motion | Not installed; motion is CSS keyframes, `setInterval` at 12 fps on a pure reducer, or `requestAnimationFrame` | rAF for the platter angle, CSS transitions for the tonearm and the crate lift, no new dependency |
| State management library | `useReducer` over pure `(state, action) => state` modules in `_lib/*.ts`, tested with `node --test` | Same: `deck.ts` reducer, player events are actions |
| Component tests with a mocked player | No jsdom, no RTL, no vitest; `npm test` is `node --test` over `_lib/*.test.ts`; `npm run test:e2e` is HTTP against `next start`; `scripts/walk-*.sh` probe served HTML | Put every decision in the reducer so "selecting a record loads it", "pause stops the spin", "error shows fallback" are reducer tests; the component is a thin shell; a browser QA step covers the rest |
| `records.json` | Data is TypeScript (`content/site.ts`, `_lib/sun.ts`) | Keep `records.json` as asked, with `records.ts` typing and validating it (Turbopack imports JSON; the test reads it with `fs`) |
| Lighthouse 90+ | The pod has no browser and no docker; pm-189's QA used headless Chrome via playwright-core from a scratch directory | Lighthouse and bounding-box checks are QA steps, not unit tests |

Other conventions to carry: `build-sha` meta in the layout (`lib/build-stamp.test.ts` asserts it per group), a `scripts/walk-vinyl.sh` in the style of `walk-sun.sh`, a row in `site.projectList` (`content/site.ts`), `e2e/rbac.test.ts` expecting `/projects` to link the new route and the route to return 200 without `aria-label="Main"`, a README section, plain `<a href="/">` back home (another root layout), commits authored as `Otohime <quiinthieu@gmail.com>` (Vercel Hobby deploys only the owner's commits), subjects `pm-191/t-NNNN: …`.

**Already in the repo and directly relevant:** `components/television.tsx` embeds one YouTube player on `/music` with a module-level singleton promise for `iframe_api`, `playerVars: { playsinline: 1, rel: 0, origin: location.origin }`, `onReady/onStateChange/onError`, `destroy()` on unmount, a hand-inked TV whose screen is a 6:5 box kept at least 200 px each way with the drawing behind it, and the comment "YouTube wants the player at least 200px each way with nothing in front of it". `lib/songs.ts` already parses 11-character video ids from links. Vinyl cannot import these (isolation), so copy the pattern. One improvement to make while copying: the loader must resolve at once when `window.YT?.Player` already exists, otherwise an HMR re-evaluation appends the script a second time and `onYouTubeIframeAPIReady` never fires again.

## 2. Reference projects: what to borrow, what to do differently, licences

- **shadcn.io "Vinyl Player" block** (https://www.shadcn.io/blocks/music-vinyl-player). Borrow the idea only: record with label art, tone arm that swings in on play, 33/45/78 selector, transport row, track info. Differ: no Framer Motion, no restarting CSS spin (it snaps the angle), rotation driven by YouTube's state not by the buttons, 78 dropped (data model says 33|45). Licence: the block page shows no licence; https://www.shadcn.io/license covers Pro items and forbids redistribution. Treat as reference, copy nothing.
- **shadcn.io "Vinyl Collection" block** (https://www.shadcn.io/blocks/music-vinyl-collection). Borrow: a grid of sleeves with RPM and year badges and a hover lift. Differ: our own procedurally drawn sleeves instead of placeholder images, keyboard focus lift, genre filter, drag source. Same licence position.
- **Fitbert/the-shelf** (https://github.com/Fitbert/the-shelf). Borrow the visual recipe: layered plinth, grooved platter, strobe ring, power LED, RPM switch that changes spin rate, a tonearm dragged with pointer events (works on touch), drop on the platter starts play. Differ: audio is a visible YouTube embed, not uploads; no Supabase, Discogs, Media Session or barcode scanning; no Tailwind. Licence: no LICENSE file, so all rights reserved by default; study the look, write our own code.
- **thebuggeddev/vinyl** (https://github.com/thebuggeddev/vinyl). three.js 3D player; licence not visible from the page. Not used now; a 3D skin would be a later project.
- **bitu467/record-player** (https://github.com/bitu467/record-player). Plain HTML/CSS/JS spin and tonearm with a bundled `audio.mp3`; no licence. Confirms the minimal shape (one disc, one arm, one button); we do the same with SVG and rAF.

## 3. YouTube compliance, requirement by requirement

Sources: Required Minimum Functionality (https://developers.google.com/youtube/terms/required-minimum-functionality), Developer Policies III.I.6-9 (https://developers.google.com/youtube/terms/developer-policies), player parameters (https://developers.google.com/youtube/player_parameters), IFrame API reference (https://developers.google.com/youtube/iframe_api_reference).

| # | Rule (source) | Design decision | Proof |
| --- | --- | --- | --- |
| 1 | "Embedded players must have a viewport that is at least 200px by 200px"; 16:9 at least 480×270 recommended (RMF) | Monitor panel is a CSS grid cell of `min-width: 480px; aspect-ratio: 16/9` on desktop; on phones `width: 100%; height: max(200px, 56.25vw)` so a 320 px screen still gives 200 px tall (16:9 at 320 px would be 180 px). Space reserved before the script loads (no layout shift). Never `display:none`, never 0×0, never off-screen | Geometry unit test on the layout constants at 1366, 768, 390 and 320 px; walk greps the served CSS; QA measures `getBoundingClientRect()` |
| 2 | "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player, including player controls" (RMF) | The TV frame is a sibling drawn around the player cell with `padding`, not an absolutely positioned child over it; the player host has `position: relative; z-index: 1; isolation: isolate`, no `::after`, no vignette, no glass. Turntable and crate are separate grid cells; the tonearm's SVG is clipped to its own box | Unit test: platter box, tonearm sweep box and crate box are disjoint from the monitor box in the same grid coordinates; QA with `document.elementsFromPoint` at the player's four corners and centre finds the iframe first |
| 3 | "separate, isolate, or modify the audio or video components" forbidden (III.I.7) | Video stays visible, no audio extraction, no download link; the optional crackle is a separate synthesised Web Audio source that never routes YouTube's audio | Code review line in the plan |
| 4 | "modify, build upon, or block any portion or functionality of a YouTube player" (III.I.6); no changes "not explicitly described by the API documentation" (RMF) | Only documented `playerVars`: `origin`, `playsinline: 1`, `rel: 0`, `enablejsapi` (implied by the API). Cover and label art are procedural SVG (Capsule/Sun style); no YouTube thumbnails | `records.json` has no thumbnail field; validator rejects `i.ytimg.com` URLs |
| 5 | Playback from a user action; "A page or screen must not have more than one YouTube player that automatically plays" (RMF); autoplay shares data on load (policies III.E.4.i) | `autoplay` never set; `playVideo()` only inside click/pointer/keyboard handlers (Play, dropping the record, tonearm drop); exactly one `YT.Player` per page, created lazily on the first record selection | Reducer test: no `play` effect without a user action; `/vinyl` is a different root layout from `/music`, so the two players never share a page |
| 6 | No "background player … not displayed in the page, tab, or screen that the user is viewing" (III.I.9) | `visibilitychange` → `pauseVideo()` when hidden; `pagehide` and unmount → `destroy()` | Reducer test for the `hidden` action; QA checks state after tab switch |
| 7 | Error 153 "The request does not include the HTTP Referer header" (API reference) | Production sends no `Referrer-Policy` header (checked with curl on 2026-10-19), so the browser default `strict-origin-when-cross-origin` applies; never add a `no-referrer` policy or meta; pass `origin: location.origin` | Walk asserts no `Referrer-Policy: no-referrer` header on `/vinyl` and no `referrerpolicy="no-referrer"` in the HTML |
| 8 | Graceful errors | `onError` codes: 2 invalid parameter, 5 HTML5 error, 100 not found/private, 101/150 embedding not allowed, 153 no Referer. Show a friendly LCD message, "Watch on YouTube" (`https://www.youtube.com/watch?v=ID`) and "Skip" which auto-advances to the next record after 4 s unless the user acts; each record also has a permanent "Watch on YouTube" link | Reducer tests per code; `scripts/vinyl-check.ts` reports dead ids before deploy |

**Autoplay rejection.** Browsers block unmuted `playVideo()` outside a gesture. Our play always comes from a gesture, but iOS can still refuse; detect it: after a `play` effect, if no `BUFFERING`/`PLAYING` state arrives within 1500 ms and the player still reports `CUED`/`UNSTARTED`, move to a `tap` phase that shows "Tap to play" on the monitor (YouTube's own big button is then the gesture). Never fail silently.

**Embeddability check.** `https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DID` answers 200 with title and author for an embeddable video, 400 for a malformed id (probed from this pod), 401 when the owner disabled embedding and 404 when the video does not exist (community reports: https://github.com/lycheeverse/lychee/issues/214, https://github.com/extractus/oembed-extractor/issues/168). A 200 does not prove playback (region and age limits surface at runtime as 150), so the validator reports and the player still handles `onError`. The pod can reach youtube.com, so the script can run locally and in CI.

## 4. Data model

`app/(vinyl)/_lib/records.json`, typed by `records.ts`:

```ts
type VinylRecord = {
  id: string; title: string; artist: string; year: number; genre: string;
  coverArtUrl: string;            // own SVG route or "procedural:<seed>"; never i.ytimg.com
  labelColor: string; accentColor: string;   // #rrggbb
  rpm: 33 | 45;
  youtubeVideoId: string;         // /^[A-Za-z0-9_-]{11}$/
  startSeconds?: number; endSeconds?: number;
  youtubePlaylistId?: string;     // optional; tracks shown as Side A / Side B
  tracks?: { side: "A" | "B"; title: string; youtubeVideoId: string }[];
  placeholder?: true;             // listed in the README to replace
};
```

`validateRecords(records)` returns a list of problems (unique ids, 11-char ids, hex colours, 33|45, start < end, contrast of `labelColor` against the LCD text ≥ 4.5:1, no YouTube thumbnail URLs, at least 12 records) and `records.test.ts` runs it. `scripts/vinyl-check.ts` (same `node --experimental-strip-types` prelude as `capsule:sheet`) validates, then calls oEmbed per distinct id with a small concurrency and prints a table: id, status, verdict (embeddable / embedding disabled / not found / malformed / network), exit 1 if any record is dead. `npm run vinyl:check`.

Placeholders: ship 12 records whose `youtubeVideoId` cycles the three owner-chosen ids from `content/site.ts` (`IXA6bQsVNjs`, `agneRtEe-t8`, `vR49dHUwMUA`, all oEmbed 200 today) and mark them `placeholder: true`; the README lists them in one table. The validator warns on duplicate ids but does not fail, so placeholders stay green until replaced.

## 5. Proposed shape (draft for the plan; the product owner owns the final version)

```
app/(vinyl)/
  layout.tsx            own <html>/<body>, vinyl.css, build-sha meta, themeColor
  vinyl.css             variables, grid, turntable, monitor frame, crate, LCD, reduced-motion block
  vinyl/page.tsx        server: header, <VinylApp records={RECORDS} />, "Watch on YouTube" list, home link
  _lib/records.json     12 records
  _lib/records.ts       types, RECORDS, validateRecords, genres(), labelArt(record) → SVG params
  _lib/deck.ts          pure reducer: phases, YT events as actions, effects list (load, play, pause, seek, destroy)
  _lib/spin.ts          rotation: advance(spin, dtMs, targetRpm) with exponential inertia; reduced-motion settle
  _lib/youtube.ts       singleton iframe_api loader (strict-mode, HMR and multi-consumer safe), typed Player subset
  _lib/geometry.ts      layout boxes per breakpoint (monitor, platter, tonearm sweep, crate) for the overlap test
  _lib/crackle.ts       flag (default off) and a Web Audio noise generator on its own AudioContext
  _lib/*.test.ts        records, deck, spin, geometry, isolation
  _components/vinyl-app.tsx   client shell: reducer, player ref, rAF loop, visibility, keyboard, drag source/target
  _components/crate.tsx       grid of sleeves, genre filter, search, "Place on turntable" button, draggable
  _components/sleeve.tsx      procedural cover art (SVG, seeded by id and colours)
  _components/turntable.tsx   plinth, platter, grooves, label, spindle, strobe ring, LED, 33/45 switch, tonearm
  _components/monitor.tsx     the retro TV frame around the player host <div> (never over it)
  _components/transport.tsx   play/pause, stop, prev/next, eject, volume, seek bar with time/duration
  _components/lcd.tsx         now-playing readout, aria-live="polite"
scripts/vinyl-check.ts, scripts/walk-vinyl.sh
content/site.ts (Projects row), e2e/rbac.test.ts, lib/build-stamp.test.ts, README.md
```

State diagram (`deck.ts`; `yt` is the raw `YT.PlayerState`):

```
empty ──select──▶ placing ──placed──▶ cued ──play(user)──▶ starting ──yt:3──▶ buffering ──yt:1──▶ playing
  ▲                                      ▲                    │ no yt:1/3 in 1.5 s             ▲      │
  │ eject                                │ stop               ▼                                 │      │ yt:2 / pause / hidden
  └───────────── any ◀───────────────────┴──────────────── tap ──play(user)──▶ starting         │      ▼
                                                                                     yt:3 ◀────┴──  paused
playing ──yt:0──▶ ended ──next/prev──▶ placing            any ──yt:error──▶ error ──skip(auto 4 s)──▶ placing(next)
```

Derived view: tonearm `rest | hovering (starting, buffering, tap) | down (playing, paused-while-spinning-down)`; platter target RPM = record rpm (or the user's 33/45 override) when `playing`, 0 otherwise; `spin.ts` eases the angle toward the target so pause spins down over ~1.8 s and play spins up over ~1.2 s; under `prefers-reduced-motion` the angle is frozen and a "playing" lamp blinks instead.

Effects from the reducer, executed by the shell: `load {videoId, startSeconds, endSeconds}` (via `cueVideoById` on select, `loadVideoById` on play-from-crate), `play`, `pause`, `stop` (`stopVideo` then `cueVideoById`), `seek {seconds}`, `volume {0-100}`, `destroy`. Seek bar and tonearm scrub both dispatch `seek`; the shell polls `getCurrentTime()`/`getDuration()` every 250 ms while not `empty`.

Keyboard, on the deck region only (so it does not fight YouTube's own iframe shortcuts): Space play/pause, ArrowLeft/ArrowRight previous/next record, Escape eject, the 33/45 switch is a radio group, the tonearm is a `role="slider"` with Home/End/arrow keys as the non-drag scrub.

## 6. Tests and proof, given no browser on the pod

- Unit (`npm test`): `deck.test.ts` (every transition in the diagram, each `onError` code, no `play` effect without a user action, `hidden` always yields `pause`, `unmount` yields `destroy`, select yields `load` then nothing plays); `spin.test.ts` (monotone approach, settles within the budget, reduced motion returns the target at once, angle never snaps between frames); `records.test.ts` (schema, 12+, contrast); `geometry.test.ts` (monitor ≥ 200×200 and ≥ 480×270 on desktop at every breakpoint; monitor box disjoint from platter, tonearm sweep and crate boxes); `isolation.test.ts` (copy of Capsule's, both directions); `build-stamp.test.ts` gains Vinyl's layout.
- Walk (`scripts/walk-vinyl.sh`): `/vinyl` 200, title, no sidebar, build-sha, 12 `data-record="`, one `data-monitor`, the strings `Place on turntable`, `Watch on YouTube`, `aria-live="polite"`, exactly one stylesheet with `prefers-reduced-motion` and no Tailwind tokens, no `Referrer-Policy: no-referrer` header, no `iframe_api` script tag in the server HTML (lazy load), plus the site pages.
- QA with headless Chrome (playwright-core from a scratch directory, as pm-189 did) at 1366×768 and 390×844: iframe `getBoundingClientRect()` ≥ 200×200, `elementsFromPoint` at five points returns the iframe, no console errors, select all 12 records then check `performance.memory` and that only one iframe exists, tab-hide pauses, Lighthouse desktop ≥ 90 via `npx lighthouse`. A missing browser is a note, not a fail.

## 7. Risks and notes

- **Error 153** appears the moment anyone adds `Referrer-Policy: no-referrer` (header, meta or iframe attribute). The walk guards it.
- **iOS autoplay refusal** is handled by the `tap` phase; test it in QA on a mobile emulation with autoplay policy "user-gesture-required".
- **Strict mode / HMR**: the loader must short-circuit on an existing `window.YT.Player`; the shell keeps a `live` flag like the television does so a destroyed player's late events are ignored.
- **Keyboard inside the iframe**: once the visitor clicks the YouTube player, focus is in the iframe and our shortcuts stop; the transport buttons remain, which is fine and documented.
- **Playlists** (`youtubePlaylistId`): `cuePlaylist` changes `getPlaylistIndex` semantics and `onStateChange` fires per track; keep it optional and ship single-video records first.
- **No binaries**: no cover images, no crackle `.mp3`; sleeves and labels are procedural SVG, crackle is synthesised.
- **Lighthouse** can only be run where a browser exists; record the score in the QA report.

## 8. Suggested task split (for the product owner)

1. Engine and data, `qa: skip`: `records.json`, `records.ts`, `deck.ts`, `spin.ts`, `geometry.ts`, `youtube.ts`, tests, `scripts/vinyl-check.ts`. Adds files only; the site still builds.
2. The page, QA with a browser: layout, css, crate, turntable, monitor, transport, LCD, lazy player, Projects row, e2e/build-stamp updates, `walk-vinyl.sh`, README (records, validator, compliance checklist, licensing notes).
3. Motion and input polish, QA: rAF inertia, drag-and-drop from crate and tonearm scrub, keyboard map, reduced motion, crackle flag.

## 9. Open questions and assumptions (none blocking)

- Route `/vinyl`, name "Vinyl" in the Projects list; change the slug if you prefer `/records`.
- Records are static data; owner-added records (like `/music` channels) would be a follow-up reusing the `song` table pattern.
- 78 RPM is out (data model says 33|45); adding it is one union member and one switch position.
- Placeholder ids reuse your three `/music` songs; replace them in `records.json` and run `npm run vinyl:check`.
- Crackle ships synthesised and off; if you want a specific recorded texture, CC0 options exist (https://selektaudio.com/sound-lab/textures/vinyl-crackle) but would add a binary to the repo.

## Sources

- Repo at bafc5dd: `components/television.tsx`, `lib/songs.ts`, `app/(capsule)/**`, `app/(sun)/**`, `scripts/walk-sun.sh`, `.github/workflows/ci.yml`, `README.md`.
- YouTube RMF: https://developers.google.com/youtube/terms/required-minimum-functionality
- YouTube Developer Policies: https://developers.google.com/youtube/terms/developer-policies
- IFrame API reference: https://developers.google.com/youtube/iframe_api_reference
- Player parameters: https://developers.google.com/youtube/player_parameters
- Error 153 and referrer policy: https://teamdynamix.umich.edu/TDClient/30/Portal/KB/Article/14491/Fixing-YouTube-Player-Error-153-with-Referrer-Policy-Settings
- oEmbed status codes: https://github.com/lycheeverse/lychee/issues/214 ; https://github.com/extractus/oembed-extractor/issues/168
- shadcn.io blocks and licence: https://www.shadcn.io/blocks/music-vinyl-player ; https://www.shadcn.io/blocks/music-vinyl-collection ; https://www.shadcn.io/license
- Reference repos: https://github.com/Fitbert/the-shelf ; https://github.com/thebuggeddev/vinyl ; https://github.com/bitu467/record-player
