import { connection } from "next/server";
import { readNowPlaying } from "@/lib/now-playing";
import { sanitize } from "@/lib/now-playing-data";

// What Music's cassette says, as JSON: the same cached reading the page prints (lib/now-playing.ts), read on
// demand. Only the display labels and each provider's state, always a 200, quiet or not. A read, never a purge.
export async function GET() {
  // Per request, never at build: the reading must not be baked into the build.
  await connection();
  const reading = sanitize(await readNowPlaying());
  return Response.json(reading, { headers: { "cache-control": "no-store" } });
}
