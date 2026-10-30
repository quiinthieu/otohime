import { ImageResponse } from "next/og";

export const alt = "Ink Slime Mould — sumi veins between project nodes on washi, otohime.dev";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const nodes = [
  [180, 250],
  [420, 180],
  [680, 230],
  [920, 170],
  [300, 420],
  [560, 460],
  [840, 400],
];

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f6f1e6", color: "#171614" }}>
      <div style={{ display: "flex", flexDirection: "column", padding: 56, width: 420 }}>
        <div style={{ fontSize: 22, letterSpacing: 2 }}>OTOHIME.DEV / PLAY / FIG. 16</div>
        <div style={{ fontSize: 64, marginTop: 18 }}>Ink Slime Mould</div>
        <div style={{ fontSize: 26, marginTop: 16 }}>Veins follow the food.</div>
      </div>
      <svg width="720" height="630" viewBox="0 0 1100 630">
        <path d="M180 250 C300 200 360 190 420 180 C520 220 600 210 680 230 C780 180 860 160 920 170 M420 180 C380 300 340 360 300 420 C400 430 480 450 560 460 C680 440 760 420 840 400 C900 320 930 240 920 170 M680 230 C640 330 600 400 560 460" stroke="#171614" strokeWidth="8" fill="none" strokeLinecap="round" />
        {nodes.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="16" fill="#f6f1e6" stroke="#171614" strokeWidth="4" />
        ))}
      </svg>
    </div>,
    size,
  );
}
