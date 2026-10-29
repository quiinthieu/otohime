import { FigTitle } from "@/components/figures";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import StrataLoader from "../../strata/_components/strata-loader";
import "../../strata/strata.css";

export const metadata: Metadata = {
  title: "Paper Strata",
  description: "A cut-paper year you can scrub. The sheets are commits and notes.",
};

export default function PlayStrataPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="15" hint="a toy on the same desk">Paper Strata</FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          The same cut-paper year as the strata sheet. Hover a week, walk it with the arrow keys, and scrub back
          through the archive.
        </p>
        <StrataLoader />
        <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/strata" className="link">Paper Strata</Link>
          <Link href="/ledger" className="link">Stamp ledger</Link>
          <Link href="/work" className="link">Work</Link>
          <Link href="/play" className="link">Back to Play</Link>
        </p>
      </div>
    </ViewTransition>
  );
}
