# Ink ghosts

Anonymous, short-lived cursors from other visitors on Home (`/`) and Ryugu-jo (`/ryugu`). This folder holds the
transport, persistent Pocket switch and dynamically loaded client canvas. Deploy automation follows in pm-257 tasks 4 to 5.

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
| `pref.ts`, `pref-client.ts` | Pure preference store and React `useSyncExternalStore` adapter shared by both roots. |
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

`GET /version` returns only `{"service":"otohime-ghosts","fingerprint":"<sha256>","workerVersionId":"<uuid>"}`.
The version id comes from Cloudflare's `WORKER_VERSION` version-metadata binding (null when no binding is supplied). The fingerprint is a sha256 over
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

The optional browser canvas uses `GET /api/ghosts?probe=1`: disabled configuration returns HTTP 200 with JSON
`null`, so an intentional off state does not create a failed subresource or browser console error. Enabled
configuration returns the same endpoint/rooms object. The ordinary GET retains its empty disabled 404;
both forms remain runtime-only and `no-store`.

Both pages mount the neutral idle loader. The canvas is portalled to `document.body`: Home's entrance animation
would otherwise give a fixed descendant page-sized rather than viewport-sized bounds. Styles are inline,
`pointer-events:none`, and the whole layer is `aria-hidden`, with no focus target or live region. Other-member
count is separate from drawable tips; a silent connected visitor still contributes to the subdued `N here` label.

The controller sends movement at most every 100ms after a 0.002 normalized deadzone. It bounds the remote map to
24 entries, trails to 12 points, ripples to 48 and DPR to 1.5. Trails and ripples fade in 700ms; silent tips disappear
at six seconds using one expiry timer. It requests animation frames only for fading work or a single event/resize
redraw. `data-ghosts-state`, `data-ghosts` and `data-ghosts-ripples` expose state, other connected members
and actual ripple paint calls, respectively. The counter alone is not proof of visible rendering.
The paint counter accumulates during an eligible connection and resets with the visuals when suppressed.

Reduced motion, hidden documents, offline state and unmount close sockets, abort configuration fetches, clear
marks and cancel timers/frames. The adapter removes pointer/resize observers while ineligible. Config and socket
handshakes have an eight-second attempt deadline; retryable failures allow three total attempts, delayed by 1s
and 3s after the preceding failure. Full rooms terminate immediately. Disabled configuration stays off. The budget
belongs to the mounted controller: preference changes toggle eligibility rather than recreate that budget.
Local pointerdown feedback is immediate; wire clicks are limited to 5Hz alongside movement's 10Hz.

Home's menu-only **Ghosts on/off** chip follows Dive and Sea sound. `aria-pressed=true` means ghosts enabled.
It uses the existing native button primitive, so Enter, Space and touch activate the switch without starting the game.
`localStorage["ghosts"] === "hidden"` suppresses ghosts; enabling removes the key. Missing or malformed values
allow ghosts only when endpoint configuration and lifecycle eligibility also permit them. Server/hydration snapshots
stay hidden. Blocked storage falls back to memory for the current JavaScript page; persistence across full reloads
or other tabs cannot be provided when storage is denied.

The store notifies same-tab subscribers synchronously, follows localStorage events from other tabs (including
clear), ignores sessionStorage events, and removes its window listener when the last subscriber leaves. Both
loaders check the preference before fetching configuration. After the idle canvas first mounts, it stays mounted
to retain the attempt budget. Its direct preference subscription immediately closes transport, clears local and
remote ink, aborts config, cancels frames/retries and detaches input observers. Generation guards reject callbacks
already queued by a stopped connection. Motion, visibility and online changes reconcile the same session.

The existing explicit `ghosts/*.test.ts` glob runs the client and config tests in `npm test`.
`config.test.ts` executes the actual GET body with only Next's request-context boundary substituted. Client tests
use an injected clock/socket/scheduler and canvas method recorder. These prove policy, lifecycle and paint calls;
real-browser pixel and geometry evidence is distinct, and neither proves a hosted Worker deployment.

After `npm ci && npm run build`, `TMPDIR=/tmp npm run test:ghosts-pref` starts its own production Next server,
local fake and real Chrome. It asserts synchronous clearing, keyboard/touch behavior, persistence, cross-tab/route
updates, initial/dynamic suppression, fresh anonymous joins and budget exhaustion. Its pixel assertion rejects a
disabled-paint negative control. Visibility and offline changes are injected browser properties/events; motion uses
Chrome media emulation. No production configuration, Cloudflare credentials or database is required.

## Remaining
- Production activation and independent live acceptance (task 5).

Production activation is out of scope for the client delivery. Local fake-server/browser evidence does not prove hosted fan-out.

## Deployment and operator handoff

The Worker workflow is `.github/workflows/ghosts.yml` ("Ink ghosts Worker"). Both main path-filtered pushes
and **Run workflow** dispatches on main use the same serialized job. It skips entirely unless repository variable
`GHOSTS_DEPLOY_ENABLED` equals `true`. It has `contents: read`, no PR trigger and no fork token surface.
The Worker has a separate lock: `npm ci`, typecheck, real local workerd tests and a credential-free dry-run must
pass before the deployment step can see Cloudflare secrets. Shared `ghosts/**` changes, including protocol/policy/room,
source, Worker lock/configuration and the workflow/deploy helper itself trigger the job.

Task 4 prepares this path without provisioning, inspecting or requesting external credentials. Task 5 owns any
operator action at that dependency. The concrete operator chore, when authorized in task 5, is:

1. In the selected Cloudflare account create a narrowly scoped deploy API token: Account **Workers Scripts: Edit**,
   **Account Settings: Read**
   for account discovery if needed. Scope to that account; no DNS, zone, user, storage-data or global API key access.
   Workers Scripts permission covers Worker/DO deployment. Review provider permission requirements before granting extras.
2. Install GitHub Actions repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through the secret UI.
   Never put values in chat, YAML, a report or an artifact. Keep `ALLOWED_ORIGINS` exactly `https://otohime.dev`
   in `ghosts/worker/wrangler.jsonc`; local origins belong only to the fake.
3. Set repository variable `GHOSTS_DEPLOY_ENABLED=true` and dispatch the workflow on **main**. Download its
   `ghosts-build-<source-sha>-<run-id>` artifact. It contains only schema, service, exact Worker version id,
   Worker source SHA, workflow run id, code+lock+configuration fingerprint and per-file hashes.
   The summary publishes the same metadata. Raw CLI output stays in process memory and is neither printed nor copied into the artifact.
4. Compare the artifact's `workerVersionId` and `fingerprint` to the dedicated Worker's public `GET /version`.
   The id uses Cloudflare's [version metadata binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/),
   so it identifies the serving version rather than an unrelated latest commit. The fingerprint covers `src/**/*.ts`,
   shared protocol/policy/room, package manifest/lock and Wrangler configuration. Local workerd checks real binding construction;
   workflow fixtures fail on missing ids, mismatched hashes and failed pre-deploy checks.
5. Set Vercel Production `GHOSTS_ENDPOINT=wss://<dedicated-worker>.workers.dev/ghosts`, then redeploy production
   configuration. Use a different hostname from the app: browser WebSocket has no `credentials: omit` option.
   `/api/ghosts` must now return the endpoint and rooms without caching. That is readiness, not product acceptance.

Read-only identity check (no deployment, upgrades, visitor frames or floods):

```sh
node scripts/probe-ghosts.mjs --fixture
node scripts/probe-ghosts.mjs --app https://otohime.dev --worker https://<dedicated-worker>.workers.dev --manifest /path/to/ghosts-build.json --app-build /path/to/app-build.json
```

The helper keeps Worker source SHA/version/fingerprint separate from application `/api/health.sha` and Next BUILD_ID.
The main application CI publishes `app-build-<app-sha>-<run-id>/app-build.json` containing separately named
`appSha` and `nextBuildId` read from `.next/BUILD_ID`. Pass it with `--app-build`; the probe checks its SHA against
the serving app health before reporting BUILD_ID. Without this independent artifact the value is null (unavailable),
never synthesized from the app SHA or Worker source SHA.
QA should record both identities before testing two independent live browser contexts on Home and then `/ryugu`:
move and click now, sample actual peer ink and decay, leave, test room isolation and opt-out/reduced motion,
and send one denied-Origin upgrade as the negative control. Do not save raw real visitor frames.
Read bounded paginated successful/failed/current deploy history and raw failures, state completeness, and correlate
by fingerprint/version. Fake/browser evidence is integration demonstrated locally; only observed hosted behavior
can establish product delivery. Task 4 has no hosted deployment id and claims no live execution.

Rollback: unset Vercel `GHOSTS_ENDPOINT` and redeploy its production configuration. The optional browser probe returns
`null` and the layer stays off quietly; direct `/api/ghosts` returns 404. Set `GHOSTS_DEPLOY_ENABLED=false` to stop
further Worker deploys as a separate action. Unsetting the app endpoint does not delete Worker/DO resources;
existing mounted pages can retain their connection until reload. For an immediate server-side stop, deploy an empty
`ALLOWED_ORIGINS` configuration and close existing sessions via a reviewed Worker rollback/disable operation.
No credential or deployment prerequisite is reached by local verification.

## Two-browser proof boundary

`test:ghosts` selects only `e2e/ghosts.test.ts` through the self-owned e2e runner. It brings up migrated embedded
Postgres, a production Next server and a bounded, reset-per-case fake on `127.0.0.1` while pages use `localhost`.
Two independent Chrome contexts drive pointers/clicks; real canvas alpha samples and drawing calls prove tips,
trail segments and decay, remote/local ripples and removal. A disabled-paint control retains the app's draw counter
but fails the exact pixel assertion. The synthetic app auth cookie is actually sent to the app host; fake logs
prove only Cookie header **absence**, never values, on the other host. Coordinates are checked finite/normalized
and movement frequency is bounded from fake timestamps (with network-arrival jitter allowance).

Chrome media emulation proves initial/change reduced motion. Visibility and online properties/events are explicitly
injected; real sockets, rendering, cross-tab storage and reload are used. Refusal/full/flap exercise terminal states
and the retry budget. Config response injection proves quiet 404/off; the compiled route's runtime configuration test
also runs in the full suite. All application warnings/errors and uncaught page errors fail; browser-native performance
warnings have no JS arguments, and native failed-upgrade diagnostics are allowed only in intentional failure cases.
CI leaves the fake and `GHOSTS_ENDPOINT` alive through E2E and every later motion/footer probe, with always-run cleanup.
The fake's reset/log/mode endpoints are test-only and are forbidden in the actual Worker bundle.

The documented Docker entrypoint `scripts/e2e-local.sh` also owns a fake and configures Next before startup.
Its shell lifecycle is exercised against the real fake without requiring Docker in the fixture. The production
`verify-deploy.sh` Terminal/Press subset runs serial native Node tests directly, retaining CI failure annotations;
that read-only subset needs no ghost transport and never changes the served application's configuration.
