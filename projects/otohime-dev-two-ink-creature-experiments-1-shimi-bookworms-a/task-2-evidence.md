# t-1771 — Inkblot migration and moderated answers API

## Delivery recovery: run-9700

Branch: `pm-300-t-1771-moderated-answers`. Freshly fetched base:
`250705f` (`origin/main`). The implementation is unchanged from rescued commit
`4d1ec50`; source, migration, tests, lockfile and configuration were compared
directly. Only this evidence was updated. Owner Git identity was configured and
checked with the required repository scripts.

The previous run's actual persisted failure was
`push_not_on_main: HEAD 7924eea740d0 is not on origin/main`. Its successful branch
push and submitted summary did not satisfy integration delivery. This run will
push the task branch with `git push origin HEAD` and fast-forward the same tested
commit onto `main`; it will not wait for CI or check deployment.

Recovery preserved the original rescue on
`pm-300-t-1771-api-recovery-run-9700`, then replayed only `4d1ec50` without
committing onto the final branch from freshly fetched main. Dropped rescue commit
`49c183f`, which contained only generated `content/history.json` changes. No CSS
or crumple-test changes were carried into this task: those paths already match
main. Build-generated history was restored using the contract's
`git checkout -- content/history.json`. No rescue commits were rewritten.

### Fresh verification

| Check | Observed result |
| --- | --- |
| `npm ci` | Exit 0, unchanged lockfile |
| `npx drizzle-kit check` | Exit 0, `Everything's fine` |
| `npm run db:generate` | Exit 0, `No schema changes, nothing to migrate` |
| Required targeted unit suite | 39 tests, 39 pass, 0 fail/skip |
| `TMPDIR=/tmp npm test` | 2741 tests, 2741 pass, 0 fail/skip |
| Required fresh-build embedded-Postgres E2E | 5 tests, 5 pass, 0 fail/skip |
| `TMPDIR=/tmp npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0, 13 existing warnings outside task files |
| Snapshot comparison | All existing tables unchanged; only two Inkblot tables added |
| Working and staged `git diff --check` | Exit 0 |

Both verification commands from the contract are used. The clean-migrations
status assertion is run after committing the migration, since its staged addition
necessarily appears in porcelain status before commit. Raw logs and
`commits.txt` are retained in `SHARED_DIR/artifacts`.

```text
ok 1 - expand-only migration upgrades 0000..0005 and preserves existing user/guestbook/bottle data
ok 2 - real API persists normalized pending notes, server decorations, and no raw IP
ok 3 - GET filters approved rows by blot key and paginates tied microsecond timestamps without duplicates
ok 4 - negative controls reject malformed/foreign/profane/URL/oversized/key requests without inserting or consuming quota
ok 5 - concurrent hour, day and pending-cap admission are atomic and denied requests leave no quota residue
# tests 5
# pass 5
# fail 0
# skipped 0
```

The E2E command constructs the actual `pg.Pool` and store adapter, applies the
migrations to real embedded PostgreSQL 17, builds the production Next application
and exercises the real route over HTTP. Negative controls verify invalid inputs
produce neither inserted notes nor quota consumption. Concurrent requests prove
the hourly 3-of-12, daily 1-of-8 at 99, and pending 1-of-8 at 499 limits. Unit
tests use an injected fake store; the E2E harness's unrelated Ghosts service is a
fake. Neither replaces PostgreSQL or the Inkblot route.

Execution environment: Linux/x86_64, Node `22.23.3`, Next `16.4.2`, pg `8.23.1`,
Drizzle ORM `0.45.4`, drizzle-kit `0.31.11`, embedded-postgres `17.10.0-beta.17`,
all installed with the unchanged lockfile. Production build ID:
`Q0mR2vAwiFKRtVPUNm6wK`. Executable/configuration/test/migration fingerprint:
`18c4e0f7586ad83af6f884366814cbc75f73018a15f267a528989de5a62dbfc0`.
`t1771-build-identity.json` records the sorted path-to-SHA256 map and the SHA256
of its canonical JSON. Actual run profile from persisted run metadata:
`codex-sol-6-1-high`, model `gpt-6.1-sol`, effort `high`; worker `avietidol-z490`.

History inspection: task-manager project `plan-manager`, FAILED and COMPLETED
offsets 0 and 20, limit 20 each (40 FAILED of 155, 40 COMPLETED of 1187), plus all
6 current global RUNNING tasks. This bounded history is **not exhaustive**. The
direct previous-task read confirms FAILED, its raw 1153-line runner tail ends in
the main-ancestry guard and rescue push, and persisted run metadata reports
`callback_apply_failures=0`. Board task t-1771 still cites prior summary rep-5777
and is leased to run-9700 after failed_run. Earlier logs outside the tail and old
artifacts were not re-read; their historical assertions below are not fresh
proof. No asynchronous runtime or ingestion pipeline is changed by this API.
Fresh local attempts in this run all passed; no known executable defect remains.

Integration deployed: unobserved. Waiting for capacity: none. Execution
demonstrated: local production API and real PostgreSQL. Product delivered:
backend implementation only; frontend is Task 3. CI, green gate and deployed QA
remain owned by plan-manager for t-1771 at the pushed SHA; a failed check returns
this task for repair. No CI result is claimed or awaited.

## Historical run-9693 evidence (superseded by the fresh results above)

Run: `run-9693`, plan `pm-300`. Branch: `pm-300-t-1771-inkblot-api`.
Base: `573b70e9de539096f3f9e296fe075307b3fe288f` (`origin/main` freshly fetched).

Added expand-only migration `0006_funny_spencer_smythe`, the two Drizzle tables,
and `/api/inkblot/answers` GET/POST. No existing migration, dependency or lockfile
was changed. Owner identity was configured and checked before schema work.

POST accepts `{ blotKey, name?, note, website? }`, normalizes NFKC and whitespace,
counts Unicode code points, and rejects URLs, profanity, populated honeypots,
foreign Origin, invalid keys, and caller-supplied moderation/decorations. It caps
actual streamed bytes at 4096. The server supplies tilt/hand; insertion is always
pending. Namespaced HMAC buckets store no raw IP. A transaction-scoped advisory
lock serializes the 3/hour IP limit, 100/day global limit and 500 pending cap,
with bounded cleanup of expired usage buckets. Missing configuration or database
failures fail closed. The public projection excludes review metadata.

GET requires one `blot` key and at most one canonical cursor. Approved rows are
ordered by descending creation timestamp and ID, 24 per page, preserving all six
fractional timestamp digits. Historical valid daily keys remain readable; POST
accepts only daily keys within ±1 UTC day. All handled responses are `no-store`.

## Execution identity and boundaries

- Node `22.23.3`, Darwin/arm64, Next `16.4.2`, pg from the unchanged npm lock,
  `embedded-postgres` `17.10.0-beta.17` (real PostgreSQL 17 binaries).
- Relevant source/configuration/migration/test/lock fingerprint (SHA-256):
  `b9d6305c510893d0dc5ac76083281b66f12c351f3a509890ddcfd15f331a2302`.
- Lock SHA-256: `9d0bded9b7c00b1dcb124931f68d266b0bbd5643437fb023d81ee2d505e23f7b`.
- Migration SHA-256: `2fe8ce63a2a5f7fbb54d66759c6adee7a8d773856e18acb0344140843cb5bfb3`.
- Final production Next build ID: `aaRzhfTxOx6BkDubtQhKv`.
- E2E ran the actual production build and `next start`, real route, `pg.Pool`
  construction, store adapter, migrations and embedded database. No fake runner
  or in-memory database substitutes for this proof. HTTP unit tests inject a fake
  store; the existing unrelated Ghosts fixture is fake in the E2E harness.
- Agent role is `software_engineer` through Codex. The session does not expose an
  exact model/profile/effort identifier; none is inferred from platform defaults.

## Verification output

| Check | Result |
| --- | --- |
| `npx drizzle-kit check` | Exit 0, `Everything's fine` |
| `npm run db:generate` (after initial generation) | Exit 0, `No schema changes, nothing to migrate` |
| Targeted strip-types unit command below | 39 tests, 39 pass, 0 fail/skip |
| Full `TMPDIR=/tmp npm test` | 2741 tests, 2741 pass, 0 fail/skip |
| `TMPDIR=/tmp npm run typecheck` | Exit 0 |
| `npm run lint` | Exit 0; 0 errors, 11 existing warnings outside changed files |
| Full-build embedded-Postgres E2E command below | 5 tests, 5 pass, 0 fail/skip |
| `git diff --check` | Exit 0 |

```sh
TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/inkblot.test.ts lib/inkblot-http.test.ts lib/ask-llm.test.ts
TMPDIR=/tmp node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e.mjs --test 'e2e/inkblot-api.test.ts'
```

Final E2E TAP summary:

```text
ok 1 - expand-only migration upgrades 0000..0005 and preserves existing user/guestbook/bottle data
ok 2 - real API persists normalized pending notes, server decorations, and no raw IP
ok 3 - GET filters approved rows by blot key and paginates tied microsecond timestamps without duplicates
ok 4 - negative controls reject malformed/foreign/profane/URL/oversized/key requests without inserting or consuming quota
ok 5 - concurrent hour, day and pending-cap admission are atomic and denied requests leave no quota residue
# tests 5
# pass 5
# fail 0
# skipped 0
```

The upgrade test applies 0000–0005 in an isolated schema, inserts existing user,
guestbook and bottle sentinel data, applies 0006 and verifies preservation. It
checks the public index and database rejection of invalid status, tilt, hand and
empty note. The suite verifies pending/rejected/other-blot rows never leak, and
26 tied microsecond timestamps paginate exactly once. Concurrent bursts prove
exactly 3 of 12 admitted for an IP, exactly 1 of 8 at daily usage 99, and exactly
1 of 8 at pending count 499. Denied requests leave no hourly quota residue.

Negative controls send malformed JSON, URLs, obfuscated profanity, foreign
Origin, oversized text/body, invalid blot keys, impossible cursor dates and
caller-controlled status/tilt/hand. HTTP rejection, unchanged answer count and
unchanged usage are asserted against real Postgres.

Local run history is complete: initial unit run failed because the new module
was absent; initial full-build E2E had 4 passes and one test assertion failure
because Drizzle emits `DESC NULLS LAST`; the corrected test-only rerun reused that
build and passed 5/5. A separate failing unit regression demonstrated that the
shared cursor parser accepts impossible dates. After the Inkblot-specific fix,
the final targeted tests and a fresh full-build E2E passed. Raw logs and the
complete fingerprint manifest are copied into the run's shared artifacts.
There is no durable runtime queue or paginated job history for this API task.

The verification command's `git checkout -- content/history.json` suffix was
replaced by restoring a byte-for-byte backup taken before the first build:
that file already had unrelated changes at task entry. It is excluded from the
commit. Migration generation is checked again after the task commit, when the
contract's clean-`db/migrations` assertion can be evaluated.

## Delivery scope

Local API execution is demonstrated. A branch push preserves this implementation;
main integration, CI and deployed acceptance are not demonstrated here. No runtime
capacity or operator prerequisite is pending. Per the software-engineer contract,
plan-manager owns CI/green-gate/QA after push; a failed gate must return this task
for repair. No frontend is delivered by t-1771.
