import { FigTitle } from "@/components/figures";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import StrataLoader from "./_components/strata-loader";
import "./strata.css";

export const metadata: Metadata = {
  title: "Paper Strata",
  description: "A year of commits and notes, cut into stacked sheets of coloured paper.",
  twitter: { card: "summary_large_image" },
};

export default function StrataPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="15" hint="cut paper · one sheet a contour">Paper Strata</FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          Each week of the year is a column. The busier weeks stand higher, and the year is sliced into six sheets of
          paper with a shadow between them. Move across the stack, or scrub the year, and the sheet rustles.
        </p>
        <StrataLoader />
        <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/ledger" className="link">Stamp ledger</Link>
          <Link href="/work" className="link">Work</Link>
          <Link href="/play" className="link">Play</Link>
          <Link href="/play/strata" className="link">The same stack, as a toy</Link>
        </p>
      </div>
    </ViewTransition>
  );
}
