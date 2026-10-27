import { normalizeCoord, ROOM_CAP } from "./protocol.ts";
import { parseEndpoint, type GhostConfig, type GhostRoom } from "./config.ts";
import type { ServerMessage } from "./protocol.ts";

export const MOVE_INTERVAL = 100;
export const DEADZONE = 0.002;
export const TRAIL_MS = 700;
export const TIP_MS = 6000;
export const POINT_CAP = 12;
export const RIPPLE_CAP = 48;
export type Point = { x: number; y: number };
export type Mark = Point & { at: number };
export type Peer = { tip: Mark; points: Mark[] };
export type GhostState = "off" | "connecting" | "on" | "gone";
export type Snapshot = { state: GhostState; others: number; ripples: number };

export function pointerPoint(x: number, y: number, width: number, height: number): Point | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const nx = normalizeCoord(x / width), ny = normalizeCoord(y / height);
  return nx === null || ny === null ? null : { x: nx, y: ny };
}

export function shouldMove(last: Mark | undefined, point: Point, now: number): boolean {
  return !last || (now - last.at >= MOVE_INTERVAL && Math.hypot(point.x - last.x, point.y - last.y) >= DEADZONE);
}

export function canvasSize(width: number, height: number, dpr: number) {
  const ratio = Math.min(1.5, Math.max(1, Number.isFinite(dpr) ? dpr : 1));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)), ratio };
}

/** Server data is untrusted too; bound parsing before JSON and copy only protocol fields. */
export function parseServerFrame(data: unknown): ServerMessage | null {
  if (typeof data !== "string" || data.length > 256 || new TextEncoder().encode(data).length > 256) return null;
  try {
    const v = JSON.parse(data);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const id = typeof v.id === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(v.id) ? v.id : null;
    const count = Number.isInteger(v.n) && v.n >= 1 && v.n <= ROOM_CAP;
    if (v.t === "full") return { t: "full" };
    if (v.t === "hi" && id && count) return { t: "hi", id, n: v.n };
    if (v.t === "n" && count) return { t: "n", n: v.n };
    if (v.t === "bye" && id) return { t: "bye", id };
    if ((v.t === "m" || v.t === "c") && id) {
      const x = normalizeCoord(v.x), y = normalizeCoord(v.y);
      if (x !== null && y !== null) return { t: v.t, id, x, y };
    }
  } catch { /* malformed frames are quiet */ }
  return null;
}

export class GhostModel {
  peers = new Map<string, Peer>();
  ripples: Mark[] = [];
  id = "";
  others = 0;

  reset() { this.peers.clear(); this.ripples = []; this.id = ""; this.others = 0; }
  ripple(point: Point, now: number) {
    this.ripples.push({ ...point, at: now });
    this.ripples = this.ripples.slice(-RIPPLE_CAP);
  }
  accept(msg: ServerMessage, now: number) {
    if (msg.t === "hi") { this.id = msg.id; this.others = msg.n - 1; }
    if (msg.t === "n") this.others = msg.n - 1;
    if (msg.t === "bye") this.peers.delete(msg.id);
    if ((msg.t === "m" || msg.t === "c") && msg.id !== this.id) {
      if (msg.t === "c") this.ripple(msg, now);
      const old = this.peers.get(msg.id);
      if (!old && this.peers.size >= ROOM_CAP) this.peers.delete(this.peers.keys().next().value!);
      const mark = { x: msg.x, y: msg.y, at: now };
      this.peers.set(msg.id, { tip: mark, points: [...(old?.points ?? []), mark].slice(-POINT_CAP) });
    }
  }
  prune(now: number) {
    this.ripples = this.ripples.filter(p => now - p.at < TRAIL_MS);
    for (const [id, peer] of this.peers) {
      if (now - peer.tip.at >= TIP_MS) this.peers.delete(id);
      else peer.points = peer.points.filter(p => now - p.at < TRAIL_MS);
    }
  }
  animating() { return this.ripples.length > 0 || [...this.peers.values()].some(p => p.points.length > 0); }
  nextExpiry(now: number) {
    return Math.min(...[...this.peers.values()].map(p => Math.max(0, TIP_MS - (now - p.tip.at))));
  }
}

export type GhostSocket = Pick<WebSocket, "close" | "send" | "onmessage" | "onclose" | "onerror">;
type Handle = number;
export interface GhostRuntime {
  now(): number;
  config(signal: AbortSignal): Promise<GhostConfig | null>;
  connect(url: string): GhostSocket;
  later(fn: () => void, ms: number): Handle;
  cancelLater(handle: Handle): void;
  frame(fn: () => void): Handle;
  cancelFrame(handle: Handle): void;
  draw(model: GhostModel, now: number): number; // Number of ripples actually painted, not received.
  clear(): void;
  publish(snapshot: Snapshot): void;
}

/** One instance per mounted page. Eligibility toggles never reset the attempt budget. */
export class GhostSession {
  readonly model = new GhostModel();
  private attempts = 0;
  private eligible = false;
  private disposed = false;
  private terminal: "off" | "gone" | undefined;
  private generation = 0;
  private state: GhostState = "off";
  private socket?: GhostSocket;
  private abort?: AbortController;
  private retry?: Handle;
  private deadline?: Handle;
  private expiry?: Handle;
  private raf?: Handle;
  private lastMove?: Mark;
  private lastClick = -Infinity;
  private drawnRipples = 0;

  private runtime: GhostRuntime;
  private room: GhostRoom;
  private origin: string;
  constructor(runtime: GhostRuntime, room: GhostRoom, origin: string) {
    this.runtime = runtime; this.room = room; this.origin = origin;
  }
  private publish(state = this.state) {
    this.state = state;
    this.runtime.publish({ state, others: this.model.others, ripples: this.drawnRipples });
  }
  setEligible(value: boolean) {
    if (this.disposed || this.eligible === value) return;
    this.eligible = value;
    this.stop();
    if (!value) this.publish(this.terminal ?? "off");
    else if (this.terminal || this.attempts >= 3) { this.terminal ??= "gone"; this.publish(this.terminal); }
    else void this.start();
  }
  private stop() {
    this.generation++;
    this.abort?.abort(); this.abort = undefined;
    for (const handle of [this.retry, this.deadline, this.expiry]) if (handle !== undefined) this.runtime.cancelLater(handle);
    this.retry = this.deadline = this.expiry = undefined;
    if (this.raf !== undefined) this.runtime.cancelFrame(this.raf);
    this.raf = undefined;
    const socket = this.socket; this.socket = undefined;
    if (socket) {
      socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
    }
    this.model.reset(); this.lastMove = undefined; this.lastClick = -Infinity;
    this.drawnRipples = 0;
    this.runtime.clear();
  }
  private finish(state: "gone" | "off") {
    this.terminal = state; this.stop(); this.publish(state);
  }
  private fail = () => {
    this.stop();
    if (!this.eligible || this.disposed) return;
    if (this.attempts >= 3) { this.finish("gone"); return; }
    this.publish("connecting");
    const generation = this.generation;
    this.retry = this.runtime.later(() => {
      if (generation !== this.generation) return;
      this.retry = undefined; void this.start();
    }, this.attempts === 1 ? 1000 : 3000);
  };
  private async start() {
    if (!this.eligible || this.disposed || this.terminal) return;
    this.attempts++;
    const generation = ++this.generation;
    const active = () => generation === this.generation && this.eligible && !this.disposed;
    const abort = this.abort = new AbortController();
    this.publish("connecting");
    // A hung config fetch or socket handshake consumes an attempt too.
    this.deadline = this.runtime.later(() => { if (active()) this.fail(); }, 8000);
    try {
      const config = await this.runtime.config(abort.signal);
      if (generation !== this.generation) return;
      const endpoint = config && parseEndpoint(config.endpoint, this.origin);
      if (!endpoint || !(Array.isArray(config?.rooms) && config.rooms.includes(this.room))) { this.finish("off"); return; }
      const url = new URL(endpoint); url.searchParams.set("room", this.room);
      const socket = this.socket = this.runtime.connect(url.href);
      socket.onerror = () => { if (active()) this.fail(); };
      socket.onclose = event => { if (!active()) return; if (event.code === 1013) this.finish("gone"); else this.fail(); };
      socket.onmessage = event => {
        if (!active()) return;
        const msg = parseServerFrame(event.data);
        if (!msg) return;
        if (msg.t === "full") { this.finish("gone"); return; }
        if (msg.t === "hi") {
          if (this.deadline !== undefined) this.runtime.cancelLater(this.deadline);
          this.deadline = undefined;
          this.model.accept(msg, this.runtime.now()); this.publish("on");
        } else if (this.state === "on") {
          this.model.accept(msg, this.runtime.now()); this.publish(); this.redraw();
        }
      };
    } catch {
      if (generation === this.generation) this.fail();
    }
  }
  pointer(kind: "m" | "c", point: Point) {
    if (this.state !== "on" || !this.socket || !this.eligible) return;
    const now = this.runtime.now();
    if (kind === "m") {
      if (!shouldMove(this.lastMove, point, now)) return;
      this.lastMove = { ...point, at: now };
    } else {
      this.model.ripple(point, now); this.redraw();
      // Local feedback is immediate; bound click traffic independently to <= 5Hz.
      if (now - this.lastClick < 200) return;
      this.lastClick = now;
    }
    try { this.socket.send(JSON.stringify({ t: kind, ...point })); } catch { this.fail(); }
  }
  redraw = () => {
    if (this.state !== "on" || !this.eligible || this.disposed || this.raf !== undefined) return;
    const generation = this.generation;
    this.raf = this.runtime.frame(() => {
      if (generation !== this.generation || !this.eligible || this.disposed) return;
      this.raf = undefined;
      const now = this.runtime.now();
      this.model.prune(now);
      const painted = this.runtime.draw(this.model, now);
      if (painted > 0) { this.drawnRipples += painted; this.publish(); }
      if (this.expiry !== undefined) this.runtime.cancelLater(this.expiry);
      this.expiry = undefined;
      if (this.model.animating()) this.redraw();
      else {
        const ms = this.model.nextExpiry(now);
        if (Number.isFinite(ms)) this.expiry = this.runtime.later(() => {
          if (generation !== this.generation) return;
          this.expiry = undefined; this.redraw();
        }, ms);
      }
    });
  };
  dispose() { this.disposed = true; this.eligible = false; this.stop(); }
}

/** Drawing returns evidence only for ripple arcs actually sent to a real 2D context. */
export function paintGhosts(ctx: CanvasRenderingContext2D, model: GhostModel, now: number, width: number, height: number): number {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = ctx.fillStyle = "#948578";
  ctx.lineCap = "round";
  for (const peer of model.peers.values()) {
    for (let i = 1; i < peer.points.length; i++) {
      const a = peer.points[i - 1], b = peer.points[i];
      ctx.globalAlpha = Math.max(0, 1 - (now - a.at) / TRAIL_MS) * 0.22;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(a.x * width, a.y * height); ctx.lineTo(b.x * width, b.y * height); ctx.stroke();
    }
    const tip = peer.tip;
    if (now - tip.at < TIP_MS) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.ellipse(tip.x * width, tip.y * height, 2.5, 4, -0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  let drawn = 0;
  for (const ripple of model.ripples) {
    const age = now - ripple.at;
    if (age < 0 || age >= TRAIL_MS) continue;
    ctx.globalAlpha = (1 - age / TRAIL_MS) * 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ripple.x * width, ripple.y * height, 3 + age / TRAIL_MS * 25, 0, Math.PI * 2); ctx.stroke();
    drawn++;
  }
  ctx.globalAlpha = 1;
  return drawn;
}
