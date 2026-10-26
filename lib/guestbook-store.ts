import type { Pool, PoolClient } from "pg";
import { encodeCursor, type Admission, type AdmissionResult, type Cursor, type GuestbookStore, type PublicEntry, type Stroke } from "./guestbook.ts";

const lockKey = "80761273125673001"; // fixed guestbook namespace, unrelated to other advisory locks
async function count(client: PoolClient, bucket: string): Promise<number> {
  const result = await client.query<{ count: number }>("select count from guestbook_usage where bucket=$1", [bucket]);
  return result.rows[0]?.count ?? 0;
}
export function createGuestbookStore(pool: Pool): GuestbookStore {
  return {
    async admit(input: Admission): Promise<AdmissionResult> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("select pg_advisory_xact_lock($1::bigint)", [lockKey]);
        // One small bounded sweep on every write, after taking the lock. Old rows are never read again.
        await client.query("delete from guestbook_usage where bucket in (select bucket from guestbook_usage where updated_at < $1::timestamptz - interval '2 days' limit 100)", [input.now]);
        if (await count(client, input.hour) >= 3) { await client.query("ROLLBACK"); return { kind: "hour_limit" }; }
        if (await count(client, input.day) >= 100) { await client.query("ROLLBACK"); return { kind: "day_limit" }; }
        const pending = await client.query<{ count: string }>("select count(*)::text as count from guestbook_entry where status='pending'");
        if (Number(pending.rows[0].count) >= 500) { await client.query("ROLLBACK"); return { kind: "queue_full" }; }
        await client.query("insert into guestbook_entry (id,name,note,v,strokes,duration_ms,point_count,byte_count,status,tilt,tape,created_at) values ($1,$2,$3,1,$4::jsonb,$5,$6,$7,'pending',$8,$9,$10)", [input.id, input.payload.name, input.payload.note, JSON.stringify(input.payload.strokes), input.payload.durationMs, input.pointCount, input.byteCount, input.tilt, input.tape, input.now]);
        for (const bucket of [input.hour, input.day]) await client.query("insert into guestbook_usage(bucket,count,updated_at) values($1,1,$2) on conflict(bucket) do update set count=guestbook_usage.count+1, updated_at=excluded.updated_at", [bucket, input.now]);
        await client.query("COMMIT");
        return { kind: "accepted", id: input.id };
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async list(cursor: Cursor | null) {
      const result = await pool.query<{ id: string; name: string; note: string; v: number; strokes: Stroke[]; duration_ms: number; tilt: number; tape: number; created_at: string }>(`select id,name,note,v,strokes,duration_ms,tilt,tape,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at from guestbook_entry where status='approved' and ($1::timestamptz is null or (created_at,id) < ($1::timestamptz,$2::text)) order by created_at desc,id desc limit 25`, [cursor?.createdAt ?? null, cursor?.id ?? null]);
      const more = result.rows.length > 24;
      const entries: PublicEntry[] = result.rows.slice(0, 24).map((row) => ({ id: row.id, name: row.name, note: row.note, v: 1, strokes: row.strokes, durationMs: row.duration_ms, tilt: row.tilt, tape: row.tape, createdAt: row.created_at }));
      const last = entries.at(-1);
      return { entries, nextCursor: more && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
    },
  };
}
