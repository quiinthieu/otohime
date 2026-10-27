# Ink ghosts changelog

## 2026-10-27: draw ephemeral visitor ink (pm-257/t-1608)

- Add request-time, no-store `/api/ghosts` configuration. Disabled or invalid endpoints return 404; secure
  cross-origin Worker endpoints and loopback-only local WebSockets accept no credentials, fragments or base query.
- Load a neutral client canvas when idle on Home and Ryugu-jo, with no palace layout or stylesheet changes.
  A body portal preserves viewport coordinates outside Home's animated container; the decoration cannot take input or focus.
- Draw anonymous peer brush tips, 700ms trails and local/peer click ripples. Bound peers, points, ripples, traffic
  and DPR; stop animation when fading work ends and expire silent tips after six seconds without a continuous loop.
- Shut down transport, drawing and input observers when motion is reduced, the page is hidden/offline or unmounted.
  Retry at most three times per mounted page, with 1s/3s backoff; full rooms terminate immediately. Disabled
  configuration stays quiet. Expose state, other-member count and a counter of ripple draws for browser verification.
- Add direct policy/lifecycle tests, actual route-body wiring coverage and canvas-call evidence. The existing explicit
  `ghosts/*.test.ts` npm test glob includes both new suites. Pocket preference and production activation follow later.

## 2026-10-27: reject reserved wire bits and preserve rate time (pm-257/t-1607)

- Reject RSV1/2/3 in the fake at the frame header with 1002, before buffering payloads or entering the room.
- Preserve the token bucket timestamp high-water mark during clock rollback, including restored attachments.
- Add shared fake/workerd wire regressions, a partial-header case, and rollback/recovery tests with restoration.

## 2026-10-26: bounded ghost rooms and Worker adapter (pm-257/t-1607)

- Added `ghosts/protocol.ts`, `ghosts/policy.ts` and `ghosts/room.ts`: the wire protocol, upgrade admission and the
  pure room. Rooms `/` and `/ryugu`, 24 sockets per room, 128-byte frames, a 15/s token bucket over every frame,
  and five invalid frames before a 1008 close.
- Added `ghosts/worker/`: the Cloudflare Worker and its hibernating `GhostRoom` Durable Object (SQLite namespace,
  no storage, observability off). The package has its own lock and a pinned compatibility date.
  - `test:local` runs the actual Worker in workerd, including a live-state reconstruction test.
  - `bundle:check` compiles it with `wrangler deploy --dry-run`.
  - `GET /version` serves the code+lock+config fingerprint.
- Added `scripts/ghosts-fake.mjs`: a dependency-free fake on the same policy and room. It has `normal`, `refuse`,
  `full` and `flap` modes, local-only controls and a capped in-memory log.
- `npm test` now runs `ghosts/*.test.ts` and `scripts/ghosts-fake.test.mjs`. The root tsconfig and eslint skip
  `ghosts/worker`.
- Not deployed and not rendered yet. See `ghosts/README.md`.
