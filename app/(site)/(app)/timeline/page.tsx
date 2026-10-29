import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { TimelineBook } from "@/components/timeline-book";
import { careerArchive } from "@/lib/timeline";
import { site } from "@/content/site";
import "./timeline.css";

export const metadata: Metadata = { title: "Pop-up Book Timeline", description: "Nine paper spreads, 2018–2026. A public archive in folds, tabs and ink." };
export default function TimelinePage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <FigTitle n="02c" hint="nine years, one little book">Pop-up Book Timeline</FigTitle>
    <p className="mt-3 max-w-prose text-muted">2018–2026, kept between paper covers. Turn a year, pull a tab, spin the wheel. This career story is an invented draft, awaiting the owner’s corrections. Linked public projects are real.</p>
    <TimelineBook years={careerArchive(site.projectList, site.stack)} />
    <p className="mt-8"><Link href="/work" className="link">Back to Work</Link> · <Link href="/ledger/sql" className="link">Open the SQL ledger</Link></p>
  </div></ViewTransition>;
}
