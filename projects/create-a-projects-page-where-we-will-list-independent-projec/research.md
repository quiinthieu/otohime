# Research: a Projects page for otohime.dev (pm-171)

Submitted as report rep-3331 by the research run; committed here by the
product-owner run (run-5999).

Idea: "create a projects page where we will list independent projects in the future".

## Recommendation

Add `/projects` as the sixth public page of the persona site, driven by a typed
list in `content/site.ts` that starts empty and renders an honest empty state.
No database table, no admin screen: a project is added by editing one array in
`content/site.ts` and merging. That matches how every other public page here
gets its words (work, play, notes, music all read `site.*`), keeps the change
expand-only, and leaves a DB-backed list as a separate, later idea if it is ever
wanted. One software-engineer task is enough; it touches eight files and adds
no migration.

## What is there today (repo `otohime`, main at 6456dd7)

- Next.js 16.4 app router, React 19.3, Tailwind 4, Better Auth + Drizzle on
  Postgres. `cacheComponents: true`, `authInterrupts`, typed routes via
  `next typegen` (`LayoutProps<"/">` in `app/layout.tsx`).
- Two layouts. `app/(home)/` is the entrance at `/` with no sidebar; its pocket
  console (`components/handheld.tsx`) is "the way in" and its `MENU` lists the
  four public pages. `app/(app)/` is every other page with the sidebar; the
  sidebar's `PUBLIC` list in `app/(app)/layout.tsx` is Home, Work, Play, Notes,
  Music.
- Every public page is the same shape: `ViewTransition` → `div.rise` →
  `FigTitle n="0N" hint=…` → a muted intro line from `site.*` → a figure or
  list. Notes is the closest template for a text list (`app/(app)/notes/page.tsx`:
  an `<ol>` of rows with `border-t border-line`, plus a `Figure kind="parcel"`
  on the right).
- `content/site.ts` holds every public word, with typed arrays (`Game`, `Line`,
  `Song`) and `TODO(otohime)` marks on invented text.
- Figure numbers are hard-coded per page: Work 02, Play 03, Notes 04, Music 05,
  Dashboard 06, Account 07, Users 08, Roles 09. The sidebar prints "Fig. NN" by
  list position (`components/nav-links.tsx`), so page numbers and nav numbers
  line up only while the public list stays in that order.
- Public pages are not matched by `proxy.ts` (only /dashboard, /account,
  /admin/*), so a new public route needs no auth change.
- Tests: `npm test` runs 13 unit tests in `lib/*.test.ts` (green on this
  checkout after `npm ci`). `e2e/rbac.test.ts` asserts the public paths
  `/`, `/work`, `/play`, `/notes`, `/music` return 200 and that `/` has no
  `aria-label="Main"` sidebar. CI runs lint, typecheck, unit, migration drift,
  build, migrate and e2e on every PR and on main; main then deploys to Vercel.
- There is no sitemap route, no `projects` mention anywhere, and no
  `docs/claude/` directory or `projects/` plan folder in this repo (the plan
  document named in the job header does not exist here).

## Proposed change

### Content (`content/site.ts`)

```ts
export type Project = {
  title: string;
  note: string;          // one line on what it is and why
  href?: string;         // repo or live link, optional
  status: "building" | "live" | "shelved";
  colour: Swatch;        // the dot next to the title, like games and songs
};
// in site:
projects: "Things I build on my own time. The bench is clear for now.", // TODO(otohime)
projectList: [] satisfies Project[],
```

Keep the array empty in this change. The type is the contract that makes
"list independent projects in the future" a one-line edit.

### Page (`app/(app)/projects/page.tsx`)

- `export const metadata: Metadata = { title: "Projects" }`.
- `FigTitle n="06" hint="independent"` (hint is a judgement call for the SWE).
- Intro line from `site.projects`.
- If `site.projectList.length === 0`: `Notice` from `components/figures.tsx`
  with `heading="h2"`, `figure="parcel"`, a title such as "Nothing on the bench
  yet" and a muted line, so the empty page still looks designed. `Notice` is
  already used for 404 and the forbidden screen.
- Else: an `<ul>` in the Play/Music "listings" style: swatch dot, bold title,
  muted note, status as a `badge`, and the title wrapped in a link when `href`
  is set. Build the list branch now even though it renders nothing, so the
  first real project needs no code.
- Put the list markup in the page, not a new component, unless the SWE wants a
  figure. A new inked figure (a workbench, a parts bin) is a nice-to-have and
  should not block this task.

### Wiring

1. `app/(app)/layout.tsx`: append `{ href: "/projects", label: "Projects" }` to
   `PUBLIC` after Music, so it is the sixth public page and its nav position
   matches `n="06"`.
2. `components/handheld.tsx`: append `{ label: "Projects", href: "/projects" }`
   to `MENU`. See the LCD risk below: change `PITCH` to 10 and
   `line = (i) => -146 + i * PITCH` so five lines fit inside the LCD.
3. Renumber the signed-in rooms so numbers stay unique and ordered:
   Dashboard 06 → 07, Account 07 → 08, Users 08 → 09, Roles 09 → 10
   (`app/(app)/dashboard/page.tsx`, `account/page.tsx`, `admin/users/page.tsx`,
   `admin/users/[id]/page.tsx`, `admin/roles/page.tsx`). The numbers are
   decoration (`aria-hidden`), so this is cosmetic but cheap, and it keeps the
   "Fig." sequence honest.
4. `e2e/rbac.test.ts`: add `/projects` to the public-pages list in "the public
   pages are open to everyone".
5. `README.md`: nothing structural changes; optionally note that projects are
   listed from `content/site.ts`.

### Tests

- Unit: `lib/machines.test.ts` builds its pad with `newPad(4)` and does not read
  `MENU`, so it stays green. Optionally add a test that
  `tap` over `newPad(5)` wraps at 5, mirroring the new menu length, or better:
  export `MENU` length and assert the console menu and the sidebar's public
  list name the same hrefs. That needs `MENU` moved out of the client
  component (for example a `pages` array in `content/site.ts` that both the
  sidebar and the handheld import). This dedupe is optional and worth doing
  only if the SWE finds it a small diff.
- E2E: the extended public-pages assertion covers the route being reachable
  without a session and rendering inside the sidebar layout. A second cheap
  assertion: the HTML of `/projects` contains `Projects` in the `<h1>` and the
  empty-state heading.
- CI typecheck: `next typegen` regenerates route types, so a `Link href="/projects"`
  typechecks only once the page file exists. Create the page before wiring the
  links, or run `npm run typecheck` once at the end.

### Verification lines for the build contract

- `npm run lint && npm run typecheck && npm test` green.
- `npm run build` green; `next start` on port 4010 then
  `curl -s -o /dev/null -w '%{http_code}' http://localhost:4010/projects` prints 200.
- `curl -s http://localhost:4010/projects | grep -c 'aria-label="Main"'` prints 1
  (sidebar present) and the body contains `Projects`.
- `curl -s http://localhost:4010/ | grep -c PROJECTS` prints 1 (the console menu
  lists the new page in upper case on the LCD).
- `BASE_URL=http://localhost:4010 DATABASE_URL=… npm run test:e2e` green, with
  `/projects` in the public list.
- Visually or with a screenshot: the LCD on `/` shows five menu lines inside the
  screen; none is clipped at the bottom edge.

## Risks and gotchas

- **LCD overflow on the pocket console.** The screen rect is `y=-158, h=56`
  (bottom edge at -102). Menu baselines are `-142 + i*12`, so a fifth line sits
  at -94, outside the LCD and over the bezel. Pitch 10 from -146 gives
  -146…-106 with the 8.5px LCD font, which fits with room for descenders. The
  splash text at -127 and the cursor triangle are unaffected.
- **Figure numbers.** Appending at the end keeps the public order and the
  hard-coded numbers consistent. Inserting Projects after Work instead would
  shift Play/Notes/Music by one in the nav while their pages still say 03/04/05.
- **Typed routes.** `Link href="/projects"` fails typecheck until the page
  exists; order the edits accordingly.
- **AGENTS.md churn.** `next dev` re-adds its Next.js block to `AGENTS.md`; do
  not commit that noise with the feature.
- **No sitemap.** Nothing to update; if a sitemap is ever added, projects goes
  in it.
- **CI timing.** The e2e job signs up four users against production rate limits
  (3 per 10 s) and waits them out; adding one GET does not change that.

## Out of scope, noted for the product owner

- A DB-backed projects table with admin CRUD. The site owner edits code for
  every other page and deploys through CI, so a static list is the cheapest
  and most reversible path. If the list ever needs editing without a deploy,
  that is a new idea with a migration (expand-only per README), a Drizzle
  schema change, and an admin screen behind the `admin` role.
- A dedicated inked figure for the page. Nice, not needed for an empty list.
- Per-project detail pages (`/projects/[slug]`). Not asked for; the list rows
  can link out instead.

## Suggested task split

One SWE task: "Add a public Projects page". Acceptance is the verification
list above. A separate quality-engineer pass is the usual CI run plus a
screenshot of the console LCD with five lines.

## Assumptions recorded

- The site's own words are drafts marked `TODO(otohime)`; the Projects intro
  line should carry the same mark.
- "Independent projects" means personal side projects, distinct from the Work
  page's day job. The page copy should say so in one line.
- No plan document exists in the repo for this plan; this research used the
  board's plan and the idea text only.
