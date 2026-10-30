import sharp from "sharp";
import snapshot from "@/content/contributions.json";
import { isSeason, seasonForWeek, weekDate } from "@/lib/bonsai";
import { postcardSvg } from "@/lib/bonsai-postcard";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const week = params.get("week") ?? snapshot.weeks.at(-1)!.week;
  if (!weekDate(week) || !snapshot.weeks.some(w => w.week === week)) return new Response("Week is not in this activity snapshot", { status: 400 });
  const requested = params.get("season");
  if (requested && !isSeason(requested)) return new Response("Invalid season", { status: 400 });
  const season = isSeason(requested) ? requested : seasonForWeek(week);
  const png = await sharp(Buffer.from(postcardSvg(snapshot.weeks, week, season, snapshot.through))).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=0, s-maxage=3600", "X-Content-Type-Options": "nosniff" } });
}
