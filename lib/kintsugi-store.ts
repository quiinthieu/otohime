import { Pool } from "pg";
import type { MendedCard, Seam } from "./kintsugi.ts";

let pool: Pool | undefined;
export function kintsugiPool() {
  if (!process.env.DATABASE_URL) throw new Error("Kintsugi storage unavailable");
  return pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 4000, statement_timeout: 5000 });
}
export function createKintsugiStore(pool: Pool) {
  return {
    async list(): Promise<MendedCard[]> {
      return (await pool.query<MendedCard>('select id, count, seams from kintsugi_card order by count desc, id limit 128')).rows;
    },
    async mend(id: string, seam: Seam, buckets: string[], now = new Date()): Promise<"accepted" | "limited" | "full"> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("select pg_advisory_xact_lock(80761273125673002::bigint)");
        await client.query("delete from kintsugi_usage where updated_at < $1::timestamptz - interval '2 days'", [now]);
        const usage = await client.query<{bucket:string;count:number}>("select bucket,count from kintsugi_usage where bucket=any($1::text[])", [buckets]);
        const caps = [6, 2, 1000];
        if (buckets.some((bucket, i) => (usage.rows.find(r => r.bucket === bucket)?.count ?? 0) >= caps[i])) {
          await client.query("ROLLBACK"); return "limited";
        }
        const size = await client.query<{n:number}>("select count(*)::int as n from kintsugi_usage");
        if (size.rows[0].n + 3 > 4096) { await client.query("ROLLBACK"); return "full"; }
        const cards = await client.query<{n:number;exists:boolean}>("select count(*)::int as n, bool_or(id=$1) as exists from kintsugi_card", [id]);
        if (cards.rows[0].n >= 128 && !cards.rows[0].exists) { await client.query("ROLLBACK"); return "full"; }
        await client.query(`insert into kintsugi_card(id,count,seams) values($1,1,$2::jsonb)
          on conflict(id) do update set count=least(kintsugi_card.count+1,1000000),
          seams=(select coalesce(jsonb_agg(value order by ord), '[]'::jsonb) from jsonb_array_elements(kintsugi_card.seams || excluded.seams) with ordinality as s(value,ord) where ord > greatest(jsonb_array_length(kintsugi_card.seams),0)-11)`, [id, JSON.stringify([seam])]);
        for (const bucket of buckets) await client.query("insert into kintsugi_usage(bucket,count,updated_at) values($1,1,$2) on conflict(bucket) do update set count=kintsugi_usage.count+1,updated_at=excluded.updated_at", [bucket, now]);
        await client.query("COMMIT"); return "accepted";
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
  };
}
