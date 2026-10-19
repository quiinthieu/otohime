# Research: let owners add a channel to otohime.dev/music (pm-186)

> Submitted as report rep-3538 by research run run-6302 and committed here by
> the product owner (run-6304) without changes. The plan (`plan.md`) differs from
> it in one place: owner-added songs are read **per request**, not through
> `use cache`, because CI and production build before they migrate. See the
> plan's Decisions.

Idea (idea-186, from the console): "Allow Owner users to add tracker to
`https://otohime.dev/music`". Research run run-6302 on repo `otohime`, main at
b6359d381d5686614ce63a2c65e1bafc1d1da9ef, which is also the sha the live
`/music` serves today (`<meta name="build-sha">`).

## Recommendation

Read "add tracker" as **add a track**: a signed-in **owner** sees an
"Add a channel" form on `/music` itself, pastes a YouTube link, gives the song
a title, artist, note and colour, and the television gains a channel for every
visitor, with no deploy. Owners can also remove a channel they added. Admins
and users see the page exactly as today.

Build it as:

1. a `song` table in Postgres (expand-only migration), read for everyone
   through a `use cache` + `cacheTag("songs")` function so the public page
   stays in the static shell;
2. a `song` resource in `lib/permissions.ts` (`create`, `delete`), granted to
   `owner` only, so `/admin/roles` keeps showing the whole matrix;
3. two Server Actions (`addSong`, `removeSong`) that re-check the session and
   `can(role, { song: [...] })` on the server, validate, write, and call
   `updateTag("songs")`;
4. an owner-only island on `/music`, behind `<Suspense>`, that renders the
   form and the per-row Remove buttons;
5. the three starter songs stay in `content/site.ts` as built-in channels
   1 to 3; owner-added songs follow them in order.

Two software-engineer tasks: (1) data, permission and pure validation with
unit tests; (2) the page, the actions, the e2e assertions and the README.
Nothing needs a person to act, there is no third-party setup, and every step is
reversible (drop the island, keep the table).

### Why this reading of "tracker"

| Reading | Fit | Verdict |
| --- | --- | --- |
| **A track** (a song, a channel on the TV) | `/music` is a television with three hard-coded channels in `content/site.ts`, marked `TODO(otohime)`. An owner-only way to add one is exactly one word away from the idea. | **Recommended** |
| A tracker module player (MOD/XM/IT) | A new WebAssembly player and file uploads inside a YouTube television. Heavy, and no reason to gate it by role. | Not this |
| An analytics tracker script | Site-wide, not per page, and a role gate makes no sense for a script tag. | Not this |
| A listening log (play counter per song) | Needs no owner action; it would be a counter, not something an owner "adds". | Not this |

The product owner can confirm with `plan_manager_ask_user` (advisory), but
should not block on it: the recommended build is the smallest one that makes
the sentence true, and the other readings would be new ideas anyway.

## What is there today

- Next.js 16.4.2 (`cacheComponents: true`, `authInterrupts`, typed routes),
  React 19.3, Tailwind 4, Better Auth 1.7.10 with the admin plugin, Drizzle on
  Postgres (Neon in production, Vercel hosting; CI in
  `.github/workflows/ci.yml` runs lint, typecheck, `npm test`, a migration
  drift check, build, migrate and `npm run test:e2e`, then deploys `main`).
- `/music` (`app/(site)/(app)/music/page.tsx`) is a public, fully static page:
  `FigTitle n="05" hint="three channels"`, the intro `site.music` ("Three songs
  on repeat, one channel each"), `<Television songs={site.songs}
  playlist={site.playlist} />`, and a "Listings" `<ol>` of the same songs with
  `CH 01`.. numbers and swatch dots.
- `components/television.tsx` is a client component around YouTube's IFrame
  API. It takes `songs: Song[]`, joins their `video` ids and calls
  `cuePlaylist(ids)`; `tune(i)` calls `playVideoAt(i)`; the knob rotates
  `-45 + 45 * (channel - 1)` degrees (cosmetic; fine for a handful of
  channels, odd past about 7). Adding songs is a prop change: the effect is
  keyed on the joined ids, so it re-cues.
- `Song = { title, artist, note, colour: Swatch, video }` in
  `content/site.ts`; `Swatch` is one of `yellow | coral | mint | blue | pink`
  (`components/figures.tsx`). `site.songs` is used only by the music page.
- Roles: `owner > admin > user` in `lib/permissions.ts`, built on Better
  Auth's `defaultStatements` (`user`, `session`). `can(role, permissions)` is
  the gate everywhere (`lib/dal.ts` `requirePermission`, the sidebar, the
  dashboard). `/admin/roles` renders `statements` as a matrix and says "roles
  live in code". Owners are made with SQL only.
- Session reads: `getSession()` in `lib/dal.ts` (React `cache`, `headers()`).
  With Cache Components a session read must sit behind `<Suspense>`; the
  sidebar's `Nav` in `app/(site)/(app)/layout.tsx` is the pattern.
- Mutations today all go through Better Auth endpoints from client components
  (`components/account-panel.tsx` `useAction`, `components/user-actions.tsx`).
  There is **no Server Action and no custom route handler** in the repo yet
  (`app/api/` has only `auth/[...all]` and `health`).
- Database: `db/schema.ts` has `user`, `session`, `account`, `verification`.
  Migrations `0000`, `0001` under `db/migrations/`; CI fails if
  `db:generate` would write anything, so a schema change must commit its
  migration and snapshot.
- Tests: `npm test` runs 98 node:test cases (green here after `npm ci`), no
  DB. `e2e/rbac.test.ts` runs over HTTP against `next start` with a Postgres,
  signs up `@e2e.test` users, promotes one to owner by SQL, and asserts the
  public pages (including `/music`) return 200.
- Walks: `scripts/walk-shore.sh` and `walk-capsule.sh` probe a build or
  `BASE_URL=https://otohime.dev`, one `ok -`/`not ok -` line per check.

## Proposed change

### Data (`db/schema.ts`, migration 0002)

```ts
export const song = pgTable("song", {
  id: text("id").primaryKey(),              // crypto.randomUUID()
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  note: text("note").notNull(),
  colour: text("colour").notNull(),         // a Swatch key, checked in code
  video: text("video").notNull(),           // YouTube id, 11 chars
  position: integer("position").notNull(),  // play order after the built-ins
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }), // nullable: a song outlives its owner account
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`npm run db:generate` writes `db/migrations/0002_*.sql` and the snapshot;
commit both (CI's drift check). Expand-only, so production migrates before the
new code is live and the old code keeps serving. `created_by` is nullable with
`set null` so a channel outlives the account that added it.

### Permission (`lib/permissions.ts`)

```ts
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";

const ac = createAccessControl({ ...defaultStatements, song: ["create", "delete"] });
export const statements = ac.statements;
export const roles = {
  owner: ac.newRole(ac.statements),            // everything, incl. song
  admin: ac.newRole({ ...adminAc.statements }), // Better Auth's admin set, no song
  user: ac.newRole({ ...userAc.statements }),
};
```

`Role` exposes `.statements` (`better-auth/dist/plugins/access/types.d.mts`),
so the admin and user sets stay Better Auth's, only re-typed against the
wider access control. `Permissions` (derived from `roles.user.authorize`) then
accepts `{ song: ["create"] }`, `can()` needs no change, and `/admin/roles`
gains a `song` section with a dot under owner only. The admin plugin and
`adminClient({ roles })` take the same object. Add to
`lib/permissions.test.ts`: owner may `song: create, delete`; admin, user,
null, `"constructor"` may not.

### Validation (`lib/songs.ts`, pure, unit-tested)

- `parseVideoId(input)`: accepts a bare 11-char id or a YouTube URL
  (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `music.youtube.com`),
  returns the id or `null`. Id regex `^[A-Za-z0-9_-]{11}$`.
- `parseSong(form: Record<string, unknown>)`: trims; title and artist 1 to 80
  chars, note 0 to 200, colour in `swatches`; returns `{ ok, song | errors }`.
  Keep `Swatch` and `Song` importable without React (move the two types to
  `lib/songs.ts` or keep `swatches` in `components/figures.tsx` and re-export
  the key list from a `.ts` file, because `npm test` cannot import `.tsx`).
- Tests in `lib/songs.test.ts` cover each URL shape, a bad id, long fields,
  an unknown colour and a `__proto__` colour.

### Reading and writing (`app/(site)/(app)/music/actions.ts`, `lib/songs-store.ts`)

```ts
// lib/songs-store.ts (server-only)
export async function listSongs() {
  "use cache";
  cacheLife("days");
  cacheTag("songs");
  return db.select().from(song).orderBy(song.position, song.createdAt);
}
```

```ts
// app/(site)/(app)/music/actions.ts
"use server";
export async function addSong(_prev: State, form: FormData): Promise<State> {
  const session = await getSession();
  if (!session || !can(session.user.role, { song: ["create"] })) return { error: "Owners only." };
  const parsed = parseSong(Object.fromEntries(form));
  if (!parsed.ok) return { error: parsed.errors };
  await db.insert(song).values({ id: crypto.randomUUID(), ...parsed.song, position: nextPosition, createdBy: session.user.id });
  updateTag("songs");          // read-your-own-write: the owner sees the channel at once
  return { ok: true };
}
export async function removeSong(_prev: State, form: FormData) { /* same gate with song: ["delete"], then delete by id, updateTag */ }
```

Why Server Actions and not a route handler or a client call:

- Next 16's documented mutation path (`07-mutating-data.md`), with a built-in
  Origin-vs-Host CSRF check (`02-guides/server-actions.md` line 82) so no
  origin code is needed, and progressive enhancement for a plain `<form>`.
- `updateTag` is allowed only in Server Actions and gives read-your-own-writes;
  `revalidateTag` from a route handler would serve the stale list once.
- The docs' warning applies: a Server Function is reachable by POST, so the
  session and `can()` check live inside each action, never only in the UI.

Cap the list at, say, 12 owner-added songs (cuePlaylist takes up to 200 ids,
but the knob and the `CH` LCD are drawn for a few channels). Return an error
past the cap rather than silently dropping.

### Page (`app/(site)/(app)/music/page.tsx`)

- `const songs = [...site.songs, ...(await listSongs())]` (cached, so still in
  the static shell). Pass to `Television` and the Listings as today. The hint
  becomes `${songs.length} channels`, and `site.music` loses the word "Three"
  (or is built from the count).
- Each owner-added row in Listings shows its `Remove` button only inside the
  owner island (below), or the island re-renders the list; simplest: the
  island renders both the form and a small "Your channels" list with Remove
  buttons, keeping the public Listings untouched.
- `<Suspense fallback={null}><OwnerTools /></Suspense>` at the end of the
  page. `OwnerTools` is an async Server Component: `getSession()`, return
  `null` unless `can(role, { song: ["create"] })`, else render
  `<AddChannelForm action={addSong} />` (a client component using
  `useActionState`, fields: YouTube link, title, artist, note, colour
  `<select>`), with `Field` from `components/field.tsx` and the `btn`,
  `field`, `alert` classes. Remove is a second small form per row with a
  hidden `id` and a two-press confirm (first press turns the label into
  "Really remove?").
- `proxy.ts` is not touched: `/music` stays public; the session read happens
  only inside the island.

### Television (`components/television.tsx`)

- No API change. Optionally clamp the knob's rotation (`min(channel - 1, 6)`)
  so a long list does not spin it past the bezel. The `CH n` LCD already
  prints any number.

### Tests and proof

- Unit (`npm test`, no DB): `lib/permissions.test.ts` gains the `song` cases;
  `lib/songs.test.ts` covers `parseVideoId` and `parseSong`;
  `lib/build-stamp.test.ts` style check that `README.md` mentions how
  channels are added (optional).
- E2E (`e2e/rbac.test.ts`, existing harness): (a) `/music` still 200 for
  anyone; (b) `INSERT INTO song (...)` by SQL in `before`, then the anonymous
  `/music` HTML contains that title and `CH 04`; (c) the owner's `/music`
  contains the form (`name="video"`), and the admin's, the plain user's and
  the anonymous page do not; (d) `after` deletes the row. The action's own
  gate is proven by the unit test on `can()` plus the identical check in the
  action; calling a Server Action by raw POST needs its action id and is not
  worth the brittleness.
- Walk: add to `scripts/walk-shore.sh` or a new `walk-music.sh` two checks:
  `/music` has `name="build-sha"` and the `CH 01` listing, and (locally, with
  the e2e DB) the inserted channel. Remote QA cites the live `build-sha` and
  that the public page lists the built-in channels; the owner-only form on
  production can only be seen by the site owner signing in, so acceptance
  should rely on CI's e2e for that path and at most leave a watch, never a
  gate.
- Migration drift: `npx drizzle-kit check` and `npm run db:generate` must
  leave `db/migrations` clean, as CI enforces.

### Docs

`README.md`: in Layout, `lib/songs.ts` (channel validation) and the `song`
table; in Roles, that `song: create, delete` is owner-only; a line under
`/music` saying owners add channels from the page and the three starters live
in `content/site.ts`.

## Task split (for the product owner)

1. **t-A, software_engineer, `qa: skip`** (pure code and schema, fully proven
   by `npm test` and the drift check): `song` table + migration 0002,
   `song` statement in `lib/permissions.ts` with tests, `lib/songs.ts` +
   tests, `README.md` Roles note. Verification: `npm ci && npm test`,
   `npx drizzle-kit check`, `npm run db:generate && git status --porcelain
   db/migrations` empty, `npm run typecheck`, `npm run lint`.
2. **t-B, software_engineer, depends on t-A**: `lib/songs-store.ts`,
   `music/actions.ts`, `OwnerTools` + `AddChannelForm`, page changes, the
   e2e assertions, the walk checks, README. Verification: the same plus
   `npm run build`, `npm run db:migrate` and `npm run test:e2e` against
   `next start` with the CI Postgres (the README's recipe), and the walk
   script locally. QA re-runs the walk against `https://otohime.dev` at the
   delivery sha.

One task is possible but the two keep each diff reviewable and let t-A's
migration land first.

## Risks and notes

- **Ambiguity of "tracker".** Mitigated above; the build is cheap to discard.
- **First Server Action in the repo.** Lint (`eslint-config-next`) and typed
  routes are fine with it; the action file must start with `"use server"` and
  export only async functions. Reading the Next 16 docs in
  `node_modules/next/dist/docs/` is required by `AGENTS.md`.
- **Cache Components.** `listSongs` with `cacheLife("days")` joins the static
  shell; `updateTag("songs")` in the action refreshes it. The session read
  must stay inside `<Suspense>` or the build fails. `db` is imported only in
  server files (`lib/`, `db/`), as the README demands.
- **Vercel data cache.** `updateTag` works on Vercel; the owner's next render
  shows the channel. Other visitors see it after the tag expires or the next
  revalidation, which is immediate for a `use cache` tag that was updated.
- **Commit identity.** The plan's `commit_identity` is `Otohime
  <quiinthieu@gmail.com>`; Vercel Hobby deploys only the owner's commits
  (README, pm-184 lesson).
- **Neon preview branches.** PR previews migrate their own branch first, so
  the migration is exercised before `main`.
- **Not in scope.** Editing or removing the three starters (a seed migration
  with `drizzle-kit generate --custom` is the later path), reordering,
  admin access, Spotify playlist sync, uploads of audio files.
