import { connection } from "next/server";
import { configResponse } from "../../../ghosts/config.ts";

export async function GET(request: Request) {
  await connection();
  return configResponse(process.env.GHOSTS_ENDPOINT, new URL(request.url).origin);
}
