import { connection } from "next/server";
import { configResponse } from "../../../ghosts/config.ts";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const response = configResponse(process.env.GHOSTS_ENDPOINT, url.origin);
  // The optional browser layer needs an off result without a failed subresource.
  // Keep the original endpoint's disabled 404 for direct/configuration callers.
  return url.searchParams.get("probe") === "1" && response.status === 404
    ? Response.json(null, { headers: response.headers })
    : response;
}
