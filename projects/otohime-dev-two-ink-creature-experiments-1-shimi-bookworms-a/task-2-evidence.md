# t-1771 — Inkblot migration and moderated answers API

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
