# Owner Channels: owners add songs to the /music television (pm-186)

**Idea.** "Allow Owner users to add tracker to `https://otohime.dev/music`"

**Product.** `/music` is a television with three channels, one song each. The
songs are hard-coded in `content/site.ts`. With this plan, a signed-in
**owner** sees an **Add a channel** form under the Listings on `/music`. They
paste a YouTube link, give the song a title, an artist, an optional note and a
colour, and press **Add channel**. The television gains channel 4 (5, 6 …) for
every visitor at once, with no deploy. Owners can also **Remove** a channel
they added (press twice to confirm). Admins, users and signed-out visitors see
`/music` as before, plus any channels owners have added. The three starter
songs stay in `content/site.ts` as channels 1 to 3.

Research: [research.md](research.md) (rep-3538, run-6302). Repo `otohime`,
planned at `b6359d3`, the sha live `/music` serves today. Read the Next 16 docs
in `node_modules/next/dist/docs/` before writing code (`AGENTS.md`).
Relevant pages: `01-app/03-api-reference/04-functions/connection.md`,
`refresh.md`, `01-app/02-guides/server-actions.md` and
`01-app/01-getting-started/07-mutating-data.md`.

## Decisions

| Decision | Why |
| --- | --- |
| "Tracker" means **track**: a song, which is a channel on the TV. | `/music` is a TV of songs, and an owner-only "add a channel" is the smallest build that makes the idea true. A module-tracker player or an analytics script makes no sense with a role gate. It is cheap to discard. |
| Owner-added songs live in a new Postgres `song` table (expand-only migration `0002`). The starters stay in `content/site.ts`. | No deploy is needed to add a song, and the old code keeps serving while the migration runs. Seeding the starters into the table is a later, separate change. |
| Owner-added songs are read **per request** (`await connection()` inside `<Suspense>`), not with `use cache`. The actions call `refresh()`. | CI's `checks` job and the production job both **build before they migrate**, and the walks build with no database. A `use cache` read would run the query at build time, against a table that does not exist yet. A per-request read never runs at build. Every visitor sees a change at once, and tests can insert by SQL and see the row with no cache to defeat. It costs one small query per view. This overrides research. |
| `listSongs()` catches any DB error, logs it and returns `[]`. | A database outage, or a walk with no DB, still shows the three built-in channels with status 200. |
| A new `song` permission statement (`create`, `delete`) is granted to **owner** only, in `lib/permissions.ts`. | `can()` stays the single gate, and `/admin/roles` shows the new row automatically ("roles live in code"). Better Auth's admin and user sets stay unchanged. |
| Writes are two **Server Actions** (`addSong`, `removeSong`). Each re-checks the session and `can()` on the server before it validates or writes. | A Server Function is reachable by any POST, so the UI gate alone proves nothing. Next 16's action Origin check covers CSRF. Plain `<form>`s also work without JS. |
| Only `lib/` and `db/` open Postgres. The actions call `lib/songs-store.ts`. | This is the README's rule. |
| An owner may remove **any** owner-added channel. Removal is gated by `song: delete`, not by who added it. | There is one site owner in practice, and per-author rules add checks with no product gain. |
| There are at most **12** owner-added channels. A video already on the TV (built-in or added) is refused. | The knob and the `CH` LCD are drawn for a handful of channels, and a duplicate channel is confusing. The action says why, and nothing is dropped silently. |
| The server-side gate is proven in e2e by posting the form **as a no-JS browser would**. The test copies the owner form's hidden inputs and replays them with a plain user's cookie, and the database must not change. | This proves the claim that matters: a non-owner's POST changes nothing. |
| `scripts/e2e-local.sh` runs the e2e suite against a **throwaway docker Postgres** on a free port, then removes it. | The README recipe needs two terminals and a long-lived DB. A single command proves migration `0002` applies, and proves every DB claim, inside any checkout that has docker. CI runs the same e2e against its own Postgres. |
| `scripts/walk-music.sh` walks a local build (no DB) or `BASE_URL=https://otohime.dev`. | QA and acceptance get a checked-in walk with one `ok -`/`not ok -` line per check, in the style of `walk-shore.sh` and `walk-capsule.sh`. It does not edit those two scripts. |
| Each delivery commit is authored **and** committed as `Otohime <quiinthieu@gmail.com>`. Set `GIT_AUTHOR_NAME/EMAIL` and `GIT_COMMITTER_NAME/EMAIL` on `git commit` and on `git push` (the push helper may rebase). | Vercel Hobby deploys only the owner's commits (pm-184). |

## Data shapes

```ts
// db/schema.ts
export const song = pgTable("song", {
  id: text("id").primaryKey(),              // crypto.randomUUID()
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  note: text("note").notNull(),             // "" when none
  colour: text("colour").notNull(),         // a Swatch key, checked in lib/songs.ts
  video: text("video").notNull(),           // 11-char YouTube id
  position: integer("position").notNull(),  // play order after the built-ins
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// lib/songs.ts (pure: no React, no db; `npm test` imports it)
export const SWATCH_KEYS: readonly Swatch[];    // ["yellow","coral","mint","blue","pink"], checked against Swatch both ways at compile time
export const MAX_ADDED_SONGS = 12;
export const LIMITS = { title: 80, artist: 80, note: 200 };
export type SongInput = { title: string; artist: string; note: string; colour: Swatch; video: string };
export type SongField = keyof SongInput;
export function parseVideoId(input: string): string | null;
export function parseSong(fields: Record<string, unknown>):
  | { ok: true; song: SongInput }
  | { ok: false; errors: Partial<Record<SongField, string>> };

// lib/songs-store.ts ("server-only")
export type StoredSong = SongInput & { id: string };   // assignable to content/site.ts Song
export const listSongs: () => Promise<StoredSong[]>;   // React cache; await connection(); order by position, createdAt; [] on error
export function insertSong(input: SongInput, createdBy: string): Promise<{ ok: true } | { ok: false; error: string }>; // cap + duplicate checks
export function deleteSong(id: string): Promise<boolean>;

// app/(site)/(app)/music/actions.ts ("use server")
export type SongFormState = { ok?: boolean; error?: string; errors?: Partial<Record<SongField, string>> };
export async function addSong(prev: SongFormState, form: FormData): Promise<SongFormState>;
export async function removeSong(prev: SongFormState, form: FormData): Promise<SongFormState>;
```

## Tasks

### 1. Song data, the owner-only `song` permission, validation and a one-command e2e

- **Role:** software_engineer. QA is required: it touches a migration, and
  `/admin/roles` gains a visible row.
- **Problem:** Owners need somewhere to keep the songs they add, a permission
  that says only owners may add or remove them, and input rules that cannot be
  fooled. The repo also has no single command that proves a migration and the
  role gates against a real Postgres.
- **Action items:**
  1. `db/schema.ts`: add the `song` table above. Run `npm run db:generate` and
     commit `db/migrations/0002_*.sql`, `meta/0002_snapshot.json` and the
     journal. The migration only creates the table (expand-only).
  2. `lib/permissions.ts`: build the access control with
     `createAccessControl({ ...defaultStatements, song: ["create", "delete"] })`
     from `better-auth/plugins/access`. Set
     `owner: ac.newRole(ac.statements)`,
     `admin: ac.newRole({ ...adminAc.statements })` and
     `user: ac.newRole({ ...userAc.statements })`. Export `ac` too. Keep `can`,
     `rankOf` and `mayAct` unchanged. Pass `ac` alongside `roles` to
     `admin({ ... })` in `lib/auth.ts` and to `adminClient({ ... })` in
     `lib/auth-client.ts`.
  3. `lib/permissions.test.ts`: owner may `song: ["create", "delete"]`, and
     admin, user, `null`, `""`, `"constructor"` and `"__proto__"` may not. The
     existing user and session cases still pass unchanged, including admin's
     `user: list … delete` and `session: list, revoke`.
  4. `lib/songs.ts` as in Data shapes. `parseVideoId` accepts a bare id
     (`^[A-Za-z0-9_-]{11}$`). It also accepts `http(s)` URLs, with or without a
     scheme, on `youtube.com`, `www.`, `m.`, `music.youtube.com`, `youtu.be`
     and `youtube-nocookie.com`, in the shapes `/watch?v=` (extra params such
     as `&list=` and `&t=` are fine), `youtu.be/<id>?si=…`, `/shorts/<id>`,
     `/embed/<id>` and `/live/<id>`. It returns `null` for every other host,
     including `youtube.com.evil.com` and `evil.com/watch?v=…`, for
     `javascript:` and for ids of the wrong length. `parseSong` trims
     everything. `title` and `artist` must be 1 to 80 characters, `note` 0 to
     200, and `colour` must be one of `SWATCH_KEYS` (use `Object.hasOwn` or
     `includes`, never `in`, so `__proto__` is refused). Non-string values
     (a `File`) are errors. It returns every field error at once, in plain
     words ("Paste a YouTube link or video id.").
  5. `lib/songs.test.ts`: every accepted URL shape, every rejected host above,
     ids of 10 and 12 characters, empty input, an 81-character title, a
     201-character note, an unknown colour, `__proto__` and `constructor` as
     colours, a `File`-like value, and a valid input that comes back trimmed.
  6. `scripts/e2e-local.sh` (bash, `set -u`, no `set -e`). It needs docker and
     exits 2 with a clear message if docker is missing. It picks a free host
     port, runs `docker run -d --rm --name otohime-e2e-$$ -e POSTGRES_USER=otohime
     -e POSTGRES_PASSWORD=otohime -e POSTGRES_DB=otohime -p 127.0.0.1:<port>:5432
     postgres:17-alpine`, and waits for `docker exec … pg_isready` (60 tries,
     0.5 s apart). Then it sets `DATABASE_URL`, runs `npm run db:migrate` and
     `npm run build` (skipped when `SKIP_BUILD=1`), and starts `npm start` on
     `APP_PORT` (default 4027) in its own process group. The server gets
     `BETTER_AUTH_URL=http://localhost:$APP_PORT` and the CI placeholder
     `BETTER_AUTH_SECRET`, and runs without `NODE_ENV=test`. The script waits
     for `/api/health`, then runs `BASE_URL=… npm run test:e2e` and exits with
     its status. An `EXIT` trap kills the server's process group and runs
     `docker rm -f` on the container. Write no `wc -l`; use `grep -c` with
     numeric tests (BSD).
  7. `e2e/rbac.test.ts`: the owner's `/admin/roles` HTML contains a `song` row,
     and the admin's `/admin/roles` row for `song` shows no grant under admin.
     Assert the smallest stable marker the page renders, and read
     `app/(site)/(app)/admin/roles/page.tsx` first.
  8. `README.md`: under Roles, add that `song: create, delete` is owner-only.
     Under Tests, add `bash scripts/e2e-local.sh` (it needs docker) as the
     one-command e2e.
  9. Commit and push with the owner identity.
- **Interfaces:** `db/schema.ts`; `db/migrations/`; `lib/permissions.ts`;
  `lib/permissions.test.ts`; `lib/auth.ts`; `lib/auth-client.ts`;
  `lib/songs.ts`; `lib/songs.test.ts`; `scripts/e2e-local.sh`;
  `e2e/rbac.test.ts`; `README.md`
- **Non-goals:** any change to `/music`, Server Actions, the TV, seeding the
  three starters into the table, admin access to songs, and changes to CI.
- **Acceptance:** `npm test` passes with the new `song` permission and
  validation cases. Migration `0002` applies to a fresh Postgres, and
  `db:generate` writes nothing. `bash scripts/e2e-local.sh` passes,
  including owner-only `song` on `/admin/roles`, and leaves no container or
  server behind.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test` (900 s)
  - `npx drizzle-kit check && npm run db:generate && test -z "$(git status --porcelain db/migrations)" && ls db/migrations/0002_*.sql`
  - `bash -n scripts/e2e-local.sh && ! grep -nE 'wc +-l' scripts/e2e-local.sh`
  - `bash scripts/e2e-local.sh` (1200 s)
  - `test -z "$(docker ps -q --filter name=otohime-e2e-)"` (no container left behind)
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

### 2. Owners add and remove channels on /music

- **Role:** software_engineer, depends on 1. QA is required.
- **Problem:** The table and the permission exist, but `/music` still shows
  only the three hard-coded songs, and an owner has no way to add one.
- **Action items:**
  1. `lib/songs-store.ts` (`import "server-only"`):
     - `listSongs` is wrapped in React `cache`. It calls `await connection()`,
       then selects from `song` ordered by `position, created_at`, and maps the
       rows to `StoredSong`. On any error it calls `console.error` and returns
       `[]`.
     - `insertSong` refuses when 12 owner-added songs exist ("12 channels added.
       Remove one to add another.") and when the video id is already a built-in
       (`site.songs`) or a stored song ("That video is already channel N.").
       Otherwise it inserts with `position = max(position) + 1` (0 when empty)
       and `id = crypto.randomUUID()`.
     - `deleteSong(id)` deletes by id and returns whether a row went.
  2. `app/(site)/(app)/music/actions.ts` (`"use server"`, async exports only).
     Each action **first** reads `getSession()` and checks
     `can(session.user.role, { song: ["create"] })` (or `["delete"]`). If either
     fails it returns `{ error: "Only owners can change channels." }` and
     writes nothing. Then it parses with `parseSong(Object.fromEntries(form))`
     (or reads a string `id`), calls the store and calls `refresh()` from
     `next/cache` after a successful write. Never trust a role or user id sent
     in the form.
  3. `app/(site)/(app)/music/page.tsx`:
     - The static shell holds `FigTitle n="05"` with `hint="one song per
       channel"` and the intro. Change `site.music` in `content/site.ts` to
       drop "Three" (for example "Songs on repeat, one channel each. Tune
       in.").
     - Move the TV and the Listings into a `Channels` server component that
       takes `songs`. Render
       `<Suspense fallback={<Channels songs={site.songs} />}>` around an async
       `LiveChannels`, which renders
       `<Channels songs={[...site.songs, ...await listSongs()]} />`. Key the
       Listings rows by index and video, not by title, because titles may
       repeat.
     - At the end, render `<Suspense fallback={null}><OwnerTools /></Suspense>`.
       `OwnerTools` is async. It reads `getSession()` and returns `null` unless
       `can(role, { song: ["create"] })`. Otherwise it renders a caption
       `Add a channel`, `<AddChannelForm />` and, when any exist, an "Added
       channels" list of `listSongs()` rows. Each row shows `CH nn`, title ·
       artist, and a `<RemoveChannelButton id=… />`.
  4. `components/add-channel-form.tsx` (`"use client"`): `useActionState(addSong, {})`
     and a plain `<form action={formAction}>` with fields named `video`
     ("YouTube link"), `title`, `artist`, `note` (optional) and `colour` (a
     `<select>` of `SWATCH_KEYS`, each option with its swatch name). Use
     `Field` from `components/field.tsx` and the existing `field`, `btn` and
     `alert` classes. Show field errors under their fields, and the general
     error in an `alert` with `role="alert"`. Reset the form after `ok`.
     Disable the submit while pending ("Adding…").
  5. `components/remove-channel-button.tsx` (`"use client"`): a form with a
     hidden `id`, bound to `useActionState(removeSong, {})`. The first press
     changes the label to "Really remove?" and the second press submits. Esc or
     blur resets it. It is keyboard-reachable and has a visible focus.
  6. `components/television.tsx`: clamp the knob to
     `rotate(${-45 + 45 * Math.min(channel - 1, 6)} …)`. Make no other change.
  7. `e2e/music.test.ts`, a new file in the `rbac.test.ts` style with its own
     `owner`, `admin` and `plain` users and run id. Each test name says what it
     proves:
     - Anonymous `/music` is 200, has `CH 01`, and has no `name="video"`. The
       owner's `/music` has `name="video"`, and the admin's and the plain
       user's do not.
     - An `INSERT INTO song` by SQL (title `e2e-<run>-sql`, a valid id, the
       next position) shows up in the anonymous `/music` HTML on the next
       request, with its `CH nn`, where nn = 3 + the row count.
     - **No-JS add:** fetch the owner's `/music`, take the add form's hidden
       inputs (React renders the action reference there), add `video`,
       `title=e2e-<run>-form`, `artist`, `note` and `colour`, and POST it as
       `multipart/form-data` to `/music` with the owner's cookie and
       `origin: BASE`. The row now exists with `created_by` = the owner's id,
       and anonymous `/music` shows it.
     - **Gate:** replay the same scraped add fields, with a new title, using the
       plain user's cookie and then the admin's. Also replay the owner's remove
       form for the form row with the plain user's cookie. The `song` row count
       and the form row are unchanged.
     - **Owner remove:** replay the remove form with the owner's cookie. The row
       is gone, and anonymous `/music` no longer shows it.
     - **Refusals:** a duplicate video, and an invalid link (`https://evil.com/watch?v=…`),
       add no row.
     - `after` deletes `song` rows whose title starts with `e2e-<run>`, before
       it deletes the users.
  8. `scripts/walk-music.sh`, in the frame of `scripts/walk-capsule.sh`
     (copied, not shared). It builds and runs `next start` on `PORT` (default
     4025) with no database, or walks `BASE_URL`. Checks:
     - `/music` is 200.
     - `build-sha` is `EXPECT_SHA` locally, or any 40-hex sha remotely.
     - `CH 01`, `CH 02` and `CH 03` are each present.
     - The three starter titles from `content/site.ts` are present (read
       them from the file, do not copy them).
     - No `name="video"` for anonymous visitors.
     - Locally, exactly 3 `CH ` listing labels (the no-DB fallback). Remotely,
       at least 3.
     - Locally, no server is left on `PORT` afterwards.
     Use `grep -c` with numeric tests and never `wc -l`.
  9. `README.md`: under `/music`, say that owners add channels from the page,
     that the starters live in `content/site.ts`, and that there are at most
     12. Add `lib/songs.ts` and `lib/songs-store.ts` to Layout, and the walk
     line `bash scripts/walk-music.sh` to Tests.
  10. Commit and push with the owner identity.
- **Interfaces:** `lib/songs-store.ts`; `app/(site)/(app)/music/page.tsx`;
  `app/(site)/(app)/music/actions.ts`; `components/add-channel-form.tsx`;
  `components/remove-channel-button.tsx`; `components/television.tsx`;
  `content/site.ts`; `e2e/music.test.ts`; `scripts/walk-music.sh`; `README.md`
- **Non-goals:** editing, reordering or removing the three starters; editing an
  added song (remove and re-add instead); admin or user access; Spotify playlist
  sync; audio uploads; any change to `proxy.ts`, CI, Shore or Capsule.
- **Acceptance:** A signed-in owner sees **Add a channel** on `/music`. A valid
  YouTube link adds the next channel for every visitor at once, and **Remove**
  (pressed twice) takes it away. Admins, users and anonymous visitors see no
  form, and their POSTs change nothing. With no database, `/music` still shows
  the three starters with status 200.
- **Verification:**
  - `npm ci && npm run lint && npm run typecheck && npm test` (900 s)
  - `npx drizzle-kit check && npm run db:generate && test -z "$(git status --porcelain db/migrations)"`
  - `bash -n scripts/walk-music.sh && ! grep -nE 'wc +-l' scripts/walk-music.sh`
  - `bash scripts/e2e-local.sh` (1200 s; runs `e2e/rbac.test.ts` and `e2e/music.test.ts`)
  - `bash scripts/walk-music.sh` (900 s)
  - `if BASE_URL=http://127.0.0.1:4031 bash scripts/walk-music.sh; then exit 1; fi` (the walk fails when nothing is there)
  - `test -z "$(docker ps -q --filter name=otohime-e2e-)"`
  - `test "$(git log -1 --format=%ae)" = quiinthieu@gmail.com`

## QA and acceptance

- **QA, task 1.** Run `bash scripts/e2e-local.sh` at the delivery sha. On a
  local build with that DB, sign up, promote yourself by SQL (README), and look
  at `/admin/roles`: there is a `song` row with `create` and `delete`, and the
  dot is under owner only. Production cannot show this to QA without the site
  owner's login, so QA does not try.
- **QA, task 2.** Run `bash scripts/e2e-local.sh` and `bash scripts/walk-music.sh`
  at the delivery sha. Use a browser if the lease allows it (on macOS turn the
  Bash sandbox off; use `exact: true` on role names). On a local build: as
  owner, add a channel from a `youtu.be` link and see `CH 04` on the TV and in
  Listings. Remove it with two presses. Check that an admin sees no form. Then
  read the deployed `build-sha` immediately before
  `EXPECT_SHA=<sha> BASE_URL=https://otohime.dev bash scripts/walk-music.sh`,
  and cite that sha. Docs-only pushes redeploy, so re-read it after the walk.
- **Acceptance.** Walk production with `scripts/walk-music.sh` at the deployed
  sha, plus CI's `checks` job for that sha, which runs both e2e files against
  Postgres, or `bash scripts/e2e-local.sh` at that sha. The real owner adding
  a channel on production is advisory and never a gate. Nothing here is
  scheduled or dated, so no watch is needed.

## Risks

- **First Server Actions in the repo.** The file must be `"use server"` with
  async exports only. Typed routes and lint are fine with it. If the no-JS
  replay cannot find the hidden action inputs under `useActionState`, read
  React's rendered form in a local build before you change the approach, and
  record any change with `plan_manager_record_decision`.
- **Session reads under Cache Components.** `getSession()` and `connection()`
  must stay inside `<Suspense>`, or `next build` fails. The build is part of
  every verification.
- **Rollback.** Remove `OwnerTools` and `LiveChannels` and `/music` is the old
  page again. The table can stay (expand-only), so no down-migration is ever
  needed.
- **Docker on the runner.** `scripts/e2e-local.sh` needs docker. Docker 29.6
  runs on the planning lease. If a gate runner has none, the script exits 2
  with a clear message; that is an environment cause, not a code one.
