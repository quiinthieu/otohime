# All projects link: a way back to /projects (pm-195)

**Idea.** "When users are on a specific project page, there is no way for them
to go back to the project list. Users can only go back to the home page.
Expected: allow users to go back to the project list when they are on a
specific project page."

**Product.** Each of the five project entry pages (`/shore`, `/capsule`, `/sun`,
`/elements`, `/vinyl`) gets a second pill in its top bar, `← All projects`,
linking to `/projects`, next to the existing `otohime.dev` home pill. Home stays.
`/elements/<symbol>` keeps only `← All elements` (the list is two clicks away
there; the idea names the project page).

Research: rep-3755 (run-6623), checked against main at fda37fa. Nothing in it is
repeated beyond what the task needs.

## Constraints that shape the work

- Every project is its own root layout with its own `<html>`, stylesheet and no
  Tailwind. `app/(<group>)/_lib/isolation.test.ts` fails on any import of
  `components/`, `content/`, `lib/`, `app/(site)` or another project. So there is
  **no shared top bar**: the change is five parallel edits, one per group. This
  is house style, not an omission.
- `/projects` lives in the site's root layout, so leaving a project is a full
  page load: a plain `<a>` (not `next/link`) with
  `{/* eslint-disable-next-line @next/next/no-html-link-for-pages */}`, exactly
  like the existing home link.
- Four walk scripts assert `href="/"` on the project page; none counts it, so an
  extra link does not disturb them. Keep the home link.

## Change (one software-engineer task)

Per group, in `page.tsx` and that group's `.css` only:

1. Put the home link and the new link in
   `<nav className="ways-out" aria-label="Site">` (class name is the engineer's
   call) so the bar keeps its alignment. The new link:
   ```tsx
   <a className="home-link" href="/projects">
     <span aria-hidden="true">←</span> All projects
   </a>
   ```
   Reuse `.home-link` for the pill look; no new colours; tap target stays 44px.
2. CSS per bar:
   - Shore, Capsule: nav is `display:flex; align-items:center; gap:8px` on the
     right, brand stays left; allow `flex-wrap: wrap` under 480px.
   - Sun: `.topbar` is a block with one 22px hand-font link; make the nav flex
     with a gap and give the pill its own font-size so it does not inherit 22px.
   - Elements: nav keeps both pills together on the left of the space-between bar.
   - Vinyl: tightest bar (pill, then `<h1>Vinyl</h1>`, gap 16px); put the pills in
     a nav before the heading and add `flex-wrap: wrap` so nothing overflows at 390px.
3. Walks: after the "links home" line in each `scripts/walk-<x>.sh`, add
   `check "/x links the project list" has x 'href="/projects"'`. Shore's walk has
   no "links home" line; add both there.
4. E2E: in each "X is its own page, without the site's sidebar" test in
   `e2e/rbac.test.ts`, also `assert.match(html, /href="\/projects"/)`.
5. README: one clause under "Layout": every project's top bar links home and to
   `/projects`, both plain `<a>` because they cross root layouts.

## Out of scope

- A shared top-bar component (isolation tests forbid it).
- A link on `/elements/<symbol>`.
- Landing on the project's own row (`/projects#shore`).
- Replacing the home link.

## Verification (all runnable in the checkout, no waiting)

- `npm ci && npm test`: the five isolation tests prove no cross-group import.
- `npm run lint` and `npm run typecheck` (also type-checks the e2e edits).
- `bash scripts/walk-<x>.sh` for all five: builds, serves, exits 0, and the new
  "links the project list" line is `ok`.
- The e2e "is its own page" tests need Docker Postgres (`scripts/e2e-local.sh`);
  they run in CI. QA also checks 390px and 1366px on all five pages: both pills
  visible, no horizontal overflow, brand/heading still on its side.
- After deploy (acceptance, not the engineer):
  `BASE_URL=https://otohime.dev bash scripts/walk-<x>.sh` per project.

## Task graph

1. **Add an All projects link to each project's top bar**, software_engineer,
   no dependencies. One task: five small edits sharing one pattern, one README
   line and one review.
