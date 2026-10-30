import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { HankoPress } from "./press";

export const metadata: Metadata = { title: "Hanko Press", description: "Carve a personal vermilion seal from your name. Press it, keep it, and take the ink home." };

export default function HankoPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <Link href="/play" className="caption underline underline-offset-4">← Back to Play</Link>
    <div className="mt-6"><FigTitle n="朱" hint="a small mark of your own">Hanko Press</FigTitle></div>
    <p className="mt-3 max-w-prose text-muted">A name, carved into vermilion. The same name leaves the same little imperfections, every time.</p>
    <HankoPress />
    <noscript><p>Turn on JavaScript to carve and download a seal. Your name stays on your device.</p></noscript>
  </div></ViewTransition>;
}
