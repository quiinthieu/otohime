import type { Pool } from "pg";
import { encodeCursor, type Cursor, type PublicEntry, type Stroke } from "./guestbook.ts";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReviewEntry = PublicEntry & { status: ReviewStatus };

export async function listReviewEntries(pool: Pool, status: ReviewStatus, cursor: Cursor | null) {
  const result = await pool.query<{
    id: string; name: string; note: string; strokes: Stroke[]; duration_ms: number;
    tilt: number; tape: number; created_at: string; status: ReviewStatus;
  }>(`select id,name,note,strokes,duration_ms,tilt,tape,status,
    to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at
    from guestbook_entry where status=$1 and
    ($2::timestamptz is null or (created_at,id) < ($2::timestamptz,$3::text))
    order by created_at desc,id desc limit 25`, [status, cursor?.createdAt ?? null, cursor?.id ?? null]);
  const entries: ReviewEntry[] = result.rows.slice(0, 24).map((row) => ({
    id: row.id, name: row.name, note: row.note, strokes: row.strokes, durationMs: row.duration_ms,
    v: 1, tilt: row.tilt, tape: row.tape, createdAt: row.created_at, status: row.status,
  }));
  const last = entries.at(-1);
  return { entries, nextCursor: result.rows.length > 24 && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
}

export async function reviewEntry(pool: Pool, id: string, status: ReviewStatus | "deleted") {
  const result = status === "deleted"
    ? await pool.query("delete from guestbook_entry where id=$1", [id])
    : await pool.query("update guestbook_entry set status=$2 where id=$1", [id, status]);
  return (result.rowCount ?? 0) > 0;
}
