# t-1567 Health reports the build sha: summary (run-8734, claude-opus-5-5)

## Delivered
- `lib/build-info.ts` (pure, no imports): `buildSha(raw)` returns the trimmed sha, or `dev` when it is unset or
  blank. `healthBody(raw)` returns `{ ok: true, sha }`.
- `app/api/health/route.ts`: the `select 1` database check is unchanged, and the route now answers
  `Response.json(healthBody(process.env.BUILD_SHA))`. It reads the literal `process.env.BUILD_SHA` because
  `next.config.ts` sets `BUILD_SHA` (GITHUB_SHA, then VERCEL_GIT_COMMIT_SHA, then dev) through `env`, which inlines
  only that exact expression at build time. On Vercel it is not a runtime variable, so a helper that read
  `process.env` itself would answer `dev` in production.
- `lib/build-info.test.ts` (6 tests): the pure helper, an exact `{ok, sha}` key set, a source scan that keeps the
  literal read in the route and the db check ahead of it, next.config still defining BUILD_SHA, and the README note.
- `README.md`: the line next to `<meta name="build-sha">` now notes `/api/health`'s `{ok: true, sha}`.

## Evidence (macOS build-worker lease, Node 22.12.0, Next 16.4.2 Turbopack)
| check | result |
| --- | --- |
| `npm ci && npm test` | exit 0, 1995/1995 pass (1989 before, plus 6 in `lib/build-info.test.ts`) |
| `npm run typecheck && npm run lint` | exit 0, 0 errors, the same 10 pre-existing warnings, none in touched files |
| negative control: new tests with the old route stashed | test 4 (`/api/health answers healthBody(process.env.BUILD_SHA)`) fails, 5/6 pass |
| `GITHUB_SHA=feedc0de1234567890 next build` | exit 0; the compiled health chunk holds `Response.json((0,o.f)("feedc0de1234567890"))`, so the sha is inlined at build |
| real HTTP: `SKIP_BUILD=1 node scripts/e2e.mjs` (embedded Postgres 17, migrations, `next start`) with an out-of-repo probe | `GET /api/health` returned 200 `{"ok":true,"sha":"feedc0de1234567890"}` |
| negative control on the HTTP probe (EXPECT_SHA=dev) | fails, exit 1 |

## Boundaries
- Real: Next build, `next start`, embedded Postgres, HTTP GET. Fake: the sha (`feedc0de1234567890` stands in for GITHUB_SHA).
- Not done here (non-goals, later tasks of Cycle 2): production still serves the old build until `checks` are green
  on main (task 2), and the production job's `/api/health` sha == GITHUB_SHA assertion is task 3. Production's
  `{ok, sha}` is therefore unobserved until a deploy runs.
