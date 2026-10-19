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
content/site.ts      the words on the public pages
lib/pages.ts         the public pages (sidebar and console menu); add a project as an entry in `site.projectList` in content/site.ts
lib/auth.ts          Better Auth, plus the role-hierarchy guard
lib/permissions.ts   roles and what each may do
lib/machines.ts      state for the figures you can play with
db/                  Drizzle schema, client, and migrations
```

A page with its own design gets its own route group with a `layout.tsx` (its own `<html>` and stylesheet), so it does not inherit the site's CSS. Moving between root layouts is a full page load.

The site follows the OS's light or dark setting until someone presses the theme toggle. Their choice is kept in `localStorage.theme`.

The browser talks only to this Next.js server. `lib/` and `db/` are the only code that opens Postgres.

## Roles

There are three site-wide roles: `owner` > `admin` > `user`. New accounts are `user`. The full permission matrix is at `/admin/roles`. An admin can only manage people ranked below them, and can only hand out roles below their own. So owners can't be created from the app at all.

To make the first owner, sign up, then run:

```bash
# local
docker compose exec postgres psql -U otohime -d otohime -c "UPDATE \"user\" SET role='owner' WHERE email='you@example.com';"
# Neon (production or a branch)
psql "$DATABASE_URL" -c "UPDATE \"user\" SET role='owner' WHERE email='you@example.com';"
```

The change takes effect on the next request.

## Tests

- `npm test` runs the unit tests (roles and the rank rule). It needs no database.
- `npm run test:e2e` runs HTTP tests for RBAC and session revocation against a running production build. They sign up throwaway `@e2e.test` users and delete them afterwards:

  ```bash
  npm run build
  PORT=4010 BETTER_AUTH_URL=http://localhost:4010 npm start
  # in another terminal
  BASE_URL=http://localhost:4010 DATABASE_URL=postgresql://otohime:otohime@localhost:5433/otohime npm run test:e2e
  ```

CI runs both on every PR.

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
