import { stamp } from "@/lib/og";
import type { NextRequest } from "next/server";

// A common image endpoint keeps the independent sketch projects isolated: their metadata passes just
// the title and path. /og without a query remains the home/unknown-page card. Bound untrusted text
// before Satori lays it out; neither parameter is a URL to fetch or a file to read.
export function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  const path = request.nextUrl.searchParams.get("path")?.trim();
  return stamp(
    title && title.length <= 160 ? title : "Otohime",
    path && path.startsWith("/") && path.length <= 200 ? path : "Data engineer. Plays games.",
  );
}
