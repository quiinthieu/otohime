import test from "node:test";
import assert from "node:assert/strict";
import { inkblotGet, inkblotPost, inkblotBuckets, type InkblotDeps } from "./inkblot-http.ts";
import { encodeCursor } from "./guestbook.ts";
import type { InkblotAdmission } from "./inkblot-store.ts";
const base = "https://example.dev/api/inkblot/answers";
const now = new Date("2026-10-29T12:00:00Z");
const payload = { blotKey: "otohime7", name: "Visitor", note: "a moth", website: "" };
function fixture() {
  const writes: InkblotAdmission[] = [];
  const reads: unknown[] = [];
  const deps: InkblotDeps = {
    env: { DATABASE_URL: "postgres://fixture", BETTER_AUTH_SECRET: "secret", BETTER_AUTH_URL: "https://example.dev/path" },
    now: () => now, id: () => "12345678-1234-1234-1234-123456789abc",
    store: { async admit(input) { writes.push(input); return { kind: "accepted", id: input.id }; }, async list(...args) { reads.push(args); return { entries: [], nextCursor: null }; } },
  };
  const post = (value: unknown = payload, headers: Record<string, string> = {}) => inkblotPost(new Request(base, { method: "POST", headers: { "content-type": "application/json", origin: "https://example.dev", "x-real-ip": "203.0.113.7", ...headers }, body: typeof value === "string" ? value : JSON.stringify(value) }), deps);
  const get = (query = "?blot=otohime7") => inkblotGet(new Request(base + query), deps);
  return { deps, writes, reads, post, get };
}
test("POST normalizes NFKC, whitespace and code points; derives decorations and private quota keys", async () => {
  const f = fixture();
  const response = await f.post({ ...payload, name: " Ａ\u0000 B ", note: "🦋".repeat(80) });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.blotKey, payload.blotKey);
  assert.equal(body.status, "pending");
  assert.ok(Number.isInteger(body.tilt) && body.tilt >= -4 && body.tilt <= 4);
  assert.ok(Number.isInteger(body.hand) && body.hand >= 0 && body.hand <= 2);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(f.writes[0].payload.name, "A B");
  assert.equal([...f.writes[0].payload.note].length, 80);
  assert.deepEqual({ hour: f.writes[0].hour, day: f.writes[0].day }, inkblotBuckets("203.0.113.7", now, "secret"));
  assert.ok(!JSON.stringify(f.writes).includes("203.0.113.7"));
  assert.equal((await f.post({ blotKey: "0", note: "moth" })).status, 201);
  assert.equal(f.writes[1].payload.name, "");
});
test("POST rejects malformed shape, text, URL, profanity, honeypot and caller moderation before store", async () => {
  const f = fixture();
  for (const value of [null, [], "{", { ...payload, note: "" }, { ...payload, note: " \n " }, { ...payload, note: "🦋".repeat(81) }, { ...payload, name: "🦋".repeat(25) }, { ...payload, name: 1 }, { ...payload, note: null }, { ...payload, note: "https://spam.dev" }, { ...payload, name: "www.spam.dev" }, { ...payload, note: "ｆｕｃｋ" }, { ...payload, note: "f.u.c.k" }, { ...payload, note: "nigger" }, { ...payload, website: "bot" }, { ...payload, website: null }, ...["status", "tilt", "hand", "extra"].map(key => ({ ...payload, [key]: 0 }))]) {
    const response = await f.post(value);
    assert.equal(response.status, 400, JSON.stringify(value));
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  for (const blotKey of ["", "a".repeat(11), "ABC", "daily:2026-02-30", "daily:2026-10-27", "daily:2026-10-31", null]) {
    const response = await f.post({ ...payload, blotKey });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).reason, "blot_key");
  }
  assert.equal(f.writes.length, 0);
  for (const blotKey of ["daily:2026-10-28", "daily:2026-10-29", "daily:2026-10-30"]) assert.equal((await f.post({ ...payload, blotKey })).status, 201);
});
test("transport guards enforce origin, JSON and actual bytes including streaming bodies", async () => {
  const f = fixture();
  assert.equal((await f.post(payload, { origin: "https://foreign.dev" })).status, 403);
  assert.equal((await f.post(payload, { "content-type": "text/plain" })).status, 415);
  assert.equal((await f.post(payload, { "content-length": "4097" })).status, 413);
  assert.equal((await f.post(JSON.stringify(payload) + " ".repeat(4096))).status, 413);
  // UTF-8 byte count, not UTF-16 length; under 4096 characters but over 4096 bytes.
  assert.equal((await f.post(JSON.stringify(payload) + "　".repeat(1500))).status, 413);
  let canceled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(2049)); }, cancel() { canceled = true; } });
  const request = new Request(base, { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
  assert.equal((await inkblotPost(request, f.deps)).status, 413);
  assert.equal(canceled, true);
  assert.equal(f.writes.length, 0);
});
test("GET validates singular keys and cursor, preserving historical daily galleries", async () => {
  const f = fixture();
  for (const query of ["", "?blot=", "?blot=a&blot=b", "?blot=ABC", "?blot=daily:2026-02-30", "?blot=a&cursor=invalid", "?blot=a&cursor=&cursor=x"]) assert.equal((await f.get(query)).status, 400, query);
  for (const createdAt of ["2026-02-30T01:02:03.123456Z", "0000-01-01T00:00:00.000000Z"]) {
    const invalid = encodeCursor({ id: "12345678-1234-1234-1234-123456789abc", createdAt });
    assert.equal((await f.get(`?blot=a&cursor=${invalid}`)).status, 400);
  }
  assert.equal(f.reads.length, 0);
  const cursor = { id: "12345678-1234-1234-1234-123456789abc", createdAt: "2026-10-29T01:02:03.123456Z" };
  const response = await f.get(`?blot=daily:2024-02-29&status=pending&cursor=${encodeCursor(cursor)}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(f.reads, [["daily:2024-02-29", cursor]]);
  assert.deepEqual(await response.json(), { entries: [], nextCursor: null });
});
test("configuration, quota and storage failures fail closed with stable reasons and safe logs", async () => {
  for (const missing of ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const) {
    const f = fixture(); delete f.deps.env[missing];
    assert.equal((await f.post()).status, 503);
    assert.equal(f.writes.length, 0);
  }
  const f = fixture();
  f.deps.env.BETTER_AUTH_URL = "invalid";
  assert.equal((await f.post()).status, 503);
  f.deps.env.BETTER_AUTH_URL = "https://example.dev";
  for (const kind of ["hour_limit", "day_limit", "queue_full"] as const) {
    f.deps.store!.admit = async () => ({ kind });
    const response = await f.post();
    assert.equal(response.status, kind === "queue_full" ? 503 : 429);
    assert.equal((await response.json()).reason, kind);
    if (kind !== "queue_full") assert.equal(response.headers.get("retry-after"), kind === "hour_limit" ? "3600" : "86400");
  }
  const logs: string[] = [];
  f.deps.log = (reason) => logs.push(reason);
  f.deps.store!.admit = async () => { throw new Error("private database details"); };
  f.deps.store!.list = async () => { throw new Error("private database details"); };
  assert.equal((await f.post()).status, 503);
  assert.equal((await f.get()).status, 503);
  assert.deepEqual(logs, ["write_failed", "read_failed"]);
  f.deps.store = undefined;
  assert.equal((await f.post()).status, 503);
  assert.equal((await f.get()).status, 503);
});
