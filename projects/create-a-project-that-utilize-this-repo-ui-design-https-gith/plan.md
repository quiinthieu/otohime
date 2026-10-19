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
| CI's e2e test stops expecting the empty bench and expects the Shore row. | `e2e/rbac.test.ts` asserts "Nothing on the bench yet", and that step gates the production deploy. |

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

## Tasks

### 1. Give the site its own route-group root layout

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
  and a `next start` walk of the routes above on port 4018.

### 2. Add Shore, a sea-glass focus timer in its own root layout

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
     `app.mjs`). Server page `app/(shore)/shore/page.tsx` with metadata title
     "Shore". Parents of glass must not `overflow: hidden` (48 px glow gutter).
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
  check).

## QA and acceptance

- **QA (each task):** rerun the task's verification on the delivery sha. Then
  read `<meta name="build-sha">` on https://otohime.dev/ and walk production
  if it serves the delivery sha (or a descendant). For task 2, take light- and
  dark-scene screenshots of `/shore` with a headless browser (e.g. Chrome
  `--headless --screenshot`) and click through Begin → Finish now → reload. A
  missing browser is noted in the report, not a fail: the curl markers and
  unit tests stand.
- **Acceptance:** walk the plan on otohime.dev if it serves the final sha:
  `/shore` (timer, pebble, scene), `/projects` → Shore row → `/shore` →
  "otohime.dev" link → `/`, and `/nonexistent` → parcel page. If production
  lags, walk a local `next start` of the final sha and pass with a watch on
  https://otohime.dev/shore (`build-sha` = final sha or a descendant, 200, three
  or more `class="glass`), `not_before` one hour after the push.

## Risks

- **The move touches every route.** It is `git mv` only and the spike was
  green, but task 1's walk covers each public page and the 404.
- **Canvas support.** `ctx.filter` blur is missing in Safari < 18 and in
  jsdom: shadows render unblurred, nothing breaks. The canvas mounts in
  `useEffect`, so there is no hydration mismatch.
- **Performance.** Each piece shades a bitmap on mount and resize. Cap the
  visible shore at 12 pebbles per row and never animate recipe values.
- **Stopping servers.** Use `pkill -x next-server`, never
  `pkill -f "next start"` (it kills the agent's shell). The verification
  commands kill their own process group on exit.
- **`AGENTS.md` churn.** `next dev` re-adds its block; leave it alone.
