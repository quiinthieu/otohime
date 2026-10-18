"use client";

import { box } from "@/components/figures";
import { Chip, Machine, useTick } from "@/components/machine";
import { newPad, pad, type Button } from "@/lib/machines";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useReducer } from "react";

// A pocket console standing up, its screen a menu of the site. W is its
// thickness, D the front's width.
const O: [number, number] = [176, 232];
const W = 24;
const D = 112;
const H = 176;
const body = box(O, W, D, H, [0, 0, 0], 60);
const cartridge = box(O, 12, 76, 14, [2, 18, H]);
const MENU = [
  { label: "Work", href: "/work" },
  { label: "Play", href: "/play" },
  { label: "Notes", href: "/notes" },
  { label: "Music", href: "/music" },
];
const PITCH = 12; // the menu's line height on the screen
const line = (i: number) => -142 + i * PITCH; // a menu line's baseline

export function Handheld() {
  const router = useRouter();
  const [s, dispatch] = useReducer(pad, MENU.length, newPad);
  useTick(s.pressed !== null, dispatch);
  const item = MENU[s.cursor];
  const lit = (button: Button) => (s.pressed === button ? "fig-lamp" : "fig-dark");

  function open() {
    dispatch("a");
    // let the press show first, unless motion is reduced
    const wait = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
    setTimeout(() => router.push(item.href), wait);
  }

  // The arrow keys and Enter (or A) work the console from anywhere on the
  // page, except in a form field.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    // ponytail: the console has the arrows only at the top of the page;
    // scrolled down at all, they scroll it again
    if (scrollY > 0) return;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      dispatch(event.key === "ArrowUp" ? "up" : "down");
    } else if (event.key === "a" || event.key === "A" || (event.key === "Enter" && !target?.closest("a, button"))) {
      open();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <Machine
      label="Pocket console"
      caption="Handheld"
      colour="blue"
      viewBox="0 0 230 310"
      busy={s.pressed !== null}
      readout={`Press A to open ${item.label.toLowerCase()}.`}
      below={
        // The menu as plain links, for screen readers; they show when tabbed to.
        <nav aria-label="Pages" className="sr-only focus-within:not-sr-only">
          <ul className="flex flex-wrap justify-center gap-2 pb-3">
            {MENU.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} className="btn btn-sm">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      }
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
        {/* The screen boots once the figure has printed: the power light,
            a splash, then the menu (.boot and .splash in globals.css). */}
        <rect x={10} y={-166} width={92} height={74} rx={4} className="fig-dark" />
        <circle cx={17} cy={-140} r={2.4} className="fig-lamp boot" style={{ animationDelay: "0.7s" }} />
        <rect x={24} y={-158} width={64} height={56} rx={1.5} className="fig-lcd boot" style={{ animationDelay: "0.8s" }} />
        <text x={56} y={-127} textAnchor="middle" className="fig-text lcd splash">
          OTOHIME
        </text>
        <g className="boot" style={{ animationDelay: "1.6s" }}>
          {MENU.map(({ label }, i) => (
            <text key={label} x={40} y={line(i)} className="fig-text lcd">
              {label.toUpperCase()}
            </text>
          ))}
          <polygon
            points={`29,${line(s.cursor) - 7} 35,${line(s.cursor) - 3.5} 29,${line(s.cursor)}`}
            className="lcd lcd-cursor"
            stroke="none"
          />
        </g>
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
