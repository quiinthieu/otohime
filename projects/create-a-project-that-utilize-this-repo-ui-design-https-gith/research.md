# Research: a sea-glass project on otohime.dev (pm-181)

Submitted by research run-6195 as report rep-3469 (body), committed here by the
product owner (run-6206).

Idea: "Create a project that utilize this repo UI design: https://github.com/mttmcknn/sea-glass.
This project should act like a separate component that is not impacted by the otohime app's
current design. You're free to choose the project's idea, features."

## Recommendation

Build **Shore**, a focus timer at `/shore` whose finished sessions become sea-glass pebbles on a
shoreline. It lives in its own Next.js **root layout** (`app/(shore)/`), ships its own stylesheet
and the vendored sea-glass canvas renderer, and never imports `globals.css`, Tailwind, the
masthead, the sidebar or the figures. It keeps its ledger in `localStorage`: no table, no
migration, no auth, no API. It becomes the first entry in `site.projectList`, so the empty
bench on `/projects` (pm-171) finally has something on it.

The isolation design was proven in this run with a build spike in a throwaway worktree on
Next 16.4.2: lint, typecheck and `next build` green; `/shore` serves one stylesheet with zero
Tailwind rules and no `aria-label="Main"`; every existing route still answers; unmatched URLs
still get the site's "Nothing in this parcel" page. One software-engineer task is enough.

## What sea-glass is (repo at db70d71, 2026-10-18)

- A **Jetpack Compose / Compose Multiplatform library** (Kotlin, Gradle, JDK 17, Maven Central
  `dev.mttmcknn:sea-glass:0.1.0`). Nothing in the Kotlin side is usable from a web app.
- Its "UI design" comes from the original **web playground**, whose source is vendored unchanged
  in `web/dist/`: `sea-glass.mjs` (27.6 KB, the material renderer), `styles.css` (20 KB, the
  page design), `state.mjs` (recipes), `app.mjs` (playground wiring), `index.html`. Docs call
  `web/dist/sea-glass.mjs` "the visual source of truth".
- **Licence: Apache-2.0** (author mttmcknn). Vendoring requires keeping the licence notice;
  there is no NOTICE file upstream, so a copy of `LICENSE` plus a header comment naming the
  source commit is enough.
- `sea-glass.mjs` is a dependency-free ES module. Exports: `PALETTES`, `DEFAULT_SETTINGS`,
  `seededRandom`, `buildContour`, `contourSegments` (pure, run under Node) and
  `mountGlass(element, {shape, palette, seed, settings})` which prepends an `aria-hidden`
  `<canvas>` (`z-index:-1`, 48 px gutter on every side), redraws on `ResizeObserver`, sets
  `--glass-ink` on the element, and returns `{update, destroy}`. It needs `document`, `Path2D`,
  `ctx.filter` (blur) and `requestAnimationFrame`, so it is client-only.
- Upstream `web/tests` (9 tests, `node --test`) pass on this pod's Node v22.23.3. A test that
  imports the vendored `.mjs` from a `.ts` test file also passes under `--experimental-strip-types`.

### The design language (from `styles.css` and `index.html`)

| Token | Value |
| --- | --- |
| paper / stage | `#f4f5f0` / `#edf0ea` (preview shell: radial `#fbfcf7 → #edf0e9`) |
| ink / muted / line / accent | `#253d36` / `#5d7064` / `#dce2da` / `#416a59` |
| dark scene | radial `#344a46 → #233735`, border `#3c5047`, captions `#a8b9a7` |
| serif (display) | Georgia, "Times New Roman"; h1 `clamp(34px,3.3vw,49px)` weight 400, `-1.6px` tracking, `em` in `#71867a` |
| sans (UI) | Inter, system; body copy 11–12 px; eyebrows 8–9 px, `1.4–1.8px` letter-spacing, 600 |
| captions | `01 / THE ORIGINAL FEEL` style: two-sided flex, 8 px, letter-spaced, `#8e9c8f` |
| stage notes | italic serif 13 px, `#667c68`, centred |
| cards | 1 px `--line` border, radius 11–16 px, near-white `#fafbf7` fills, soft `#36503907` shadows |
| focus ring | `2px solid #477f70`, offset 5 px (8 px on glass) |
| press | `.glass:active { transform: translateY(2px) }` and elevation −3 while pressed |
| palettes | lagoon `#B5D0EB/#D6E9FF/#2F647C`, lilac `#E1CDE8/#FBE8F7/#71388B`, rose `#EECED6/#FFF0F1/#963F59`, amber `#F0D9BE/#FFFCE0/#865733`, mint `#C0DED0/#E6FFF0/#396C5A` (body/edge/ink) |
| recipes | reference `{frost .55, grain .48, tumble .025, thickness 6, bulge .65, elevation 8, light 315, transmission .58}`, tumbled, quiet |
| shapes | `rounded` (corner radius 0.46 × short side), `capsule`, `disc`; sizes used: 270×88 button, 450×82 toolbar, 72×70 pebble, 185×46 segmented, 58×31 switch |

Everything about this clashes with otohime (warm paper `#f2efe7`, 13 px monospace, inked
isometric figures, "Fig. NN"), which is exactly why the project must not share a layout.

## What is there today (otohime, main at 7f63d87)

- Next 16.4.2 app router, React 19.3, Tailwind 4 via Turbopack loader, Better Auth + Drizzle,
  `cacheComponents`, `authInterrupts`, typed routes. Node 22.x; tests are `node --test` over
  `lib/**/*.test.ts` with `--experimental-strip-types`.
- **One root layout** `app/layout.tsx`: imports `globals.css` (Tailwind preflight + the paper/ink
  tokens + 13 px mono body), pins the theme with an inline script, publishes
  `<meta name="build-sha">`. Groups `(home)`, `(app)` (sidebar), `(auth)`; `app/error.tsx`,
  `app/not-found.tsx`, `app/icon.svg`, `app/api/*`.
- `/projects` (pm-171) renders `site.projectList: Project[]` from `content/site.ts`
  (`{title, note, href?, status: building|live|shelved, colour: Swatch}`), currently empty with
  the "Nothing on the bench yet" notice. Rows link with a plain `<a href>`, which is right for a
  link into another root layout (that is a full page load by design).
- `proxy.ts` matches only `/dashboard`, `/account`, `/admin/*`: a new public route needs no change.
- `lib/build-stamp.test.ts` reads `app/layout.tsx` by path. `e2e/rbac.test.ts` lists the public
  pages and asserts `/` has no sidebar.
- Production: otohime.dev still serves 6456dd7 behind a stuck GitHub Actions run (pm-180 QA,
  `sign-in-required:ci-provider:quiinthieu-otohime`). Acceptance for this plan must walk a local
  `next start` of the delivery sha, like pm-171 revision 2, with production as a watch.
  (Product owner note, run-6206: by 2026-10-19 otohime.dev serves 7147cf8, so deploys flow
  again; the plan keeps the local walk as the fallback.)
- There is no plan document for pm-181 in the repo (the job header's path does not exist here).

## Architecture: a second root layout (proven)

Next 16.4 docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`,
`layout.md#root-layout`): "To create multiple root layouts, remove the top-level `layout.js`
file, and add a `layout.js` file inside each route group." Navigation between root layouts is a
full page load; routes in different groups must not share a URL.

Spike (worktree, same deps, `npm run typecheck && npm run lint && npm run build` then `next start`):

| Probe | Result |
| --- | --- |
| `git mv app/{layout,error,not-found}.tsx app/globals.css 'app/(home)' 'app/(app)' 'app/(auth)' 'app/(site)/'` | typecheck, lint, build green; `app/api/*` and `app/icon.svg` stay at the root and still build (`/icon.svg` 200) |
| `app/(shore)/layout.tsx` with its own `<html>/<body>` and `import "./shore.css"` | `/shore` 200, `<title>Shore</title>`, one stylesheet, `grep -c 'tailwind\|--color-paper\|--tw-'` on it = 0, no `aria-label="Main"` |
| `/`, `/projects`, `/work`… | 200, unchanged markup, `build-sha` meta present |
| unmatched URL with no top-level layout | **regression**: Next's default "404: This page could not be found." |
| fix A: `app/(site)/[...rest]/page.tsx` calling `notFound()` | `/nonexistent` and `/shore/nope` 404 with `<title>Not found · Otohime</title>` rendered by `(site)/not-found.tsx` inside the site root layout; no experimental flag; the catch-all sits outside `(app)` so no sidebar and no session read |
| fix B: `experimental.globalNotFound: true` + `app/global-not-found.tsx` (own `<html>`, imports `./(site)/globals.css`, theme script, `Notice`) | same 404s, parcel page with site CSS and `build-sha` meta; flag is marked experimental in the docs |
| vendored `.mjs` imported from TSX | `allowJs` makes TypeScript read the `.mjs` itself, so a sibling `sea-glass.d.ts` is ignored (TS2305); name it **`sea-glass.d.mts`** and the import typechecks |
| eslint on the vendored file | 3 `no-unused-vars` warnings, 0 errors (`npm run lint` exits 0); add it to `globalIgnores` to keep lint silent |
| `node --test 'lib/**/*.test.ts' 'app/(shore)/_lib/*.test.ts'` | the parenthesised route-group path is a literal in Node's glob; 22 tests ran |
| `lib/build-stamp.test.ts` after the move | **fails** with ENOENT on `app/layout.tsx`; it must read `app/(site)/layout.tsx` (and should also read the shore layout) |
| `/shore` build stamp | absent until the shore layout sets `metadata.other["build-sha"]` too |

Recommend fix A (catch-all) as the default and fix B as the fallback if the catch-all ever
collides with a wanted dynamic route.

Rejected: (1) scoped CSS under one root layout: `globals.css` `@layer base` sets `body` font,
colour and background and Tailwind preflight resets everything, so "not impacted" is
unreachable. (2) A static sub-site in `public/shore/` with a rewrite: fully isolated, but
outside lint, typecheck, typed routes and the unit suite, and `public/` has no index-file
serving without a `rewrites()` entry.

## The project: Shore

A quiet single page. Pick a length, begin, and when the timer ends a piece of sea glass is
added to today's shore. Each pebble has a stable seed, so the same session always tumbles the
same way, and the row is a record of the day.

### Features (v1)

1. **Timer.** Lengths 15 / 25 / 45 min in a lilac capsule *segmented* control. A lagoon
   *rounded* 270×88 "Begin" button (becomes "Pause" / "Resume"), a lilac capsule mini-toolbar
   with reset and skip-to-done icon actions. The countdown is serif display type, `aria-live`
   polite status, `document.title` shows `mm:ss · Shore` while running. Timing is wall-clock
   (`startedAt`, `pausedMs`), not an interval counter, so a backgrounded tab stays correct.
2. **Pebbles.** Finishing mints `{startedAt, minutes, palette, seed}`. Palette by length (amber
   15, mint 25, lilac 45), `seed = dayNumber * 101 + indexOfDay` so a day re-renders
   identically. Today's shore is a row of 72×70 *disc* glass pieces with a tally line
   ("3 pieces · 1 h 25 min"), wrapping after 12; days are kept for 30 days.
3. **Scene.** Light / dark scene toggle (the upstream `dark-scene` pair), remembered in the
   ledger; `prefers-reduced-motion` disables the 2 px press offset transitions.
4. **Ledger.** `localStorage["shore-v1"]`, read through a `normalizeLedger()` that clamps and
   drops junk the way upstream `normalizeRecipe` does. "Clear today" is the only destructive
   action, confirmed inline.
5. **Back link.** A plain `<a href="/">otohime.dev</a>` in the top bar; the Projects row links
   to `/shore`. Both are full-page loads across root layouts, which is what the docs prescribe.

Not in v1: accounts or sync, push notifications, sounds, per-session notes, a recipe inspector
(the upstream sliders). Any of these is a later idea.

### File layout

```
app/(site)/layout.tsx            moved root layout for the whole existing site (+ error, not-found, globals.css, (home), (app), (auth))
app/(site)/[...rest]/page.tsx    notFound() for unmatched URLs (fix A)
app/(shore)/layout.tsx           second root layout: <html lang>, <body>, import "./shore.css", metadata {title template "%s · Shore", build-sha, themeColor #f4f5f0}
app/(shore)/shore.css            hand-written from upstream styles.css: tokens, topbar, stage, captions, .glass, segmented, icon-action, dark-scene, reduced-motion
app/(shore)/shore/page.tsx       server page: metadata, static chrome, <ShoreApp/>
app/(shore)/_components/glass.tsx       "use client"; mounts mountGlass in useEffect, destroy on unmount, elevation −3 on pointerdown like upstream
app/(shore)/_components/shore-app.tsx   "use client"; state machine idle→running→paused→done, ledger, scene
app/(shore)/_components/icons.tsx       the handful of 24-grid stroke icons the page uses (play, pause, reset, check, sun, moon), ported from app.mjs paths
app/(shore)/_lib/sea-glass.mjs          vendored verbatim from sea-glass@db70d71 web/dist, header comment with source URL + commit
app/(shore)/_lib/sea-glass.d.mts        hand-written types (PALETTES, buildContour, mountGlass, Settings, Shape, PaletteName)
app/(shore)/_lib/LICENSE                Apache-2.0 copy
app/(shore)/_lib/timer.ts, ledger.ts, pebbles.ts   pure TS: remaining(now, session), normalizeLedger, seedFor(day, index), paletteFor(minutes)
app/(shore)/_lib/*.test.ts              node:test for the above + geometry determinism of the vendored module
```

Underscore folders are private (not routable). Everything the project owns is under
`app/(shore)/`; the only edits outside it are the moves, the catch-all, `content/site.ts`,
`package.json` test glob, `eslint.config.mjs` ignore, `lib/build-stamp.test.ts`, `e2e/rbac.test.ts`,
`README.md`.

### Wiring

1. `package.json` `test`: `--test 'lib/**/*.test.ts' 'app/(shore)/_lib/*.test.ts'` (keep the
   strip-types flags before `--test`; `lib/build-stamp.test.ts` asserts their order).
2. `eslint.config.mjs`: add `"app/(shore)/_lib/sea-glass.mjs"` to `globalIgnores`.
3. `lib/build-stamp.test.ts`: read `app/(site)/layout.tsx` and `app/(shore)/layout.tsx`, assert
   both publish `build-sha`.
4. `content/site.ts`: first project `{ title: "Shore", note: "A focus timer that leaves sea glass behind.", href: "/shore", status: "live", colour: "mint" }`
   and drop "The bench is empty for now." from `site.projects` (keep `TODO(otohime)`).
5. `e2e/rbac.test.ts`: `/shore` returns 200 without the sidebar; `/nonexistent` returns 404
   with `Not found · Otohime` in the title. Leave the public-pages list alone: `/shore` is not a
   sidebar page.
6. `README.md` layout block: `app/(site)/` (the site, one root layout) and `app/(shore)/` (Shore,
   its own root layout and CSS, sea-glass renderer vendored under Apache-2.0); note that the
   test glob covers both.

### Tests

- Unit (`npm test`): `remaining()` across start/pause/resume and clock skew; `normalizeLedger`
  rejects bad JSON, clamps minutes to {15,25,45}, drops entries older than 30 days;
  `seedFor` is deterministic and distinct per index; `paletteFor` mapping; vendored
  `buildContour(72,70,"disc",.025,seed)` deterministic and inside bounds (mirrors upstream).
- Build-time: `grep -q '"/shore"' .next/app-path-routes-manifest.json`.
- Walk on `next start` (no database needed for `/shore`, `/`, `/projects`, 404s): status codes
  and markers as in the spike table above, plus `curl -s …/shore | grep -c 'class="glass'` ≥ 3
  and `curl …/projects | grep -c 'href="/shore"'` = 1.
- Browser: a screenshot of `/shore` in light and dark scene showing rendered glass (canvas work
  cannot be asserted from curl or jsdom). This is a QA step, not a gate.

### Verification lines for the build contract

- `npm ci && npm run lint && npm run typecheck && npm test`
- `npm run build` with the CI placeholder env; `grep -q '"/shore"' .next/app-path-routes-manifest.json`
- `next start -p 4012`; then `curl -s -o /dev/null -w '%{http_code}' localhost:4012/shore` = 200,
  `curl -s localhost:4012/shore | grep -c 'aria-label="Main"'` = 0,
  `curl -s localhost:4012/projects | grep -c 'href="/shore"'` = 1,
  `curl -s -o /dev/null -w '%{http_code}' localhost:4012/nonexistent` = 404 and its HTML contains `Not found · Otohime`,
  `/`, `/work`, `/projects` = 200 with `aria-label="Main"` on `/work`.
- The stylesheet linked from `/shore` contains no `--tw-` or `--color-paper`.
- Stop the server with `pkill -x next-server` (see lesson below) and confirm `pgrep -x next-server` is empty before the next probe.

## Risks and gotchas

- **Moving the root layout touches every route.** It is `git mv` only (imports use `@/`), but
  the `LayoutProps<"/">` type, `./globals.css` relative import and `app/icon.svg` all keep
  working only if the files move together into `(site)` and `icon.svg`, `api/` stay at the root.
  Proven in the spike; still, run the full walk.
- **404s change shape.** Without the catch-all (or `global-not-found`), unmatched URLs lose the
  parcel page. Ship fix A in the same commit.
- **`.d.ts` beside `.mjs` is ignored** under `allowJs`; use `.d.mts`.
- **Canvas features.** `ctx.filter` blur is missing in Safari before 18 and in jsdom: shadows
  render unblurred, nothing breaks. SSR renders the button markup; the canvas mounts in
  `useEffect`, so there is no hydration mismatch (spike HTML had `class="glass"` server-side).
- **Glow gutter.** The renderer draws 48 px outside the element; parents must not `overflow:hidden`
  and the shore row needs padding, or pebbles clip.
- **Seeds.** Keep a piece's seed stable across re-renders and distinct between neighbours
  (upstream rule), or every pebble looks the same and flickers on update.
- **Performance.** Each piece shades a bitmap on mount and on resize (CPU). The playground runs
  ~20 pieces; cap the visible shore at 12 pebbles per day and never animate recipe values.
- **AGENTS.md churn.** `next dev` re-adds its block; do not commit it.
- **Node 22.12 gate.** The strip-types flags already cover `.ts` tests; the `.mjs` import needs
  nothing extra (checked on 22.23; 22.12 loads `.mjs` natively).
- **Production is stuck** behind GitHub Actions (pm-180). Accept on a local `next start` of the
  delivery sha and watch otohime.dev, as pm-171 revision 2 did.

## Out of scope, noted for the product owner

- A recipe inspector (sliders, pin/compare, copy recipe) like the upstream playground.
- Persisting sessions to Postgres for signed-in users (would need an expand-only migration and
  a tiny API; the ledger shape is ready for it).
- Re-skinning any otohime page with sea glass. The brief says the opposite.
- Porting `styles.css` wholesale. Take the tokens and the components the page uses; the rest of
  the 20 KB is playground chrome.

## Suggested task split

One SWE task: "Add Shore, a sea-glass focus timer in its own root layout" with the wiring and
verification lines above. The quality-engineer pass is the local walk plus two screenshots
(light and dark scene). Acceptance passes on the local build with a watch on
`https://otohime.dev/shore`.

## Decisions recorded this run

- approach_chosen: second root layout via route groups, proven by a build spike in a worktree.
- approach_chosen: the project is Shore, a localStorage focus timer that mints pebbles, listed
  as the first `site.projectList` entry.
- lesson (global): `pkill -f "next start"` kills the agent's own shell and leaves the server up;
  use `pkill -x next-server` and check `pgrep` before probing.

## Assumptions

- "Utilize this repo UI design" means the web playground's look and material, not the Kotlin
  library; the Kotlin side has no web artefact.
- The site owner is fine vendoring Apache-2.0 code with its licence file; the repo has no
  licence of its own.
- The project copy is a first draft and should carry `TODO(otohime)` like the rest of
  `content/site.ts`.
