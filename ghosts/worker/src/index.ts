// Ink ghosts fan-out Worker. GET /ghosts?room=%2F or ?room=%2Fryugu upgrades to
// a WebSocket in that room's GhostRoom; GET /version reports the public build
// fingerprint. Admission (method, Upgrade, exact Origin, known room) is decided
// here by the shared policy before any Durable Object is allocated.

import { GHOSTS_PATH, VERSION_PATH, admitUpgrade, parseAllowedOrigins } from "../../policy.ts";
import { versionResponse } from "./version.ts";

export { GhostRoom } from "./room-do.ts";

// Only the default handler and GhostRoom may be exported: workerd treats every export as an entrypoint.
export interface Env {
  GHOST_ROOMS: DurableObjectNamespace;
  ALLOWED_ORIGINS: string;
  WORKER_VERSION?: { id: string };
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === VERSION_PATH) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
      }
      return versionResponse(env.WORKER_VERSION?.id ?? null);
    }
    if (url.pathname !== GHOSTS_PATH) return new Response(null, { status: 404 });
    const admission = admitUpgrade(
      { method: request.method, url: request.url, header: (name) => request.headers.get(name) },
      parseAllowedOrigins(env.ALLOWED_ORIGINS),
    );
    if (!admission.ok) return new Response(null, { status: admission.status });
    const stub = env.GHOST_ROOMS.get(env.GHOST_ROOMS.idFromName(admission.room));
    // A fresh request: no cookie, IP, UA or other visitor header reaches the room.
    return stub.fetch("https://ghost-room/connect", { headers: { upgrade: "websocket" } });
  },
} satisfies ExportedHandler<Env>;
