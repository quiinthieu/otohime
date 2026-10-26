import test from "node:test";
import assert from "node:assert/strict";
import { buckets, decodeCursor, encodeCursor, validateGuestbook } from "./guestbook.ts";
const stroke = { c: 0, p: [0, 0, 240, 160], w: [1, 15], t0: 0, d: 100 };
const payload = () => ({ v: 1, name: " A   visitor ", note: "hello", durationMs: 100, website: "", strokes: [stroke] });
test("canonical bounded vectors and normalized optional text", () => {
  const good = validateGuestbook(payload());
  assert.equal(good.ok, true);
  if (good.ok) { assert.equal(good.payload.name, "A visitor"); assert.equal(good.pointCount, 2); }
  assert.equal(validateGuestbook({ ...payload(), status: "approved" }).ok, false);
  assert.equal(validateGuestbook({ ...payload(), strokes: [{ ...stroke, svg: "<script>" }] }).ok, false);
  assert.equal(validateGuestbook({ ...payload(), strokes: [{ ...stroke, p: [0, 0, 241, 0] }] }).ok, false);
  assert.equal(validateGuestbook({ ...payload(), strokes: [{ ...stroke, w: [1, 16] }] }).ok, false);
  assert.equal(validateGuestbook({ ...payload(), strokes: [{ ...stroke, p: [0, 0] }] }).ok, false);
  assert.equal(validateGuestbook({ ...payload(), durationMs: 99 }).ok, false);
  assert.equal(validateGuestbook({ ...payload(), website: "trap" }).ok, false);
  assert.deepEqual(validateGuestbook({ ...payload(), strokes: Array(41).fill(stroke) }), { ok: false, reason: "shape" });
  assert.deepEqual(validateGuestbook({ ...payload(), strokes: [{ ...stroke, p: Array(1502 * 2).fill(0), w: Array(1502).fill(1) }] }), { ok: false, reason: "vector_large" });
});
test("profanity, links and benign lookalikes", () => {
  for (const note of ["f.u.c.k", "sh1t", "visit example.com", "https://example.dev", "files.example.edu", "ftp://example.org"]) assert.equal(validateGuestbook({ ...payload(), note }).ok, false, note);
  for (const note of ["classical music", "The assistant drew it", "a pretty beach"]) assert.equal(validateGuestbook({ ...payload(), note }).ok, true, note);
  assert.deepEqual(validateGuestbook({ ...payload(), name: "a".repeat(25) }), { ok: false, reason: "text" });
});
test("HMAC namespacing and strict cursor", () => {
  const now = new Date("2026-10-26T12:30:00Z");
  assert.equal(buckets("1.2.3.4", now, "s").day, "guestbook:day:2026-10-26");
  assert.ok(!buckets("1.2.3.4", now, "s").hour.includes("1.2.3.4"));
  const cursor = encodeCursor({ createdAt: "2026-10-26T12:30:00.123456Z", id: "00000000-0000-4000-8000-000000000001" });
  assert.ok(decodeCursor(cursor));
  assert.equal(decodeCursor(cursor + "!"), null);
});
