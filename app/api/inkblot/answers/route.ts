import { Pool } from "pg";
import { connection } from "next/server";
import { inkblotGet, inkblotPost } from "@/lib/inkblot-http";
import { createInkblotStore } from "@/lib/inkblot-store";

let pool: Pool | undefined;
function deps() {
  const env = { DATABASE_URL: process.env.DATABASE_URL, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET, BETTER_AUTH_URL: process.env.BETTER_AUTH_URL };
  // Construct lazily only with a configured URL; missing configuration fails closed.
  const store = env.DATABASE_URL ? createInkblotStore(pool ??= new Pool({ connectionString: env.DATABASE_URL })) : undefined;
  return { env, store, log: (reason: string, requestId: string) => console.error("inkblot", reason, requestId) };
}
export async function GET(request: Request) { await connection(); return inkblotGet(request, deps()); }
export async function POST(request: Request) { return inkblotPost(request, deps()); }
