# Ink ghosts changelog

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
