# Projects Bench — a public Projects page (pm-171)

Idea: "create a projects page where we will list independent projects in the
future". Research: [research.md](research.md) (rep-3331).

## Outcome

otohime.dev gets a sixth public page, `/projects`, for Otohime's independent
(side, not day-job) projects. It ships with no projects listed and an empty
state that still looks designed. Adding the first project later is a single
entry in `content/site.ts`, with no code change.

## Revision 2 (run-6132): why t-1018 failed and what changes

t-1018 delivered the page in e097b14. Its code is correct: green gates
ver-2267 and ver-2273, and in run-6006 the whole CI `checks` job passed locally,
e2e 9/9 included. It still failed QA three times, on two agent profiles, for
two reasons that are not about the page:

1. **Its acceptance needed production.** "CI is green on main" sent QA to
   otohime.dev. That site has served 6456dd7 since 2026-10-18 16:31Z. At
   2026-10-19 01:14Z, `/projects` was still 404 (edge age 24039) and `/` still
   showed the four-line console at -142. CI on main is stuck or failing in
   GitHub Actions, and nobody on the platform can read it or re-run it. The
   repo is private, otohime's `ci_token` is empty, and
   `deploy_detection=none`. Only a person can fix that (the existing chore
   `sign-in-required:ci-provider:quiinthieu-otohime`, see
   [fix_plan.md](fix_plan.md)).
2. **The green gate runs Node 22.12.** `npm test` runs `node --test` on `.ts`
   files. Node 22.12 cannot load them without `--experimental-strip-types`.
   CI's newer 22.x strips types by default. ver-2315 and ver-2322 failed every
   unit test, including the untouched ones, with `ERR_UNKNOWN_FILE_EXTENSION`.
   So every relaunch came back red without a code fault.

What the new task does differently:

- **It is accepted on a local production build of its delivery sha, not on
  otohime.dev.** `next start` serves the public pages with no database: this
  run checked that `/projects` returns 200 with the sidebar and "Nothing on the
  bench yet", and that `/` lists PROJECTS at -146. A verification item does
  exactly that, so the green gate proves the user-visible page itself.
- **It makes the test scripts pass on Node 22.12.** `test` and `test:e2e` get
  `--experimental-strip-types`. Newer 22.x accepts the flag as a no-op. Checked
  in this run on v22.12.0: 17/17 pass.
- **It stamps the build.** `next.config.ts` inlines `BUILD_SHA` (GitHub's
  `GITHUB_SHA` during CI's `vercel build`). The root layout renders it as
  `<meta name="build-sha" content="…">`. QA, acceptance and the watch then read
  the deployed commit instead of guessing it from cache ages and SVG
  baselines. Prototyped in this run and reverted: 3 lines, lint and typecheck
  green.
- **Production is a watch, not a gate.** Acceptance walks the local build and
  passes with a watch on https://otohime.dev/projects. The gap is recorded as a
  decision: this platform cannot prove "live on otohime.dev" until a person
  unsticks CI on main.
- `.github/workflows/ci.yml` is not changed. A blind edit cannot be observed,
  and it could break the deploy path that last worked. Pushing to main is
  allowed again. GitHub keeps at most one pending run per concurrency group,
  and a newer push replaces the older pending run, so pushes do not pile up.

## Decisions

| Decision | Why |
| --- | --- |
| The list is a typed array `site.projectList: Project[]` in `content/site.ts`. It starts empty. | Every public page reads its words from `content/site.ts` and ships through CI. A static list is the simplest option, is expand-only, and can be undone. A DB-backed list with admin CRUD would be a separate idea later. |
| `/projects` goes after Music as the sixth public page, `FigTitle n="06"`. | The sidebar prints "Fig. NN" by list position. Adding the page at the end keeps those numbers and the pages' hard-coded figure numbers in step. |
| The signed-in pages are renumbered: Dashboard 07, Account 08, Users 09 (list and detail), Roles 10. | Figure numbers stay unique and in order. The change is cosmetic (`aria-hidden`) and costs little. |
| The public page list moves to `lib/pages.ts`, and the sidebar (`app/(app)/layout.tsx`) and the pocket console (`components/handheld.tsx`) both import it. | With one list, the console menu and the sidebar cannot drift apart. It also lets a unit test read the list. |
| The console menu geometry (`PITCH = 10`, first baseline `-146`) and the LCD rectangle (`y=-158, h=56`) are exported from `lib/pages.ts`, and a unit test checks that every menu line fits inside the LCD. | At the current pitch of 12 from -142, a fifth line lands at -94, below the LCD's bottom edge at -102. A unit test proves the fix now, with no browser screenshot. |
| E2E: `/projects` is added to the public-pages assertion and checked for the sidebar. CI's e2e job proves it on push, not the task gate. | The e2e suite needs Postgres and waits out auth rate limits. CI already runs it on every push to main. |
| Revision 2: the page is accepted on a local `next start` of the delivery sha. Being live on otohime.dev is an acceptance watch. | Production is stuck behind GitHub Actions, which nobody on the platform can read or re-run. Local `next start` serves the public pages with no database, so the page can be proven now. |
| Revision 2: `test` and `test:e2e` pass `--experimental-strip-types`. | The green gate's Node 22.12 cannot load `.ts` tests without it. CI's newer 22.x ignores it. |
| Revision 2: `<meta name="build-sha">` from `next.config.ts` `env.BUILD_SHA` (`GITHUB_SHA`, then `VERCEL_GIT_COMMIT_SHA`, else `dev`). | The deployed commit becomes readable from any page with one curl. No database, no secret, and 3 lines to undo. |
| Revision 2: `.github/workflows/ci.yml` is not changed. | Nobody can observe a CI edit, and the deploy path last worked on 6456dd7. Unsticking CI is the person's chore. |

## Not in scope

- A database table, migration or admin screen for projects.
- Per-project detail pages (`/projects/[slug]`). Rows link out instead.
- A new inked figure for the page. The empty state reuses `Notice` with the
  existing `parcel` figure.
- Real project entries. The array ships empty, and the intro line carries
  `TODO(otohime)`.

## Tasks

### Done in revision 1: Add a public Projects page (t-1018, delivered in e097b14)

Kept as is. The text below is the original contract, for reference. It is not
re-proposed.

**Problem.** The site has nowhere to list independent projects. The console
menu and the sidebar each keep their own copy of the public pages. The console's
LCD has room for only four menu lines.

**Action items.**

1. `content/site.ts`: add
   `export type Project = { title: string; note: string; href?: string; status: "building" | "live" | "shelved"; colour: Swatch }`,
   a `projects` intro string marked `TODO(otohime)` that says these are
   independent, own-time projects, and `projectList: [] as Project[]`.
2. `lib/pages.ts` (new, pure TS, no React or `@/` imports at runtime): export
   - `PUBLIC_PAGES` = Home `/`, Work, Play, Notes, Music, Projects `/projects`,
   - `CONSOLE_MENU` = `PUBLIC_PAGES` without Home,
   - `LCD = { y: -158, h: 56 }`, `MENU_PITCH = 10`, and
     `menuBaseline(i) = -146 + i * MENU_PITCH`.
   Type the hrefs so that typed routes still typecheck in `Link`. If `Route`
   typing from `next` gets in the way, cast at the call site.
3. `app/(app)/projects/page.tsx` (new): `metadata.title = "Projects"`, then
   `ViewTransition` → `div.rise` → `FigTitle n="06"` → a muted intro from
   `site.projects` → either an empty-state `Notice` (`heading="h2"`,
   `figure="parcel"`, a title such as "Nothing on the bench yet") or, when
   the list is non-empty, a `<ul>` in the Play/Music listing style: swatch
   dot, title (linked when `href` is set), note, and status as a badge. Build
   the page file before wiring the links (typed routes).
4. `app/(app)/layout.tsx`: build `PUBLIC` from `PUBLIC_PAGES`.
   `components/handheld.tsx`: build `MENU` from `CONSOLE_MENU` and use
   `menuBaseline`/`MENU_PITCH`/`LCD` in place of the local constants.
5. Renumber the `FigTitle n` values on the signed-in pages: Dashboard 07, Account 08,
   Users list and Users detail 09, Roles 10.
6. `lib/pages.test.ts` (new): `/projects` is the sixth public page; the
   console menu is the public pages minus Home, in the same order; every
   `menuBaseline(i)` for `i < CONSOLE_MENU.length` lies within
   `[LCD.y + 8, LCD.y + LCD.h - 3]` (8.5px font: cap height below the top,
   descenders above the bottom); `site.projectList` is an array and
   `site.projects` is a non-empty string (import `../content/site.ts`; its
   `Swatch` import is type-only and is stripped).
7. `e2e/rbac.test.ts`: add `/projects` to "the public pages are open to
   everyone", and assert that `/projects` HTML has `aria-label="Main"` and the
   empty-state heading.
8. `README.md`: one line saying that the public pages are listed in `lib/pages.ts`
   and that projects are added as entries in `site.projectList` in `content/site.ts`.
9. Do not commit the `AGENTS.md` block that `next dev` re-adds.

**Interfaces.** `README.md`; `content/site.ts`; `lib/pages.ts`; `lib/pages.test.ts`;
`app/(app)/projects/page.tsx`; `app/(app)/layout.tsx`;
`components/handheld.tsx`; `app/(app)/dashboard/page.tsx`;
`app/(app)/account/page.tsx`; `app/(app)/admin/users/page.tsx`;
`app/(app)/admin/users/[id]/page.tsx`; `app/(app)/admin/roles/page.tsx`;
`e2e/rbac.test.ts`.

**Verification.**

- `npm ci && npm run lint && npm run typecheck`
- `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/pages.test.ts`
- `npm test` (the whole unit suite, including the unchanged machine tests)
- `npm run build` with the CI placeholder env (it needs no running database;
  checked on 6456dd7), then `grep -q '"/projects"' .next/app-path-routes-manifest.json`.

**Acceptance.** The public pages `/projects` returns 200 without a session. It
renders inside the sidebar layout, with the heading "Projects", Fig. 06, and the
empty-state notice. The sidebar lists Projects sixth. The console on `/` shows five
menu lines (Work, Play, Notes, Music, Projects), all inside the LCD, and pressing A
on Projects opens `/projects`. The signed-in pages read Fig. 07–10. CI is green on
main, including e2e. *(Revision 2 removed the production half of this line from
acceptance, as explained above.)*

### 1. Projects page: gate-proof tests and build stamp (software_engineer, revision 2)

**Problem.** The Projects page is on main (e097b14), but nothing proves it on
this platform. The green gate's Node 22.12 cannot run the `.ts` unit tests.
Production is stuck on 6456dd7. Nobody can read which commit otohime.dev
serves, so QA has been guessing from cache ages and SVG baselines.

**Action items.**

1. `package.json`: in `test` and `test:e2e`, add `--experimental-strip-types
   --disable-warning=ExperimentalWarning` before `--test`. Keep the existing
   `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.
2. `next.config.ts`: add `env: { BUILD_SHA: process.env.GITHUB_SHA ??
   process.env.VERCEL_GIT_COMMIT_SHA ?? "dev" }`, with a one-line comment.
3. `app/layout.tsx`: add `other: { "build-sha": process.env.BUILD_SHA ?? "dev" }`
   to the root `metadata`, so every page renders
   `<meta name="build-sha" content="<sha>">`.
4. `README.md`: one line in the deploy section. It says that
   `<meta name="build-sha">` on any page names the commit that is live.
5. Do not change the Projects page, `lib/pages.ts` or `.github/workflows/ci.yml`.
   If a verification item fails on the page, fix the page within the
   revision-1 interfaces and say so in the report.
6. Do not commit the `AGENTS.md` block that `next dev` re-adds.

**Interfaces.** `package.json`; `next.config.ts`; `app/layout.tsx`; `README.md`.

**Non-goals.** Changing CI or its concurrency, secrets or runners; a deploy
path outside CI; reading GitHub Actions; DB-backed projects; new page content.

**Verification** (all inside the checkout. The last item starts `next start`
on port 4017 and stops it again):

- `npm ci --no-audit --no-fund && npm run lint && npm run typecheck`
- `npm test` (this fails today on Node 22.12, which makes it the red gate)
- `node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/pages.test.ts`
- Local production build and page check. It needs no database. The
  `build-sha` greps fail on today's main, which makes it the red gate:

  ```sh
  bash -c 'set -em; export BETTER_AUTH_SECRET=ci-placeholder-not-a-real-secret-0123456789abcdef BETTER_AUTH_URL=http://localhost:4017 DATABASE_URL=postgresql://otohime:otohime@localhost:5432/otohime GITHUB_SHA=0123456789abcdef0123456789abcdef01234567; d=$(mktemp -d); npm run build >"$d/build.log"; grep -q "\"/projects\"" .next/app-path-routes-manifest.json; ./node_modules/.bin/next start -p 4017 >"$d/start.log" 2>&1 & pid=$!; trap "kill -- -$pid" EXIT; curl -fsS --retry 30 --retry-connrefused --retry-delay 1 -o "$d/projects.html" http://localhost:4017/projects; curl -fsS -o "$d/home.html" http://localhost:4017/; grep -q "Nothing on the bench yet" "$d/projects.html"; grep -q "aria-label=\"Main\"" "$d/projects.html"; grep -q PROJECTS "$d/home.html"; grep -q "y=\"-146\"" "$d/home.html"; grep -Eq "name=\"build-sha\"[^>]*content=\"$GITHUB_SHA\"" "$d/projects.html"; grep -Eq "name=\"build-sha\"[^>]*content=\"$GITHUB_SHA\"" "$d/home.html"'
  ```

**Acceptance.** On a local production build of the delivery sha (`next start`),
signed out: `/projects` returns 200 inside the sidebar layout, with the h1
"Projects", Fig. 06 and "Nothing on the bench yet". The sidebar lists Projects
sixth. `/` shows the console with five menu lines from -146 (WORK … PROJECTS),
and A on PROJECTS opens `/projects`. Every page carries
`<meta name="build-sha">` with the commit the build was made from. `npm test`
passes on Node 22.12. otohime.dev is **not** a criterion for this task. QA
works on the local build, as run-6006 did, and the deployed site belongs to the
acceptance watch below.

## Production, outside the gate

- The chore stays with a person, under the existing fingerprint
  `sign-in-required:ci-provider:quiinthieu-otohime` (steps in
  [fix_plan.md](fix_plan.md)): open GitHub Actions for main, cancel the stuck
  run, re-run the newest main run, and rotate `VERCEL_TOKEN` or
  `DATABASE_URL_UNPOOLED` if a production step is red on auth. Its ready probe
  is unchanged. No task waits on it.
- Lasting fix, also a person's: an `actions:read` token for quiinthieu/otohime,
  bound as otohime's `ci_token` with `deploy_detection=workflow-success`.
- Acceptance passes on the local walk with a **watch**, `not_before` one hour
  after the pass. The watch passes when https://otohime.dev/projects returns
  200 with "Nothing on the bench yet" and its `<meta name="build-sha">` names
  a commit that contains e097b14 (`git merge-base --is-ancestor e097b14
  <sha>`). Broken means a 404, or a `build-sha` missing or older than the
  delivery.

## Acceptance walk

Walked on a local `next start` build of the delivery sha (production is the watch).

| Starting state | Action | Observable result |
| --- | --- | --- |
| Signed out | Open `/projects` | 200; sidebar; "Projects" h1, Fig. 06; empty-state notice |
| Signed out | View source of any page | `<meta name="build-sha" content="<delivery sha>">` (with `GITHUB_SHA` set at build) |
| Node 22.12 checkout | `npm test` | All unit tests pass |
| Signed out | Open `/` and scroll the console menu | Five lines inside the LCD; A on Projects opens `/projects` |
| Signed in | Open Dashboard, Account, Admin users, Roles | Figure numbers 07, 08, 09, 10 |
| Repo | Add one entry to `site.projectList` locally | Row renders with dot, title, note and status. No code change is needed |
