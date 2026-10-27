/** Runtime configuration shared by the route and the defensive browser parser. */
export const ROOMS = ["/", "/ryugu"] as const;
export type GhostRoom = (typeof ROOMS)[number];
export type GhostConfig = { endpoint: string; rooms: readonly GhostRoom[] };

const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);

export function parseEndpoint(value: unknown, appOrigin: string): string | null {
  if (typeof value !== "string" || !/^wss?:\/\//.test(value) || /[\s\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    const app = new URL(appOrigin);
    if (url.username || url.password || url.hash || url.search || value.includes("?") || value.includes("#")) return null;
    if (url.pathname !== "/ghosts") return null;
    if (url.protocol === "ws:") {
      if (!loopback(url.hostname) || !loopback(app.hostname)) return null;
    } else if (url.protocol === "wss:") {
      // Compare the corresponding HTTP origin: browser WebSocket origin strings use ws(s).
      if (`https://${url.host}` === app.origin) return null;
    } else return null;
    return url.href;
  } catch {
    return null;
  }
}

export function configResponse(value: unknown, appOrigin: string): Response {
  const endpoint = parseEndpoint(value, appOrigin);
  const headers = { "Cache-Control": "no-store" };
  return endpoint
    ? Response.json({ endpoint, rooms: ROOMS }, { headers })
    : new Response(null, { status: 404, headers });
}
