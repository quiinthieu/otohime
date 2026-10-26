import { bottleGet } from "@/lib/bottles-http";
import { bottleDeps } from "@/lib/bottles-server";
import { connection } from "next/server";
export async function GET() {
  await connection();
  return bottleGet(bottleDeps());
}
