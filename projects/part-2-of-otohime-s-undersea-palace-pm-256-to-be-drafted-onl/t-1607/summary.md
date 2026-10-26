# t-1607 · Bounded ghost rooms and Worker adapter · run-8976 summary

Plan pm-257 (Ink Ghosts), task 1 of 5. Role: software engineer. Run profile: Claude Opus 5.5 (`claude-opus-5-5`).
The delivery commit is the `pm-257/t-1607:` commit listed in `commits.txt`.

## What changed

- `ghosts/protocol.ts`, `ghosts/policy.ts`, `ghosts/room.ts`: the shared wire protocol, upgrade admission and pure
  room state machine, with an injected clock. The limits:
  - rooms `/` and `/ryugu` only
  - an exact Origin allowlist
  - 24 sockets per room (then `{t:"full"}` and close 1013)
  - frames up to 128 UTF-8 bytes
  - a 15-token bucket refilling at 15/s, spent by every attempt
  - five invalid frames, then close 1008

  Accepted events go to the other members only, with a server-minted id.
- `ghosts/worker/`: its own package with an exact lock (wrangler 4.152.0, workerd 1.20261019.1,
  @cloudflare/workers-types 5.20261026.1, typescript 5.9.3) and compatibility date 2026-10-15.
  - `src/index.ts` admits through the shared policy before allocating a DO. It forwards a fresh `upgrade`-only
    request, so no cookie, IP or UA reaches the room, and serves `/version`.
  - `src/room-do.ts`: `GhostRoom` (SQLite namespace) uses `acceptWebSocket` and the hibernation handlers. It
    rebuilds from `getWebSockets()` plus attachments that hold exactly `{id,tokens,at,invalid}`.
  - Observability, logs and logpush are off.
  - Scripts: `typecheck`, `test:local`, `bundle:check`, `fingerprint`.
- `scripts/ghosts-fake.mjs`: a dependency-free fake on the same policy and room.
  - Modes: normal, refuse, full, flap.
  - Controls: loopback-only and refused when an Origin is sent; ready, log, reset and mode.
  - Log: capped and in memory. It holds coordinates and header-presence booleans only.
  - Teardown is deterministic.
  - The module also exports the raw test client and `CONTRACT_CASES`/`NEGATIVE_UPGRADES`, which run against both
    the fake and the actual Worker.
- `package.json`: `npm test` adds `'ghosts/*.test.ts' 'scripts/ghosts-fake.test.mjs'`. `tsconfig.json` and
  `eslint.config.mjs` exclude `ghosts/worker` only.
- Two existing guard tests (`lib/ask-deploy.test.ts`, `lib/plan-release.test.ts`) pinned `tsconfig.exclude` to
  `["node_modules"]`. They now pin `["node_modules", "ghosts/worker"]`.
- Docs: `ghosts/README.md` (architecture and privacy boundary) and `changelogs/ghosts.md`.

## Verification (lease checkout, darwin, node 22.23.3)

| Contract command | Result |
|---|---|
| `node … --test 'ghosts/*.test.ts'` | exit 0, 23/23 |
| `node … --test scripts/ghosts-fake.test.mjs` | exit 0, 18/18 |
| `cd ghosts/worker && npm ci` (from an empty node_modules) | exit 0 |
| `npm run typecheck` (worker) | exit 0 |
| `npm run test:local` (worker) | exit 0, 14/14 |
| `npm run bundle:check` (worker) | exit 0: `index.js` 12336 bytes, fingerprint `54ea22a371c9031e7f6e7801a246aea25a9b11841ccaa2ff1390bc48d186574e` |
| `npm test` | exit 0, 2302/2302 |
| `npm run lint` | exit 0, 0 errors; 10 warnings, none in touched files (the baseline count) |
| `npm run build` | exit 0, run from an APFS clone at `/tmp/oto-8976` with `.next` removed (the known lease-path next/font lesson) |
| `npm run typecheck` (root) | exit 0 (not a contract item, but CI runs it) |

`test:local` runs:

1. The 8 shared contract cases (pairs, bye, room isolation, 13 refusals, frame strikes, rate, cap, `/version`)
   against the Worker started from `wrangler.jsonc`.
2. A re-entry suite against `test/wrangler.reentry.jsonc`. It wraps the real routing and `GhostRoom`, and rebuilds
   `GhostRoom` on the live `DurableObjectState` mid-session. The suite checks that:
   - four strikes plus one closes 1008 after the rebuild
   - a drained bucket stays drained
   - fan-out reaches the restored sockets
   - 24 still means full
   - the storage key count is 0 and there are no application tables
   - the room received only the `upgrade` header
3. Static privacy checks of the config and source.

### Negative controls (mutations, each reverted)

| Mutation | Result |
|---|---|
| GhostRoom does not restore from attachments | 2 re-entry tests fail |
| Restore resets tokens/strikes | re-entry test 1 fails |
| Worker forwards the visitor's request to the DO | re-entry test 1 fails (header names) |
| Coordinates added to the attachment | re-entry test 1 fails |
| Origin allowlist replaced by "whatever was sent" | contract case "bad upgrades" fails |
| `console.log` in the Worker | `bundle:check FAIL bundle mentions console.` |

The unmutated control passes 14/14 and `bundle:check PASS`.

## Defects found and fixed during the run

- workerd refused to start because `src/index.ts` exported non-handler values: every export of the entry module is
  an entrypoint. The helpers moved to `src/version.ts`, and `bundle:check` now requires the exports to be exactly
  `[GhostRoom, default]`.
- The fake's CLI printed its ready line before installing its SIGTERM handler, so an immediate kill exited by signal.
  A parallel stress run found this (1 failure in 8). The handlers now come first. 24 parallel runs pass afterwards.
- A missing close made a test hang instead of failing. Every close wait is now bounded (`waitClosed`), with
  per-test timeouts.

## Boundaries and what is not proven

- What is real: the Worker and Durable Object code in workerd/Miniflare with real DO bindings and attachments,
  driven over loopback sockets.
- What is not: no Cloudflare account, deploy or edge was involved. Hibernation is simulated by rebuilding the
  instance, not by real eviction.
- Local runtime differences:
  - workerd answers a POST carrying Upgrade with 400 before the Worker runs, so the shared case accepts 405 or 400.
  - Miniflare creates a `__miniflare_do_name` table, which the storage assertion treats as runtime-owned.
- Not done here:
  - The Worker tests are not in `.github/workflows/ci.yml`. That is task 4's interface, and root CI's `npm ci` does
    not install `ghosts/worker`.
  - No client, endpoint or deploy exists yet (tasks 2 to 5). Live fan-out is unproven.
- `npm audit` in `ghosts/worker` reports undici advisories (1 high, 2 moderate) via miniflare/wrangler. These are
  the local dev runtime only, not in the Worker bundle. wrangler 4.152.0 was the latest at pin time.
- `content/history.json` was already modified in the lease checkout before this run (prebuild output). It is not
  part of this delivery.
