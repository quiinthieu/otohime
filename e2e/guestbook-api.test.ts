import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { buckets } from "../lib/guestbook.ts";
const base = process.env.BASE_URL ?? "http://localhost:4000";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const payload = { v: 1, durationMs: 100, name: "Ink visitor", note: "a little wave", strokes: [{ c: 0, p: [1, 2, 3, 4], w: [3, 4], t0: 0, d: 100 }] };
const post = (ip: string, body: unknown = payload, headers: Record<string, string> = {}) => fetch(`${base}/api/guestbook`, { method: "POST", headers: { "content-type": "application/json", origin: base, "x-real-ip": ip, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const rows = async () => Number((await pool.query("select count(*)::int as n from guestbook_entry")).rows[0].n);
const usage = async (bucket: string) => Number((await pool.query("select count from guestbook_usage where bucket=$1", [bucket])).rows[0]?.count ?? 0);
const id = () => randomUUID();

test("real migration upgrades old schema without losing sentinel data", async () => {
  const client = await pool.connect();
  const schema = `guestbook_upgrade_${Date.now()}`;
  try {
    await client.query("BEGIN");
    await client.query(`create schema ${schema}`);
    await client.query(`set local search_path to ${schema}`);
    for (let i = 0; i < 4; i++) {
      const file = ["0000_long_wendigo", "0001_swift_ironclad", "0002_lively_spacker_dave", "0003_petite_omega_flight"][i];
      const sql = readFileSync(`db/migrations/${file}.sql`, "utf8").replaceAll('"public"."user"', `"${schema}"."user"`).replaceAll("--> statement-breakpoint", "\n");
      await client.query(sql);
    }
    await client.query("insert into \"user\"(id,name,email,updated_at) values('sentinel','Before migration','sentinel@example.test',now())");
    const sql = readFileSync("db/migrations/0004_green_scarlet_witch.sql", "utf8").replaceAll('"public"."user"', `"${schema}"."user"`).replaceAll("--> statement-breakpoint", "\n");
    await client.query(sql);
    assert.equal((await client.query("select name from \"user\" where id='sentinel'")).rows[0].name, "Before migration");
    assert.equal((await client.query("select count(*)::int as n from guestbook_entry")).rows[0].n, 0);
  } finally { await client.query("ROLLBACK"); client.release(); }
});

test("real API persists pending vectors and hides private rows, with 24-entry tied-time pages", async () => {
  const before = await rows();
  const response = await post(`first-${id()}`);
  assert.equal(response.status, 201, response.status === 201 ? "" : await response.text());
  const written = await response.json();
  assert.equal(written.status, "pending");
  const persisted = await pool.query("select status,strokes,tilt,tape from guestbook_entry where id=$1", [written.id]);
  assert.equal(persisted.rows[0].status, "pending");
  assert.deepEqual(persisted.rows[0].strokes, payload.strokes);
  assert.ok(persisted.rows[0].tilt >= -4 && persisted.rows[0].tilt <= 4);
  assert.ok(persisted.rows[0].tape >= 0 && persisted.rows[0].tape <= 3);
  assert.equal(await rows(), before + 1);
  const hidden = await (await fetch(`${base}/api/guestbook?status=pending`)).json();
  assert.ok(!hidden.entries.some((entry: { id: string }) => entry.id === written.id));
  assert.equal((await fetch(`${base}/api/guestbook?cursor=invalid`)).status, 400);
  await pool.query("update guestbook_entry set status='rejected' where id=$1", [written.id]);
  const tied = new Date("2026-01-01T00:00:00.123Z");
  const ids = Array.from({ length: 26 }, id);
  for (const entryId of ids) await pool.query("insert into guestbook_entry(id,v,strokes,duration_ms,point_count,byte_count,status,tilt,tape,created_at) values($1,1,$2,100,2,50,'approved',0,0,$3)", [entryId, JSON.stringify(payload.strokes), tied]);
  const first = await (await fetch(`${base}/api/guestbook`)).json();
  assert.equal(first.entries.length, 24);
  assert.ok(first.nextCursor);
  const second = await (await fetch(`${base}/api/guestbook?cursor=${encodeURIComponent(first.nextCursor)}`)).json();
  assert.equal(second.entries.length, 2);
  assert.equal(new Set([...first.entries, ...second.entries].map((entry: { id: string }) => entry.id)).size, 26);
  for (const entry of [...first.entries, ...second.entries]) assert.deepEqual(Object.keys(entry).sort(), ["id", "name", "note", "v", "strokes", "durationMs", "tilt", "tape", "createdAt"].sort());
  assert.ok(![...first.entries, ...second.entries].some((entry: { id: string }) => entry.id === written.id));
  await pool.query("delete from guestbook_entry where id = any($1::text[])", [ids]);
});

test("malformed, foreign, profane, URL and oversized bodies never insert", async () => {
  const before = await rows();
  for (const body of ["{", { ...payload, note: "f.u.c.k" }, { ...payload, note: "https://bad.dev" }, { ...payload, strokes: [{ ...payload.strokes[0], p: [1, 2, 999, 4] }] }, { ...payload, website: "bot" }]) assert.equal((await post(`bad-${id()}`, body)).status, 400);
  assert.equal((await post(`bad-${id()}`, payload, { origin: "https://foreign.dev" })).status, 403);
  assert.equal((await post(`bad-${id()}`, JSON.stringify(payload) + " ".repeat(9000))).status, 413);
  assert.equal(await rows(), before);
});

test("concurrent hour, day and queue admission are atomic", async () => {
  const ip = `concurrent-${id()}`;
  const results = await Promise.all(Array.from({ length: 12 }, () => post(ip)));
  assert.equal(results.filter((response) => response.status === 201).length, 3);
  assert.equal(results.filter((response) => response.status === 429).length, 9);
  const keys = buckets(ip, new Date(), process.env.BETTER_AUTH_SECRET!);
  assert.equal(await usage(keys.hour), 3);
  const dayBefore = await usage(keys.day);
  await pool.query("update guestbook_usage set count=99 where bucket=$1", [keys.day]);
  const fresh = `day-${id()}`;
  assert.equal((await post(fresh)).status, 201);
  const deniedIp = `another-${id()}`;
  assert.equal((await post(deniedIp)).status, 429);
  assert.equal(await usage(keys.day), 100);
  const deniedKeys = buckets(deniedIp, new Date(), process.env.BETTER_AUTH_SECRET!);
  assert.equal(await usage(deniedKeys.hour), 0);
  await pool.query("update guestbook_usage set count=$2 where bucket=$1", [keys.day, dayBefore + 4]);
  await pool.query("update guestbook_entry set status='rejected' where status='pending'");
  const queueIds = Array.from({ length: 499 }, id);
  await pool.query("insert into guestbook_entry(id,v,strokes,duration_ms,point_count,byte_count,status,tilt,tape) select x,1,'[]'::jsonb,100,2,2,'pending',0,0 from unnest($1::text[]) x", [queueIds]);
  const queueIp = `queue-${id()}`;
  const queueKeys = buckets(queueIp, new Date(), process.env.BETTER_AUTH_SECRET!);
  assert.equal((await post(queueIp)).status, 201);
  const before = await rows();
  assert.equal((await post(queueIp)).status, 503);
  assert.equal(await rows(), before);
  assert.equal(await usage(queueKeys.hour), 1);
  await pool.query("delete from guestbook_entry where id = any($1::text[])", [queueIds]);
});

test.after(async () => { await pool.end(); });
