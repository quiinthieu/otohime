import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { ShadowTheatre } from "@/components/shadows/theatre";
export const metadata: Metadata = { title: "Hand-Shadow Puppet Theatre", description: "A candle, a paper screen, and four small ink creatures. Play with paper puppets or opt in to private, on-device hand tracking." };
export default function ShadowsPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise"><FigTitle n="03g" hint="影絵 · stories between your fingers">Hand-Shadow Puppet Theatre</FigTitle><p className="mt-2 text-muted">Pull up a chair. A rabbit, a dog, a bird and a deer are waiting in the candlelight.</p><ShadowTheatre/><noscript><p>Camera and dragging need JavaScript. You can still follow the creatures to <Link href="/projects">Projects</Link> and <Link href="/notes">Notes</Link>.</p></noscript><p className="mt-8"><Link className="link" href="/play">Back to Play</Link></p></div></ViewTransition>;
}
