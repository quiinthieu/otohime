import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

test("forged approval is rejected without using the write allowance", async () => {
  const base = process.env.BASE_URL;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const ip = `qa-${randomUUID()}`;
  const payload = {
    v: 1,
    durationMs: 25,
    strokes: [{ c: 2, p: [2, 3, 4, 5], w: [2, 3], t0: 0, d: 25 }],
  };
  const send = (body) => fetch(`${base}/api/guestbook`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, "x-real-ip": ip },
    body: JSON.stringify(body),
  });
  try {
    const before = Number((await pool.query("select count(*)::int as n from guestbook_entry")).rows[0].n);
    const forged = await send({ ...payload, status: "approved" });
    assert.equal(forged.status, 400);
    assert.equal((await forged.json()).reason, "shape");
    assert.equal(Number((await pool.query("select count(*)::int as n from guestbook_entry")).rows[0].n), before);

    const accepted = await Promise.all(Array.from({ length: 3 }, () => send(payload)));
    assert.ok(accepted.every((response) => response.status === 201));
    const [{ id, status }] = await Promise.all(accepted.map((response) => response.json()));
    assert.equal(status, "pending");
    assert.equal((await send(payload)).status, 429);
    assert.equal((await pool.query("select status from guestbook_entry where id=$1", [id])).rows[0].status, "pending");
    const publicRead = await fetch(`${base}/api/guestbook?status=approved`);
    assert.equal(publicRead.status, 200);
    assert.equal(publicRead.headers.get("cache-control"), "no-store");
    assert.ok(!(await publicRead.json()).entries.some((entry) => entry.id === id));
    assert.equal(Number((await pool.query("select count(*)::int as n from guestbook_entry")).rows[0].n), before + 3);
  } finally {
    await pool.end();
  }
});
