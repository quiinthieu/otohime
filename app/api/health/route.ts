import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db/client";
import { healthBody } from "@/lib/build-info";

export async function GET() {
  // Opt out of build-time prerendering so each check reaches Postgres.
  await connection();
  await db.execute(sql`select 1`);
  return Response.json(healthBody(process.env.BUILD_SHA));
}
