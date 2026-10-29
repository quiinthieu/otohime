import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { Loom } from "./loom";

export const metadata: Metadata = { title: "Ink Loom", description: "Stamp a rhythm on paper. An eight-voice ink sequencer with shareable loops and printable scores." };
export default function LoomPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <Link href="/play" className="caption underline underline-offset-4">← Back to Play</Link>
    <div className="mt-6"><FigTitle n="織" hint="a rhythm woven in ink">Ink Loom</FigTitle></div>
    <p className="mt-3 max-w-prose text-muted">Stamp a few blots. Let the paper sing. Eight voices, sixteen steps, a little room for happy accidents.</p>
    <Loom />
    <noscript><p>Turn on JavaScript to stamp, share and print a loop. Sound starts off.</p></noscript>
  </div></ViewTransition>;
}
