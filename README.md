# Otohime

Personal site for [otohime.dev](https://otohime.dev). One Next.js app serves the pages and the API. Postgres holds accounts and app data.

## Local setup

```bash
bash scripts/dev.sh
```

That creates `.env` if needed (including `BETTER_AUTH_SECRET`), starts Postgres, applies migrations, and runs Next.js. The app listens on port **4000** by default (`http://localhost:4000`) so it stays outside the mini-app range **3000–3098**. Postgres listens on **5433**.

`BOOTSTRAP_ONLY=1 bash scripts/dev.sh` prepares the database and exits without starting the app. `SKIP_BROWSER=1` skips opening a tab.

The script raises Node's HTTP header size so mini-app cookies on `localhost` do not produce a blank 431 page.

## Layout

```
app/                 holds only api/ and icon.svg; every page lives in a route group
app/(site)/          the whole site under one root layout (layout.tsx, globals.css)
app/(site)/(home)/   the front page, an entrance with no sidebar
app/(site)/(app)/    the other pages, with the sidebar
app/(site)/(app)/music/  /music, a television with one song per channel: the starters live in content/site.ts,
                     signed-in owners add channels from the page (at most 12) and remove them; actions.ts holds the writes
app/(shore)/        Shore, a focus timer: its own root layout and CSS (no Tailwind), with the
                     sea-glass renderer vendored in _lib/ under Apache-2.0; `npm test` covers its _lib/*.test.ts
                     _lib/actions.ts holds the ledger changes behind Shore's buttons; actions.test.ts proves
                     Begin -> Finish now -> reload without a browser
app/(capsule)/       Capsule, a coin-and-crank card machine: its own root layout and CSS (no Tailwind),
                     with its pure engine (cards, draws, coins, ledger) in _lib/; `npm test` covers its _lib/*.test.ts
                     layout.tsx and capsule.css are its root layout; capsule/page.tsx is /capsule
                     _components/ holds the machine, the card frame and the app (buttons, coin tray, album)
                     _lib/art/ holds the hand-drawn cards as path data (one file per card, ART in index.ts)
                     and svg.ts, which draws them for the page and for `npm run capsule:sheet`
app/(orrery)/        Orrery, hand-drawn posters of the Sun, the eight planets and five stars: its own root layout
                     and CSS (no Tailwind); layout.tsx (hand fonts via next/font) and orrery.css are its root layout;
                     orrery/page.tsx is the index /orrery and orrery/[body]/page.tsx the 14 static posters
                     (/orrery/saturn), with not-found.tsx for an unknown one; /sun is a 308 to /orrery/sun
                     (next.config.ts). _lib/bodies.ts holds the 14 bodies (sourced, tested by bodies.test.ts)
                     and _lib/cutaway.ts draws any of them (tested by cutaway.test.ts); _components/ holds the
                     Sun's own poster (sun-poster.tsx, its inked stage.tsx), every other body's (body-poster.tsx,
                     cutaway.tsx) and the shared top bar and Previous / Next (chrome.tsx), all server components.
                     The Sun's layers, sources and number words are pure data in _lib/ (sun.ts, format.ts), its
                     words are _lib/poster.ts, the ink is _lib/ink.ts (rough.js, fixed seed) and _lib/words.ts
                     is the shared word counter; `npm test` covers its _lib/*.test.ts
app/(elements)/      Elements, a periodic table with a Bohr atom per element: its own root layout and CSS
                     (no Tailwind, system fonts); layout.tsx and elements.css are its root layout;
                     elements/page.tsx is /elements and elements/[symbol]/page.tsx the 118 static pages
                     (/elements/fe), the no-JS path; _components/ holds the table island (table.tsx: roving
                     tabindex, arrow keys, legend dimming), the cells, the legend, the <dialog> (element-dialog.tsx),
                     the shared detail (element-detail.tsx), the 2D Bohr diagram (bohr-svg.tsx) and the
                     lazily loaded 3D atom (atom-3d.tsx);
                     its data and pure maths are in _lib/ (elements.ts vendored under CC BY-SA 3.0 with
                     its LICENSE.md, funFacts.json, categories, grid, atom, view, format, webgl); `npm test` covers its
                     _lib/*.test.ts; only _components/atom-3d.tsx may import three, fiber or drei
app/(vinyl)/         Vinyl, a crate of records, a turntable and a visible YouTube player: its own root layout
                     and CSS (no Tailwind, system fonts); layout.tsx and vinyl.css are its root layout;
                     vinyl/page.tsx is /vinyl (the client island plus a no-JS list with a Watch on YouTube
                     link per record); _components/ holds the shell (vinyl-app.tsx: the one player, timers,
                     the 250 ms clock, the rAF platter, visibility, keys, the flight, the crackle), the crate,
                     sleeves and their drag (sleeve-drag.ts), turntable with its draggable tonearm, monitor,
                     LCD and transport; its pure engine is in _lib/ (records, deck, spin, geometry, oembed,
                     player, youtube, tonearm, flight, crackle); `npm test` covers its _lib/*.test.ts
content/site.ts      the words on the public pages
lib/pages.ts         the public pages (sidebar and console menu); add a project as an entry in `site.projectList` in content/site.ts
lib/auth.ts          Better Auth, plus the role-hierarchy guard
lib/permissions.ts   roles and what each may do
lib/songs.ts         the rules for songs owners add (video links, field limits); pure
lib/songs-store.ts   reads, adds and removes the songs owners add (the only code that touches the `song` table)
lib/machines.ts      state for the figures you can play with
db/                  Drizzle schema, client, and migrations
```

A page with its own design gets its own route group with a `layout.tsx` (its own `<html>` and stylesheet), so it does not inherit the site's CSS. Moving between root layouts is a full page load.

Every project's top bar links home and to `/projects`, both plain `<a>` because they cross root layouts.

The site follows the OS's light or dark setting until someone presses the theme toggle. Their choice is kept in `localStorage.theme`.

The browser talks only to this Next.js server. `lib/` and `db/` are the only code that opens Postgres.

## Roles

There are three site-wide roles: `owner` > `admin` > `user`. New accounts are `user`. The full permission matrix is at `/admin/roles`. An admin can only manage people ranked below them, and can only hand out roles below their own. So owners can't be created from the app at all.

`song: create, delete` (the songs owners add to `/music`) is owner-only: admins and users have no grant.

To make the first owner, sign up, then run:

```bash
# local
docker compose exec postgres psql -U otohime -d otohime -c "UPDATE \"user\" SET role='owner' WHERE email='you@example.com';"
# Neon (production or a branch)
psql "$DATABASE_URL" -c "UPDATE \"user\" SET role='owner' WHERE email='you@example.com';"
```

The change takes effect on the next request.

## Tests

- `npm test` runs the unit tests (roles and the rank rule, Shore's timer, ledger and pebbles under `app/(shore)/_lib/`, and Capsule's cards, draws, coins, ledger, machine and art under `app/(capsule)/_lib/*.test.ts`, and Orrery's bodies, cutaways, the Sun's layers and sources, number words, poster words, ink, motion, word counter and import isolation under `app/(orrery)/_lib/*.test.ts`, and Elements' dataset, facts, categories, grid, atom maths, labels and number formats, dialog reducer and import isolation under `app/(elements)/_lib/*.test.ts`, and Vinyl's records, deck state machine, platter inertia, layout geometry, oEmbed verdicts, player effects, iframe_api loader, tonearm drag and keys, crate-to-platter drag and flight, crackle and import isolation under `app/(vinyl)/_lib/*.test.ts`, and Rotor's wiring, Enigma engine (BDZGO, the double step, an independent vector with rings and plugs, self-inverse, query round-trip), tape, page machine, ink, word counter and import isolation under `app/(rotor)/_lib/*.test.ts`, and Planisphere's sidereal time (GMST at J2000 and Meeus 12.a), alt-az, wheel geometry and horizon containment, Sun, Moon phase, vendored stars and lines, cities, query reducer, ink, word counter and import isolation under `app/(planisphere)/_lib/*.test.ts`, and Barometer's cities, the 29 WMO codes, dial geometry (1011.2 hPa is 30.24 degrees), `parseReading` on four captured fixtures, the set-hand reducer, `station.ts`'s fetch rules (read as text, so no network), ink, word counter and import isolation under `app/(barometer)/_lib/*.test.ts`). It needs no database.
- `npm run test:e2e` runs HTTP tests for RBAC and session revocation against a running production build. They sign up throwaway `@e2e.test` users and delete them afterwards:

  ```bash
  npm run build
  PORT=4010 BETTER_AUTH_URL=http://localhost:4010 npm start
  # in another terminal
  BASE_URL=http://localhost:4010 DATABASE_URL=postgresql://otohime:otohime@localhost:5433/otohime npm run test:e2e
  ```

- `bash scripts/e2e-local.sh` is the one-command e2e. It needs docker: it starts a throwaway Postgres on a free port, applies the migrations, builds (skip with `SKIP_BUILD=1`), serves on `APP_PORT` (default 4027), runs `npm run test:e2e`, then removes the container and the server.

CI runs the unit and e2e tests on every PR.

Walk Shore and the site with `bash scripts/walk-shore.sh` (builds, serves on :4019, one `ok`/`not ok` line per check), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-shore.sh`.

Walk Capsule and the site the same way with `bash scripts/walk-capsule.sh` (builds, serves on :4021), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-capsule.sh`.

Walk Orrery and the site the same way with `bash scripts/walk-orrery.sh` (builds, serves on :4027; every poster, the index, the `/sun` redirect and the 404s), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-orrery.sh`.

Walk Elements and the site the same way with `bash scripts/walk-elements.sh` (builds, serves on :4029: 118 cells, 10 legend items, both series markers, the attribution links, no 3D code on the table page and no reference to the built 3D chunk, iron's fact on `/elements/fe` and a 404 for `/elements/xx`), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-elements.sh`.

Probe the Elements dialog in headless Chromium with classic scrollbars shown with `bash scripts/probe-elements-dialog.sh` (builds, serves on :4031; the table must not move or lift a cell when the dialog closes by backdrop, Esc or the Close button), or against a deployed site with `BASE_URL=https://otohime.dev bash scripts/probe-elements-dialog.sh`; it installs Playwright into a temp dir, so `package.json` stays unchanged.

Walk Vinyl and the site the same way with `bash scripts/walk-vinyl.sh` (builds, serves on :4031: 12 sleeves, one monitor and one player host, no `iframe_api` or `<iframe>` in the server HTML, no `no-referrer` policy, Vinyl's one stylesheet with the player's `aspect-ratio: 16 / 9`, `min-width: 480px` and `max(200px, …)` and nothing hiding it, a `role="slider"` tonearm, one `data-drop-target` platter, `touch-action: none` on the tonearm alone and its non-passive `touchstart` listener in `turntable.tsx`, no flight under reduced motion, no crackle toggle unless `NEXT_PUBLIC_VINYL_CRACKLE=1`, no `.mp3`/`.wav`/`.ogg` under `app/(vinyl)` or `public/`, and `/projects` linking `/vinyl` once), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-vinyl.sh`.

Probe the dropdown pickers in headless Chromium with `bash scripts/probe-selects.sh` (builds, serves on :4033, installs Playwright into a temp prefix and opens Vinyl's genre select and a site `select.field` in light and dark, and presses Escape, Space and the arrows inside the open Vinyl picker with a record on the platter), or against production with `BASE_URL=https://otohime.dev bash scripts/probe-selects.sh`. The pickers are customizable selects (`appearance: base-select`) behind `@supports`, so Firefox keeps the native popup.

The Sun's parts and callouts live in `app/(orrery)/_lib/poster.ts` and every other body's in `app/(orrery)/_lib/bodies.ts`; the ink is rough.js with a fixed seed in `app/(orrery)/_lib/ink.ts`; `bash scripts/walk-orrery.sh` counts the words on every served page (cap 220, `WORD_CAP` in `app/(orrery)/_lib/words.ts`).

Orrery's motion is CSS only in `app/(orrery)/orrery.css`: the ink draws itself on, layer by layer; on the Sun's poster three loops then run (convection, photon, wind); all of it is off under reduced motion, and `app/(orrery)/_lib/motion.test.ts` tests it.

Walk `/music` with `bash scripts/walk-music.sh` (builds with no database and serves on :4025: the three starters from `content/site.ts` must still show, with status 200), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-music.sh`.

A Capsule round is staged so the tier comes last. Turn commits the draw and also deals the round's look from the same seed and draw index on streams of their own (`turnFrames` and `dropIndex` in `app/(capsule)/_lib/gacha.ts`): the crank turns for 16 to 28 frames (1.3 to 2.3 s at 12 fps), and in the last 6 one identical capsule falls out of the dome, through the collar, into the chute. Open then runs shake, part, rise (a plain, numberless card back comes up out of the capsule), edge (the tier rule draws on: ink, slate, or gold), hold (a legend's glow and sparks, legend only) and flip, 6 frames each (part 4). Components read the round only through `revealView` in `app/(capsule)/_lib/reveal.ts`, and `reveal.test.ts` plays every frame of every tier to prove that nothing before the edge stage has an edge or a face. Turn still saves the card at once, so a reload mid-round keeps it, but `albumView` holds that copy and draw back from the album and the tally until the card is revealed. Under reduced motion each press lands on its last pose at once.

See every drawn Capsule card on one sheet with `npm run --silent capsule:sheet > /tmp/capsule.svg`, then open the file in a browser or any SVG viewer.

To add or swap a Capsule card, edit its entry in `app/(capsule)/_lib/cards.ts` (id, name, film, year, tier, colours, note) and draw it as `app/(capsule)/_lib/art/<id>.ts`, registered in `art/index.ts`. Follow the printed-ink brief in the pm-196 plan: absolute path commands only, palette-role fills (the card colour is mixed 12 % toward paper), one thin rough ink outline per stroked shape, the `hatch` role for shade (rough hachure, never outlined), `weight: "fine"` for whiskers, fur and hair lines, no gradients and no raster. The ink comes from `app/(capsule)/_lib/art/ink.ts` (Capsule's own copy of Sun's rough.js wrapper, seeded per shape so the server and the browser draw the same bytes), and the pinned Totoro hash in `art.test.ts` pins the look: change it only after looking at the sheet. `app/(capsule)/_lib/art.test.ts` checks that every card is drawn and every path stays inside the card face, and `npm run capsule:sheet` previews the set. This is also the takedown rollback: replace the set with original characters this way, and leave the machine, the economy and the page untouched.

## Elements

Elements (`app/(elements)/`) draws the periodic table from data vendored into the repo; nothing is fetched at runtime.

The table is server-rendered: 118 links to `/elements/<symbol>`, so it works before and without JavaScript. Once hydrated, the cells share one tab stop and the arrow keys, Home and End move between them; a plain click, Enter or Space opens the detail in a native `<dialog>` (a bottom sheet under 768 px) with Prev/Next, Close, Esc and a backdrop click, and focus returns to the cell. A click with a modifier key follows the link. Light and dark follow the OS unless the site's theme toggle pinned one (`localStorage.theme`).

**Data sources and licences.**

- `app/(elements)/_lib/elements.ts` is generated from [Bowserinator/Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON) (elements 1 to 118 only; the upstream file also has 119). Its summaries are Wikipedia text, so the dataset is under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); the licence text is kept beside it in `app/(elements)/_lib/LICENSE.md`, and wherever a summary is shown the page must link the element's `source` article and the licence. The npm repackaging `periodic-table-data-complete` says MIT, which cannot override the Wikipedia text, so it is not used.
- `app/(elements)/_lib/funFacts.json` holds one fun fact per element, written in our own words, each with the page it can be checked on (`sourceUrl`). The RSC and Los Alamos periodic tables may be cited but never copied: their terms forbid reuse.
- The 3D atom uses `three`, `@react-three/fiber` and `@react-three/drei`, all MIT, pinned to exact versions in `package.json`.

**Adding or editing a fun fact.** Each entry is `"<atomic number>": { "fact": "...", "sourceUrl": "https://..." }`. A fact is one sentence of at most 200 characters, ends with a full stop, contains no URL, is suitable for all ages and is not a copy of the source's wording. `sourceUrl` must be `https://` on one of `en.wikipedia.org`, `periodic-table.rsc.org`, `www.rsc.org`, `www.nist.gov`, `physics.nist.gov`, `pubchem.ncbi.nlm.nih.gov`, `iupac.org`, `www.lanl.gov` or `science.nasa.gov`, and the page must actually state the fact. Never invent a fact: if you are unsure, write a conservative, well-documented one and add its atomic number to the top-level `needsReview` list, which marks facts still waiting for a person to check them against their source. Remove the number once it is checked. The list is empty at the moment: every fact was checked against its cited article.

**Validation.** `npm run elements:validate` checks the facts (all 118 keys plus `needsReview`, the schema, the length and full-stop rules, the host allowlist, no duplicates) and the dataset (118 elements in order, unique symbols, shells summing to the atomic number, categories, grid rows, the licence file). A failure names the first offending atomic number. Both files also run in `npm test`.

**The 3D atom.** `app/(elements)/_components/atom-3d.tsx` is the only file that imports `three`, `@react-three/fiber` or `@react-three/drei` (`isolation.test.ts` enforces it), and the dialog loads it with `next/dynamic` (`ssr: false`) only after the first open, so the table page ships none of it; the walk checks that the built 3D chunk exists and that `/elements` does not name it. While the chunk loads, the dialog shows the Bohr SVG.

- Fixed allocations: one Canvas stays mounted across Prev/Next and close/reopen, with one nucleus `InstancedMesh` (64 nucleons at most, a representative cluster for larger nuclei, and the caption then says "showing 64 of N nucleons"), one electron `InstancedMesh` (118) and seven tori shown or hidden by shell count. Changing element rewrites matrices, colours and visibility only, so there is nothing to dispose and nothing grows over 118 clicks. Rendering stops while the dialog is closed.
- Lighting is a hemisphere light, one key light and an environment drawn from two `Lightformer`s: no HDR or texture is fetched. The tint is the category colour the page's theme resolved (`--cat`).
- Drag rotates and wheel or pinch zooms within limits; panning is off. A slow auto-rotate pauses while you interact and resumes four seconds after.
- `prefers-reduced-motion: reduce` turns off auto-rotate and holds the electrons still (`frameloop="demand"`); it is re-read when the setting changes.
- Fallback: without WebGL (probed once in `_lib/webgl.ts`), if the renderer fails or the WebGL context is lost, the dialog keeps the Bohr SVG.
- GLB models: `NEXT_PUBLIC_ELEMENTS_GLB=1` at build time makes the atom try the dataset's `bohr_model_3d` GLB, with the procedural atom shown while it loads and if it fails. It is off by default because the files sit in a third-party bucket with no stated licence; they are never vendored here.

**Refreshing the dataset.** `npm run elements:vendor` downloads the upstream JSON and `LICENSE.md` at the current upstream commit and rewrites `elements.ts` (the commit is recorded in its header) and `LICENSE.md`; `npm run elements:vendor -- <commit>` pins a specific commit. Review the diff, run `npm run elements:validate`, and commit the output. Never edit `elements.ts` by hand.

**Refreshing Planisphere's stars.** `npm run planisphere:vendor` fetches d3-celestial's `stars.6.json`, `starnames.json`, `constellations.lines.json` and `LICENSE` at the current master commit and rewrites `app/(planisphere)/_lib/stars.ts` (the 921 XHIP stars of magnitude 4.5 or brighter), `lines.ts` and `LICENSE.md`, with the commit in each header; `npm run planisphere:vendor -- <commit>` pins one. The committed files are at `7e720a3de062059d4c5400a379146a601d9010e0`. The script refuses a count outside 900-1,000 or a missing Sirius, Vega, Polaris, Betelgeuse, Canopus, Arcturus or Rigel; a newer ref that moves the count fails `stars.test.ts` on purpose. Nothing is fetched at runtime.

## Vinyl records

Vinyl (`/vinyl`, `app/(vinyl)/`) plays a crate of records on a turntable, with the music in a visible YouTube player. Its records live in `app/(vinyl)/_lib/records.json`; the rules they must keep are in `validateRecords` in `app/(vinyl)/_lib/records.ts`.

**Adding a record.** Append an object to `records.json`:

- `id`: lower-case words joined by hyphens, unique. `title`, `artist`, `genre`: non-empty text. `year`: a whole year from 1900 to this year. `rpm`: `33` or `45`.
- `youtubeVideoId`: the 11-character id from `youtube.com/watch?v=<id>`. Optional `startSeconds` and `endSeconds` (numbers, start before end) trim it. Optional `youtubePlaylistId`, and optional `tracks: [{ "side": "A" | "B", "title", "youtubeVideoId" }]` for a Side A / Side B track list.
- `coverArtUrl`: `"procedural:<id>"` (the sleeve is drawn from the record's colours) or a path on this site starting with `/`. Never a YouTube thumbnail: `ytimg.com` and `youtube.com` URLs are rejected, because YouTube's terms forbid altering or reusing its thumbnails as our art.
- `labelColor` and `accentColor`: `#rrggbb`. The label text is black or white, whichever contrasts more with `labelColor`, and must reach 4.5:1 (WCAG AA); the validator checks it.
- Drop `placeholder: true` once the id is a real choice.

**Checking video ids.** `npm run vinyl:check` validates `records.json`, then asks YouTube's oEmbed endpoint about every distinct video id (four at a time, 8 s timeout) and prints a table `record · videoId · status · verdict`: `embeddable` (200), `malformed` (400; YouTube also answers 400 for a well-formed id that no video has), `embedding-disabled` (401 or 403), `not-found` (404) or `network`. It exits 1 on any invalid record or dead video, 2 when the only failures are network ones, else 0. `npm run vinyl:check -- --offline` validates without the network. Repeated video ids are warnings, not errors.

**Placeholders to replace.** All twelve records are placeholders that cycle the three `/music` starter videos (all embeddable on 2026-10-19). Replace each `youtubeVideoId` with your record's video and run `npm run vinyl:check`:

| Record id | Title | Video id |
| --- | --- | --- |
| `harbour-lights` | Harbour Lights | `IXA6bQsVNjs` |
| `velvet-morning` | Velvet Morning | `agneRtEe-t8` |
| `paper-satellites` | Paper Satellites | `vR49dHUwMUA` (tracks: A `vR49dHUwMUA`, A `IXA6bQsVNjs`, B `agneRtEe-t8`) |
| `neon-tide` | Neon Tide | `IXA6bQsVNjs` |
| `willow-road` | Willow Road | `agneRtEe-t8` |
| `blue-hour-sessions` | Blue Hour Sessions | `vR49dHUwMUA` |
| `golden-thread` | Golden Thread | `IXA6bQsVNjs` |
| `concrete-garden` | Concrete Garden | `agneRtEe-t8` |
| `glass-meridian` | Glass Meridian | `vR49dHUwMUA` |
| `four-winds` | Four Winds | `IXA6bQsVNjs` |
| `chalk-and-cedar` | Chalk and Cedar | `agneRtEe-t8` |
| `nocturne-for-trains` | Nocturne for Trains | `vR49dHUwMUA` |

**Playing.** "Place on turntable" puts a record on the platter and, the first time, loads YouTube's player script and creates the page's one player; every later record is cued into that same player. Play swings the arm in; it hovers while YouTube buffers, lowers when YouTube reports playing, and the platter spins up and down with inertia (`_lib/spin.ts`, one `requestAnimationFrame` loop) following YouTube's reported state, not the buttons. Keys in the deck: Space plays or pauses, ← and → change record, Escape ejects. Under reduced motion the platter stays still and the PLAYING lamp shows it plays.

**Dragging and scrubbing.** A record can also be dragged from its sleeve art onto the platter, whose rim lights up when a drop will land. This uses pointer events, not the HTML drag-and-drop API (which does not work on touch). A mouse or pen drag starts once the pointer moves 6 px. A touch drag starts after a 350 ms long press, so a swipe still scrolls the crate. A finger on the tonearm drags it (a non-passive touchstart listener stops the page panning; `touch-action` does not apply inside an SVG). Escape or letting go anywhere else drops nothing. Placing a record by drag or by "Place on turntable" flies a disc from the sleeve to the platter (a 450 ms FLIP animation of transform and opacity, `_lib/flight.ts`). There is no flight under reduced motion, or when its path would cross the monitor. The dragged disc is never drawn over the player. The tonearm is also the seek bar: between the first and last grooves its angle is the playback position (`_lib/tonearm.ts`). Drag it onto the record to play (from the spot it lands on, if the record was paused). Move it while playing to scrub, and lift it back to its rest to pause. It is a keyboard slider (`role="slider"`): ← and → move it 5 s, PageUp and PageDown 30 s, Home and End go to the ends, and Enter drops or lifts the needle. The transport's seek bar stays as the plain fallback.

**Crackle (off by default).** Build with `NEXT_PUBLIC_VINYL_CRACKLE=1` to add a faint vinyl crackle and a "Crackle" toggle beside the turntable. The crackle is synthesised in `_lib/crackle.ts`: four seconds of soft hiss and random pops, computed in the browser and looped. That means no audio file is shipped and there is no recording to license. It plays on its own Web Audio context and gain node, at -36 dB and never louder than -30 dB. It starts only after a Play gesture and only while the record plays in a visible tab. It stops on pause, on a hidden tab and on unmount. It never reads from or routes the YouTube player's sound, which stays the music. Without the flag, none of this code runs.

**YouTube compliance checklist.** These rules come from YouTube's API Services policies and win over every other requirement:

| # | Rule | Where it is enforced |
| --- | --- | --- |
| 1 | The player is visible, at least 200×200 (480×270 or more on a desktop, 16:9) | `vinyl.css`: `[data-player-host]` is `width: 100%; height: max(200px, 56.25vw)`, and from 1024 px `min-width: 480px; aspect-ratio: 16 / 9`; its box is reserved before the player loads; no rule hides it (`_lib/geometry.test.ts`, `scripts/walk-vinyl.sh`) |
| 2 | Nothing in front of any part of the player | The monitor's bezel and chin are padding around the host and a row below it; the host is `position: relative; z-index: 1; isolation: isolate`; the placeholder sits behind it and goes once the iframe exists; error and tap notes sit in the chin; the turntable cell clips the tonearm (`overflow: hidden`) at every angle it can be dragged to; the dragged disc is not drawn while it meets the monitor and a flight that would cross it is not flown; `_lib/geometry.test.ts`, `_lib/tonearm.test.ts`, `_lib/flight.test.ts` |
| 3 | No audio isolation, no downloads | The video is always shown; nothing offers a download; only `crackle.ts` opens an `AudioContext`, for its own synthesised crackle, and it never touches the player (`_lib/isolation.test.ts`, `_lib/crackle.test.ts`) |
| 4 | Documented player parameters only; YouTube thumbnails untouched | `PLAYER_VARS` is exactly `playsinline`, `rel`, `origin` (`_lib/player.test.ts`); sleeves and labels are drawn by code and `validateRecords` rejects YouTube art URLs |
| 5 | Playback starts only from a user action; one player per page | Only actions carrying `user: true` can produce a play (`_lib/deck.test.ts`); a tonearm drop or Enter on it is such a gesture (`_lib/tonearm.test.ts`); auto-advance and auto-skip cue the next record and wait for Play; the player script loads on the first placement and one `YT.Player` is reused |
| 6 | No background play | A hidden tab pauses (`visibilitychange`); `pagehide` and unmount destroy the player (`vinyl-app.tsx`, `_lib/deck.test.ts`) |
| 7 | Referer sent; `origin` passed | No `Referrer-Policy` and no `referrerpolicy` anywhere, so the browser default `strict-origin-when-cross-origin` applies; `origin: location.origin` (`scripts/walk-vinyl.sh`, `_lib/player.test.ts`) |
| 8 | Watch on YouTube per record; graceful errors | Every sleeve, the monitor and the no-JS list link `youtube.com/watch?v=`; `onError` shows a friendly message with Skip and Watch on YouTube and cues the next record after 4 s; a play the browser refuses shows "Tap the video to play" |

**Licensing notes.** All sleeves and labels are drawn by code from each record's colours; no image, font or audio file is shipped or fetched. These projects were studied for ideas only, and nothing was copied from any of them: shadcn.io's Vinyl Player and Vinyl Collection blocks (shadcn.io's licence forbids redistribution), Fitbert/the-shelf (no licence file, so all rights reserved), thebuggeddev/vinyl (no licence visible; a three.js player, not used) and bitu467/record-player (no licence).

## Deploying

GitHub Actions (`.github/workflows/ci.yml`) does it all:

- **Every PR** runs lint, typecheck, a migration drift check and a build. It also gets a preview on Vercel backed by its own Neon branch (`preview/pr-<n>`, a copy of production that is migrated first). The branch is deleted when the PR closes.
- **Every push to `main`** runs the same checks, then builds, migrates production, deploys to Vercel and smoke-tests `https://otohime.dev/api/health`.

The jobs need these repo settings:

- **Variables:** `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEON_PROJECT_ID`.
- **Secrets:** `VERCEL_TOKEN`, `NEON_API_KEY`, and `DATABASE_URL_UNPOOLED` (production's direct, unpooled URL, used for migrations).
- **Vercel Production env:** `DATABASE_URL` (pooled), `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.
- **Vercel Preview env:** only `BETTER_AUTH_SECRET`. CI passes each preview its own Neon branch URL.

Rules that keep this safe:

- Production migrates before the new code goes live, and the old code keeps serving if the deploy fails. So migrations must be expand-only: add first, drop in a later PR.
- `drizzle-kit migrate` runs every pending migration in one transaction, so `CREATE INDEX CONCURRENTLY` won't work.
- `<meta name="build-sha">` on any page names the commit the live site was built from.
- Commits to `main` must be authored by the site owner's GitHub email, or Vercel Hobby will not deploy them.
- Don't run `vercel --prod` from a laptop; it skips the migration.
- Keep the Vercel Git integration disconnected, or Vercel deploys before CI migrates.
