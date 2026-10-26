// Test-only Worker entry (test/wrangler.reentry.jsonc). Public requests go
// through the real src/index.ts routing into the real GhostRoom; /__test/*
// requests let the adapter test rebuild GhostRoom on the same live
// DurableObjectState, as a hibernation wake does, and read back what the
// runtime holds: attachment keys, storage and the header names that reached the room.

import { DurableObject } from "cloudflare:workers";
import worker, { type Env } from "../src/index.ts";
import { GhostRoom } from "../src/room-do.ts";

export class TestGhostRoom extends DurableObject<Env> {
  private inner: GhostRoom;
  private generation = 1;
  private headerNames: string[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.inner = new GhostRoom(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/__test/reconstruct") {
      this.inner = new GhostRoom(this.ctx, this.env);
      this.generation += 1;
      return Response.json(await this.report());
    }
    if (url.pathname === "/__test/inspect") return Response.json(await this.report());
    this.headerNames = [...request.headers.keys()].sort();
    return this.inner.fetch(request);
  }

  private async report() {
    const tables = this.ctx.storage.sql
      .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .toArray()
      .map((row) => row.name);
    return {
      generation: this.generation,
      members: this.inner.memberCount(),
      sockets: this.ctx.getWebSockets().length,
      attachmentKeys: this.ctx
        .getWebSockets()
        .map((ws) => Object.keys((ws.deserializeAttachment() as object | null) ?? {}).sort().join(",")),
      storageKeys: (await this.ctx.storage.list()).size,
      tables,
      headerNames: this.headerNames,
    };
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.inner.webSocketMessage(ws, message);
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void {
    this.inner.webSocketClose(ws, code, reason, wasClean);
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    this.inner.webSocketError(ws, error);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/__test/")) {
      const room = url.searchParams.get("room") ?? "/";
      return env.GHOST_ROOMS.get(env.GHOST_ROOMS.idFromName(room)).fetch(request);
    }
    return worker.fetch(request, env);
  },
} satisfies ExportedHandler<Env>;
