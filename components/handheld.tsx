"use client";

import { box } from "@/components/figures";
import { Chip, Machine, useTick } from "@/components/machine";
import { useRouter } from "next/navigation";
import { useReducer } from "react";

// A pocket console standing up, its screen a menu of the site. W is its
// thickness, D the front's width.
const O: [number, number] = [176, 232];
const W = 24;
const D = 112;
const H = 176;
const body = box(O, W, D, H, [0, 0, 0], 60);
const cartridge = box(O, 12, 76, 14, [2, 18, H]);
const MENU = [
  { label: "WORK", href: "/work" },
  { label: "PLAY", href: "/play" },
  { label: "NOTES", href: "/notes" },
];

type Button = "up" | "down" | "a";
type Pad = { cursor: number; pressed: Button | null; hold: number };

function pad(s: Pad, action: Button | "tick"): Pad {
  if (action === "tick") return s.hold > 1 ? { ...s, hold: s.hold - 1 } : { ...s, pressed: null, hold: 0 };
  const step = action === "up" ? -1 : action === "down" ? 1 : 0;
  // a button stays down for two frames, so the press shows
  return { cursor: (s.cursor + step + MENU.length) % MENU.length, pressed: action, hold: 2 };
}

export function Handheld() {
  const router = useRouter();
  const [s, dispatch] = useReducer(pad, { cursor: 0, pressed: null, hold: 0 });
  useTick(s.pressed !== null, dispatch);
  const item = MENU[s.cursor];
  const lit = (button: Button) => (s.pressed === button ? "fig-lamp" : "fig-dark");

  function open() {
    dispatch("a");
    // let the press show first, unless motion is reduced
    const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    setTimeout(() => router.push(item.href), wait);
  }

  return (
    <Machine
      label="Pocket console"
      caption="Handheld"
      colour="blue"
      viewBox="0 0 230 310"
      busy={s.pressed !== null}
      readout={`Press A to open ${item.label.toLowerCase()}.`}
      controls={
        <>
          <Chip onClick={() => dispatch("up")}>▲ Up</Chip>
          <Chip onClick={() => dispatch("down")}>▼ Down</Chip>
          <Chip onClick={open}>A Open</Chip>
        </>
      }
    >
      <polygon className="fig-shade" points={body.shadow} />
      <g style={{ "--fig": "#a39e93" } as React.CSSProperties}>
        <polygon className="fig-shaded" points={cartridge.shaded} />
        <polygon className="fig-lit" points={cartridge.lit} />
        <polygon className="fig-top" points={cartridge.top} />
      </g>
      <polygon className="fig-top" points={body.top} />
      <polygon className="fig-shaded" points={body.shaded} />
      <polygon className="fig-lit" points={body.lit} />
      <g transform={body.onShaded}>
        <path d="M8 -120h8M8 -112h8M8 -104h8" fill="none" strokeWidth={1.6} />
      </g>
      <g transform={body.onLit}>
        {/* screen: bezel, power light, the menu */}
        <rect x={10} y={-166} width={92} height={74} rx={4} className="fig-dark" />
        <circle cx={17} cy={-140} r={2.4} className="fig-lamp" />
        <rect x={24} y={-158} width={64} height={56} rx={1.5} className="fig-lcd" />
        {MENU.map(({ label }, i) => (
          <text key={label} x={40} y={-139 + i * 14} className="fig-text lcd">
            {label}
          </text>
        ))}
        <polygon
          points={`29,${-146 + s.cursor * 14} 35,${-142.5 + s.cursor * 14} 29,${-139 + s.cursor * 14}`}
          className="lcd lcd-cursor"
          stroke="none"
        />
        <text x={12} y={-80} className="fig-text" style={{ fontSize: 7 }}>
          POCKET
        </text>
        {/* d-pad: the pressed arm lights up */}
        <rect x={16} y={-57} width={28} height={10} rx={1.5} className="fig-dark" />
        <rect x={25} y={-66} width={10} height={28} rx={1.5} className="fig-dark" />
        <rect x={26.5} y={-64.5} width={7} height={8} className={lit("up")} stroke="none" />
        <rect x={26.5} y={-47.5} width={7} height={8} className={lit("down")} stroke="none" />
        {/* B and A, start and select, the speaker */}
        <circle cx={72} cy={-46} r={7.5} className="fig-dark" />
        <circle cx={90} cy={-58} r={7.5} className={lit("a")} />
        <path d="M40 -18l10 -4M56 -18l10 -4" fill="none" strokeWidth={4} />
        <path d="M80 -6l12 -16M86 -6l12 -16M92 -6l12 -16" fill="none" strokeWidth={2} />
      </g>
    </Machine>
  );
}
