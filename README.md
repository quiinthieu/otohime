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
app/                 holds only api/, icon.svg and global-not-found.tsx (the 404 for an unknown address, drawn
                     with the site's parcel page); every page lives in a route group
app/(site)/          the whole site under one root layout (layout.tsx, globals.css)
app/(site)/(home)/   the front page, an entrance with no sidebar
app/(site)/(app)/    the other pages, with the sidebar
app/(site)/(app)/music/  /music, a television with one song per channel: the starters live in content/site.ts,
                     signed-in owners add channels from the page (at most 12) and remove them; actions.ts holds the writes
app/(site)/(app)/sketches/  /sketches, one sketchbook of Places, Small things and (once activated in content/portraits.json)
                     People, with a manifest-only named PNG download route at download/[filename]/route.ts
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
app/(rotor)/         Rotor, a hand-drawn Enigma I: its own root layout and CSS (no Tailwind); layout.tsx
                     (Orrery's hand fonts via next/font) and rotor.css are its root layout; rotor/page.tsx is
                     /rotor, rendered per request from the query (?r=I-II-III&ring=AAA&pos=AAA&ref=B&plug=AB-CD&m=…)
                     so its GET form encodes with JavaScript off; _components/box.tsx inks the box on the server
                     and rotor-app.tsx, the one client island, types on it (keys, lamps, tape, lid form, share URL);
                     its engine is in _lib/ (wiring, enigma, tape, machine, board, form, copy, ink, words);
                     `npm test` covers its _lib/*.test.ts
app/(planisphere)/   Planisphere, tonight's sky on an inked star wheel: its own root layout and CSS (no Tailwind);
                     layout.tsx (Orrery's hand fonts via next/font) and planisphere.css are its root layout;
                     planisphere/page.tsx is /planisphere, rendered per request from the query
                     (?city=hcmc&date=2026-10-20&hour=21) so its GET form draws the sky with JavaScript off;
                     _components/wheel.tsx draws the frame, hour ring, window and star disc on the server and
                     moon-corner.tsx the Moon; its engine is in _lib/ (stars, lines, cities, time, sky, sun, moon,
                     wheel, ink, words); `npm test` covers its _lib/*.test.ts
app/(barometer)/     Barometer, a brass weather station for a chosen city: its own root layout and CSS (no Tailwind);
                     layout.tsx (Orrery's hand fonts via next/font) and barometer.css are its root layout;
                     barometer/page.tsx is /barometer, rendered per request from ?city=hcmc (an unknown city draws
                     Ho Chi Minh City) so its GET form works with JavaScript off; _components/station.tsx inks the
                     dial, thermometer, vane and cup on the server and hand-app.tsx, the one client island, submits
                     the city on change and keeps the set hand in localStorage; its engine is in _lib/ (cities,
                     codes, dial, reading, hand, station, ink, words); station.ts holds the only fetch;
                     `npm test` covers its _lib/*.test.ts
app/(articles)/      The Otohime Gazette, a small newspaper of six short illustrated explainers: its own root layout
                     and CSS (no Tailwind, no client island); layout.tsx (three newspaper faces via next/font) and
                     articles.css are its root layout; articles/page.tsx is the front page /articles and
                     articles/[slug]/page.tsx the six static stories (/articles/why-ice-floats), with not-found.tsx
                     for an unknown one; _components/ holds the masthead, the story card and the figure, all server
                     components; its engine is in _lib/ (articles, readability, edition, figures/, ink, words);
                     `npm test` covers its _lib/*.test.ts
app/(structures)/    Structures, eight drawn pages on data structures you can poke: its own root layout and CSS (no
                     Tailwind); layout.tsx (Caveat and Patrick Hand via next/font) and structures.css are its root
                     layout; structures/page.tsx is the index /structures and structures/[slug]/page.tsx the eight
                     static pages (/structures/stack), with not-found.tsx for an unknown one; _components/ holds the
                     chrome, the figure and the server machine.tsx, which inks the stamps and renders the one client
                     island, machine-app.tsx; its engine is in _lib/ (machine, play, structures/, copy, scenes,
                     stamps, ink, life/, costs, words); `npm test` covers its _lib/*.test.ts
app/(design-system)/ Design system, one drawn page at /design-system: a box of decisions made once and a board of nine
                     parts you can turn knobs on. Its own root layout and CSS (no Tailwind); layout.tsx and
                     design-system.css are its root layout; design-system/page.tsx is the static page;
                     _components/ holds board.tsx (server: inks the 27 stamps) and board-app.tsx (the one client
                     island); its engine and ink are in _lib/; `npm test` covers its _lib/*.test.ts
content/site.ts      the words on the public pages
lib/pages.ts         the public pages (sidebar and console menu); add a project as an entry in `site.projectList` in content/site.ts
lib/auth.ts          Better Auth, plus the role-hierarchy guard
lib/permissions.ts   roles and what each may do
lib/songs.ts         the rules for songs owners add (video links, field limits); pure
lib/songs-store.ts   reads, adds and removes the songs owners add (the only code that touches the `song` table)
lib/machines.ts      state for the figures you can play with
lib/end.ts           pure reducer for the Internet Save Point footer (poke cycle, 10th-poke breather, Konami sequence)
components/end-footer.tsx  server semantic footer for (home) and (app), with CONSOLE_MENU, site.lines and cached UTC year
components/end-stage.tsx   client stage for the save-point console, LCD eyes, wobble/swatch knobs and Back to top
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

- `npm test` runs the unit tests (roles and the rank rule, Shore's timer, ledger and pebbles under `app/(shore)/_lib/`, and Capsule's cards, draws, coins, ledger, machine and art under `app/(capsule)/_lib/*.test.ts`, and Orrery's bodies, cutaways, the Sun's layers and sources, number words, poster words, ink, motion, word counter and import isolation under `app/(orrery)/_lib/*.test.ts`, and Elements' dataset, facts, categories, grid, atom maths, labels and number formats, dialog reducer and import isolation under `app/(elements)/_lib/*.test.ts`, and Vinyl's records, deck state machine, platter inertia, layout geometry, oEmbed verdicts, player effects, iframe_api loader, tonearm drag and keys, crate-to-platter drag and flight, crackle and import isolation under `app/(vinyl)/_lib/*.test.ts`, and Rotor's wiring, Enigma engine (BDZGO, the double step, an independent vector with rings and plugs, self-inverse, query round-trip), tape, page machine, box geometry, the no-JS form's query, the explainer's words and tone, ink, word counter and import isolation (one client island) under `app/(rotor)/_lib/*.test.ts`, and Planisphere's sidereal time (GMST at J2000 and Meeus 12.a), alt-az, wheel geometry and horizon containment, Sun, Moon phase, vendored stars and lines, cities, query reducer, ink, word counter and import isolation under `app/(planisphere)/_lib/*.test.ts`, and Barometer's cities, the 29 WMO codes, dial geometry (1011.2 hPa is 30.24 degrees), `parseReading` on four captured fixtures, the set-hand reducer, `station.ts`'s fetch rules (read as text, so no network), ink, word counter and import isolation under `app/(barometer)/_lib/*.test.ts`, and the Gazette's six articles (in order, 180 to 350 words at Flesch-Kincaid grade 8 or under with short sentences, every number one of its facts and every source `https` on the allowlist), readability (syllable vectors, sentences that keep 0.917 whole, `fkGrade` pinned at −1.45 for "The cat sat on the mat.", reading time), edition dates and the dateline, figures (inside the frame, labels 12 px or more at 390 px, every fact drawn), ink, word counter and import isolation (no client file) under `app/(articles)/_lib/*.test.ts`, and Structures' eight machines (the worked examples end where the plan's table says, with their last moves' sentences pinned; every step count is its trace's step beats; a full or empty machine refuses with one beat and the same state; find, add and remove for 8 things fall in their one, few or all bands; the array's find 16 is 5 steps, the heap's row is 1 3 8 5 4 and keeps its order through a 200-move seeded run, the graph's ripple from A is B C D, E F G, H; every reducer pure), the eight pages' words (180 to 350 words at Flesch-Kincaid grade 8 or under, every quoted step count one the machine takes, sources `https` on the allowlist), the ink (seed 214), the stamp kit (24 hand-inked stamps, eight kinds by three seeds, each inside its size), the scenes (every state of every worked example, every full machine and a seeded 200-move run of each laid out 480 wide, in frame, no two stamps overlapping, every arrow joining placed stamps, letters 17 or more so 12 px at 390 px; the search tree's 1..5 line strictly deeper node by node), the eight In life drawings (in frame, at most 10 labels of 17 or more, one spot), the costs cards (every number and box is the machine's `costs()`), the play clock (12 fps on twos: a 4-beat move is done after 24 ticks and not 23, `settle` lands on the last beat, step mode ignores ticks), motion (stamps glide with a 150 ms transform, the In life ink draws on over 600 ms, the reduced-motion block is last and zeroes both and the hop), readability, word counter and import isolation (no React, Next, clock or dice in `_lib/`, only `ink.ts` and `stamps.ts` touch rough.js and `scenes.ts` reaches neither, exactly one client file, `_components/machine-app.tsx`, which reaches no ink, stamps, kit, life, costs or rough.js, and only `layout.tsx` reads `process.env`) under `app/(structures)/_lib/*.test.ts`, and Design system's engine (8 pots, 9 parts, 3 patterns; every knob and preset moves all nine parts with the system on and none with it off, "9 to fix by hand", leaving `DRIFT`; Paper night sets its ink; each of the six dresses sets exactly paper, ink, spot, corner and face; reset; `describe`; `turn` is pure), the contrast rule (WCAG 2: 21 for black on white, `#2456b3` on cream 6.2, coral 2.8, "Ink on paper 15.5 to 1, passes. Spot on paper 6.2 to 1, passes." and the system-off sentence), the Right here pins (the eleven other top-level stylesheets read as text: light paper, ink, distinct custom properties, `--paper`/`--ink`, 10 papers, 11 inks, 8 creams, and the dresses' spot, corner and face; a new group stylesheet fails until pinned), the words (180 to 350 words at Flesch-Kincaid grade 8 or under, every digit one of the engine's numbers, no "component", "token" or "typography", at least three sources `https` on the allowlist), the ink (seed 216), the stamp kit (27 hand-inked stamps, nine parts by three corners, `part-<part>-<corner>`, each an outline and a spot accent inside its size, a part's three differing only in the corner radius), the board's scenes (the start board, every board one turn from it, every dress and the system-off board laid out 480 wide, in frame, no two parts overlapping, every word inside its part, letters 17 or more; the corners swap only the stamp, the gaps alone move the parts, no system places from `DRIFT`), the three figures (the box names 8 pots, 9 parts and 3 patterns from `POTS`, `PARTS` and `PATTERNS`; the follow card's 9 and 0 are `turn()`'s for Spot coral with the system on and off; the here card has one scrap a `SIBLINGS` row with its hex and decision boxes, and the `--paper`/`--ink` counts in spot; each in frame with labels 17 or more), readability, word counter and import isolation (no React, Next, file reads, clock or dice in `_lib/`, only `ink.ts` and `stamps.ts` touch rough.js and `scenes.ts` reaches neither, at most one client file) under `app/(design-system)/_lib/*.test.ts`). It needs no database.
- `npm run test:e2e` runs HTTP tests for RBAC and session revocation against a production build. They sign up throwaway `@e2e.test` users and delete them afterwards. Without `BASE_URL` it needs nothing running: `scripts/e2e.mjs` starts a throwaway embedded Postgres 17 (the `embedded-postgres` dev dependency, no docker), applies the migrations, builds (skip with `SKIP_BUILD=1`), serves on a free port, runs the suite and removes it all. With `BASE_URL` set it runs against that server as it is:

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

Walk Planisphere and the site with `bash scripts/walk-planisphere.sh` (builds, serves on :4037: no `B:` templates or `$RC` and exactly one GET form; Tokyo on 2026-10-20 at 21:00 draws at least 400 stars and 80 constellation lines, all four compass letters, one Moon, the north disc and Vega but not Sirius in the "up now" line; Ho Chi Minh City at noon shows the daytime window; Sydney shows the south disc; bad query values fall back to Ho Chi Minh City with a 200; every body is under 400 KB; the page links only its own stylesheet, with reduced motion and no Tailwind; every inked path stays within the hour ring of the wheel's centre; the explainer is at most 120 words; the credit links are there; `/projects` links `/planisphere` once; exactly one `"use client"` file, the island, with one `role="slider"` served and no `roughjs`, `rough.js` or star data (Betelgeuse) in any client chunk the page references; a `?lat=10.82&lon=106.63&tz=Asia/Ho_Chi_Minh` position is labelled "Your location" on the north disc; on a local start, the server log has no `Error`, `⨯` or `unstable value` line after any request, and a deployed URL prints a note that its log is not readable), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-planisphere.sh`.

Probe turning the Planisphere wheel by finger in headless Chromium with `bash scripts/probe-planisphere-touch.sh` (builds, serves on :4043, installs Playwright and axe-core into a temp prefix; at 390x844 a real-touch quarter-turn drag (CDP `Input.dispatchTouchEvent`) on the disc moves the hour by 6 h each way on Tokyo and Sydney with no `pointercancel` and no page scroll, a 60 degree arc moves 4 h, a finger still scrolls the page on the explainer and, with JavaScript off, on the chart; at 1366x768 the mouse drag and ArrowRight are unchanged; axe finds no `nested-interactive` and nothing serious), or against production with `BASE_URL=https://otohime.dev bash scripts/probe-planisphere-touch.sh`. Chrome reads `touch-action` from the svg's box, so the island marks `svg.wheel` `data-turnable` once hydrated and the CSS puts `touch-action: none` there; with JavaScript off a finger scrolls the chart.

Walk Barometer and the site the same way with `bash scripts/walk-barometer.sh` (`QUIET=1` instead proves the quiet face against a dead and a slow feed, see Live data; builds, serves on :4051; `/barometer`, `?city=tokyo`, `?city=mexico-city` and `?city=nope` each draw exactly one face, `reading` or `quiet`, and the walk prints which, since the feed may be down: 200, the build-sha, one GET form, 24 cities, the Open-Meteo and CC BY 4.0 credit once, no `B:` templates or `$RC`, a body under 200 KB, and on the reading face a pressure of 900-1100 hPa (which rejects the 785 hPa surface pressure at altitude); `nope` and the bare page select Ho Chi Minh City, Tokyo selects Tokyo; `api.open-meteo.com` appears in no HTML and no client chunk; the page links only its own stylesheet; the explainer is at most 120 words; one `"use client"` file without rough.js; `/projects` links `/barometer` once), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-barometer.sh`.

Walk the Gazette and the site the same way with `bash scripts/walk-articles.sh` (builds, serves on :4065: `/articles` has one `<h1>` naming the Gazette, the dateline's Wednesday, 21 October 2026, exactly six `data-article` stories and six story links, no `B:` templates or `$RC` and only its own stylesheet; each of the six stories has one `<h1>`, one figure with `role="img"` and a caption, a sources box of at least two `https` links all on the allowlist, its date and reading time, Previous / Next in edition order, at most 600 visible words and under 150 KB; `/articles/nope` is a 404 saying "Not in this edition"; `/projects` links `/articles` once; no `"use client"` file under `app/(articles)` and a print stylesheet), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-articles.sh`.

Walk Structures and the site the same way with `bash scripts/walk-structures.sh` (builds, serves on :4069: `/structures` has one `<h1>` naming Structures, exactly eight `data-page` rows in teaching order with thumbnails and cost dots, eight page links, no `B:` templates, `$RC` or Tailwind; each of the eight pages has one `<h1>`, one each of the life, machine and costs figures, a disabled control fieldset, a narration, an `<ol data-trace>` of at least two steps, the worked example's end-state labels drawn (from the engine's own `labels()`), a sources box of at least two allowlisted `https` links, Previous / Next in series order, at most 700 visible words and under 200 KB; `/structures/nope` is a 404 saying "Not in this series"; `/projects` links `/structures` once; no script chunk `/structures/stack` loads holds rough.js; exactly one `"use client"` file under `app/(structures)`), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-structures.sh`.

Probe Structures' machines in headless Chromium with `bash scripts/probe-structures.sh` (builds, serves on :4073, installs Playwright and axe-core into a temp prefix; at 390x844 and 1366x768 the stack's controls wake after hydration, Push 9 says "9 goes on top.", Pop lists its beats, a full pile refuses with a sentence and an unchanged drawing; the search tree's Find 6 says "Found 6 in 3 steps." no sooner than 1000 ms after the press, or within 250 ms under reduced motion; Step mode shows a beat a press; "Insert 1, 2, 3, 4, 5" draws five nodes going down; Reset restores the example; Tab, 4 and Enter run the default move; nothing scrolls sideways at 320 px; axe finds nothing serious on `/structures` and `/structures/heap`, light and dark; no console error), or against production with `BASE_URL=https://otohime.dev bash scripts/probe-structures.sh`.

Walk Design system and the site the same way with `bash scripts/walk-design-system.sh` (builds, serves on :4075: `/design-system` has one `<h1>` naming Design system, the four figures once each, 27 stamps, nine `data-part`, one disabled fieldset of seven knobs, six dresses, eleven `data-sheet` scraps, two `<output>`s with the start sentences, at least three allowlisted sources, at most 700 words and 200 KB, no `B:` templates, `$RC` or Tailwind; `/projects` links it once; no rough.js in its script chunks; exactly one client file; with nothing listening on :4077 the walk fails).

Probe Design system's board in headless Chromium with `bash scripts/probe-design-system.sh` (builds, serves on :4079, installs Playwright and axe-core into a temp prefix; at 390x844 and 1366x768 the knobs wake after hydration, Spot coral says "1 knob turned. 9 parts followed." and fails the rule, No system with Spot mint follows nothing, Corner round swaps all nine stamps, Paper night fails for blue and passes for yellow, Dress as Gazette paints `rgb(243, 238, 227)`, Reset, the glide is 0.15s, 0s with Speed still and 0s under reduced motion, keyboard ArrowRight in Spot, JavaScript off, no sideways scroll at 320, no console errors, axe clean in light and dark).

Walk Rotor and the site the same way with `bash scripts/walk-rotor.sh` (builds, serves on :4035: 26 lamps, 26 keys, three windows and one GET form; `?m=AAAAA` prints `BDZGO` on the tape, also as the no-JS form submits it; `?pos=ADU&m=AAAA` shows `BFY` in the windows (the double step); bad fields fall back to the defaults with a 200; `?m=BDZGO` decodes to `AAAAA`; a rings-and-plugs vector matches the engine; one `"use client"` file, no rough.js in any client chunk, an explainer of at most 120 words, both wiring sources linked and `/projects` linking `/rotor` once), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-rotor.sh`.

Probe the hop between the site and the projects in headless Chromium with `bash scripts/probe-motion.sh` (builds, serves on :4061, installs Playwright into a temp prefix; at 1366x768 and 390x844 it clicks the real links `/projects` → each of the eight projects, `/shore` → `/projects` and Planisphere's "Next door" → `/orrery`, and goes `/orrery/sun` → `/planisphere` by script, since no link joins them: `pageswap` and `pagereveal` must both carry a view transition of type `hop`, the root fades out in 150 ms and in over 210 ms after 150 ms, the title moves as `project-<slug>`, and no `project-*` name is on two elements; under reduced motion the same hops complete and nothing at load runs longer than 1 ms; the site's own page changes keep the default crossfade; no console or page error; and with `@view-transition` stripped from what `/shore` loads, the hop into it must cut), or against production with `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh`.

Probe the hop into the signed-in rooms with `bash scripts/probe-motion-signed-in.sh`. It needs a database and finds or starts one on its own: `DATABASE_URL` if it answers, else a throwaway docker Postgres, else `embedded-postgres` in a temp prefix (`not ok - database` if none works). Then it migrates, builds (not with `SKIP_BUILD=1`) and serves on :4063. It signs up an owner and a plain user named `*-<run>@probe.test` and deletes them on exit. At 1366x768 and 390x844, with motion on and reduced, it signs in through the `/sign-in` form (to `/dashboard`, and with `?next=/account`) and goes from `/shore` by `location.assign` into the rooms, `/admin/*`, the 403, `/work`, `/` and `/projects`. Each landing must carry the hop and its full root fade, with no page error or console error until the hop and every streamed reveal have settled. With the root layout's `pagereveal` guard stripped from `/dashboard`, a sign-in must log "Transition was skipped". CI runs it in `checks` against its own server with `BASE_URL` and `DATABASE_URL`. It refuses otohime.dev, because it creates accounts.

The Sun's parts and callouts live in `app/(orrery)/_lib/poster.ts` and every other body's in `app/(orrery)/_lib/bodies.ts`; the ink is rough.js with a fixed seed in `app/(orrery)/_lib/ink.ts`; `bash scripts/walk-orrery.sh` counts the words on every served page (cap 220, `WORD_CAP` in `app/(orrery)/_lib/words.ts`).

Orrery's motion is CSS only in `app/(orrery)/orrery.css`: the ink draws itself on, layer by layer; on the Sun's poster three loops then run (convection, photon, wind); all of it is off under reduced motion, and `app/(orrery)/_lib/motion.test.ts` tests it.

Walk `/music` with `bash scripts/walk-music.sh` (builds with no database and serves on :4025: the three starters from `content/site.ts` must still show, with status 200), or against production with `BASE_URL=https://otohime.dev bash scripts/walk-music.sh`.

Walk `/sketches` and run its headless Chromium probe with `bash scripts/walk-sketches.sh` (builds, serves on :4081, checks build-sha, section and figure counts, responsive loaded images at 1366x768 and 390x844, negative-control 404 image interception, and `/sketches/download/[filename]`), or reuse a build with `SKIP_BUILD=1 EXPECT_PEOPLE=0 bash scripts/walk-sketches.sh` (pre-activation, 12 studies) / `SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh` (activated, 22 studies), or against a deployment with `BASE_URL=https://otohime.dev EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh`.

Validate the sketches assets and portrait manifest with `npm run sketches:check` (offline schema, 3:4 aspect ratio, `1152x1536` `< 600 KB` JPEG derivatives, `https://files-cdn.x.ai` allowlist, non-expiring provenance, and hash uniqueness; add `-- --require-people` to require all ten reviewed portrait records and `-- --live` to download, hash, and decode all 20 public URLs). On-demand generation, import, and xAI Files publication live in `scripts/sketches-paint.ts` (`preflight --offline`, `generate`, `import`, `publish`), backed by a redacted attempt ledger and `content/portraits.json` (which stays `[]` until all ten reviewed portraits are published and verified).

Walk the Internet Save Point footer across all seven public site pages, auth, global 404 and the eleven isolated project roots with `bash scripts/walk-end.sh` (builds, serves on :4081; or reuse a build with `SKIP_BUILD=1 PORT=4081 bash scripts/walk-end.sh`, or walk a deployment with `BASE_URL=https://otohime.dev bash scripts/walk-end.sh`).

Probe the Internet Save Point footer in headless Chromium with `bash scripts/probe-end.sh` (builds, serves on :4083, installs Playwright into a temp prefix; or reuse a build with `SKIP_BUILD=1 PORT=4083 bash scripts/probe-end.sh`, or probe a deployment read-only with `BASE_URL=https://otohime.dev bash scripts/probe-end.sh`). It verifies the rendered DOM at 1366×768, 768×1024 and 390×844 (touch mobile): one semantic footer below `main#main` on every public site route, route isolation on auth/404 and all eleven projects, `/music`'s television clear area, reserved layout stability across entry/reveal/poke/unlock/restore, actual SVG `getBBox()`/`getComputedTextLength()` LCD bounds in every state, light/dark WCAG contrast, all five swatches and `feDisplacementMap` wobble scale, mobile disclosure, once-per-mount scroll entry, offscreen and document-hidden pause, filter isolation, zero idle rAF/interval loops, reduced motion on load and toggled mid-press, mascot click/tap/Enter/Space, Konami unlock/exclusions/persistence/blocked-storage fallback, real Tab order, Back to top scroll + `main#main` focus, no-JavaScript rendering, and a failing-then-restored canonical-href negative control. External requests are attributed by parsed host and frame owner: only `/music`'s television may reach YouTube, through its API script in the page and its own embed iframe (inside `main`, outside the footer); everything else fails the run, and browser-local controls (all fulfilled by `page.route`, so remote mode stays read-only) prove that main-frame, look-alike and footer-side requests still fail it. The achievement badge is awaited by its computed state, with a bounded deadline, and a badge held at opacity 0 must fail that wait.

## Internet Save Point (footer)

At the bottom of the site's `(home)` and `(app)` pages, `EndFooter` (`components/end-footer.tsx`) and `EndStage` (`components/end-stage.tsx`) draw a miniature paper cliff where the homepage's pocket console rests as a friendly save point ("You've reached the end of the internet. / Thanks for stopping by. See you on the next level."):

- **Split rendering for smooth motion.** Static isometric line work (the ragged deckle ground slab, signpost and pocket console) sits inside two `Inked` SVG layers so the `feTurbulence` + `feDisplacementMap` filter never repaints during ambient loops. Drifting clouds, twinkling stars, the breathing lamp, falling data packets, expressive LCD eyes and the two-row LCD text sit in an aligned unfiltered `.end-sky` SVG layer.
- **On-twos mascot and Konami achievement.** The pure reducer in `lib/end.ts` (tested by `lib/end.test.ts`) steps two-tick button presses at 12 fps (`useTick`), cycles six short cues from `site.end` with a tenth-poke breather (`STOP / POKING`), and listens for `↑ ↑ ↓ ↓ ← → ← → B A` while the footer is visible in the viewport (ignoring editable fields, modifiers and key repeats, and clearing partial progress when scrolled away or hidden). Unlocking reveals the reserved `★ 1/1 Reached the end` badge, colors the stars in the five house swatches, and persists `end:achievement = "1"` in `localStorage` after hydration (degrading cleanly to an ephemeral unlock if storage is blocked).
- **Navigation and no-JS resilience.** The six canonical destinations map `CONSOLE_MENU` directly and the four contact chips map `site.lines` with `away()` target/rel semantics. The copyright year is prerendered by an async `"use cache"` helper with `cacheLife("days")` and `getUTCFullYear()`. With JavaScript off or under `prefers-reduced-motion: reduce`, the complete resting illustration, links, credits and `#main` top anchor work without layout shifts.

A Capsule round is staged so the tier comes last. Turn commits the draw and also deals the round's look from the same seed and draw index on streams of their own (`turnFrames` and `dropIndex` in `app/(capsule)/_lib/gacha.ts`): the crank turns for 16 to 28 frames (1.3 to 2.3 s at 12 fps), and in the last 6 one identical capsule falls out of the dome, through the collar, into the chute. Open then runs shake, part, rise (a plain, numberless card back comes up out of the capsule), edge (the tier rule draws on: ink, slate, or gold), hold (a legend's glow and sparks, legend only) and flip, 6 frames each (part 4). Components read the round only through `revealView` in `app/(capsule)/_lib/reveal.ts`, and `reveal.test.ts` plays every frame of every tier to prove that nothing before the edge stage has an edge or a face. Turn still saves the card at once, so a reload mid-round keeps it, but `albumView` holds that copy and draw back from the album and the tally until the card is revealed. Under reduced motion each press lands on its last pose at once.

See every drawn Capsule card on one sheet with `npm run --silent capsule:sheet > /tmp/capsule.svg`, then open the file in a browser or any SVG viewer.

To add or swap a Capsule card, edit its entry in `app/(capsule)/_lib/cards.ts` (id, name, film, year, tier, colours, note) and draw it as `app/(capsule)/_lib/art/<id>.ts`, registered in `art/index.ts`. Follow the printed-ink brief in the pm-196 plan: absolute path commands only, palette-role fills (the card colour is mixed 12 % toward paper), one thin rough ink outline per stroked shape, the `hatch` role for shade (rough hachure, never outlined), `weight: "fine"` for whiskers, fur and hair lines, no gradients and no raster. The ink comes from `app/(capsule)/_lib/art/ink.ts` (Capsule's own copy of Sun's rough.js wrapper, seeded per shape so the server and the browser draw the same bytes), and the pinned Totoro hash in `art.test.ts` pins the look: change it only after looking at the sheet. `app/(capsule)/_lib/art.test.ts` checks that every card is drawn and every path stays inside the card face, and `npm run capsule:sheet` previews the set. This is also the takedown rollback: replace the set with original characters this way, and leave the machine, the economy and the page untouched.

## Motion

The app moves in one house style, with no motion library: CSS, React's `<ViewTransition>` and the browser's `@view-transition`.

- Figures and machines run on twos, at 12 fps, from pure reducers (`lib/machines.ts`); smoother looked worse.
- Ink draws itself on (`stroke-dashoffset` from 1 to 0 over `pathLength="1"`), then the parts fade up.
- The base style is the resting pose: every keyframe animates *from* somewhere, so a still (reduced motion, CSS that never loads, JavaScript off) is the whole drawing.
- The exit is fast and the enter gentle: 150 ms out, 210 ms in after it, nothing over 400 ms except a draw-on. Loops only on things that loop in life (a lamp, a platter).
- The one simulation is the stamp board on `/play` ("Stamp it", or a 500 ms press on the heading): `lib/stamps.ts` is a hand-written box solver (fixed 120 Hz steps, sequential impulses, sleep), unit tested in `lib/stamps.test.ts`; the board's chunk loads only when it is used. Under reduced motion it never runs: the letters are placed, and Tidy snaps. `scripts/probe-stamps.sh` drives it in a browser.
- Each stylesheet ends with its own `prefers-reduced-motion` block, which also zeroes the `::view-transition-group/old/new(*)` pseudo-elements (`*` does not match them).

The site and each project are separate root layouts, so a hop between them is a full document load. It crossfades only when both documents opt in. So every stylesheet carries a copy of the hop rule (it is never imported across route groups): `@view-transition { navigation: auto; types: hop; }`, the root fade under `:root:active-view-transition-type(hop)` (typed, so the site's own page changes keep the default crossfade) and `h1 { view-transition-name: project-<slug>; }`, the name the row title on `/projects` carries through `--vt`. Each root layout also repeats `@view-transition{navigation:auto;types:hop}` in an inline `<style>` in its `<head>`. On a first visit Chromium settles the opt-in before a stylesheet that is still loading applies, and the hop then cuts. **A new project copies the rule and the inline `<style>`, and names its `h1`.** `lib/motion.test.ts` fails until it does, and `scripts/probe-motion.sh` watches the hops run.

Inside the site, React's `<ViewTransition>` runs a page's exit and enter only when it sits above every node that changes. Each page wraps itself (`enter="page-in" exit="page-out" default="none"`), and so does each group layout (`(home)`, `(app)`, `(auth)`), around everything below its masthead: a move between groups swaps the whole layout, and only the layout's wrapper can fire. The masthead stays outside, and the root layout stays bare. An unknown address gets `app/global-not-found.tsx`, a whole document drawn on the server with the opt-in in its `<head>`, so its exits are hops.

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

## Rotor

Rotor (`/rotor`, `app/(rotor)/`) is an Enigma I drawn in ink on cream paper: three rotor windows, 26 lamps, 26 keys and a paper tape. Type on the real keyboard or click the drawn keys. The right rotor steps (with the double step), one lamp lights amber and the tape grows in groups of five, plain above and code below. The lid holds the settings: three of rotors I–V, rings, start positions, reflector B or C and up to ten plug pairs. The Share line is a URL with the settings and the message, and the address bar follows it as you type. Type the code back in with the same settings and the message returns. With JavaScript off, the lid is a plain GET form and the server encodes. The wiring is Wikipedia's rotor table, checked against the Crypto Museum's (`_lib/wiring.ts`), and the engine is pinned to `AAAAA` → `BDZGO` and an independent simulator in `_lib/enigma.test.ts`.

## Planisphere

Planisphere (`/planisphere`, `app/(planisphere)/`) draws the sky for a city, a date and an hour as a paper star wheel: a disc of 921 stars (magnitude 4.5 or brighter, J2000, no precession) centred on the pole you can see, turned by one `rotate()` under a frame whose oval window is the horizon for the latitude. The maths is plain: Greenwich mean sidereal time (Meeus ch. 12) gives local sidereal time, which gives each star's altitude and azimuth; the Sun is Meeus ch. 25 low precision and the Moon is the Astronomical Almanac's seven-term longitude series, so every 2026 phase lands within 20 minutes. The stars and constellation lines are d3-celestial's (BSD-3-Clause, XHIP via VizieR V/137D, lines after the IAU), vendored by `scripts/vendor-planisphere.ts`; nothing is fetched at runtime. The page awaits `searchParams` with `export const instant = false` and no `<Suspense>`, so a plain GET form works with JavaScript off, and each query field falls back to its default on its own. One client island, `planisphere-app.tsx`, wraps the server-drawn chart: with JavaScript on, dragging the disc or the arrow keys (Shift for an hour) turn it in quarter hours and rewrite the Sun, Moon, daylight tint, "up now" line, form and URL (`history.replaceState`), "Now" jumps to the present, and "Use my location" (asked only on press, nothing stored) or a city change navigates so the server inks the new window; the island imports no rough.js, star data or lines.

## Barometer

Barometer (`/barometer`, `app/(barometer)/`) draws a brass weather station for one of 24 cities: an aneroid dial with a black needle (Stormy, Rain, Change, Fair, Very Dry), a glass thermometer, a wind vane and a tin rain cup, all in rough.js ink, with one sentence under them ("Ho Chi Minh City, 17:30 local, 26.9 °C, 1011.2 hPa, drizzle."). The city is a plain GET form checked against the vendored list in `_lib/cities.ts`; an unknown city draws Ho Chi Minh City with a 200. With JavaScript on, the select reads on change, and **Set** moves the dial's second brass hand to the needle and keeps it in `localStorage` (`barometer.hand`), so the next visit shows whether the pressure rose or fell; **Clear** removes it.

The readings are from [Open-Meteo](https://open-meteo.com/) (CC BY 4.0, no key), credited on every render. They are fetched only on the server, in `_lib/station.ts`: a `"use cache"` function whose `cacheLife` is 900 s after a good reading (the feed's own interval) and 60 s after a failure, with a 4 s `AbortSignal.timeout`. The dial reads `pressure_msl`, never `surface_pressure` (Mexico City answers 785 hPa for the second and about 1020 for the first). If the feed is down or slow the board still draws at rest, "The station is quiet.", with a 200. `BAROMETER_HOST` (an http(s) origin, read once at module load) points the server elsewhere for tests.

## Gazette

The Otohime Gazette (`/articles`, `app/(articles)/`) is a small newspaper: a front page with a blackletter masthead, a dateline, the lead story above the fold and the rest in ruled columns, and one static page per story with a drawn infographic, two justified columns with a drop cap from 720 px, numbered sources and Previous / Next. Every page is HTML built ahead of time, with no client island, so it reads with JavaScript off and prints cleanly.

To add an article:

1. Add an `Article` to `app/(articles)/_lib/articles.ts` and put it in `ARTICLES` (front-page order; the first is the lead): a `slug` (`[a-z-]+`, the URL), a `kicker` (`Sky`, `Calendar`, `Numbers` or `Earth`), a `headline`, a one-sentence `deck`, `published` (`YYYY-MM-DD`; the newest is the edition's date), the `body` as plain-text paragraphs (no HTML, no markdown), its `facts` and `sources`, and the figure's `caption` and `alt`.
2. Write to the caps `articles.test.ts` enforces: a body of 180 to 350 words with no paragraph over 90, a Flesch-Kincaid grade of 8 or under (`fkGrade` in `_lib/readability.ts`), a mean sentence of 20 words or fewer and none over 35; a headline of at most 8 words and a deck of at most 30. If a piece runs over, split sentences; never loosen a cap.
3. Every number in the body is a `fact` naming a source key. Give at least two sources, each `https` on the allowlist: `en.wikipedia.org`, `www.gps.gov`, and `nasa.gov`, `noaa.gov`, `usgs.gov` or `nist.gov` and their subdomains.
4. Draw its figure in `_lib/figures/<slug>.ts` and register it in `figures/index.ts`: ink paths from `_lib/ink.ts` (rough.js, `SEED = 213`), the subject in `spot`, and `<text>` labels whose numbers come from the facts by id (a fact left out goes in `UNDRAWN` with the reason). `figures.test.ts` keeps it inside its frame with labels of 12 px or more at 390 px.
5. Add the slug to `SLUGS` in `scripts/walk-articles.sh` and update the six-story counts there and in `e2e/rbac.test.ts`.

## Structures

Structures (`/structures`, `app/(structures)/`) is a series of eight pages on squared notebook paper: the array, the linked list, the stack, the queue, the hash table, the search tree, the heap and the graph. Each page has an In life drawing, a machine you work with buttons (each move plays beat by beat at 12 fps, a picture and a sentence a beat, ending with its step count), a costs card, four short parts, sources and Previous / Next. With JavaScript off the machine shows the worked example's end state and its steps. The pages and their drawings are built ahead of time; the only client code is the island, `_components/machine-app.tsx`, and rough.js never reaches it: the server inks the stamps and the island places them with `<use>`.

To add a structure:

1. Write `_lib/structures/<slug>.ts`, a `Structure<S>` (`_lib/machine.ts`): a `slug` (`[a-z-]+`, the URL), a `cap`, `empty(cap?)`, its `moves` (`{ id, label, takes }`, `takes` one of `none`, `number`, `word`, `index`, `pair`), the `defaultMove` Enter runs, a pure `reduce(state, action)`, `describe` (the drawing's `aria-label`, naming every label), `labels`, the worked `example` and `costs()`. Put it in `STRUCTURES` in `structures/index.ts` (teaching order: each page uses only pictures from earlier ones).
2. The trace is the explanation. Every beat is one sentence (`say`), the element ids it lights (`hot`) and `step: true` if it counts: a step is looking at one thing, moving one thing one place, writing a thing into its place, or relinking or rubbing out one arrow or line. A move's `steps` is its step beats (use `done()`), and a successful move ends with a summary beat ("Found 6 in 3 steps."). A move past the cap, on an empty machine or with a value it cannot take is refused with `refuse()`: the same state object and exactly one beat. Keep element ids stable (`slot3`, `n8`, `b0`, `A`) so the island moves a stamp rather than redrawing it.
3. `costs()` measures find, add and remove with 8 things inside on `empty(COST_ROOM)`, by running `reduce`; each falls in a band the tests pin: one (1 to 3 steps), few (4 to 6) or all (7 to 10).
4. Lay it out in `_lib/scenes.ts` (`sceneFor`, 480 wide, a fixed height; every state in frame with no overlaps, letters 17 or more) and name its stamp kinds in `SCENE_KINDS`; draw its In life picture in `_lib/life/<slug>.ts` (at most 10 labels, one spot) and register it in `life/index.ts`.
5. Write its page in `_lib/copy.ts` to the caps `copy.test.ts` enforces: a title of at most 4 words, a one-sentence deck of at most 30, a body of 180 to 350 words at Flesch-Kincaid grade 8 or under (mean sentence 20 or under, longest 35), every step count in *How a move works* one the machine takes, no Big-O, code, `<`, `>` or `http` in the prose, and at least two sources, each `https` on `en.wikipedia.org`, `developer.mozilla.org`, `docs.python.org` or `en.cppreference.com`.
6. Add the slug to `SLUGS` in `scripts/walk-structures.sh` and update the eight-page counts there and in `e2e/rbac.test.ts`.

## Design system

Design system (`/design-system`, `app/(design-system)/`) explains the idea on one page of squared notebook paper in the Structures look: a box of eight pots (paper, ink, spot, corner, gap, size, speed, face), nine parts built only from them and three patterns, with a rulebook on the lid. Its board draws the nine parts; seven knobs, a No system switch and six Dress as buttons change the pots, and a counter says how many parts followed. With the system on every knob moves all nine parts; with it off nothing follows and nine are left to fix by hand. The rule line reads ink and spot against paper as WCAG ratios. The "Right here" card audits this site's eleven other stylesheets. With JavaScript off the board is a finished drawing at the start values with greyed knobs. The page is built ahead of time; the only client code is `_components/board-app.tsx`, and rough.js never reaches it: the server inks the 27 stamps and the island places them with `<use>`, colouring them from `--board-*` custom properties on the svg root.

The "Right here" numbers are pinned in `_lib/siblings.ts` and checked by `siblings.test.ts`, which reads the other stylesheets as text. To re-pin when a sister stylesheet changes or a new project lands:

1. Run `npm test`. A mismatch prints the new value (paper, ink, count of custom properties, `--paper`/`--ink` flags, or an unpinned group stylesheet).
2. Edit that row in `SIBLINGS` (or add a row for a new group with its group, file, light paper, first ink, decision count and flags; add a dress if you want one).
3. If the prose quotes a changed count (sheets, papers, inks, creams), `copy.test.ts` fails too: fix the sentence in `_lib/copy.ts` with it.
4. Add the project's name to the motion probe and walk counts if it is a new project, as the other projects do.

## Live data

The rules every page on this site that reads a live feed follows. Barometer (`app/(barometer)/`) is the worked example; copy its shape inside your own route group (the isolation tests forbid sharing code across groups, so there is no shared library).

1. **One server-only module holds the only `fetch(` and the host.** Barometer's is `_lib/station.ts`; the host is a module constant read once from an env override (`BAROMETER_HOST`, used only if it parses as an http(s) origin) with the real origin as the default. `isolation.test.ts` fails if `fetch(`, the host or `process.env` appear anywhere else, and the walk checks that the host is in no served HTML or script chunk.
2. **The page exports `instant = false` and awaits `searchParams` as its first statement, outside any `<Suspense>`.** With `cacheComponents: true` a plain page fails `next build`, and the Suspense shape leaves no-JavaScript visitors on the fallback for ever. The segment options `revalidate`, `dynamic` and `fetchCache` are gone.
3. **The upstream call sits in a `"use cache"` function, with `cacheLife` matched to the feed's own interval and a short life for failures.** Barometer's feed updates every 900 s, so a good reading gets `cacheLife({ stale: 300, revalidate: 900, expire: 3600 })`; a failure gets `cacheLife({ stale: 30, revalidate: 60, expire: 300 })`, so an outage costs one upstream call a minute, not one per view. One `cacheLife` call per invocation, one in each branch.
4. **`AbortSignal.timeout` on every fetch.** Barometer's is 4000 ms. Any throw, non-200 or unparsable body gives `null`.
5. **A pure parser, tested on captured fixtures, returning `null` on anything unexpected.** `parseReading` takes `unknown` and is tested on a real answer, a missing field, the feed's error shape and garbage, with no network. Read the field you mean (`pressure_msl`, not `surface_pressure`).
6. **A drawn quiet face, with a 200, never a 4xx or 5xx for bad input or a dead feed.** An unknown city draws the default city; a `null` reading draws the board at rest with "The station is quiet."
7. **The licence credit is on every render**, on the reading face and the quiet face alike (Open-Meteo, CC BY 4.0, linked).
8. **The reading's time is on the page** ("17:30 local"), so staleness is visible.
9. **No network at build.** The city list and the fixtures are vendored; `next build` never calls the feed.
10. **A host override and a `QUIET=1` walk prove the dead and slow cases on demand.** Waiting for a real outage proves nothing. `QUIET=1 bash scripts/walk-barometer.sh` builds once (`SKIP_BUILD=1` reuses a build), then starts the server twice: with `BAROMETER_HOST` on a dead port, where `/barometer` and `?city=tokyo` must be the quiet face with a 200, the credit and the build-sha in under 3 s; and with it on a Node fake on `127.0.0.1:4057` that answers after 10 s, where `?city=paris` (a city not yet asked on that server) must be the quiet face in 3.5 to 6.5 s, which shows the 4 s abort fired, and the fake's log must show a `/v1/forecast?` request with `pressure_msl`. Both servers and the fake are killed by process group on every exit path.

Not here, on purpose: retries, circuit breakers, a status page. The short failure life in rule 3 is the whole back-off.

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

## Ask the console: the model tier

The Ask chip answers offline from `public/ask-index.json` (`lib/ask.ts`). `/api/ask` adds an optional tier on top that answers with Claude. It is off unless both env vars are set:

| Env var | Effect |
| --- | --- |
| `ASK_LLM` | `1` turns the tier on. Anything else, or unset, keeps it off. |
| `ANTHROPIC_API_KEY` | Server-only. Never commit it, and never give it a `NEXT_PUBLIC_` name. |

- **Off** (the default): `GET` and `POST /api/ask` are 404. `bash scripts/probe-ask-llm.sh` builds, starts with both vars unset and checks this.
- **On:** `GET /api/ask` is `{"enabled":true,"limits":{"hour":10,"day":150}}`. `POST /api/ask` takes `{"question":"..."}`, at most 1 KB, only from the `BETTER_AUTH_URL` origin (403 otherwise). It returns `{mode, lines, sources}`. The model (`claude-opus-5-5`, effort `low`, structured JSON, 8 s timeout, one retry) sees only the top 6 BM25 passages. It may cite only their ids, and `sources` holds only those passages' pages.
- **Budget:** each IP gets 10 model answers per UTC hour, and the whole site gets 150 per UTC day. These are counted in the `ask_usage` table, keyed by an HMAC of the IP, never the address itself. Past either limit the reply is 429 with the offline answer under an `(OFFLINE)` line. An SDK error, a refusal, a reply that does not parse, or an unreachable database also gives the offline answer (200, `(OFFLINE)`). A question nothing on the site matches never reaches the model. At most 150 short calls a day costs roughly $6/day in the worst case and far less in practice.
- `lib/ask-llm.test.ts` covers this with a fake client and an in-memory store.

## Deploying

GitHub Actions (`.github/workflows/ci.yml`) does it all:

- **Every PR** runs lint, typecheck, a migration drift check and a build. It also gets a preview on Vercel backed by its own Neon branch (`preview/pr-<n>`, a copy of production that is migrated first). The branch is deleted when the PR closes.
- **Every push to `main`** runs the same checks, then builds, migrates production, deploys to Vercel and smoke-tests `https://otohime.dev/api/health`.

The jobs need these repo settings:

- **Variables:** `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `NEON_PROJECT_ID`.
- **Secrets:** `VERCEL_TOKEN`, `NEON_API_KEY`, and `DATABASE_URL_UNPOOLED` (production's direct, unpooled URL, used for migrations).
- **Vercel Production env:** `DATABASE_URL` (pooled), `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Optional: `ASK_LLM=1` and `ANTHROPIC_API_KEY` turn on Ask's model tier (see above).
- **Vercel Preview env:** only `BETTER_AUTH_SECRET`. CI passes each preview its own Neon branch URL.

Rules that keep this safe:

- Production migrates before the new code goes live, and the old code keeps serving if the deploy fails. So migrations must be expand-only: add first, drop in a later PR.
- `drizzle-kit migrate` runs every pending migration in one transaction, so `CREATE INDEX CONCURRENTLY` won't work.
- `<meta name="build-sha">` on any page names the commit the live site was built from.
- Commits to `main` must be authored by the site owner's GitHub email, or Vercel Hobby will not deploy them.
- Don't run `vercel --prod` from a laptop; it skips the migration.
- Keep the Vercel Git integration disconnected, or Vercel deploys before CI migrates.
