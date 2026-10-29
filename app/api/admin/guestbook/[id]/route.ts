import { Pool } from "pg";
import { getSession } from "@/lib/dal";
import { can } from "@/lib/permissions";
import { reviewEntry } from "@/lib/guestbook-review";

let pool: Pool | undefined;
const reply = (body: unknown, status: number) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function PATCH(request: Request, context: RouteContext<"/api/admin/guestbook/[id]">) {
  const session = await getSession();
  if (!session) return reply({ reason: "unauthenticated" }, 401);
  if (!can(session.user.role, { guestbook: ["moderate"] })) return reply({ reason: "forbidden" }, 403);
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ reason: "origin" }, 403);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return reply({ reason: "media_type" }, 415);
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)) return reply({ reason: "id" }, 400);
  if (Number(request.headers.get("content-length") ?? 0) > 100) return reply({ reason: "size" }, 413);
  let value: unknown;
  try {
    const reader = request.body?.getReader();
    let text = "";
    if (reader) while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += new TextDecoder().decode(chunk.value);
      if (text.length > 100) { await reader.cancel(); return reply({ reason: "size" }, 413); }
    }
    value = JSON.parse(text);
  } catch { return reply({ reason: "json" }, 400); }
  const status = typeof value === "object" && value !== null && "status" in value ? value.status : undefined;
  if (status !== "approved" && status !== "rejected" && status !== "deleted") return reply({ reason: "status" }, 400);
  if (!process.env.DATABASE_URL) return reply({ reason: "unavailable" }, 503);
  try {
    const updated = await reviewEntry(pool ??= new Pool({ connectionString: process.env.DATABASE_URL }), id, status);
    return updated ? reply({ id, status }, 200) : reply({ reason: "not_found" }, 404);
  } catch { return reply({ reason: "unavailable" }, 503); }
}
