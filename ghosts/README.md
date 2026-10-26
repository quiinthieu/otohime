# Ink ghosts

Anonymous, short-lived cursors from other visitors on Home (`/`) and Ryugu-jo (`/ryugu`). This folder holds the
transport. The client canvas, the Pocket switch and the deploy workflow follow in pm-257 tasks 2 to 5.

The folder is neutral and top-level on purpose. The palace may not import from `components/`, `lib/` or other route
groups, so both roots can share `ghosts/`.

## Pieces

| Path | What it is |
|---|---|
| `protocol.ts` | Wire messages, limits and the frame parser. Pure: it runs in the Worker, the fake and the browser. |
| `policy.ts` | Upgrade admission: method, `Upgrade`, exact `Origin` and one of the two rooms. |
| `room.ts` | The pure room state machine: cap, token bucket, invalid strikes, fan-out effects and attachment validation. |
| `worker/` | The Cloudflare Worker (`src/index.ts`) and the `GhostRoom` Durable Object (`src/room-do.ts`). Its own locked package. |
| `../scripts/ghosts-fake.mjs` | A dependency-free local fake that uses the same policy and room. It also holds the raw test client and the shared contract cases. |

The Worker and the fake never reimplement a limit. Both turn `Room` effects into socket sends and closes, so a
limit changed in `room.ts` or `protocol.ts` changes everywhere.

## Protocol

`GET /ghosts?room=%2F` or `GET /ghosts?room=%2Fryugu` upgrades to a WebSocket. Nothing else upgrades.

- The client sends `{"t":"m","x":…,"y":…}` (move) or `{"t":"c","x":…,"y":…}` (click). Coordinates must be finite
  numbers. They are clamped to [0,1] and rounded to 4 decimals. Any other field, a client `id` included, is ignored.
- The server sends:
  - `{"t":"hi","id","n"}` to the newcomer
  - `{"t":"m"|"c","id","x","y"}` to the other members only
  - `{"t":"bye","id"}` and `{"t":"n","n"}` when someone leaves (`n` is also sent on a join)
  - `{"t":"full"}` before a 1013 close

  `n` is the total number of members in the room.
- Each connection's `id` is a fresh `crypto.randomUUID()`, never supplied by the client.

## Limits

These are defined once in `protocol.ts` and enforced by `room.ts`.

| Limit | Value | Effect |
|---|---|---|
| Room cap | 24 sockets | The 25th gets `{"t":"full"}` and close 1013. It never joins. |
| Frame size | 128 UTF-8 bytes | A larger frame is invalid. The fake ends a frame over 1 KiB on the wire with 1009 without buffering it. |
| Rate | 15-token bucket, refills 15/s, per connection | Every incoming frame spends a token, invalid ones included. With no token left, the frame is dropped unread and nothing fans out. |
| Invalid frames | 5 | Binary, oversize and malformed frames count. The fifth closes 1008. Valid frames don't reset the count. |

## Admission

The Worker decides admission before it allocates a Durable Object, in this order:

| Request | Answer |
|---|---|
| Not GET | 405 (workerd itself answers a POST carrying `Upgrade` with 400) |
| No `Upgrade: websocket` | 426 |
| `Origin` missing, `null`, malformed, or not exactly in `ALLOWED_ORIGINS` | 403 |
| Room missing, repeated or unknown | 404 |
| Any other path | 404 |

`ALLOWED_ORIGINS` is a comma-separated list of exact origins (`wrangler.jsonc`, production `https://otohime.dev`).
A malformed entry is dropped, never widened, and an empty list admits nobody. The Worker selects one `GhostRoom` per
canonical room with `idFromName`.

## Privacy boundary

- **Visitor data.** The application reads no identity, cookie value, IP or UA, and stores none. The Worker forwards
  a fresh request that carries only `upgrade: websocket` to the room, so no visitor header reaches the Durable
  Object. `test:local` checks this.
- **State.** The only state is the in-memory `Room` plus one hibernation attachment per socket. The attachment holds
  exactly `{id, tokens, at, invalid}` and is released with the socket. `readMemberState` rejects anything else,
  coordinates included.
- **Storage.** There is no Durable Object storage, SQL, KV, alarms, history or analytics. The namespace is SQLite-backed
  only because new namespaces must be. `test:local` asserts zero storage keys and no application tables.
- **Logs.** There are no visitor logs. `wrangler.jsonc` turns observability, invocation logs and logpush off.
  `bundle:check` fails if the bundle mentions `console.`, storage, SQL, alarms, cookies, IP, UA or `__test`.
- **The fake's log.** It is test evidence: capped (500 by default), in memory only, and lost with the process. It
  records accepted coordinates and whether `Origin`/`Cookie` were present, as booleans, never header values.
- **Provider metadata.** Cloudflare's own network metadata is outside this application-level promise.

## Hibernation

`GhostRoom` uses `ctx.acceptWebSocket` and the `webSocketMessage`, `webSocketClose` and `webSocketError` handlers.
A woken instance rebuilds membership, buckets and strikes from `ctx.getWebSockets()` and each socket's attachment,
so a wake can't reset a cap or a penalty. A socket without a valid attachment is closed 1011. `test:local` proves
this on demand, with no idle wait: `test/reentry-entry.ts` wraps the real routing and `GhostRoom`, and rebuilds
`GhostRoom` on the live `DurableObjectState` mid-session. That wrapper is never deployed.

## Commands

From the repo root (these run in `npm test`):

```sh
node --experimental-strip-types --test 'ghosts/*.test.ts'      # protocol, policy and room
node --experimental-strip-types --test scripts/ghosts-fake.test.mjs
node --experimental-strip-types scripts/ghosts-fake.mjs --port 8788 --origins http://localhost:3000
```

The fake prints `ghosts-fake ready ws://127.0.0.1:<port>/ghosts`. It supports four modes:

| Mode | Behaviour |
|---|---|
| `normal` | The same limits as the Worker. |
| `refuse` | Answers upgrades with 503. |
| `full` | Sends `{"t":"full"}` and closes 1013. |
| `flap` | Greets, then drops the connection after 50 ms. |

Its controls answer only loopback callers that send no `Origin`:

| Request | Action |
|---|---|
| `GET /__ready` | Readiness |
| `GET /__log` | The capped log |
| `POST /__reset` | Closes every socket, clears the log, back to `normal` |
| `POST /__mode?m=<mode>` | Switches mode |

In `ghosts/worker` (its own lock; the root `npm ci` does not install it):

```sh
npm ci
npm run typecheck     # tsc against @cloudflare/workers-types
npm run test:local    # the actual Worker + GhostRoom in workerd (wrangler startWorker, real DO bindings)
npm run bundle:check  # wrangler deploy --dry-run into a temp dir; asserts exports, fingerprint, forbidden APIs
npm run fingerprint   # the code+lock+config fingerprint and per-file hashes
```

`GET /version` returns only `{"service":"otohime-ghosts","fingerprint":"<sha256>"}`. The fingerprint is a sha256 over
`src/**/*.ts`, the shared `protocol.ts`, `policy.ts` and `room.ts`, `package.json`, `package-lock.json` and
`wrangler.jsonc`. It is injected at bundle time as `__GHOSTS_FINGERPRINT__` and reads `unbuilt` without one.

The compatibility date is pinned (`2026-10-15`). `.wrangler/`, `node_modules/`, `dist/` and `.dev.vars*` are
git-ignored inside the package.

## Not here yet

- Client rendering, `/api/ghosts` and `GHOSTS_ENDPOINT` (task 2).
- The Pocket hide switch (task 3).
- Two-browser proof, CI wiring and the deploy workflow (task 4).
- Production activation (task 5).

No hosted deployment or credential exists yet. Nothing in this folder proves live fan-out.
