import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canvasSize, GhostModel, GhostSession, paintGhosts, parseServerFrame, pointerPoint, shouldMove, type GhostRuntime, type GhostSocket, type Snapshot } from "./client.ts";
import type { GhostConfig } from "./config.ts";

const config: GhostConfig = { endpoint: "wss://worker.example/ghosts", rooms: ["/", "/ryugu"] };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function harness(room: "/" | "/ryugu" = "/") {
  let now = 0, id = 0, clears = 0, drawCalls = 0, render = true;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const frames = new Map<number, () => void>();
  const snapshots: Snapshot[] = [];
  const sockets: ReturnType<typeof makeSocket>[] = [];
  const signals: AbortSignal[] = [];
  const urls: string[] = [];
  function makeSocket() {
    const socket = {
      onmessage: null as GhostSocket["onmessage"], onclose: null as GhostSocket["onclose"], onerror: null as GhostSocket["onerror"],
      sent: [] as string[], closed: 0,
      send(data: string) { this.sent.push(data); }, close() { this.closed++; },
      receive(data: unknown) { this.onmessage?.call(this as unknown as WebSocket, { data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent); },
      drop(code = 1006) { this.onclose?.call(this as unknown as WebSocket, { code } as CloseEvent); },
    };
    return socket;
  }
  const runtime: GhostRuntime = {
    now: () => now,
    config: async signal => { signals.push(signal); return config; },
    connect: url => { urls.push(url); const socket = makeSocket(); sockets.push(socket); return socket; },
    later: (fn, ms) => { timers.set(++id, { at: now + ms, fn }); return id; },
    cancelLater: handle => { timers.delete(handle); },
    frame: fn => { frames.set(++id, fn); return id; },
    cancelFrame: handle => { frames.delete(handle); },
    draw: model => { drawCalls++; return render ? model.ripples.length : 0; },
    clear: () => { clears++; }, publish: snapshot => snapshots.push(snapshot),
  };
  const session = new GhostSession(runtime, room, "https://otohime.dev");
  return {
    session, runtime, sockets, signals, timers, frames, urls,
    get state() { return snapshots.at(-1)!; }, get clears() { return clears; }, get drawCalls() { return drawCalls; },
    noPaint() { render = false; },
    async advance(ms: number) {
      const end = now + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
      }
      now = end;
    },
    frame() { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); },
    async join(n = 1) { session.setEligible(true); await flush(); sockets.at(-1)!.receive({ t: "hi", id: "self", n }); },
  };
}

test("pointer policy normalizes, rejects invalid geometry and applies exact time/deadzone boundaries", () => {
  assert.deepEqual(pointerPoint(-10, 500, 100, 100), { x: 0, y: 1 });
  assert.deepEqual(pointerPoint(25, 50, 100, 100), { x: 0.25, y: 0.5 });
  for (const values of [[NaN, 0, 10, 10], [0, Infinity, 10, 10], [0, 0, 0, 10], [0, 0, 10, Infinity]]) {
    assert.equal(pointerPoint(...values as [number, number, number, number]), null);
  }
  const last = { x: 0, y: 0, at: 0 };
  assert.equal(shouldMove(undefined, { x: 0, y: 0 }, 0), true);
  assert.equal(shouldMove(last, { x: 1, y: 1 }, 99), false);
  assert.equal(shouldMove(last, { x: 0.0019, y: 0 }, 100), false);
  assert.equal(shouldMove(last, { x: 0.002, y: 0 }, 100), true);
  assert.equal(shouldMove(last, { x: 1, y: 1 }, -100), false);
  assert.deepEqual(canvasSize(100, 200, 3), { width: 150, height: 300, ratio: 1.5 });
  assert.deepEqual(canvasSize(300, 100, 1), { width: 300, height: 100, ratio: 1 });
});

test("server parser rejects malformed, oversize, binary, invalid counts/ids/coordinates", () => {
  for (const frame of [null, {}, new Uint8Array(10), "{", "[]", "null", "x".repeat(257),
    JSON.stringify({ t: "hi", id: "a", n: 25 }), JSON.stringify({ t: "n", n: -1 }), JSON.stringify({ t: "n", n: 1.5 }),
    JSON.stringify({ t: "m", id: "bad id", x: 0, y: 0 }), JSON.stringify({ t: "c", id: "a", x: "0", y: 0 }),
    JSON.stringify({ t: "hi", id: "a".repeat(65), n: 1 }), JSON.stringify({ t: "unknown" })]) {
    assert.equal(parseServerFrame(frame), null);
  }
  assert.deepEqual(parseServerFrame('{"t":"m","id":"a","x":-4,"y":5}'), { t: "m", id: "a", x: 0, y: 1 });
  assert.deepEqual(parseServerFrame('{"t":"full"}'), { t: "full" });
});

test("peer history and ripples stay bounded; trails fade at 700ms, tips expire at 6s without changing membership", () => {
  const model = new GhostModel();
  model.accept({ t: "hi", id: "self", n: 24 }, 0);
  model.accept({ t: "m", id: "self", x: 1, y: 1 }, 0);
  assert.equal(model.peers.size, 0);
  for (let i = 0; i < 100; i++) model.accept({ t: "m", id: `peer-${i}`, x: 0.5, y: 0.5 }, 0);
  assert.equal(model.peers.size, 24);
  for (let i = 0; i < 100; i++) model.accept({ t: "c", id: "peer-99", x: 0.5, y: 0.5 }, 0);
  assert.equal(model.peers.get("peer-99")!.points.length, 12);
  assert.equal(model.ripples.length, 48);
  model.prune(699); assert.equal(model.ripples.length, 48);
  model.prune(700); assert.equal(model.animating(), false); assert.equal(model.peers.size, 24);
  model.prune(5999); assert.equal(model.peers.size, 24);
  model.prune(6000); assert.equal(model.peers.size, 0); assert.equal(model.others, 23);
});

test("moves are <=10Hz; a lone visitor click schedules drawing and stops animation after fading", async () => {
  const h = harness(); await h.join();
  assert.equal(h.state.state, "on"); assert.equal(h.state.others, 0);
  assert.equal(new URL(h.urls[0]).searchParams.get("room"), "/");
  for (let i = 0; i < 100; i++) { h.session.pointer("m", { x: i / 100, y: 0.5 }); await h.advance(10); }
  assert.equal(h.sockets[0].sent.length, 10);
  h.session.pointer("c", { x: 0.5, y: 0.5 });
  assert.equal(h.state.ripples, 0, "receipt alone must not advance draw counter");
  h.frame(); assert.equal(h.state.ripples, 1); assert.equal(h.frames.size, 1);
  await h.advance(700); h.frame(); assert.equal(h.frames.size, 0); assert.equal(h.state.ripples, 1);
  h.session.pointer("c", { x: 0.2, y: 0.2 }); h.frame(); assert.equal(h.state.ripples, 2);
  h.session.dispose(); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
});

test("peer marks restart idle drawing, expire via one timer and bye removes tips", async () => {
  const h = harness("/ryugu"); await h.join(2);
  assert.equal(new URL(h.urls[0]).searchParams.get("room"), "/ryugu");
  h.sockets[0].receive({ t: "c", id: "peer", x: 0.2, y: 0.3 }); h.frame();
  assert.equal(h.state.others, 1); assert.equal(h.state.ripples, 1);
  await h.advance(700); h.frame();
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 1);
  await h.advance(5300); h.frame();
  assert.equal(h.session.model.peers.size, 0); assert.equal(h.timers.size, 0);
  h.sockets[0].receive({ t: "m", id: "peer", x: 0, y: 0 }); h.frame();
  assert.equal(h.session.model.peers.size, 1);
  h.sockets[0].receive({ t: "bye", id: "peer" }); h.frame();
  assert.equal(h.session.model.peers.size, 0); assert.equal(h.frames.size, 0);
  h.session.dispose();
});

test("no actual paint means no ripple counter (negative control)", async () => {
  const h = harness(); h.noPaint(); await h.join();
  h.session.pointer("c", { x: 0.5, y: 0.5 }); h.frame();
  assert.equal(h.drawCalls, 1); assert.equal(h.state.ripples, 0);
  h.session.dispose();
});

test("retry failures use exactly three attempts with +1s/+3s delays, then remain gone across toggles", async () => {
  const h = harness(); await h.join();
  h.sockets[0].drop(); assert.equal(h.state.state, "connecting");
  await h.advance(999); assert.equal(h.sockets.length, 1);
  await h.advance(1); assert.equal(h.sockets.length, 2);
  h.sockets[1].drop();
  await h.advance(2999); assert.equal(h.sockets.length, 2);
  await h.advance(1); assert.equal(h.sockets.length, 3);
  h.sockets[2].drop(); assert.equal(h.state.state, "gone");
  assert.equal(h.timers.size, 0);
  h.session.setEligible(false); h.session.setEligible(true); await h.advance(10000);
  assert.equal(h.sockets.length, 3);
  assert.ok(h.sockets.every(s => s.closed === 1));
});

test("full is immediately terminal without retries or drawing", async () => {
  for (const frame of [true, false]) {
    const h = harness(); h.session.setEligible(true); await flush();
    if (frame) h.sockets[0].receive({ t: "full" }); else h.sockets[0].drop(1013);
    assert.equal(h.state.state, "gone"); await h.advance(10000);
    assert.equal(h.sockets.length, 1); assert.equal(h.drawCalls, 0); assert.equal(h.frames.size, 0);
  }
});

test("disabled config never opens a socket, and transient fetch failure retries within the same budget", async () => {
  const h = harness(); h.runtime.config = async () => null;
  h.session.setEligible(true); await flush(); assert.equal(h.state.state, "off");
  assert.equal(h.sockets.length, 0); assert.equal(h.timers.size, 0);
  const failed = harness(); let fetches = 0;
  failed.runtime.config = async () => { fetches++; throw Error("offline"); };
  failed.session.setEligible(true); await flush(); await failed.advance(4000);
  assert.equal(fetches, 3); assert.equal(failed.state.state, "gone"); assert.equal(failed.sockets.length, 0);
});

test("initial suppression has zero work; hidden/offline/reduced-motion eligibility cancels active work and stale callbacks", async () => {
  const h = harness(); h.session.setEligible(false);
  assert.equal(h.sockets.length, 0); assert.equal(h.timers.size, 0);
  await h.join(2); h.sockets[0].receive({ t: "c", id: "peer", x: 0.1, y: 0.2 }); h.frame();
  h.session.setEligible(false);
  assert.equal(h.state.state, "off"); assert.equal(h.state.others, 0);
  assert.equal(h.session.model.peers.size, 0); assert.equal(h.session.model.ripples.length, 0);
  assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0); assert.equal(h.sockets[0].closed, 1);
  assert.ok(h.signals[0].aborted);
  const draws = h.drawCalls;
  h.session.pointer("c", { x: 0, y: 0 }); h.sockets[0].receive({ t: "c", id: "late", x: 1, y: 1 });
  await h.advance(10000); h.frame(); assert.equal(h.drawCalls, draws);
  await h.join(); assert.equal(h.sockets.length, 2);
  h.sockets[1].drop(); h.session.setEligible(false); await h.advance(4000);
  assert.equal(h.sockets.length, 2, "hidden cancels retry");
  h.session.setEligible(true); await flush(); assert.equal(h.sockets.length, 3);
  h.session.dispose(); assert.equal(h.frames.size, 0); assert.equal(h.timers.size, 0);
});

test("hung config consumes attempts and disposed/aborted config can never connect", async () => {
  const h = harness(); const pending: ((value: GhostConfig) => void)[] = [];
  h.runtime.config = () => new Promise(resolve => pending.push(resolve));
  h.session.setEligible(true); await h.advance(8000);
  assert.equal(h.state.state, "connecting");
  pending[0](config); await flush(); assert.equal(h.sockets.length, 0);
  await h.advance(1000); h.session.dispose();
  pending[1](config); await flush(); assert.equal(h.sockets.length, 0); assert.equal(h.timers.size, 0);
});

test("canvas painter draws brush tips, trails and only live ripple arcs", () => {
  const calls: string[] = [];
  const ctx = new Proxy({}, { set: () => true, get: (_, key) => () => calls.push(String(key)) }) as CanvasRenderingContext2D;
  const model = new GhostModel();
  model.accept({ t: "m", id: "peer", x: 0.1, y: 0.2 }, 0);
  model.accept({ t: "c", id: "peer", x: 0.2, y: 0.3 }, 100);
  assert.equal(paintGhosts(ctx, model, 100, 800, 600), 1);
  for (const method of ["clearRect", "lineTo", "ellipse", "fill", "arc", "stroke"]) assert.ok(calls.includes(method), method);
  calls.length = 0;
  model.prune(800);
  assert.equal(paintGhosts(ctx, model, 800, 800, 600), 0); assert.ok(!calls.includes("arc"));
  assert.ok(calls.includes("ellipse"));
  calls.length = 0; model.prune(6100); paintGhosts(ctx, model, 6100, 800, 600);
  assert.deepEqual(calls, ["clearRect"]);
});

test("both pages mount the neutral idle loader; canvas is decorative, passive and style-isolated", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(read("../app/(site)/(home)/page.tsx"), /<GhostLoader room="\/"/);
  assert.match(read("../app/(ryugu)/ryugu/page.tsx"), /<GhostLoader room="\/ryugu"/);
  assert.doesNotMatch(read("../app/(ryugu)/layout.tsx"), /GhostLoader|ghosts/);
  const loader = read("./loader.tsx");
  assert.match(loader, /^"use client"/); assert.match(loader, /ssr: false/);
  for (const name of ["requestIdleCallback", "cancelIdleCallback", "clearTimeout"]) assert.ok(loader.includes(name));
  const canvas = read("./canvas.tsx");
  assert.match(canvas, /createPortal/); assert.match(canvas, /document\.body/);
  assert.match(canvas, /aria-hidden="true"/); assert.match(canvas, /pointerEvents: "none"/);
  assert.match(canvas, /passive: true/); assert.doesNotMatch(canvas, /preventDefault|tabIndex|aria-live|\.css["']/);
  assert.match(canvas, /motion\.addEventListener\("change", reconcile\)/);
  assert.match(canvas, /motion\.removeEventListener\("change", reconcile\)/);
  for (const event of ["visibilitychange", "offline", "online", "pointermove", "pointerdown"]) {
    assert.ok(canvas.includes(`addEventListener("${event}"`)); assert.ok(canvas.includes(`removeEventListener("${event}"`));
  }
});
