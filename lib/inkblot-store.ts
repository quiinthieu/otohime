import type { Pool, PoolClient } from "pg";
import { encodeCursor, type AdmissionResult, type Cursor } from "./guestbook.ts";

export type InkblotPayload = { blotKey: string; name: string; note: string };
export type InkblotEntry = InkblotPayload & { id: string; tilt: number; hand: number; createdAt: string };
export type InkblotAdmission = { id: string; payload: InkblotPayload; tilt: number; hand: number; hour: string; day: string; now: Date };
export type InkblotStore = {
  admit(input: InkblotAdmission): Promise<AdmissionResult>;
  list(blotKey: string, cursor: Cursor | null): Promise<{ entries: InkblotEntry[]; nextCursor: string | null }>;
};

const lockKey = "80761273125673002"; // fixed inkblot namespace, unrelated to other advisory locks
async function count(client: PoolClient, bucket: string): Promise<number> {
  const result = await client.query<{ count: number }>("select count from inkblot_usage where bucket=$1", [bucket]);
  return result.rows[0]?.count ?? 0;
}
export function createInkblotStore(pool: Pool): InkblotStore {
  return {
    async admit(input: InkblotAdmission): Promise<AdmissionResult> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("select pg_advisory_xact_lock($1::bigint)", [lockKey]);
        // One small bounded sweep on every write, after taking the lock. Old rows are never read again.
        await client.query("delete from inkblot_usage where bucket in (select bucket from inkblot_usage where updated_at < $1::timestamptz - interval '2 days' limit 100)", [input.now]);
        if (await count(client, input.hour) >= 3) { await client.query("ROLLBACK"); return { kind: "hour_limit" }; }
        if (await count(client, input.day) >= 100) { await client.query("ROLLBACK"); return { kind: "day_limit" }; }
        const pending = await client.query<{ count: string }>("select count(*)::text as count from inkblot_answer where status='pending'");
        if (Number(pending.rows[0].count) >= 500) { await client.query("ROLLBACK"); return { kind: "queue_full" }; }
        await client.query("insert into inkblot_answer (id,blot_key,name,note,status,tilt,hand,created_at) values ($1,$2,$3,$4,'pending',$5,$6,$7)", [input.id, input.payload.blotKey, input.payload.name, input.payload.note, input.tilt, input.hand, input.now]);
        for (const bucket of [input.hour, input.day]) await client.query("insert into inkblot_usage(bucket,count,updated_at) values($1,1,$2) on conflict(bucket) do update set count=inkblot_usage.count+1, updated_at=excluded.updated_at", [bucket, input.now]);
        await client.query("COMMIT");
        return { kind: "accepted", id: input.id };
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async list(blotKey: string, cursor: Cursor | null) {
      const result = await pool.query<{ id: string; blot_key: string; name: string; note: string; tilt: number; hand: number; created_at: string }>(`select id,blot_key,name,note,tilt,hand,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at from inkblot_answer where blot_key=$1 and status='approved' and ($2::timestamptz is null or (created_at,id) < ($2::timestamptz,$3::text)) order by created_at desc nulls last,id desc nulls last limit 25`, [blotKey, cursor?.createdAt ?? null, cursor?.id ?? null]);
      const more = result.rows.length > 24;
      const entries: InkblotEntry[] = result.rows.slice(0, 24).map((row) => ({ id: row.id, blotKey: row.blot_key, name: row.name, note: row.note, tilt: row.tilt, hand: row.hand, createdAt: row.created_at }));
      const last = entries.at(-1);
      return { entries, nextCursor: more && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
    },
  };
}
