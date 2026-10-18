# Projects Bench — a public Projects page (pm-171)

Idea: "create a projects page where we will list independent projects in the
future". Research: [research.md](research.md) (rep-3331).

## Outcome

otohime.dev gets a sixth public page, `/projects`, for Otohime's independent
(side, not day-job) projects. It ships with no projects listed and an empty
state that still looks designed. Adding the first project later is a single
entry in `content/site.ts`, with no code change.

## Decisions

| Decision | Why |
| --- | --- |
| The list is a typed array `site.projectList: Project[]` in `content/site.ts`. It starts empty. | Every public page reads its words from `content/site.ts` and ships through CI. A static list is the simplest option, is expand-only, and can be undone. A DB-backed list with admin CRUD would be a separate idea later. |
| `/projects` goes after Music as the sixth public page, `FigTitle n="06"`. | The sidebar prints "Fig. NN" by list position. Adding the page at the end keeps those numbers and the pages' hard-coded figure numbers in step. |
| The signed-in pages are renumbered: Dashboard 07, Account 08, Users 09 (list and detail), Roles 10. | Figure numbers stay unique and in order. The change is cosmetic (`aria-hidden`) and costs little. |
| The public page list moves to `lib/pages.ts`, and the sidebar (`app/(app)/layout.tsx`) and the pocket console (`components/handheld.tsx`) both import it. | With one list, the console menu and the sidebar cannot drift apart. It also lets a unit test read the list. |
| The console menu geometry (`PITCH = 10`, first baseline `-146`) and the LCD rectangle (`y=-158, h=56`) are exported from `lib/pages.ts`, and a unit test checks that every menu line fits inside the LCD. | At the current pitch of 12 from -142, a fifth line lands at -94, below the LCD's bottom edge at -102. A unit test proves the fix now, with no browser screenshot. |
| E2E: `/projects` is added to the public-pages assertion and checked for the sidebar. CI's e2e job proves it on push, not the task gate. | The e2e suite needs Postgres and waits out auth rate limits. CI already runs it on every push to main. |

## Not in scope

- A database table, migration or admin screen for projects.
- Per-project detail pages (`/projects/[slug]`). Rows link out instead.
- A new inked figure for the page. The empty state reuses `Notice` with the
  existing `parcel` figure.
- Real project entries. The array ships empty, and the intro line carries
  `TODO(otohime)`.

## Tasks

### 1. Add a public Projects page (software_engineer)

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
main, including e2e.

## Acceptance walk

| Starting state | Action | Observable result |
| --- | --- | --- |
| Signed out | Open `/projects` | 200; sidebar; "Projects" h1, Fig. 06; empty-state notice |
| Signed out | Open `/` and scroll the console menu | Five lines inside the LCD; A on Projects opens `/projects` |
| Signed in | Open Dashboard, Account, Admin users, Roles | Figure numbers 07, 08, 09, 10 |
| Repo | Add one entry to `site.projectList` locally | Row renders with dot, title, note and status. No code change is needed |
