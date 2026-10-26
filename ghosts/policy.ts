// Upgrade admission for ink ghosts, shared by the Worker and the local fake.
// Everything here runs before a room (a Durable Object) is allocated, and reads
// only the method, the URL and the Origin/Upgrade headers: never cookies, IP or UA.

/** The only rooms: Home and the palace. Anything else is refused. */
export const ROOMS = ["/", "/ryugu"] as const;
export type RoomName = (typeof ROOMS)[number];

export const GHOSTS_PATH = "/ghosts";
export const VERSION_PATH = "/version";

export type Admission =
  | { ok: true; room: RoomName }
  | { ok: false; status: 400 | 403 | 404 | 405 | 426; reason: string };

export type UpgradeRequest = {
  method: string;
  url: string;
  header(name: string): string | null;
};

/** An exact origin: scheme://host[:port], nothing else. Returns null when the text is not one. */
export function canonicalOrigin(text: string | null | undefined): string | null {
  if (typeof text !== "string" || text === "" || text === "null") return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // new URL normalises case and default ports; insisting on equality rejects paths, credentials and padding.
  return url.origin === text ? text : null;
}

/** Parses a comma-separated ALLOWED_ORIGINS value; malformed entries are dropped, never widened. */
export function parseAllowedOrigins(value: string | null | undefined): string[] {
  if (typeof value !== "string") return [];
  const origins = value
    .split(",")
    .map((part) => canonicalOrigin(part.trim()))
    .filter((origin): origin is string => origin !== null);
  return [...new Set(origins)];
}

export function isAllowedOrigin(origin: string | null, allowed: readonly string[]): boolean {
  const exact = canonicalOrigin(origin);
  return exact !== null && allowed.includes(exact);
}

/** The canonical room named by ?room=, or null for a missing, repeated or unknown value. */
export function parseRoom(search: URLSearchParams): RoomName | null {
  const values = search.getAll("room");
  if (values.length !== 1) return null;
  return (ROOMS as readonly string[]).includes(values[0]) ? (values[0] as RoomName) : null;
}

/**
 * Decides an upgrade request at GHOSTS_PATH. Order: method, Upgrade header,
 * Origin, room. A refusal is decided entirely here, so no room is allocated for it.
 */
export function admitUpgrade(request: UpgradeRequest, allowed: readonly string[]): Admission {
  if (request.method !== "GET") return { ok: false, status: 405, reason: "method" };
  if ((request.header("upgrade") ?? "").toLowerCase() !== "websocket") {
    return { ok: false, status: 426, reason: "upgrade" };
  }
  if (!isAllowedOrigin(request.header("origin"), allowed)) {
    return { ok: false, status: 403, reason: "origin" };
  }
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return { ok: false, status: 400, reason: "url" };
  }
  const room = parseRoom(url.searchParams);
  if (room === null) return { ok: false, status: 404, reason: "room" };
  return { ok: true, room };
}
