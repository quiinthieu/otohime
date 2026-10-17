# Otohime

Personal site for [otohime.dev](https://otohime.dev). One Next.js app serves the pages and the API. Postgres holds accounts and app data.

## Local setup

```bash
cp .env.example .env
openssl rand -base64 32
```

Put the generated value in `BETTER_AUTH_SECRET`.

```bash
docker compose up -d
npm run db:migrate
npm run dev
```

The app is at [http://localhost:3000](http://localhost:3000). Postgres listens on port **5433** so it does not take the default port used by other local databases.

## Layout

```
app/            pages and route handlers
lib/auth.ts     Better Auth
db/             Drizzle schema, client, and migrations
```

The browser talks only to this Next.js server. `lib/` and `db/` are the only code that opens Postgres.
