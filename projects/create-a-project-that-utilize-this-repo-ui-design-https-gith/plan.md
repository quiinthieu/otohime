# Shore: a sea-glass focus timer (pm-181)

**Idea.** "Create a project that utilize this repo UI design:
https://github.com/mttmcknn/sea-glass. This project should act like a separate
component that is not impacted by the otohime app's current design. You're free
to choose the project's idea, features."

**Product.** Shore is a quiet focus timer at `otohime.dev/shore`. You pick a
length, press Begin, and when the session ends a piece of sea glass washes up on
today's shore. Each piece has a stable seed, so a day always re-renders the same
way, and the row of pebbles is a record of the day. It is the first entry on the
Projects bench (`/projects`, pm-171).

**Isolation.** Shore gets its own Next.js root layout (`app/(shore)/layout.tsx`)
with its own `<html>`, `<body>` and stylesheet. It never imports the site's
`globals.css`, Tailwind, `@/components` or `@/content`. To make room for a second
root layout, the existing site moves, unchanged, into `app/(site)/`. Going
between the two is a full page load (plain `<a href>`), which is what the Next 16
route-group docs prescribe for multiple root layouts
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`).
A unit test enforces the boundary in both directions.

Research: [research.md](research.md) (run-6195; it includes a build spike that
proved the layout split on Next 16.4.2).

## Decisions

| Decision | Why |
| --- | --- |
| The project is Shore, a localStorage focus timer that mints sea-glass pebbles. | It uses the material (the canvas renderer) and the page design (paper, serif display, letter-spaced captions, lagoon/lilac/amber/mint palettes) from sea-glass's web playground. It needs no table, migration, auth or API, so it is cheap, reversible and needs no person to act. |
| It gets a second root layout; the site moves to `app/(site)/`. | A shared root layout cannot be "not impacted": `globals.css` styles `body` and Tailwind preflight resets every element. The spike showed `/shore` serving one stylesheet with zero Tailwind or otohime tokens. |
| A catch-all `app/(site)/[...rest]/page.tsx` calls `notFound()`. | With no top-level layout, an unmatched URL would get Next's bare default 404. The catch-all keeps the site's "Nothing in this parcel" page. It needs no experimental flag (`globalNotFound` is the fallback). |
| Vendor `web/dist/sea-glass.mjs` from sea-glass@db70d71 with its Apache-2.0 `LICENSE`, typed by a hand-written `sea-glass.d.mts`. | The Kotlin library has no web artefact; the playground renderer is "the visual source of truth". Under `allowJs`, a sibling `.d.ts` is ignored, so the types file must be `.d.mts`. |
| Two SWE tasks: the move first, then Shore. | The move touches every route and can be proven alone with no visible change. Shore's visual fix cycles then never re-touch it. |
| Each task proves itself on a local `next start` of the delivery sha. QA and acceptance check otohime.dev's `build-sha` meta; if production has not caught up, acceptance passes on the local walk with a watch on `https://otohime.dev/shore`. | Public pages serve with no database. Production serves 7147cf8 today, so deploys are flowing, but a verification item must not depend on another system's timing. |
| Every delivery commit is authored and committed as `Otohime <quiinthieu@gmail.com>` by setting `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME` and `GIT_COMMITTER_EMAIL` on the `git commit` itself, and a verification item checks `git log -1 --format=%ae`. | Fleet leases export `GIT_AUTHOR_*=Claude Code`, which beats `git config`; this plan's first commit (0c39a9c) went out that way. Vercel Hobby only deploys owner-authored commits (README). |
| CI's e2e test stops expecting the empty bench and expects the Shore row. | `e2e/rbac.test.ts` asserts "Nothing on the bench yet", and that step gates the production deploy. |
| Revision 3: keep 1e171e8 and re-plan only its proof; the walk becomes `scripts/walk-shore.sh` in the repo. | t-1052 failed three gates on BSD `wc -l` padding in an inline walk that no SWE could edit; production already serves the code correctly. |
| Revision 3: the browser click-through acceptance line becomes unit tests over pure `_lib/actions.ts`; a real browser pass is advisory QA. | Headless Chrome cannot navigate in these leases, so the line could never be proven; this is the nearest provable deliverable (gap recorded as a decision). |

## Features (v1)

1. **Timer.** Lengths 15 / 25 / 45 min in a lilac capsule segmented control. A
   lagoon rounded 270×88 Begin button that becomes Pause / Resume, and a lilac
   capsule toolbar with Reset and Finish now. The countdown is serif display
   type in an `aria-live="polite"` status. While running, `document.title` is
   `mm:ss · Shore`. Timing is wall-clock (`startedAt`, `pausedMs`), so a
   backgrounded tab stays right.
2. **Pebbles.** Finishing a session mints `{startedAt, minutes, palette, seed}`:
   amber for 15, mint for 25, lilac for 45, and `seed = dayNumber * 101 + index`.
   Today's shore is a row of 72×70 disc pieces, wrapping after 12, with a tally
   ("3 pieces · 1 h 25 min"). Days older than 30 are dropped.
3. **Scene.** A light / dark scene toggle (the upstream dark-scene pair), kept in
   the ledger. `prefers-reduced-motion` turns off the press transitions.
4. **Ledger.** `localStorage["shore-v1"]` is read through `normalizeLedger()`,
   which drops bad JSON and junk entries and clamps minutes to {15, 25, 45}.
   "Clear today", confirmed inline, is the only destructive action.
5. **Links.** A plain `<a href="/">otohime.dev</a>` in Shore's top bar; the
   Projects row links to `/shore`.

Not in v1: accounts or sync, notifications, sounds, per-session notes, the
upstream recipe inspector, and re-skinning any otohime page.

## Revision 3: re-plan after t-1052 failed its gate (run-6257)

### What happened

- **t-1051** (the site moved to `app/(site)/`) is done: delivery 5d2040d, QA
  pass in [qa-t-1051.md](qa-t-1051.md). It stays as is.
- **t-1052** (Shore) was built and pushed as **1e171e8**. That code is on
  main, and **otohime.dev serves it today**: `build-sha` is 1e171e8, `/shore`
  returns 200 with `<title>Shore</title>`, three `class="glass` and no sidebar,
  `/projects` has one `href="/shore"`, and `/shore/nope` returns 404 with the
  parcel page (probed 2026-10-19 by this run). The task still failed its green
  gate three times (ver-2375, 2377, 2378, 2382). It is now superseded.
- **Why it failed:** the gate's last item was a 600-character inline
  `bash -c` walk. On the macOS gate, BSD `wc -l` prints `       1`, so
  `test "$(grep -o 'href="/shore"' … | wc -l)" = 1` is false whatever the app
  serves. A harmless `curl: (7)` line from `--retry-connrefused` was the only
  stderr, so the gate never named the failing step. Each SWE run traced it to
  `wc -l` and made no code change, because a SWE cannot edit its own
  verification line. The operator answered esc-263, but the stored contract
  kept the old command.
- **What was never proven:** t-1052's acceptance line "in a browser, Begin
  then Finish now adds a pebble that survives a reload, and the scene toggle
  switches to the dark scene". Headless Chrome cannot navigate inside these
  leases, so no run could do it.

### What the new tasks do differently

| Failed attempt (t-1052) | New tasks |
| --- | --- |
| The walk was an inline one-liner in the contract. A broken probe needed an operator to edit the contract. | The walk is **`scripts/walk-shore.sh`, checked into the repo** (task 1). The gate runs `bash scripts/walk-shore.sh`. If a probe is wrong, the SWE fixes it with a commit. |
| Counts used `wc -l` with a string `test … = 1` (BSD pads). | Counts use `grep -c` and numeric `-eq`/`-ge` only. A verification item fails the task if `wc -l` appears in the script. |
| `set -e` stopped at the first false step and printed nothing, so the gate showed only a curl retry line. | Every check runs and prints `ok - <name>` or `not ok - <name>: <detail>`, then `walk: N ok, M failed`. A red gate names the check. |
| Readiness used `curl --retry-connrefused`, which printed misleading `curl: (7)` lines. | Readiness is a bounded silent loop (at most 60 tries, 1 s apart) that the script drives itself. |
| A browser click-through was an acceptance line that no lease could perform. | The ledger transitions behind Begin, Finish now, the scene toggle and Clear today move into pure `app/(shore)/_lib/actions.ts`. A unit test drives the same path the buttons call, through serialize and `normalizeLedger` (the reload) (task 2). A real browser pass is advisory QA. |
| One task carried the whole feature, so its proof could not be split from its code. | Task 1 changes no app code (`qa: skip`). Task 2 is a small refactor plus tests, proven by task 1's script. |

**Recorded gap (decision, run-6257):** on this platform no machine check
proves canvas pixels or a real click. The nearest deliverable is the action
unit tests plus the server-rendered markers: three or more glass elements, the
Dark scene button and the Finish now action in `/shore`'s HTML. QA attaches
light and dark screenshots when a browser works. A missing browser is noted,
not failed.

**Commit identity:** 5d2040d and 1e171e8 carry a `Co-Authored-By` trailer,
and Vercel deployed 1e171e8 anyway. The trailer is accepted, and QA does not
fail a delivery for it. The identity check is the author email,
`quiinthieu@gmail.com`, which the four `GIT_AUTHOR_*` / `GIT_COMMITTER_*`
variables set on `git commit`.

## Tasks (revision 3)

### 1. Check in Shore's walk as a portable script

- **Role:** software_engineer, `qa: skip`. It adds a script and a README
  line and changes nothing a person sees. Its verification fully proves it.
- **Problem:** Shore's local `next start` walk lived only as an inline
  one-liner in t-1052's contract. It used BSD-unsafe `wc -l` string compares
  and stopped silently at the first false step, so three gates failed on a
  code that was already right, and no SWE could fix the probe.
- **Action items:**
  1. Add `scripts/walk-shore.sh` (bash, `set -u`, no `set -e` around the
     checks). Local mode (default): it sets the CI placeholder env if unset:
     `BETTER_AUTH_SECRET=ci-placeholder-not-a-real-secret-0123456789abcdef`,
     `BETTER_AUTH_URL=http://localhost:$PORT`,
     `DATABASE_URL=postgresql://otohime:otohime@localhost:5432/otohime` and
     `GITHUB_SHA=0123456789abcdef0123456789abcdef01234567`. Then it runs
     `npm run build`, unless `SKIP_BUILD=1`, with the log in a temp dir that
     it prints on failure. It starts `./node_modules/.bin/next start -p
     "$PORT"` (`PORT` defaults to 4019) in its own process group, and its
     EXIT trap kills that group so no `next-server` is left behind. Readiness
     is a silent loop of at most 60 × 1 s `curl -s -o /dev/null`.
  2. Remote mode: when `BASE_URL` is set (for example
     `https://otohime.dev`), skip build and start and walk that URL.
     `EXPECT_SHA` defaults to `GITHUB_SHA` locally. Remotely, if
     `EXPECT_SHA` is unset, any 40-hex `build-sha` counts.
  3. A `check <name> <command…>` helper runs every check, prints `ok -
     <name>` or `not ok - <name>: <detail>`, and the script ends with `walk:
     N ok, M failed` and exits 1 if M > 0. Count with `grep -c` (or
     `grep -o … | grep -c .`) and compare with `-eq`/`-ge`. Never use `wc -l`
     or a string compare of a count.
  4. The checks:
     - (local only) `.next/app-path-routes-manifest.json` lists `"/shore"`.
     - `/shore` returns 200 with `<title>Shore</title>`, at least three
       `class="glass`, no `aria-label="Main"`, and a `build-sha` meta equal
       to `EXPECT_SHA`. Its HTML has `aria-label="Dark scene"` and the text
       `Finish now`.
     - `/shore` links exactly one stylesheet under `/_next/static/`. That
       stylesheet is fetched with a 200 and a non-empty body, and contains none
       of `--tw-`, `tailwind` or `--color-paper`. A missing or empty stylesheet
       fails the check: a dry run against a dead port showed a bare "no match"
       grep passing vacuously.
     - `/projects` returns 200 with `aria-label="Main"` and exactly one
       `href="/shore"`.
     - `/`, `/work`, `/play`, `/notes` and `/music` return 200.
     - `/shore/nope` and `/nonexistent` return 404 with `Nothing in this
       parcel`.
  5. Add one line to the README: how to walk Shore locally (`bash
     scripts/walk-shore.sh`) and against production
     (`BASE_URL=https://otohime.dev bash scripts/walk-shore.sh`).
  6. Run it on this lease against main (1e171e8's code). It must exit 0.
     Commit with `GIT_AUTHOR_NAME=Otohime GIT_AUTHOR_EMAIL=quiinthieu@gmail.com
     GIT_COMMITTER_NAME=Otohime GIT_COMMITTER_EMAIL=quiinthieu@gmail.com git
     commit …`. Stop stray servers with `pkill -x next-server`, never
     `pkill -f "next start"`.
- **Interfaces:** `scripts/walk-shore.sh`; `README.md`
- **Non-goals:** any change under `app/`, `content/` or `e2e/`; CI workflow
  changes; walking production from the gate.
- **Acceptance:** `bash scripts/walk-shore.sh` builds, serves and walks Shore
  and the site on the delivery sha, prints one line per check and exits 0. It
  leaves no server on its port. Pointed at a URL where nothing listens, it
  exits non-zero.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `bash -n scripts/walk-shore.sh && ! grep -nE 'wc +-l' scripts/walk-shore.sh`
  - `bash scripts/walk-shore.sh`
  - `if curl -s -o /dev/null --max-time 2 http://localhost:4019/; then exit 1; fi`
    (no server left behind)
  - `if BASE_URL=http://127.0.0.1:4029 bash scripts/walk-shore.sh; then exit 1; fi`
    (the walk fails when Shore is not there)
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Prove Shore's buttons with unit tests on the actions they call

- **Role:** software_engineer, depends on 1. QA is required, because it
  touches `app/(shore)/_components/shore-app.tsx`.
- **Problem:** t-1052's browser acceptance line (Begin → Finish now → a
  pebble survives a reload; the dark scene sticks) could never be run here.
  The ledger changes those buttons make live inside `shore-app.tsx`
  (`washUp`, the scene setter, Clear today), where no test can reach them.
- **Action items:**
  1. Add pure `app/(shore)/_lib/actions.ts`:
     - `washUp(ledger, session): Ledger` mints the pebble for
       `dayNumber(session.startedAt)` with the next index of that day.
     - `withScene(ledger, scene): Ledger`.
     - `clearDay(ledger, now): Ledger` drops only `now`'s day.
     - `sceneClass(scene)` returns `"shore"` or `"shore dark-scene"`.
     It imports only `./ledger.ts`, `./pebbles.ts` and `./timer.ts`.
  2. `shore-app.tsx` calls these through its existing `update()` and uses
     `sceneClass` for the wrapper. No markup, copy or behaviour change.
  3. Add `app/(shore)/_lib/actions.test.ts` (node:test). It covers:
     - `begin(25, t)` then `washUp`, `serialize` and `normalizeLedger`
       (the reload), after which `today()` has one mint pebble with
       `seedFor(day, 0)`.
     - A second session the same day gets index 1 and a distinct seed.
     - 15 gives amber and 45 gives lilac.
     - `withScene(dark)` survives the reload, and `sceneClass` gives
       `"shore dark-scene"`.
     - `clearDay` keeps yesterday's pebbles.
     - Finishing the same session twice does not mint twice: either
       `washUp` is idempotent on `startedAt`, or the test pins the current
       guard. Pick one and record it.
  4. The isolation test still passes. Commit with the owner identity env,
     as in task 1.
- **Interfaces:** `app/(shore)/_lib/actions.ts`;
  `app/(shore)/_lib/actions.test.ts`; `app/(shore)/_components/shore-app.tsx`
- **Non-goals:** visual changes, new features, a browser test harness
  (Playwright or jsdom), persisting a running session across reload, and
  changes to `app/(site)/`.
- **Acceptance:** the action tests pass and drive Begin → Finish now →
  reload → one pebble, and dark scene → reload → dark. `shore-app.tsx`
  imports its ledger changes from `_lib/actions`. `bash
  scripts/walk-shore.sh` still exits 0 on the delivery sha.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test`
  - `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'app/(shore)/_lib/actions.test.ts' 'app/(shore)/_lib/isolation.test.ts'`
  - `grep -q '_lib/actions' 'app/(shore)/_components/shore-app.tsx' && ! grep -q 'mint(' 'app/(shore)/_components/shore-app.tsx'`
  - `bash scripts/walk-shore.sh`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA and acceptance

- **QA (task 2):**
  1. Rerun the verification on the delivery sha.
  2. Read `<meta name="build-sha">` on https://otohime.dev/. If it is the
     delivery sha or a descendant, run `BASE_URL=https://otohime.dev
     EXPECT_SHA=<that sha> bash scripts/walk-shore.sh`.
  3. If a headless browser works, attach light and dark scene screenshots of
     `/shore` and click through Begin → Finish now → reload. A missing
     browser is a note, not a fail.
  4. Do not fail for the `Co-Authored-By` trailer.
- **Acceptance:** if otohime.dev serves the final sha, walk it with
  `BASE_URL=https://otohime.dev EXPECT_SHA=<final sha> bash
  scripts/walk-shore.sh`. Then follow `/projects` → the Shore row → `/shore`
  → the "otohime.dev" link → `/`. Otherwise walk a local `bash
  scripts/walk-shore.sh` of the final sha, and pass with a watch on
  https://otohime.dev/shore: the same remote walk with `EXPECT_SHA` set to
  the final sha or a descendant, `not_before` one hour after the push.

## Risks

- **Port clash on the gate.** Port 4019 is the default. The script takes
  `PORT`, and a verification item checks that nothing is left listening.
- **Canvas support.** `ctx.filter` blur is missing in Safari < 18 and in
  jsdom. Shadows then render unblurred, and nothing breaks.
- **Stopping servers.** Use `pkill -x next-server`, never
  `pkill -f "next start"`, which kills the agent's shell.
- **`AGENTS.md` churn.** `next dev` re-adds its block. Leave it alone.

## Revision 2 tasks (history)

Task 1 (t-1051) and task 2 (t-1052) of revision 2 are kept below as they were
proposed. t-1052's code is the base the revision 3 tasks prove.

#### r2-1. Give the site its own route-group root layout

- **Role:** software_engineer
- **Problem:** `app/layout.tsx` is the only root layout, so every route inherits
  `globals.css`, Tailwind and the theme script. A page with its own design
  cannot exist until the site's layout moves into a route group.
- **Action items:**
  1. `git mv app/layout.tsx app/error.tsx app/not-found.tsx app/globals.css 'app/(home)' 'app/(app)' 'app/(auth)' 'app/(site)/'`.
     Leave `app/api/` and `app/icon.svg` at the root. Fix any relative import
     that breaks (imports use `@/`, so none are expected).
  2. Add `app/(site)/[...rest]/page.tsx`, which calls `notFound()` so unmatched
     URLs render `app/(site)/not-found.tsx` inside the site layout.
  3. `lib/build-stamp.test.ts` reads `app/(site)/layout.tsx` instead of
     `app/layout.tsx`.
  4. README layout block: `app/(site)/` is the whole site under one root
     layout; `app/` itself holds only `api/` and `icon.svg`; a page with its own
     design gets its own route group with a `layout.tsx`.
  5. Commit with `GIT_AUTHOR_NAME=Otohime GIT_AUTHOR_EMAIL=quiinthieu@gmail.com
     GIT_COMMITTER_NAME=Otohime GIT_COMMITTER_EMAIL=quiinthieu@gmail.com git commit …`
     (the job env sets Claude Code, which Vercel will not deploy).
- **Interfaces:** `app/(site)/`; `app/layout.tsx` (moved); `app/error.tsx`
  (moved); `app/not-found.tsx` (moved); `app/globals.css` (moved);
  `app/(site)/[...rest]/page.tsx`; `lib/build-stamp.test.ts`; `README.md`
- **Non-goals:** any visual or copy change; Shore; `experimental.globalNotFound`;
  touching `app/api/` or `proxy.ts`.
- **Acceptance:** every existing page answers as before (`/`, `/work`, `/play`,
  `/notes`, `/music`, `/projects` 200; sidebar on `/work`, not on `/`); an
  unmatched URL returns 404 with "Nothing in this parcel"; `build-sha` is still
  published; `app/layout.tsx` no longer exists.
- **Verification:** `npm ci`, lint, typecheck, unit tests; a production build
  and a `next start` walk of the routes above on port 4018; the delivery
  commit's author email is `quiinthieu@gmail.com`.

#### r2-2. Add Shore, a sea-glass focus timer in its own root layout

- **Role:** software_engineer, depends on 1
- **Problem:** The Projects bench is empty, and nothing on the site uses
  sea-glass. Shore needs a page whose design owes nothing to otohime's.
- **Action items:**
  1. Vendor `web/dist/sea-glass.mjs` from
     https://github.com/mttmcknn/sea-glass at db70d71 verbatim to
     `app/(shore)/_lib/sea-glass.mjs`, with a header comment naming the source
     URL and commit, plus `app/(shore)/_lib/LICENSE` (Apache-2.0). Write
     `app/(shore)/_lib/sea-glass.d.mts` (PALETTES, DEFAULT_SETTINGS,
     buildContour, contourSegments, seededRandom, mountGlass, Shape,
     PaletteName, Settings). Add the `.mjs` to `globalIgnores` in
     `eslint.config.mjs`.
  2. `app/(shore)/layout.tsx`: its own `<html lang="en">` and `<body>`,
     `import "./shore.css"`, metadata with title template `%s · Shore`,
     `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }` and theme colour
     `#f4f5f0`. `app/(shore)/shore.css` is hand-written from upstream
     `styles.css`: tokens, top bar, stage, captions, `.glass`, segmented
     control, icon actions, dark scene, reduced motion. No Tailwind.
  3. Pure TS in `app/(shore)/_lib/`: `timer.ts` (`remaining(now, session)` across
     start, pause, resume and clock skew), `ledger.ts` (`normalizeLedger`, the
     30-day cut, clamping), `pebbles.ts` (`seedFor(day, index)`,
     `paletteFor(minutes)`). Add `*.test.ts` beside each, plus a test that
     vendored `buildContour(72, 70, "disc", 0.025, seed)` is deterministic and
     stays in bounds.
  4. `app/(shore)/_lib/isolation.test.ts` fails if any file under
     `app/(shore)/` imports `globals.css`, `tailwindcss`, `@/components`,
     `@/content` or `@/lib`, or if any file under `app/(site)/`, `components/`
     or `lib/` imports `shore.css` or `(shore)`.
  5. Client components in `app/(shore)/_components/`: `glass.tsx` (mounts
     `mountGlass` in `useEffect`, destroys it on unmount, elevation −3 on
     pointerdown), `shore-app.tsx` (idle → running → paused → done, ledger,
     scene), `icons.tsx` (play, pause, reset, check, sun, moon from
     `app.mjs`). Server page `app/(shore)/shore/page.tsx` with metadata
     `title: { absolute: "Shore" }` (the template would otherwise give
     "Shore · Shore"). Parents of glass must not `overflow: hidden` (48 px glow gutter).
  6. `package.json` `test` adds `'app/(shore)/_lib/*.test.ts'` after
     `'lib/**/*.test.ts'`; the strip-types flags stay before `--test`.
     `lib/build-stamp.test.ts` also asserts that `app/(shore)/layout.tsx`
     publishes `build-sha`.
  7. `content/site.ts`: the first `projectList` entry is `{ title: "Shore",
     note: "A focus timer that leaves sea glass behind.", href: "/shore",
     status: "live", colour: "mint" }`. Drop "The bench is empty for now." from
     `site.projects` and keep the `TODO(otohime)` markers.
  8. `e2e/rbac.test.ts`: the Projects test expects the sidebar and a link to
     `/shore` instead of "Nothing on the bench yet"; a new test checks that
     `/shore` returns 200 without `aria-label="Main"`.
  9. README layout block: `app/(shore)/` is Shore, with its own root layout and
     CSS, and the sea-glass renderer vendored under Apache-2.0; the unit test
     glob covers it.
  10. Commit with the owner identity env, as in task 1.
- **Interfaces:** `app/(shore)/`; `content/site.ts`; `package.json`;
  `eslint.config.mjs`; `lib/build-stamp.test.ts`; `e2e/rbac.test.ts`;
  `README.md`
- **Non-goals:** persistence beyond localStorage, accounts, sync,
  notifications, sounds, the recipe inspector, and any change to how
  `app/(site)/` pages look.
- **Acceptance:** `/shore` returns 200 with title "Shore", at least three
  `class="glass` elements, no sidebar, `build-sha` published and exactly one
  stylesheet with no `--tw-`, `tailwind` or `--color-paper`. `/projects` links
  to `/shore` once. The site pages and the 404 are unchanged. The isolation
  test and the timer, ledger and pebble tests pass. In a browser, Begin → Finish
  now adds a pebble that survives a reload, and the dark scene toggles.
- **Verification:** `npm ci`, lint, typecheck, unit tests; a production build
  and a `next start` walk on port 4019 (markers above, plus the stylesheet
  check); the delivery commit's author email is `quiinthieu@gmail.com`.

