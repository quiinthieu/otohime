import { useId } from "react";
import { appSealChoice, STATUS_META, type AppManifest, type AppStatus } from "@/lib/apps";
import { SEAL_FONT, SEAL_RED, sealModel } from "@/lib/hanko";

export function HankoStatus({
  status,
  seal,
  size = "md",
  className = "",
}: {
  status: AppStatus;
  seal?: AppManifest["seal"];
  size?: "sm" | "md";
  className?: string;
}) {
  const maskId = `hanko-${useId().replace(/[^\w-]/g, "")}`;
  const meta = STATUS_META[status];
  const model = sealModel(appSealChoice({ status, seal }));

  return (
    <span
      className={`app-hanko ${size === "sm" ? "app-hanko-sm" : "app-hanko-md"} ${className}`.trim()}
      data-hanko-status={status}
    >
      <span className="app-hanko-chip" aria-hidden="true">
        <svg viewBox="0 0 200 200" aria-hidden="true" className="app-hanko-svg">
          <defs>
            <mask id={maskId}>
              <rect width="200" height="200" fill="white" />
              <g fill="black">
                {model.chips.map((chip, index) => (
                  <circle key={index} cx={chip.x} cy={chip.y} r={chip.r} />
                ))}
                {model.glyphs.map((glyph, index) => (
                  <text
                    key={index}
                    x={glyph.x}
                    y={glyph.y}
                    fontFamily={SEAL_FONT}
                    fontWeight="700"
                    fontSize={glyph.size}
                    textAnchor="middle"
                  >
                    {glyph.text}
                  </text>
                ))}
              </g>
            </mask>
          </defs>
          <path d={model.edge} fill={SEAL_RED} mask={`url(#${maskId})`} />
        </svg>
      </span>
      <span className="app-hanko-label">{meta.label}</span>
    </span>
  );
}
