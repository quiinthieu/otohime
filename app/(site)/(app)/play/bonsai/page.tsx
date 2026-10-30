import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { Bonsai } from "@/components/bonsai/bonsai";
import snapshot from "@/content/contributions.json";
import { isSeason, seasonForWeek } from "@/lib/bonsai";
type Props = { searchParams: Promise<{ week?: string; season?: string }> };
function selection(params: { week?: string; season?: string }) {
  const week = snapshot.weeks.find(w => w.week === params.week)?.week ?? snapshot.weeks.at(-1)!.week;
  return { week, season: isSeason(params.season) ? params.season : seasonForWeek(week) };
}
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { week, season } = selection(await searchParams);
  return { title: `Ink Bonsai · ${week}`, description: "A little tree grown from a year of public activity. Prune a twig, watch the seasons turn, and send a paper postcard.", openGraph: { images: [`/og/bonsai?week=${week}&season=${season}`] }, twitter: { card: "summary_large_image", images: [`/og/bonsai?week=${week}&season=${season}`] } };
}
async function Garden({ searchParams }: Props) {
  const params = await searchParams;
  const { week, season } = selection(params);
  return <>
    {params.week && params.week !== week && <p role="alert" className="mt-4">That week is not in this activity snapshot. Showing {week}.</p>}
    <form className="bonsai-week mt-6" action="/play/bonsai"><label>Tree of the week <select name="week" defaultValue={week}>{[...snapshot.weeks].reverse().map(w => <option key={w.week} value={w.week}>{w.week} · {w.count} contributions</option>)}</select></label> <button className="btn" type="submit">Grow this week</button></form>
    <Bonsai key={week} weeks={snapshot.weeks} week={week} initialSeason={season} pinnedSeason={isSeason(params.season)} through={snapshot.through}/>
    <p className="text-muted mt-6">Grown from <a className="link" href={snapshot.source}>quiinthieu’s public GitHub contributions</a>. Snapshot through <time>{snapshot.through}</time>, fetched at build time. Quiet weeks leave bare twigs. This week may be incomplete; the tree stays fixed until the next snapshot.</p>
  </>;
}
export default function BonsaiPage(props: Props) {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise"><FigTitle n="03f" hint="盆栽 · small growth, held in ink">Ink Bonsai</FigTitle><p className="mt-2 text-muted">A year of making, one twig at a time. Some weeks bloom. Some simply rest.</p><Suspense fallback={<p className="mt-6">Unfolding the garden…</p>}><Garden {...props}/></Suspense><p className="mt-8"><Link className="link" href="/play">Back to Play</Link></p></div></ViewTransition>;
}
