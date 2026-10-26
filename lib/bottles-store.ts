import type { Pool } from "pg";
import type { BottleStore, Suggestion } from "./bottles-service.ts";
import { publicInput } from "./bottles-service.ts";
import { parseBottle, publicBottle } from "./bottles.ts";
import { can } from "./permissions.ts";
const fields = `id,url,title,note,kind,status,to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "updatedAt"`;
export function createPostgresBottleStore(pool: Pool): BottleStore {
  return {
    async admit({ bottle, submitter, bucket, now }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Serialize a single submitter/hour. Unique URL handles races across submitters.
        await client.query(
          "select pg_advisory_xact_lock(hashtextextended($1,0))",
          [bucket],
        );
        const duplicate = await client.query(
          "select id from bottle_suggestion where url=$1",
          [bottle.url],
        );
        if (duplicate.rowCount) {
          await client.query("ROLLBACK");
          return { kind: "duplicate" };
        }
        const admitted = await client.query(
          `insert into bottle_usage(bucket,count,updated_at) values($1,1,$2) on conflict(bucket) do update set count=bottle_usage.count+1,updated_at=excluded.updated_at where bottle_usage.count<5 returning count`,
          [bucket, now],
        );
        if (!admitted.rowCount) {
          await client.query("ROLLBACK");
          return { kind: "rate_limited" };
        }
        const inserted = await client.query(
          `insert into bottle_suggestion(id,url,title,note,kind,status,submitter_hmac,created_at,updated_at) values($1,$2,$3,$4,$5,'pending',$6,$7,$7) on conflict(url) do nothing returning id`,
          [
            bottle.id,
            bottle.url,
            bottle.title,
            bottle.note,
            bottle.kind,
            submitter,
            now,
          ],
        );
        if (!inserted.rowCount) {
          await client.query("ROLLBACK");
          return { kind: "duplicate" };
        }
        await client.query(
          "delete from bottle_usage where bucket in (select bucket from bottle_usage where updated_at < $1::timestamptz - interval '2 days' limit 100)",
          [now],
        );
        await client.query("COMMIT");
        return { kind: "accepted", id: bottle.id };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async approved() {
      const result = await pool.query<Suggestion>(
        `select ${fields} from bottle_suggestion where status='approved' order by id`,
      );
      return result.rows.map(publicBottle);
    },
    async list(status, cursor) {
      const result = await pool.query<Suggestion>(
        `select ${fields} from bottle_suggestion where status=$1 and ($2::text is null or id>$2) order by id limit 26`,
        [status, cursor],
      );
      return {
        suggestions: result.rows.slice(0, 25),
        nextCursor: result.rows.length > 25 ? result.rows[24].id : null,
      };
    },
    async moderate(id, status, actorId, now) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock the actor until commit: demotion/ban cannot race the final write.
        const actor = await client.query<{
          role: string | null;
          banned: boolean;
        }>('select role,banned from "user" where id=$1 for share', [actorId]);
        if (
          !actor.rows[0] ||
          actor.rows[0].banned ||
          !can(actor.rows[0].role, { bottle: ["moderate"] })
        ) {
          await client.query("ROLLBACK");
          return { kind: "forbidden" };
        }
        const result = await client.query<Suggestion>(
          `select ${fields} from bottle_suggestion where id=$1 for update`,
          [id],
        );
        const row = result.rows[0];
        if (!row) {
          await client.query("ROLLBACK");
          return { kind: "not_found" };
        }
        const valid = parseBottle(publicInput(row));
        if (
          status === "approved" &&
          (!valid.ok || valid.value.url !== row.url)
        ) {
          await client.query("ROLLBACK");
          return { kind: "invalid" };
        }
        const updated = await client.query<Suggestion>(
          `update bottle_suggestion set status=$2,updated_at=$3 where id=$1 returning ${fields}`,
          [id, status, now],
        );
        await client.query("COMMIT");
        return { kind: "updated", suggestion: updated.rows[0] };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
