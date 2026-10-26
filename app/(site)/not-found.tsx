import { RisoText } from "@/components/riso-heading";
import { BrandMark } from "@/components/brand-mark";
import { LostSheet } from "@/components/lost-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { ViewTransition } from "react";

// The lost page, for an unknown address (app/global-not-found.tsx) and for a site page that calls notFound(). The
// sheet is drawn here, on the server: a torn top edge and a crumple filter (feTurbulence into feDisplacementMap).
// components/lost-sheet.tsx rubs it smooth when JavaScript runs and motion is welcome; without it the sheet stays
// crumpled, and under reduced motion the CSS lays it flat. The ways back are plain links below it, always there.
// The brand mark is a way home too; the bar stays out of the wrapper, like every layout's masthead.

const SHEET_ID = "lost-sheet";
const CRUMPLE_SCALE = 14;

// The same jitter on every render: a fixed seed, so the server draws one torn edge.
function jitter(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

// A sheet from (20, 28) to (220, 284) in a 240 x 300 box, its top torn out of a pad in short ragged steps.
function tornSheet(): string {
  const rand = jitter(404);
  const top: string[] = [];
  for (let x = 20; x < 220; x += 6 + rand() * 6) top.push(`${x.toFixed(1)},${(28 + (rand() - 0.5) * 10).toFixed(1)}`);
  top.push(`220,${(28 + (rand() - 0.5) * 10).toFixed(1)}`);
  return `M20,284 L${top.join(" L")} L220,284 Z`;
}

const TORN = tornSheet();
const RULES = Array.from({ length: 9 }, (_, i) => 76 + i * 22);
const CREASES = ["M20,118 L104,146 L220,98", "M78,30 L112,170 L92,284", "M220,212 L150,176 L104,284", "M20,236 L66,196"];
const WAYS = [
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/notes", label: "Notes" },
  { href: "/play", label: "Play" },
] as const;

export default function NotFound() {
  return (
    <>
      <header className="masthead">
        <BrandMark />
        <ThemeToggle />
      </header>
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <main className="grid min-h-[calc(100dvh-4rem)] place-items-center p-6">
          <div className="rise mx-auto grid max-w-md justify-items-center gap-3 py-8 text-center">
            <div id={SHEET_ID} className="lost-sheet">
              <svg viewBox="0 0 240 300" aria-hidden="true" focusable="false">
                <filter id="lost-crumple" x="-10%" y="-10%" width="120%" height="120%">
                  {/* Tagged with their source values, which a print run rescales after hydration (lib/appearance-client.ts). */}
                  <feTurbulence type="fractalNoise" baseFrequency="0.03" data-ap-frequency="0.03" numOctaves="2" seed="4" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale={CRUMPLE_SCALE} data-ap-scale={CRUMPLE_SCALE} xChannelSelector="R" yChannelSelector="G" />
                </filter>
                <g className="lost-page">
                  <g className="lost-crumpled" filter="url(#lost-crumple)">
                    <path className="lost-shade" d={TORN} transform="translate(5 6)" />
                    <path className="lost-torn" d={TORN} />
                    {RULES.map((y) => (
                      <line key={y} className="lost-rule" x1="30" x2="210" y1={y} y2={y} />
                    ))}
                    <line className="lost-margin" x1="52" x2="52" y1="40" y2="278" />
                    <text className="lost-404" x="132" y="170" textAnchor="middle">
                      404
                    </text>
                    {CREASES.map((d) => (
                      <path key={d} className="lost-crease" d={d} />
                    ))}
                  </g>
                </g>
              </svg>
            </div>
            <h1>
              <span aria-hidden="true">Fig. 404 — </span>
              <RisoText>This page got lost</RisoText>
            </h1>
            <p className="text-muted">There&apos;s no page at this address. It was torn out and crumpled up.</p>
            <LostSheet sheet={SHEET_ID} />
            <nav aria-label="Ways back" className="lost-ways">
              <Link href="/" className="btn btn-primary">
                Go home
              </Link>
              {WAYS.map((w) => (
                <Link key={w.href} href={w.href} className="btn">
                  {w.label}
                </Link>
              ))}
            </nav>
          </div>
        </main>
      </ViewTransition>
    </>
  );
}
