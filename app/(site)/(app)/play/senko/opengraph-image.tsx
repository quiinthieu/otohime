import { ImageResponse } from "next/og";

export const alt = "Senko Hanabi — four fleeting ink flowers on warm paper, otohime.dev";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f3eddf", color: "#292720", padding: 64, alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 22 }}>OTOHIME.DEV / PLAY / FIG. 03e</div>
        <div style={{ fontSize: 78 }}>Senko Hanabi</div>
        <div style={{ fontSize: 28 }}>A small summer, held still.</div>
        <div style={{ fontSize: 20, color: "#a33e29" }}>PEONY · PINE · WILLOW · CHRYSANTHEMUM</div>
      </div>
      <svg width="300" height="480" viewBox="0 0 300 480">
        <path d="M146 25 Q153 130 150 260" stroke="#292720" strokeWidth="4" fill="none" />
        <path d="M150 260 Q80 240 46 290 M150 260 Q208 215 252 249 M150 260 Q125 340 65 362 M150 260 Q195 315 244 370 M150 260 L155 390 M102 284 L74 270 M204 308 L234 302 M122 322 L95 330" stroke="#a33e29" strokeWidth="3" fill="none" />
        <circle cx="150" cy="260" r="13" fill="#b74729" />
        <circle cx="148" cy="257" r="5" fill="#efbe65" />
        <circle cx="46" cy="290" r="3" fill="#292720" />
        <circle cx="244" cy="370" r="3" fill="#292720" />
      </svg>
    </div>, size,
  );
}
