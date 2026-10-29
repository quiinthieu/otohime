import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { dailyBlotKey, dailyBlotSeed, generateSeededDrops, mirrorDropsForFold } from "@/lib/inkblot";

export const alt = "Ink Blot Test — a symmetric sumi blot on warm paper, otohime.dev";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  await connection();
  const key = dailyBlotKey();
  const marks = mirrorDropsForFold(generateSeededDrops(dailyBlotSeed(key.slice(6))))
    .flatMap((drop) => [drop, ...drop.satellites]);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f3eddf", color: "#292720", padding: 64, alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 22 }}>OTOHIME.DEV / PLAY / FIG. 03d</div>
        <div style={{ display: "flex", fontSize: 72 }}>Ink Blot Test</div>
        <div style={{ display: "flex", fontSize: 28 }}>Fold the sheet. Say what you see.</div>
        <div style={{ display: "flex", fontSize: 20, color: "#a33e29" }}>{`DAILY PLATE · ${key.slice(6)}`}</div>
      </div>
      <svg width="420" height="420" viewBox="0 0 100 100">
        <rect x="0" y="0" width="100" height="100" fill="#faf8f3" stroke="#ddd6c8" />
        <path d="M50 4 V96" stroke="#ddd6c8" fill="none" />
        {marks.map((mark, i) => (
          <circle key={i} cx={mark.x * 100} cy={mark.y * 100} r={Math.max(0.5, mark.r * 100)} fill="#231e16" />
        ))}
      </svg>
    </div>,
    size,
  );
}
