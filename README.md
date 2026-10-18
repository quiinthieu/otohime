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
app/                 pages and route handlers
lib/auth.ts          Better Auth, plus the role-hierarchy guard
lib/permissions.ts   roles and what each may do
db/                  Drizzle schema, client, and migrations
```

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

The browser talks only to this Next.js server. `lib/` and `db/` are the only code that opens Postgres.

## Deploying

GitHub Actions (`.github/workflows/ci.yml`) does it all:

- **Every PR** runs lint, typecheck, a migration drift check and a build. It also gets a preview on Vercel backed by its own Neon branch (`preview/pr-<n>`, a copy of production that is migrated first). The branch is deleted when the PR closes.
- **Every push to `main`** runs the same checks, then builds, migrates production, deploys to Vercel and smoke-tests `https://otohime.dev/api/health`.

Rules that keep this safe:

- Production migrates before the new code goes live, and the old code keeps serving if the deploy fails. So migrations must be expand-only: add first, drop in a later PR.
- `drizzle-kit migrate` runs every pending migration in one transaction, so `CREATE INDEX CONCURRENTLY` won't work.
- Don't run `vercel --prod` from a laptop; it skips the migration.
- Keep the Vercel Git integration disconnected, or Vercel deploys before CI migrates.
