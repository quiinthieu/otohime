import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { PaperHost } from "@/components/paper-host";
import { KintsugiSeams } from "@/components/kintsugi-seams";
import { KintsugiShake } from "@/components/kintsugi-card";
import { KINTSUGI_CARDS } from "@/lib/kintsugi-cards";
import { createKintsugiStore, kintsugiPool } from "@/lib/kintsugi-store";
import type { MendedCard } from "@/lib/kintsugi";
export const metadata: Metadata = { title: "Kintsugi" };

export default function KintsugiPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <FigTitle n="金" hint="broken, then more beautiful">Kintsugi</FigTitle>
    <p className="mt-3 max-w-prose text-muted">Four quick clicks on a card’s paper reveal a fracture. Wait a moment: gold finds the cracks. Every repair leaves a little of its visitor behind.</p>
    <p className="mt-3"><KintsugiShake /></p>
    <PaperHost className="kintsugi-demo mt-8" data-paper-id="demo:golden-paper"><h2>A little golden paper</h2><p className="text-muted mt-2">Try here, or find the small 金 button on cards in <Link className="link" href="/projects">Projects</Link>, <Link className="link" href="/notes">Notes</Link> and <Link className="link" href="/work">Work</Link>. Sound follows the site’s sound switch.</p></PaperHost>
    <h2 className="mt-10">The most-mended papers</h2>
    <Suspense fallback={<p className="mt-3 text-muted">Unrolling the shared golden webs…</p>}><GoldenWebs /></Suspense>
  </div></ViewTransition>;
}
async function GoldenWebs() {
  await connection();
  let cards: MendedCard[] | null = null;
  try {
    cards = await createKintsugiStore(kintsugiPool()).list();
  } catch { /* The local experiment remains available during a storage outage. */ }
  if (!cards) return <p className="mt-3 text-muted">The shared papers are resting. You can still mend a card and keep its seams on this device.</p>;
  const known = cards.filter(c => KINTSUGI_CARDS.some(k => k.id === c.id));
  if (!known.length) return <p className="mt-3 text-muted">No shared repairs yet. Mend the paper above to leave the first seam.</p>;
  return <ol className="kintsugi-gallery">{known.map(card => {
    const info = KINTSUGI_CARDS.find(k => k.id === card.id)!;
    return <li key={card.id}><article><KintsugiSeams seams={card.seams} /><div><h3><Link className="link" href={info.href}>{info.label}</Link></h3><p className="caption mt-4">{card.count} {card.count === 1 ? "repair" : "repairs"} · shared gold</p></div></article></li>;
  })}</ol>;
}
