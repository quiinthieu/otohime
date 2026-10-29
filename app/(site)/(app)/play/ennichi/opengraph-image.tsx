import { ImageResponse } from "next/og";

export const alt = "Ennichi Night — a four-colour festival print on warm paper, otohime.dev";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#f4efe4", color: "#292723", padding: 64, alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ fontSize: 22 }}>OTOHIME.DEV / PLAY / FIG. 03f</div>
        <div style={{ fontSize: 76 }}>Ennichi Night</div>
        <div style={{ fontSize: 28 }}>Seven keepsakes, one stamp.</div>
        <div style={{ fontSize: 20, color: "#9a3412" }}>CYAN · MAGENTA · YELLOW · KEY</div>
      </div>
      <svg width="340" height="460" viewBox="0 0 340 460">
        <path d="M70 78 H270 M48 108 H292 M92 108 V300 M248 108 V300 M78 168 H262" stroke="#9a3412" strokeWidth="10" fill="none" />
        <path d="M92 108 V300 M248 108 V300 M78 168 H262" stroke="#237f92" strokeWidth="3" fill="none" transform="translate(-3 2)" />
        <rect x="118" y="188" width="36" height="52" rx="16" fill="#ba435e" />
        <rect x="168" y="176" width="36" height="58" rx="16" fill="#d9ac3d" />
        <rect x="214" y="194" width="32" height="46" rx="14" fill="#ba435e" />
        <circle cx="170" cy="360" r="54" fill="none" stroke="#9a3412" strokeWidth="6" />
        <circle cx="170" cy="360" r="44" fill="none" stroke="#9a3412" strokeWidth="2" />
      </svg>
    </div>,
    size,
  );
}
