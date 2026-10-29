import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { encodeCursor } from "../lib/guestbook.ts";
import { inkblotBuckets } from "../lib/inkblot-http.ts";
const base = process.env.BASE_URL ?? "http://localhost:4000";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const payload = { blotKey: "otohime7", name: "Ink visitor", note: "a little moth", website: "" };
const post = (ip: string, body: unknown = payload, headers: Record<string, string> = {}) => fetch(`${base}/api/inkblot/answers`, { method: "POST", headers: { "content-type": "application/json", origin: base, "x-real-ip": ip, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (query = "blot=otohime7") => fetch(`${base}/api/inkblot/answers?${query}`);
const rows = async () => Number((await pool.query("select count(*)::int as n from inkblot_answer")).rows[0].n);
const usage = async (bucket: string) => Number((await pool.query("select count from inkblot_usage where bucket=$1", [bucket])).rows[0]?.count ?? 0);
const keys = (ip: string) => inkblotBuckets(ip, new Date(), process.env.BETTER_AUTH_SECRET!);
const id = () => randomUUID();

test("expand-only migration upgrades 0000..0005 and preserves existing user/guestbook/bottle data", async () => {
  const client = await pool.connect();
  const schema = `inkblot_upgrade_${Date.now()}`;
  try {
    await client.query("BEGIN");
    await client.query(`create schema ${schema}`);
    await client.query(`set local search_path to ${schema}`);
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
    const apply = async (tag: string) => client.query(readFileSync(`db/migrations/${tag}.sql`, "utf8").replaceAll('"public"."user"', `"${schema}"."user"`).replaceAll("--> statement-breakpoint", "\n"));
    for (const { tag } of journal.entries.slice(0, 6)) await apply(tag);
    await client.query(`insert into "user"(id,name,email,updated_at) values('sentinel','Before migration','sentinel@example.test',now())`);
    await client.query(`insert into guestbook_entry(id,v,strokes,duration_ms,point_count,byte_count,status,tilt,tape) values('old-ink',1,'[]',1,0,2,'approved',0,0)`);
    await client.query(`insert into bottle_suggestion(id,url,title,note,kind,submitter_hmac) values('old-bottle','https://example.test','Before','A note','site','private-hmac')`);
    const migration = journal.entries[6].tag;
    const sql = readFileSync(`db/migrations/${migration}.sql`, "utf8");
    assert.doesNotMatch(sql, /\b(?:DROP|RENAME|TRUNCATE|DELETE\s+FROM|ALTER\s+COLUMN|SET\s+NOT\s+NULL)\b/i);
    await apply(migration);
    assert.equal((await client.query(`select name from "user" where id='sentinel'`)).rows[0].name, "Before migration");
    assert.equal((await client.query("select status from guestbook_entry where id='old-ink'")).rows[0].status, "approved");
    assert.equal((await client.query("select title from bottle_suggestion where id='old-bottle'")).rows[0].title, "Before");
    assert.equal((await client.query("select count(*)::int as n from inkblot_answer")).rows[0].n, 0);
    const index = (await client.query("select indexdef from pg_indexes where schemaname=$1 and indexname='inkblot_public_idx'", [schema])).rows[0].indexdef;
    assert.match(index, /\(blot_key, status, created_at DESC NULLS LAST, id DESC NULLS LAST\)/);
    for (const [column, value] of [["status", "'public'"], ["tilt", "5"], ["hand", "3"], ["note", "''"]]) {
      await client.query("SAVEPOINT constraint_check");
      await client.query("insert into inkblot_answer(id,blot_key,note,tilt,hand) values('check','a','moth',0,0)");
      await assert.rejects(client.query(`update inkblot_answer set ${column}=${value} where id='check'`), (error: unknown) => (error as { code?: string }).code === "23514");
      await client.query("ROLLBACK TO SAVEPOINT constraint_check");
    }
  } finally { await client.query("ROLLBACK"); client.release(); }
});

test("real API persists normalized pending notes, server decorations, and no raw IP", async () => {
  const ip = `first-${id()}`;
  const before = await rows();
  const response = await post(ip, { ...payload, name: " Ａ ", note: "  a\n moth  " });
  assert.equal(response.status, 201, response.status === 201 ? "" : await response.text());
  assert.equal(response.headers.get("cache-control"), "no-store");
  const written = await response.json();
  assert.deepEqual(Object.keys(written).sort(), ["id", "blotKey", "status", "tilt", "hand"].sort());
  const persisted = (await pool.query("select * from inkblot_answer where id=$1", [written.id])).rows[0];
  assert.equal(persisted.status, "pending");
  assert.equal(persisted.name, "A"); assert.equal(persisted.note, "a moth");
  assert.equal(persisted.blot_key, payload.blotKey);
  assert.equal(persisted.tilt, written.tilt); assert.equal(persisted.hand, written.hand);
  assert.ok(written.tilt >= -4 && written.tilt <= 4 && Number.isInteger(written.tilt));
  assert.ok(written.hand >= 0 && written.hand <= 2 && Number.isInteger(written.hand));
  assert.equal(await rows(), before + 1);
  assert.equal(await usage(keys(ip).hour), 1);
  assert.ok(!(await pool.query("select bucket from inkblot_usage")).rows.some(row => row.bucket.includes(ip)));
  const publicNotes = await (await get("blot=otohime7&status=pending")).json();
  assert.ok(!publicNotes.entries.some((row: { id: string }) => row.id === written.id));
});

test("GET filters approved rows by blot key and paginates tied microsecond timestamps without duplicates", async () => {
  const tied = "2026-01-01T00:00:00.123456Z";
  const ids = Array.from({ length: 26 }, id);
  const hidden = [id(), id(), id()];
  try {
    for (const entryId of ids) await pool.query("insert into inkblot_answer(id,blot_key,name,note,status,tilt,hand,created_at) values($1,'otohime7','Visitor','moth','approved',-4,2,$2)", [entryId, tied]);
    for (const [i, status, key] of [[0, "pending", "otohime7"], [1, "rejected", "otohime7"], [2, "approved", "different"]] as const) await pool.query("insert into inkblot_answer(id,blot_key,note,status,tilt,hand) values($1,$2,'Hidden',$3,0,0)", [hidden[i], key, status]);
    const response = await get();
    assert.equal(response.headers.get("cache-control"), "no-store");
    const first = await response.json();
    assert.equal(first.entries.length, 24); assert.ok(first.nextCursor);
    const second = await (await get(`blot=otohime7&cursor=${encodeURIComponent(first.nextCursor)}`)).json();
    assert.equal(second.entries.length, 2); assert.equal(second.nextCursor, null);
    const entries = [...first.entries, ...second.entries];
    assert.deepEqual(entries.map((row: { id: string }) => row.id), [...ids].sort().reverse());
    for (const row of entries) {
      assert.deepEqual(Object.keys(row).sort(), ["id", "blotKey", "name", "note", "tilt", "hand", "createdAt"].sort());
      assert.equal(row.createdAt, tied); assert.equal(row.blotKey, "otohime7");
    }
    await pool.query("update inkblot_answer set blot_key='daily:2024-02-29' where id=$1", [ids[0]]);
    assert.equal((await (await get("blot=daily:2024-02-29")).json()).entries.length, 1);
  } finally { await pool.query("delete from inkblot_answer where id = any($1::text[])", [[...ids, ...hidden]]); }
});

test("negative controls reject malformed/foreign/profane/URL/oversized/key requests without inserting or consuming quota", async () => {
  const before = await rows(); const ip = `bad-${id()}`;
  for (const body of ["{", null, [], { ...payload, note: "" }, { ...payload, note: "🦋".repeat(81) }, { ...payload, name: "x".repeat(25) }, { ...payload, note: "f.u.c.k" }, { ...payload, note: "https://bad.dev" }, { ...payload, website: "bot" }, { ...payload, status: "approved" }, { ...payload, tilt: 0 }, { ...payload, hand: 0 }, { ...payload, blotKey: "unbounded-gallery-key" }, { ...payload, blotKey: "daily:2024-02-29" }]) assert.equal((await post(ip, body)).status, 400, JSON.stringify(body));
  assert.equal((await post(ip, payload, { origin: "https://foreign.dev" })).status, 403);
  assert.equal((await post(ip, payload, { "content-type": "text/plain" })).status, 415);
  assert.equal((await post(ip, JSON.stringify(payload) + " ".repeat(4096))).status, 413);
  for (const query of ["", "blot=a&blot=b", "blot=daily:2026-02-30", "blot=a&cursor=invalid", "blot=a&cursor=&cursor=x"]) assert.equal((await get(query)).status, 400);
  for (const createdAt of ["2026-02-30T01:02:03.123456Z", "0000-01-01T00:00:00.000000Z"]) {
    const cursor = encodeCursor({ id: id(), createdAt });
    assert.equal((await get(`blot=a&cursor=${cursor}`)).status, 400);
  }
  assert.equal(await rows(), before); assert.equal(await usage(keys(ip).hour), 0);
});

test("concurrent hour, day and pending-cap admission are atomic and denied requests leave no quota residue", async () => {
  const ip = `concurrent-${id()}`;
  const results = await Promise.all(Array.from({ length: 12 }, () => post(ip)));
  assert.equal(results.filter(response => response.status === 201).length, 3);
  assert.equal(results.filter(response => response.status === 429).length, 9);
  assert.equal(await usage(keys(ip).hour), 3);
  const day = keys(ip).day; const dayBefore = await usage(day);
  try {
    await pool.query("update inkblot_usage set count=99 where bucket=$1", [day]);
    const dayIps = Array.from({ length: 8 }, () => `day-${id()}`);
    const dayResults = await Promise.all(dayIps.map(value => post(value)));
    assert.equal(dayResults.filter(response => response.status === 201).length, 1);
    assert.equal(dayResults.filter(response => response.status === 429).length, 7);
    assert.equal(await usage(day), 100);
    for (const [i, response] of dayResults.entries()) assert.equal(await usage(keys(dayIps[i]).hour), response.status === 201 ? 1 : 0);
  } finally { await pool.query("update inkblot_usage set count=$2 where bucket=$1", [day, dayBefore + 1]); }
  const pendingBefore = Number((await pool.query("select count(*)::int as n from inkblot_answer where status='pending'")).rows[0].n);
  const queueIds = Array.from({ length: 499 - pendingBefore }, id);
  try {
    await pool.query("insert into inkblot_answer(id,blot_key,note,tilt,hand) select x,'a','queue fixture',0,0 from unnest($1::text[]) x", [queueIds]);
    const queueIps = Array.from({ length: 8 }, () => `queue-${id()}`);
    const queueResults = await Promise.all(queueIps.map(value => post(value)));
    assert.equal(queueResults.filter(response => response.status === 201).length, 1);
    assert.equal(queueResults.filter(response => response.status === 503).length, 7);
    assert.equal((await pool.query("select count(*)::int as n from inkblot_answer where status='pending'")).rows[0].n, 500);
    for (const [i, response] of queueResults.entries()) assert.equal(await usage(keys(queueIps[i]).hour), response.status === 201 ? 1 : 0);
  } finally { await pool.query("delete from inkblot_answer where id=any($1::text[])", [queueIds]); }
});
test.after(async () => { await pool.end(); });
