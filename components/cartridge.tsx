import { swatches } from "@/components/figures";
import type { Project } from "@/content/site";
import type { CSSProperties } from "react";

// A project on the shelf as a game cartridge: grip ridges, a clipped corner,
// a swatch label, the edge connector, a status stamp and a hard shadow. The
// shell is one unfiltered SVG that stretches with its card (lengths are
// percentages; the corner, connector and stamp sit in nested viewports pinned
// to an edge), so the label text stays HTML and wraps freely. Server-rendered:
// the lift and the insert are CSS (globals.css, "Project cartridges").
export function Cartridge({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <div
      className="cartridge"
      data-status={project.status}
      style={{ "--fig": swatches[project.colour] } as CSSProperties}
    >
      <CartridgeShell status={project.status} />
      <div className="cartridge-label">{children}</div>
    </div>
  );
}

function CartridgeShell({ status }: { status: Project["status"] }) {
  return (
    <svg className="cartridge-shell" aria-hidden="true" focusable="false" overflow="visible">
      <rect className="cartridge-shadow" x="5" y="5" width="100%" height="100%" rx="7" />
      <rect className="cartridge-body" width="100%" height="100%" rx="7" />
      <g className="cartridge-ridges">
        <line x1="12" x2="30%" y1="8" y2="8" />
        <line x1="12" x2="30%" y1="12" y2="12" />
        <line x1="12" x2="30%" y1="16" y2="16" />
      </g>
      {/* The clipped corner, top right: paper over the shell, then its edge. */}
      <svg x="100%" overflow="visible">
        <path className="cartridge-cut" d="M -16 -2 L 2 -2 L 2 16 Z" />
        <path className="cartridge-edge" d="M -16 0 L 0 16" />
      </svg>
      {/* The edge connector, bottom centre. */}
      <svg x="50%" y="100%" overflow="visible">
        <rect className="cartridge-notch" x="-22" y="-7" width="44" height="7" rx="1.5" />
        <path className="cartridge-pins" d="M -16 -5 V -1 M -10 -5 V -1 M -4 -5 V -1 M 2 -5 V -1 M 8 -5 V -1 M 14 -5 V -1" />
      </svg>
      {/* The status stamp, bottom right. */}
      <svg x="100%" y="100%" overflow="visible">
        <g className="cartridge-stamp" transform="translate(-20 -20) rotate(-14)">
          <circle r="10" />
          <circle r="7" className="cartridge-stamp-inner" />
          {status === "live" ? (
            <path d="M -3.5 0 L -1 2.8 L 3.8 -2.6" />
          ) : status === "building" ? (
            <path d="M -3.5 0 H 3.5" />
          ) : (
            <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" />
          )}
        </g>
      </svg>
    </svg>
  );
}
