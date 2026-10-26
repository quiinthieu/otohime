// GhostRoom: one Durable Object per canonical room ("/" or "/ryugu"), using
// the WebSocket hibernation API. All limits live in the shared pure Room
// (ghosts/room.ts); this adapter only maps member ids to sockets.
//
// Privacy boundary: the only state is the in-memory Room plus, per socket, an
// attachment of exactly {id, tokens, at, invalid}, released with the socket.
// No storage, SQL, KV, alarms, logs, cookies, IP/UA or coordinates are kept.

import { DurableObject } from "cloudflare:workers";
import { Room, readMemberState, type Effect } from "../../room.ts";

export class GhostRoom extends DurableObject<object> {
  private readonly room = new Room({ now: () => Date.now() });
  private readonly sockets = new Map<string, WebSocket>();

  constructor(ctx: DurableObjectState, env: object) {
    super(ctx, env);
    // Hibernation wakes a fresh instance with the old sockets still open: rebuild
    // membership, buckets and strikes from their attachments.
    for (const ws of ctx.getWebSockets()) {
      const state = readMemberState(ws.deserializeAttachment());
      if (state && this.room.restore(state)) {
        this.sockets.set(state.id, ws);
      } else {
        closeQuietly(ws, 1011, "lost state");
      }
    }
  }

  /** Member count, for the adapter re-entry test only (not reachable from the public Worker). */
  memberCount(): number {
    return this.room.size;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" || (request.headers.get("upgrade") ?? "").toLowerCase() !== "websocket") {
      return new Response(null, { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // A fresh id per connection; the client never names itself.
    const id = crypto.randomUUID();
    const joined = this.room.join(id);
    if (!joined.ok) {
      // Not hibernatable and never a member: it only hears {t:"full"} and closes 1013.
      server.accept();
      this.apply(joined.effects, new Map([[id, server]]));
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(joined.member);
    this.sockets.set(id, server);
    this.apply(joined.effects);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const id = this.idOf(ws);
    if (id === null) {
      closeQuietly(ws, 1011, "unknown");
      return;
    }
    const result = this.room.receive(id, message);
    if (result.member) ws.serializeAttachment(result.member);
    this.apply(result.effects);
    if (result.outcome === "closed") this.drop(id);
  }

  webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): void {
    const id = this.idOf(ws);
    // 1005/1006 are reserved and cannot be echoed; answer a peer close with 1000.
    closeQuietly(ws, code >= 3000 || code === 1000 ? code : 1000, "bye");
    if (id !== null) this.drop(id);
  }

  webSocketError(ws: WebSocket, _error: unknown): void {
    const id = this.idOf(ws);
    closeQuietly(ws, 1011, "error");
    if (id !== null) this.drop(id);
  }

  private idOf(ws: WebSocket): string | null {
    for (const [id, socket] of this.sockets) if (socket === ws) return id;
    // A socket accepted by a previous instance that this one did not map.
    const state = readMemberState(ws.deserializeAttachment());
    return state && this.room.has(state.id) ? state.id : null;
  }

  private drop(id: string): void {
    const ws = this.sockets.get(id);
    this.sockets.delete(id);
    // Release the attachment with the member, so a wake before the close completes cannot restore it.
    try {
      ws?.serializeAttachment(null);
    } catch {
      // Already gone.
    }
    this.apply(this.room.leave(id));
  }

  private apply(effects: Effect[], extra?: Map<string, WebSocket>): void {
    for (const effect of effects) {
      const ws = this.sockets.get(effect.to) ?? extra?.get(effect.to);
      if (!ws) continue;
      if (effect.kind === "send") {
        try {
          ws.send(JSON.stringify(effect.msg));
        } catch {
          // A socket mid-close; its own close/error handler removes it.
        }
      } else {
        closeQuietly(ws, effect.code, effect.reason);
      }
    }
  }
}

function closeQuietly(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    // Already closed.
  }
}
