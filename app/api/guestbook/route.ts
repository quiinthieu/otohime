import { Pool } from "pg";
import { connection } from "next/server";
import { guestbookGet, guestbookPost } from "@/lib/guestbook-http";
import { createGuestbookStore } from "@/lib/guestbook-store";

let pool: Pool | undefined;
function deps() {
  const env = { DATABASE_URL: process.env.DATABASE_URL, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL };
  // Construct lazily: no build-time database connection and no implicit local Postgres fallback.
  const store = createGuestbookStore(pool ??= new Pool({ connectionString: env.DATABASE_URL || "postgresql://invalid:invalid@127.0.0.1/invalid" }));
  return { env, store, log: (reason: string, requestId: string) => console.error("guestbook", reason, requestId) };
}
export async function GET(request: Request) { await connection(); return guestbookGet(request, deps()); }
export async function POST(request: Request) { return guestbookPost(request, deps()); }
