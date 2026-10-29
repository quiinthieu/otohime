import { postcardImage } from "@/lib/og";
import { decodePostcard, sketchById } from "@/lib/postcard";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NextRequest } from "next/server";

// The postcard as a 1200x630 PNG: the view's Open Graph image and the picker's download. The code is the
// whole postcard (lib/postcard.ts), so the same link always draws the same card and may be cached for a day.
export async function GET(request: NextRequest) {
  const postcard = decodePostcard(request.nextUrl.searchParams.get("c"));
  if (!postcard) {
    return new Response("Not a postcard", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  }
  const sketch = sketchById(postcard.sketch)!;
  return postcardImage(
    { postcard, sketch, image: await sketchImage(sketch.src, request.nextUrl.origin) },
    { "Cache-Control": "public, max-age=86400", "X-Robots-Tag": "noindex" },
  );
}

// The sheet as a data URL from public/ when the server has it on disk (next start), otherwise its address on
// this site for Satori to fetch. src comes from the allow-list, never from the request.
async function sketchImage(src: string, origin: string): Promise<string> {
  try {
    const filename = src.replace(/^\/sketches\//, "");
    const bytes = await readFile(join(process.cwd(), "public", "sketches", filename));
    return `data:image/jpeg;base64,${bytes.toString("base64")}`;
  } catch {
    return new URL(src, origin).toString();
  }
}
