// Local fake of the ink-ghosts Worker: a dependency-free WebSocket server over
// node:http that admits and fans out with the very same ghosts/policy.ts and
// ghosts/room.ts as the Cloudflare adapter, so local browser proofs see the
// production limits. It never ships in the Worker.
//
//   node --experimental-strip-types scripts/ghosts-fake.mjs [--port 8788] [--origins http://localhost:3000,...]
//   prints "ghosts-fake ready ws://127.0.0.1:<port>/ghosts" once listening.
//
// Controls (loopback only, refused when an Origin header is present, so a page cannot drive them):
//   GET /__ready   {ready, mode}
//   GET /__log     {entries, dropped}  (capped, in memory only, lost with the process)
//   POST /__reset  closes every socket, clears the log, mode=normal
//   POST /__mode?m=normal|refuse|full|flap
// Modes: refuse answers upgrades 503; full accepts then sends {t:"full"} and closes 1013;
// flap accepts, greets, then drops the TCP connection after flapMs (an abnormal 1006 close).
//
// The log is test evidence: it records coordinates of accepted frames and whether
// Origin/Cookie headers were present (booleans), never header values.
//
// This module also exports the raw WebSocket test client and the contract cases
// that scripts/ghosts-fake.test.mjs and ghosts/worker/test/local.test.mjs both run.

import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { connect as netConnect } from "node:net";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { GHOSTS_PATH, VERSION_PATH, admitUpgrade, parseAllowedOrigins } from "../ghosts/policy.ts";
import { CLOSE_FULL, CLOSE_POLICY, RATE_CAPACITY, ROOM_CAP } from "../ghosts/protocol.ts";
import { Room } from "../ghosts/room.ts";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
/** Frames above this many payload bytes are not buffered at all: close 1009. */
const MAX_WIRE_PAYLOAD = 1024;
const MODES = ["normal", "refuse", "full", "flap"];
export const DEFAULT_FAKE_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:4000";

// ---------------------------------------------------------------- frames

function encodeFrame(opcode, payload, mask) {
  const length = payload.length;
  const head = [0x80 | opcode];
  const maskBit = mask ? 0x80 : 0;
  if (length < 126) head.push(maskBit | length);
  else if (length < 65536) head.push(maskBit | 126, length >> 8, length & 0xff);
  else throw new Error("frame too large");
  if (!mask) return Buffer.concat([Buffer.from(head), payload]);
  const key = randomBytes(4);
  const body = Buffer.from(payload);
  for (let i = 0; i < body.length; i++) body[i] ^= key[i % 4];
  return Buffer.concat([Buffer.from(head), key, body]);
}

function closePayload(code, reason = "") {
  const body = Buffer.alloc(2 + Buffer.byteLength(reason));
  body.writeUInt16BE(code, 0);
  body.write(reason, 2);
  return body;
}

/**
 * Incremental frame reader. Returns complete frames and keeps the remainder;
 * Reserved bits yield {reserved:true} immediately; an excessive declared
 * payload yields {tooBig:true}. Neither fault buffers the payload.
 */
function makeReader(maxPayload) {
  let buffer = Buffer.alloc(0);
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const frames = [];
    for (;;) {
      if (buffer.length < 2) break;
      // No extensions are negotiated. Reject before reading lengths, masks or payloads.
      if ((buffer[0] & 0x70) !== 0) {
        frames.push({ reserved: true });
        buffer = Buffer.alloc(0);
        break;
      }
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) break;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) break;
        const big = buffer.readBigUInt64BE(2);
        length = big > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(big);
        offset = 10;
      }
      if (length > maxPayload) {
        frames.push({ tooBig: true });
        buffer = Buffer.alloc(0);
        break;
      }
      const maskOffset = offset;
      if (masked) offset += 4;
      if (buffer.length < offset + length) break;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buffer[maskOffset + (i % 4)];
      frames.push({ fin, opcode, masked, payload });
      buffer = buffer.subarray(offset + length);
    }
    return frames;
  };
}

const utf8 = new TextDecoder("utf-8", { fatal: true });

// ---------------------------------------------------------------- server

function isLoopback(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

/**
 * Starts the fake. Options: host, port (0 = any), origins (comma-separated or
 * array), mode, now and makeId (injectable clock/id source), logCap, flapMs.
 */
export async function startGhostsFake(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const allowed = Array.isArray(options.origins)
    ? parseAllowedOrigins(options.origins.join(","))
    : parseAllowedOrigins(options.origins ?? DEFAULT_FAKE_ORIGINS);
  const now = options.now ?? (() => Date.now());
  const makeId = options.makeId ?? (() => randomUUID());
  const logCap = options.logCap ?? 500;
  const flapMs = options.flapMs ?? 50;
  let mode = MODES.includes(options.mode) ? options.mode : "normal";

  const rooms = new Map(); // room name -> { room: Room, conns: Map<id, conn> }
  const sockets = new Set(); // every raw socket, for deterministic teardown
  let entries = [];
  let dropped = 0;
  let seq = 0;
  let connections = 0;

  const log = (entry) => {
    entries.push({ seq: ++seq, at: now(), ...entry });
    if (entries.length > logCap) {
      dropped += entries.length - logCap;
      entries = entries.slice(-logCap);
    }
  };

  const roomFor = (name) => {
    let entry = rooms.get(name);
    if (!entry) {
      entry = { room: new Room({ now }), conns: new Map() };
      rooms.set(name, entry);
    }
    return entry;
  };

  function sendText(conn, text) {
    if (conn.closing || conn.socket.destroyed) return;
    conn.socket.write(encodeFrame(0x1, Buffer.from(text), false));
  }

  function sendClose(conn, code, reason) {
    if (conn.closing || conn.socket.destroyed) return;
    conn.closing = true;
    conn.socket.write(encodeFrame(0x8, closePayload(code, reason), false));
    // The peer answers with its close; end the TCP connection either way.
    conn.endTimer = setTimeout(() => conn.socket.destroy(), 1000);
    conn.endTimer.unref();
  }

  function apply(entry, effects, extra) {
    for (const effect of effects) {
      const conn = entry.conns.get(effect.to) ?? (extra?.id === effect.to ? extra : undefined);
      if (!conn) continue;
      if (effect.kind === "send") sendText(conn, JSON.stringify(effect.msg));
      else sendClose(conn, effect.code, effect.reason);
    }
  }

  function leave(conn, why) {
    if (conn.left) return;
    conn.left = true;
    const entry = rooms.get(conn.room);
    if (!entry || !entry.conns.has(conn.id)) return;
    entry.conns.delete(conn.id);
    log({ kind: "leave", room: conn.room, conn: conn.n, why });
    apply(entry, entry.room.leave(conn.id));
  }

  function refuse(socket, status, text) {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }

  function onUpgrade(req, socket) {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    const headers = { origin: req.headers.origin !== undefined, cookie: req.headers.cookie !== undefined };
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.pathname !== GHOSTS_PATH) {
      log({ kind: "refused", status: 404, reason: "path", headers });
      return refuse(socket, 404, "Not Found");
    }
    if (mode === "refuse") {
      log({ kind: "refused", status: 503, reason: "mode", headers });
      return refuse(socket, 503, "Service Unavailable");
    }
    const admission = admitUpgrade(
      { method: req.method ?? "GET", url: url.href, header: (name) => headerValue(req, name) },
      allowed,
    );
    if (!admission.ok) {
      log({ kind: "refused", status: admission.status, reason: admission.reason, headers });
      return refuse(socket, admission.status, "Refused");
    }
    const key = headerValue(req, "sec-websocket-key");
    if (!key || headerValue(req, "sec-websocket-version") !== "13") {
      log({ kind: "refused", status: 400, reason: "handshake", headers });
      return refuse(socket, 400, "Bad Request");
    }
    const accept = createHash("sha1").update(key + WS_GUID).digest("base64");
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);
    const conn = { id: makeId(), n: ++connections, room: admission.room, socket, closing: false, left: false };
    const entry = roomFor(admission.room);
    if (mode === "full") {
      log({ kind: "full", room: conn.room, conn: conn.n, mode, headers });
      sendText(conn, JSON.stringify({ t: "full" }));
      sendClose(conn, CLOSE_FULL, "full");
      return;
    }
    const joined = entry.room.join(conn.id);
    if (!joined.ok) {
      log({ kind: "full", room: conn.room, conn: conn.n, mode, headers });
      apply(entry, joined.effects, conn);
      return;
    }
    entry.conns.set(conn.id, conn);
    log({ kind: "join", room: conn.room, conn: conn.n, n: entry.room.size, mode, headers });
    apply(entry, joined.effects);
    if (mode === "flap") {
      const timer = setTimeout(() => socket.destroy(), flapMs);
      timer.unref();
    }

    const read = makeReader(MAX_WIRE_PAYLOAD);
    socket.on("data", (chunk) => {
      for (const frame of read(chunk)) {
        if (conn.left) return;
        if (frame.reserved) {
          leave(conn, "reserved bits");
          sendClose(conn, 1002, "reserved bits");
          return;
        }
        if (frame.tooBig) {
          log({ kind: "frame", room: conn.room, conn: conn.n, outcome: "too-big" });
          leave(conn, "too-big");
          sendClose(conn, 1009, "too big");
          return;
        }
        if (!frame.masked) {
          leave(conn, "unmasked");
          sendClose(conn, 1002, "unmasked");
          return;
        }
        if (frame.opcode === 0x8) {
          const code = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1005;
          leave(conn, `close ${code}`);
          if (!conn.closing) sendClose(conn, code === 1005 || code < 1000 ? 1000 : code, "bye");
          socket.end();
          return;
        }
        if (frame.opcode === 0x9) {
          if (!conn.closing) socket.write(encodeFrame(0xa, frame.payload, false));
          continue;
        }
        if (frame.opcode === 0xa) continue;
        // Text frames reach the room as strings; binary, fragmented or non-UTF-8 ones as bytes (invalid).
        let data = frame.payload;
        if (frame.opcode === 0x1 && frame.fin) {
          try {
            data = utf8.decode(frame.payload);
          } catch {
            data = frame.payload;
          }
        }
        const result = entry.room.receive(conn.id, data);
        if (result.outcome === "accepted") {
          const parsed = JSON.parse(data);
          log({ kind: "frame", room: conn.room, conn: conn.n, outcome: "accepted", t: parsed.t, x: parsed.x, y: parsed.y });
        } else {
          log({ kind: "frame", room: conn.room, conn: conn.n, outcome: result.outcome });
        }
        apply(entry, result.effects);
        if (result.outcome === "closed") leave(conn, "policy");
      }
    });
    socket.on("close", () => {
      clearTimeout(conn.endTimer);
      leave(conn, conn.closing ? "closed" : "dropped");
    });
  }

  function control(req, res) {
    const url = new URL(req.url ?? "/", `http://${host}`);
    const json = (status, body) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === VERSION_PATH && req.method === "GET") {
      return json(200, { service: "otohime-ghosts-fake", fingerprint: "fake", workerVersionId: null });
    }
    if (url.pathname === GHOSTS_PATH) {
      // A plain request at the upgrade path: same answer as the Worker.
      const admission = admitUpgrade({ method: req.method ?? "GET", url: url.href, header: (n) => headerValue(req, n) }, allowed);
      res.writeHead(admission.ok ? 426 : admission.status).end();
      return;
    }
    if (!url.pathname.startsWith("/__")) return json(404, { error: "not found" });
    if (!isLoopback(req.socket.remoteAddress) || req.headers.origin !== undefined) {
      return json(403, { error: "local controls only" });
    }
    if (url.pathname === "/__ready" && req.method === "GET") return json(200, { ready: true, mode });
    if (url.pathname === "/__log" && req.method === "GET") return json(200, { entries, dropped });
    if (url.pathname === "/__reset" && req.method === "POST") {
      reset(req.socket);
      return json(200, { ok: true });
    }
    if (url.pathname === "/__mode" && req.method === "POST") {
      const next = url.searchParams.get("m");
      if (!MODES.includes(next)) return json(400, { error: `mode must be one of ${MODES.join(", ")}` });
      mode = next;
      log({ kind: "mode", mode });
      return json(200, { ok: true, mode });
    }
    return json(404, { error: "not found" });
  }

  /** Destroys every socket but `keep` (the control request asking for the reset). */
  function dropAll(keep) {
    for (const socket of sockets) if (socket !== keep) socket.destroy();
    sockets.clear();
    if (keep) sockets.add(keep);
    rooms.clear();
  }

  function reset(keep) {
    dropAll(keep);
    entries = [];
    dropped = 0;
    mode = "normal";
  }

  const server = createServer(control);
  server.on("upgrade", onUpgrade);
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, resolveListen);
  });
  const port = server.address().port;
  const base = `http://${host}:${port}`;
  return {
    port,
    base,
    url: `ws://${host}:${port}${GHOSTS_PATH}`,
    allowed,
    get mode() {
      return mode;
    },
    setMode(next) {
      if (!MODES.includes(next)) throw new Error(`unknown mode ${next}`);
      mode = next;
    },
    log: () => ({ entries: [...entries], dropped }),
    reset: () => reset(),
    async close() {
      dropAll();
      await new Promise((done) => server.close(() => done()));
    },
  };
}

function headerValue(req, name) {
  const value = req.headers[name.toLowerCase()];
  if (value === undefined) return null;
  return Array.isArray(value) ? value.join(", ") : value;
}

// ---------------------------------------------------------------- raw client (tests only)

/**
 * Minimal WebSocket client over node:net with full control of the handshake
 * headers (a browser cannot omit or forge Origin) and of the frames sent.
 * Resolves after the HTTP response: {status, ...} for a refusal, or an open client.
 */
export function rawConnect(base, { path = "/ghosts?room=%2F", origin, headers = {}, method = "GET", upgrade = true } = {}) {
  const url = new URL(path, base);
  return new Promise((resolveConnect, rejectConnect) => {
    const socket = netConnect(Number(url.port), url.hostname);
    socket.setNoDelay(true);
    const key = randomBytes(16).toString("base64");
    const lines = [`${method} ${url.pathname}${url.search} HTTP/1.1`, `Host: ${url.host}`];
    if (upgrade) lines.push("Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Key: ${key}`, "Sec-WebSocket-Version: 13");
    else lines.push("Connection: close");
    if (origin !== undefined) lines.push(`Origin: ${origin}`);
    for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
    let head = Buffer.alloc(0);
    let opened = false;
    const messages = [];
    const waiters = [];
    let closeInfo = null;
    let resolveClosed;
    const closed = new Promise((done) => (resolveClosed = done));
    const read = makeReader(1 << 20);

    const deliver = () => {
      for (let i = waiters.length - 1; i >= 0; i--) {
        const waiter = waiters[i];
        const index = messages.findIndex((msg, at) => at >= waiter.from && waiter.match(msg));
        if (index !== -1) {
          waiters.splice(i, 1);
          clearTimeout(waiter.timer);
          waiter.resolve(messages[index]);
        } else if (closeInfo) {
          waiters.splice(i, 1);
          clearTimeout(waiter.timer);
          waiter.reject(new Error(`closed ${closeInfo.code} before a matching message (${waiter.label})`));
        }
      }
    };
    const finish = (code, reason) => {
      if (!closeInfo) closeInfo = { code, reason };
      resolveClosed(closeInfo);
      deliver();
    };

    const client = {
      status: 101,
      messages,
      closed,
      get closeInfo() {
        return closeInfo;
      },
      /** The close, or a rejection after `timeout` ms: a missing close fails a test instead of hanging it. */
      waitClosed(timeout = 3000) {
        let timer;
        return Promise.race([
          closed,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`no close within ${timeout} ms`)), timeout);
          }),
        ]).finally(() => clearTimeout(timer));
      },
      sendText(text) {
        socket.write(encodeFrame(0x1, Buffer.from(text), true));
      },
      sendBinary(bytes) {
        socket.write(encodeFrame(0x2, Buffer.from(bytes), true));
      },
      /** Wire-level negative cases, without the client's frame encoder. */
      sendRaw(bytes) {
        socket.write(bytes);
      },
      /** Several text frames in one TCP write: a true burst. */
      burst(texts) {
        socket.write(Buffer.concat(texts.map((text) => encodeFrame(0x1, Buffer.from(text), true))));
      },
      next(match, { timeout = 3000, label = "message", from = 0 } = {}) {
        return new Promise((resolveNext, rejectNext) => {
          const waiter = { match, from, label, resolve: resolveNext, reject: rejectNext };
          waiter.timer = setTimeout(() => {
            waiters.splice(waiters.indexOf(waiter), 1);
            rejectNext(new Error(`timed out waiting for ${label}; got ${JSON.stringify(messages)}`));
          }, timeout);
          waiters.push(waiter);
          deliver();
        });
      },
      async close(code = 1000) {
        if (!closeInfo && !socket.destroyed) socket.write(encodeFrame(0x8, closePayload(code, "done"), true));
        const timer = setTimeout(() => socket.destroy(), 1000);
        await closed;
        clearTimeout(timer);
        socket.destroy();
      },
      destroy() {
        socket.destroy();
      },
    };

    socket.on("connect", () => socket.write(`${lines.join("\r\n")}\r\n\r\n`));
    socket.on("error", (error) => {
      if (!opened) rejectConnect(error);
      finish(1006, "error");
    });
    socket.on("close", () => {
      if (!opened) {
        const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(head.toString("latin1"))?.[1] ?? 0);
        resolveConnect({ status, closed: Promise.resolve({ code: 1006 }) });
      }
      finish(1006, "");
    });
    socket.on("data", (chunk) => {
      let data = chunk;
      if (!opened) {
        head = Buffer.concat([head, data]);
        const end = head.indexOf("\r\n\r\n");
        if (end === -1) return;
        const status = Number(/^HTTP\/1\.1 (\d{3})/.exec(head.toString("latin1"))?.[1] ?? 0);
        data = head.subarray(end + 4);
        if (status !== 101) {
          opened = true;
          socket.destroy();
          resolveConnect({ status, closed: Promise.resolve({ code: 1006 }) });
          return;
        }
        opened = true;
        resolveConnect(client);
      }
      for (const frame of read(data)) {
        if (frame.tooBig) continue;
        if (frame.opcode === 0x1) {
          messages.push(JSON.parse(frame.payload.toString("utf8")));
          deliver();
        } else if (frame.opcode === 0x8) {
          const code = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1005;
          const reason = frame.payload.subarray(2).toString("utf8");
          if (!closeInfo) closeInfo = { code, reason };
          if (!socket.destroyed) socket.end(encodeFrame(0x8, closePayload(code === 1005 ? 1000 : code), true));
          finish(code, reason);
        } else if (frame.opcode === 0x9) {
          socket.write(encodeFrame(0xa, frame.payload, true));
        }
      }
    });
  });
}

// ---------------------------------------------------------------- shared contract (tests only)

const move = (x, y, extra = {}) => JSON.stringify({ t: "m", x, y, ...extra });
const quiet = (ms) => new Promise((done) => setTimeout(done, ms));
/** How long a test listens to prove that something did NOT arrive. */
const SILENCE_MS = 300;

async function open(target, room = "%2F") {
  const client = await rawConnect(target.base, { path: `/ghosts?room=${room}`, origin: target.origin });
  assert.equal(client.status, 101, `upgrade into ${room}`);
  const hi = await client.next((m) => m.t === "hi", { label: "hi" });
  client.id = hi.id;
  client.hi = hi;
  return client;
}

async function closeAll(clients) {
  await Promise.all(clients.map((client) => client.close()));
}

/** Refusals the Worker and the fake must both give before any room exists. */
export const NEGATIVE_UPGRADES = [
  { name: "missing Origin", origin: undefined, status: 403 },
  { name: "Origin null", origin: "null", status: 403 },
  { name: "unlisted Origin", origin: "https://evil.example", status: 403 },
  { name: "lookalike Origin", origin: "https://otohime.dev.evil.example", status: 403 },
  { name: "Origin with a path", originSuffix: "/", status: 403 },
  { name: "malformed Origin", origin: "not a url", status: 403 },
  { name: "unknown room", path: "/ghosts?room=%2Fplay", status: 404 },
  { name: "no room", path: "/ghosts", status: 404 },
  { name: "repeated room", path: "/ghosts?room=%2F&room=%2Fryugu", status: 404 },
  { name: "unencoded room name", path: "/ghosts?room=ryugu", status: 404 },
  { name: "other path", path: "/elsewhere?room=%2F", status: 404 },
  { name: "plain GET without Upgrade", upgrade: false, status: 426 },
  // workerd itself answers a POST carrying Upgrade with 400 before the Worker runs; the shared policy says 405.
  { name: "POST upgrade", method: "POST", status: [405, 400] },
];

/**
 * The ghost transport contract as named async cases over a target
 * {base: "http://host:port", origin: an allowed Origin}. The same cases run
 * against the local fake and the actual Worker in workerd.
 */
export const CONTRACT_CASES = [
  {
    name: "two clients in one room exchange anonymous move and click events",
    async run(target) {
      const a = await open(target);
      const b = await open(target);
      assert.match(a.id, /^[0-9a-f-]{36}$/);
      assert.notEqual(a.id, b.id, "each connection gets its own server id");
      assert.equal(b.hi.n, a.hi.n + 1);
      await a.next((m) => m.t === "n" && m.n === b.hi.n, { label: "count after b joins" });
      const mark = a.messages.length;
      a.sendText(move(0.25, 1.5, { id: "spoofed" }));
      assert.deepEqual(await b.next((m) => m.t === "m", { label: "move" }), { t: "m", id: a.id, x: 0.25, y: 1 });
      b.sendText(JSON.stringify({ t: "c", x: -1, y: 0.123456 }));
      assert.deepEqual(await a.next((m) => m.t === "c", { label: "click" }), { t: "c", id: b.id, x: 0, y: 0.1235 });
      await quiet(SILENCE_MS);
      assert.equal(a.messages.slice(mark).filter((m) => m.t === "m").length, 0, "no echo to the sender");
      await closeAll([a, b]);
    },
  },
  {
    name: "a leaving member is announced with bye and the new count",
    async run(target) {
      const a = await open(target);
      const b = await open(target);
      await b.close();
      assert.deepEqual(await a.next((m) => m.t === "bye", { label: "bye" }), { t: "bye", id: b.id });
      assert.deepEqual(await a.next((m) => m.t === "n" && m.n === a.hi.n, { label: "count after leave" }), {
        t: "n",
        n: a.hi.n,
      });
      await a.close();
    },
  },
  {
    name: "the two rooms cannot communicate",
    async run(target) {
      const home = await open(target, "%2F");
      const palace = await open(target, "%2Fryugu");
      const palacePeer = await open(target, "%2Fryugu");
      home.sendText(move(0.5, 0.5));
      palace.sendText(move(0.6, 0.6));
      await palacePeer.next((m) => m.t === "m" && m.id === palace.id, { label: "same-room move" });
      await quiet(SILENCE_MS);
      assert.equal(palace.messages.some((m) => m.id === home.id), false, "home's move never reaches the palace");
      assert.equal(palacePeer.messages.some((m) => m.id === home.id), false);
      assert.equal(home.messages.some((m) => m.t === "m" || m.t === "bye"), false, "the palace never reaches home");
      await closeAll([home, palace, palacePeer]);
    },
  },
  {
    name: "bad upgrades are refused with the shared statuses",
    async run(target) {
      for (const bad of NEGATIVE_UPGRADES) {
        const origin = bad.originSuffix ? target.origin + bad.originSuffix : "origin" in bad ? bad.origin : target.origin;
        const result = await rawConnect(target.base, {
          path: bad.path ?? "/ghosts?room=%2F",
          origin,
          method: bad.method,
          upgrade: bad.upgrade,
        });
        const statuses = [bad.status].flat();
        assert.ok(statuses.includes(result.status), `${bad.name}: ${result.status}, expected ${statuses.join(" or ")}`);
        if (result.status === 101) await result.close();
      }
    },
  },
  {
    name: "binary, oversize and malformed frames are dropped and the fifth closes 1008",
    async run(target) {
      const a = await open(target);
      const b = await open(target);
      const mark = b.messages.length;
      a.sendBinary(Buffer.from(move(0.1, 0.1)));
      a.sendText(move(0.1, 0.1, { pad: "x".repeat(120) }));
      a.sendText("not json");
      a.sendText(JSON.stringify({ t: "m", x: "0.5", y: 0.5 }));
      a.sendText(move(0.3, 0.3)); // a valid frame between strikes still fans out
      await b.next((m) => m.t === "m" && m.x === 0.3, { label: "valid move between strikes", from: mark });
      a.sendText(JSON.stringify({ t: "chat", x: 0.1, y: 0.1 }));
      const closed = await a.waitClosed();
      assert.equal(closed.code, CLOSE_POLICY);
      assert.deepEqual(await b.next((m) => m.t === "bye", { label: "bye after policy close" }), { t: "bye", id: a.id });
      assert.equal(b.messages.slice(mark).filter((m) => m.t === "m").length, 1, "only the valid frame fanned out");
      await b.close();
    },
  },
  ...[0x40, 0x20, 0x10].map((reserved, index) => ({
    name: `RSV${index + 1} without a negotiated extension closes 1002 without fan-out`,
    async run(target) {
      const a = await open(target);
      const b = await open(target);
      try {
        a.sendText(move(0.2, 0.4));
        await b.next((m) => m.t === "m" && m.id === a.id, { label: "ordinary move before invalid wire frame" });
        const mark = b.messages.length;
        // Handcraft a masked frame independently of encodeFrame. No extension was negotiated.
        const payload = Buffer.from(move(0.3, 0.6));
        const mask = Buffer.from([1, 2, 3, 4]);
        const masked = Buffer.from(payload.map((byte, i) => byte ^ mask[i % 4]));
        a.sendRaw(Buffer.concat([Buffer.from([0x81 | reserved, 0x80 | payload.length]), mask, masked]));
        await b.next((m) => m.t === "bye" && m.id === a.id, { from: mark, label: "protocol rejection releases member" });
        assert.equal((await a.waitClosed()).code, 1002);
        assert.equal(b.messages.slice(mark).some((m) => m.t === "m" && m.id === a.id), false, "invalid frame never fans out");
      } finally {
        await closeAll([a, b]);
      }
    },
  })),
  {
    name: `a burst is cut at the ${RATE_CAPACITY}-token bucket without fan-out of the excess`,
    async run(target) {
      const a = await open(target);
      const b = await open(target);
      const mark = b.messages.length;
      const sent = Date.now();
      a.burst(Array.from({ length: RATE_CAPACITY * 2 }, (_, i) => move(i / 100, 0.5)));
      await quiet(SILENCE_MS);
      const elapsed = Date.now() - sent;
      const got = b.messages.slice(mark).filter((m) => m.t === "m").length;
      // A loaded machine may spread the burst out; the bucket can only have refilled by elapsed time.
      const ceiling = RATE_CAPACITY + Math.ceil((elapsed * RATE_CAPACITY) / 1000);
      assert.ok(got >= RATE_CAPACITY && got <= ceiling, `peer saw ${got} of ${RATE_CAPACITY * 2} in ${elapsed} ms`);
      assert.ok(got < RATE_CAPACITY * 2 || elapsed >= 1000, `the burst was not cut: ${got} in ${elapsed} ms`);
      assert.equal(a.closeInfo, null, "rate overflow drops, it does not close");
      await closeAll([a, b]);
    },
  },
  {
    name: `the room holds ${ROOM_CAP}; the next socket hears full and is closed 1013`,
    async run(target) {
      const clients = [];
      try {
        for (;;) {
          const client = await rawConnect(target.base, { path: "/ghosts?room=%2F", origin: target.origin });
          assert.equal(client.status, 101);
          const first = await client.next((m) => m.t === "hi" || m.t === "full", { label: "hi or full" });
          if (first.t === "full") {
            assert.equal((await client.waitClosed()).code, CLOSE_FULL);
            break;
          }
          clients.push(client);
          assert.ok(first.n <= ROOM_CAP, `n=${first.n}`);
          if (clients.length > ROOM_CAP) assert.fail("more than the cap admitted");
        }
        const last = clients.at(-1);
        assert.equal(last.messages.find((m) => m.t === "hi").n, ROOM_CAP, "full only once the room holds the cap");
        // The palace room is unaffected by a full home room.
        const palace = await open(target, "%2Fryugu");
        await palace.close();
        // A seat frees when someone leaves.
        await clients.shift().close();
        await last.next((m) => m.t === "n" && m.n === ROOM_CAP - 1, { label: "count after a leave" });
        const again = await open(target);
        assert.equal(again.hi.n, ROOM_CAP);
        clients.push(again);
      } finally {
        await closeAll(clients);
      }
    },
  },
  {
    name: "GET /version is public build metadata only",
    async run(target) {
      const res = await fetch(new URL("/version", target.base));
      assert.equal(res.status, 200);
      assert.match(res.headers.get("cache-control") ?? "", /no-store/);
      const body = await res.json();
      assert.deepEqual(Object.keys(body).sort(), ["fingerprint", "service", "workerVersionId"]);
      assert.ok(body.workerVersionId === null || /^[0-9a-f-]{36}$/.test(body.workerVersionId));
      assert.match(body.fingerprint, target.fingerprint ?? /^([0-9a-f]{64}|fake|unbuilt)$/);
      const text = JSON.stringify(body).toLowerCase();
      for (const word of ["token", "secret", "key", "account", "origin", "cookie", "ip", "member", "room"]) {
        assert.equal(text.includes(`"${word}`), false, `no ${word} field`);
      }
    },
  },
];

// ---------------------------------------------------------------- CLI

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fake = await startGhostsFake({
    port: Number(argValue("--port") ?? process.env.GHOSTS_FAKE_PORT ?? 8788),
    origins: argValue("--origins") ?? process.env.GHOSTS_FAKE_ORIGINS ?? DEFAULT_FAKE_ORIGINS,
    mode: argValue("--mode"),
  });
  const stop = async () => {
    await fake.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // Only after the handlers exist: a supervisor may signal the moment it reads this line.
  console.log(`ghosts-fake ready ${fake.url} origins=${fake.allowed.join(",")}`);
}
