# Ink ghosts

Anonymous, short-lived cursors from other visitors on Home (`/`) and Ryugu-jo (`/ryugu`). This folder holds the
transport and dynamically loaded client canvas. The Pocket switch and deploy workflow follow in pm-257 tasks 3 to 5.

The folder is neutral and top-level on purpose. The palace may not import from `components/`, `lib/` or other route
groups, so both roots can share `ghosts/`.

## Pieces

| Path | What it is |
|---|---|
| `protocol.ts` | Wire messages, limits and the frame parser. Pure: it runs in the Worker, the fake and the browser. |
| `policy.ts` | Upgrade admission: method, `Upgrade`, exact `Origin` and one of the two rooms. |
| `room.ts` | The pure room state machine: cap, token bucket, invalid strikes, fan-out effects and attachment validation. |
| `config.ts`, `../app/api/ghosts/route.ts` | Request-time endpoint parsing and no-store configuration (404 when disabled). |
| `client.ts` | Bounded client model, defensive server parser, lifecycle controller and 2D painter. |
| `loader.tsx`, `canvas.tsx` | Idle client-only page boundary, passive input observers and decorative viewport canvas. |
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

The fake rejects any RSV1/2/3 wire bit with 1002 before reading the payload; no WebSocket extensions are
negotiated. The same masked-wire cases run against workerd. Bucket timestamps retain their high-water mark
across clock rollback and attachment restoration: time recovery alone never grants tokens.

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

## Client runtime

Set `GHOSTS_ENDPOINT=wss://<dedicated-worker-host>/ghosts` at runtime to enable only Home and `/ryugu`.
`GET /api/ghosts` awaits `connection()` before reading it and always returns `Cache-Control: no-store`.
Unset or malformed values return an empty 404. Credentials, fragments, base queries and same-origin secure
endpoints are rejected. For local production-build proof, `ws://127.0.0.1:<port>/ghosts` works only when the
page also uses a loopback host; no hosted configuration is changed by local proof.

Both pages mount the neutral idle loader. The canvas is portalled to `document.body`: Home's entrance animation
would otherwise give a fixed descendant page-sized rather than viewport-sized bounds. Styles are inline,
`pointer-events:none`, and the whole layer is `aria-hidden`, with no focus target or live region. Other-member
count is separate from drawable tips; a silent connected visitor still contributes to the subdued `N here` label.

The controller sends movement at most every 100ms after a 0.002 normalized deadzone. It bounds the remote map to
24 entries, trails to 12 points, ripples to 48 and DPR to 1.5. Trails and ripples fade in 700ms; silent tips disappear
at six seconds using one expiry timer. It requests animation frames only for fading work or a single event/resize
redraw. `data-ghosts-state`, `data-ghosts` and cumulative `data-ghosts-ripples` expose state, other connected members
and actual ripple paint calls, respectively. The counter alone is not proof of visible rendering.

Reduced motion, hidden documents, offline state and unmount close sockets, abort configuration fetches, clear
marks and cancel timers/frames. The adapter removes pointer/resize observers while ineligible. Config and socket
handshakes have an eight-second attempt deadline; retryable failures allow three total attempts, delayed by 1s
and 3s after the preceding failure. Full rooms terminate immediately. Disabled configuration stays off. The budget
belongs to the mounted controller: the task-3 preference must toggle eligibility rather than recreate that budget.
Local pointerdown feedback is immediate; wire clicks are limited to 5Hz alongside movement's 10Hz.

The existing explicit `ghosts/*.test.ts` glob runs the client and config tests in `npm test`.
`config.test.ts` executes the actual GET body with only Next's request-context boundary substituted. Client tests
use an injected clock/socket/scheduler and canvas method recorder. These prove policy, lifecycle and paint calls;
real-browser pixel and geometry evidence is distinct, and neither proves a hosted Worker deployment.

## Not here yet
- The Pocket hide switch (task 3).
- Two-browser proof, CI wiring and the deploy workflow (task 4).
- Production activation (task 5).

Production activation is out of scope for the client delivery. Local fake-server/browser evidence does not prove hosted fan-out.
