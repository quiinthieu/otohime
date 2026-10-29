import { ImageResponse } from "next/og";

export const alt = "Paper Strata — a year cut into stacked sheets of coloured paper, otohime.dev";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const sheets = [
    { color: "#e4d5b8", d: "M40 430 L80 360 L160 390 L240 280 L340 340 L460 210 L560 300 L680 160 L820 250 L980 180 L1160 260 L1160 520 L40 520 Z" },
    { color: "#7f97b8", d: "M40 460 L120 400 L220 430 L320 340 L440 390 L560 300 L700 360 L840 280 L1000 340 L1160 300 L1160 540 L40 540 Z" },
    { color: "#c4492c", d: "M40 500 L180 450 L300 480 L420 410 L560 460 L720 400 L900 450 L1160 410 L1160 560 L40 560 Z" },
  ];
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f3eddf", color: "#231e16", padding: 56, flexDirection: "column" }}>
      <div style={{ fontSize: 22, letterSpacing: 2 }}>OTOHIME.DEV / FIG. 15</div>
      <div style={{ fontSize: 72, marginTop: 12 }}>Paper Strata</div>
      <div style={{ display: "flex", marginTop: 24 }}>
        <svg width="1080" height="360" viewBox="0 0 1200 600">
          {sheets.map((sheet) => (
            <path key={sheet.color} d={sheet.d} fill={sheet.color} stroke="#231e16" strokeWidth="3" />
          ))}
        </svg>
      </div>
    </div>,
    size,
  );
}
