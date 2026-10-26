// The ink-ghosts wire protocol and upgrade policy: what a frame may hold, how big it may be, which origins
// and rooms are admitted. The Worker (ghosts/worker) and the local fake (scripts/ghosts-fake.mjs) import
// these same files, so these cases bind both.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_FRAME_BYTES,
  encodeServerMessage,
  normalizeCoord,
  parseClientFrame,
  utf8Bytes,
} from "./protocol.ts";
import { ROOMS, admitUpgrade, canonicalOrigin, isAllowedOrigin, parseAllowedOrigins, parseRoom } from "./policy.ts";

test("move and click frames with numeric coordinates parse, clamped to [0,1] and rounded", () => {
  assert.deepEqual(parseClientFrame('{"t":"m","x":0.25,"y":0.5}'), { ok: true, msg: { t: "m", x: 0.25, y: 0.5 } });
  assert.deepEqual(parseClientFrame('{"t":"c","x":-3,"y":9}'), { ok: true, msg: { t: "c", x: 0, y: 1 } });
  assert.deepEqual(parseClientFrame('{"t":"m","x":0.123456789,"y":1e-9}'), {
    ok: true,
    msg: { t: "m", x: 0.1235, y: 0 },
  });
});

test("a client id or other extra field is ignored, never passed on", () => {
  const parsed = parseClientFrame('{"t":"m","x":0.1,"y":0.2,"id":"spoofed","name":"x"}');
  assert.deepEqual(parsed, { ok: true, msg: { t: "m", x: 0.1, y: 0.2 } });
});

test("malformed frames are rejected as malformed", () => {
  for (const frame of [
    "",
    "not json",
    "null",
    "[1,2]",
    '"m"',
    "7",
    '{"t":"m"}',
    '{"t":"m","x":"0.1","y":0.2}',
    '{"t":"m","x":0.1,"y":null}',
    '{"t":"chat","x":0.1,"y":0.2}',
    '{"t":"hi","x":0.1,"y":0.2}',
    '{"x":0.1,"y":0.2}',
    '{"t":"m","x":1e999,"y":0.2}',
  ]) {
    assert.deepEqual(parseClientFrame(frame), { ok: false, reason: "malformed" }, frame);
  }
  assert.equal(normalizeCoord(Number.NaN), null);
  assert.equal(normalizeCoord(Number.POSITIVE_INFINITY), null);
});

test("binary frames are rejected whatever they contain", () => {
  const bytes = new TextEncoder().encode('{"t":"m","x":0.1,"y":0.2}');
  assert.deepEqual(parseClientFrame(bytes), { ok: false, reason: "binary" });
  assert.deepEqual(parseClientFrame(bytes.buffer), { ok: false, reason: "binary" });
  assert.deepEqual(parseClientFrame(undefined), { ok: false, reason: "binary" });
});

test("the 128-byte cap counts UTF-8 bytes, not characters", () => {
  const exact = `{"t":"m","x":0.1,"y":0.2,"p":"${"a".repeat(MAX_FRAME_BYTES - 32)}"}`;
  assert.equal(utf8Bytes(exact), MAX_FRAME_BYTES);
  assert.equal(parseClientFrame(exact).ok, true);
  const over = exact.replace('"p":"a', '"p":"aa');
  assert.equal(utf8Bytes(over), MAX_FRAME_BYTES + 1);
  assert.deepEqual(parseClientFrame(over), { ok: false, reason: "oversize" });
  // 72 characters but 152 bytes: short in length, over the cap in bytes.
  const wide = `{"t":"m","x":0.1,"y":0.2,"p":"${"海".repeat(40)}"}`;
  assert.ok(wide.length < MAX_FRAME_BYTES);
  assert.deepEqual(parseClientFrame(wide), { ok: false, reason: "oversize" });
});

test("server messages encode as compact JSON", () => {
  assert.equal(encodeServerMessage({ t: "full" }), '{"t":"full"}');
  assert.equal(encodeServerMessage({ t: "m", id: "a", x: 0.5, y: 1 }), '{"t":"m","id":"a","x":0.5,"y":1}');
});

test("origins must be exact: no null, path, credentials, other schemes or padding", () => {
  assert.equal(canonicalOrigin("https://otohime.dev"), "https://otohime.dev");
  assert.equal(canonicalOrigin("http://localhost:4000"), "http://localhost:4000");
  for (const bad of [
    null,
    undefined,
    "",
    "null",
    "otohime.dev",
    "https://otohime.dev/",
    "https://otohime.dev/ryugu",
    "https://user@otohime.dev",
    "HTTPS://OTOHIME.DEV",
    "https://otohime.dev:443",
    " https://otohime.dev",
    "ws://otohime.dev",
    "file:///etc",
  ]) {
    assert.equal(canonicalOrigin(bad), null, String(bad));
  }
});

test("ALLOWED_ORIGINS parses to exact origins and drops the malformed ones", () => {
  assert.deepEqual(parseAllowedOrigins("https://otohime.dev, http://localhost:4000,https://otohime.dev"), [
    "https://otohime.dev",
    "http://localhost:4000",
  ]);
  assert.deepEqual(parseAllowedOrigins("*,null,https://otohime.dev/"), []);
  assert.deepEqual(parseAllowedOrigins(undefined), []);
  const allowed = parseAllowedOrigins("https://otohime.dev");
  assert.equal(isAllowedOrigin("https://otohime.dev", allowed), true);
  assert.equal(isAllowedOrigin("https://evil.example", allowed), false);
  assert.equal(isAllowedOrigin("https://otohime.dev.evil.example", allowed), false);
  assert.equal(isAllowedOrigin(null, allowed), false);
  assert.equal(isAllowedOrigin("null", ["null"]), false);
});

test("only the two rooms exist, named once", () => {
  assert.deepEqual([...ROOMS], ["/", "/ryugu"]);
  assert.equal(parseRoom(new URLSearchParams("room=%2F")), "/");
  assert.equal(parseRoom(new URLSearchParams("room=%2Fryugu")), "/ryugu");
  for (const bad of ["", "room=", "room=%2Fplay", "room=ryugu", "room=%2Fryugu%2F", "room=%2F&room=%2Fryugu"]) {
    assert.equal(parseRoom(new URLSearchParams(bad)), null, bad);
  }
});

function request(init: { method?: string; url?: string; headers?: Record<string, string> }) {
  const headers = new Map(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method: init.method ?? "GET",
    url: init.url ?? "https://ghosts.example/ghosts?room=%2F",
    header: (name: string) => headers.get(name.toLowerCase()) ?? null,
  };
}

test("admission checks method, upgrade, origin, then room", () => {
  const allowed = ["https://otohime.dev"];
  const good = { Upgrade: "websocket", Origin: "https://otohime.dev" };
  assert.deepEqual(admitUpgrade(request({ headers: good }), allowed), { ok: true, room: "/" });
  assert.deepEqual(
    admitUpgrade(request({ headers: good, url: "https://ghosts.example/ghosts?room=%2Fryugu" }), allowed),
    { ok: true, room: "/ryugu" },
  );
  assert.equal(admitUpgrade(request({ method: "POST", headers: good }), allowed).ok, false);
  const reasons = (init: Parameters<typeof request>[0]) => {
    const result = admitUpgrade(request(init), allowed);
    return result.ok ? "ok" : `${result.status} ${result.reason}`;
  };
  assert.equal(reasons({ method: "POST", headers: good }), "405 method");
  assert.equal(reasons({ headers: { Origin: "https://otohime.dev" } }), "426 upgrade");
  assert.equal(reasons({ headers: { Upgrade: "websocket" } }), "403 origin");
  assert.equal(reasons({ headers: { Upgrade: "websocket", Origin: "null" } }), "403 origin");
  assert.equal(reasons({ headers: { Upgrade: "websocket", Origin: "https://evil.example" } }), "403 origin");
  assert.equal(reasons({ headers: { Upgrade: "websocket", Origin: "https://otohime.dev/" } }), "403 origin");
  assert.equal(reasons({ headers: good, url: "https://ghosts.example/ghosts?room=%2Fplay" }), "404 room");
  assert.equal(reasons({ headers: good, url: "https://ghosts.example/ghosts" }), "404 room");
  // A bad origin is refused before the room is even read.
  assert.equal(
    reasons({ headers: { Upgrade: "websocket", Origin: "https://evil.example" }, url: "https://g.example/ghosts?room=x" }),
    "403 origin",
  );
  assert.equal(reasons({ headers: good }), "ok");
  assert.equal(admitUpgrade(request({ headers: good }), []).ok, false, "an empty allowlist admits nobody");
});
