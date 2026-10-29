import { FigTitle } from "@/components/figures";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { PachinkoMachine } from "./_components/pachinko-machine";
import "./pachinko.css";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Pipeline+Pachinko&path=%2Fplay%2Fpachinko", width: 1200, height: 630, alt: "Pipeline Pachinko, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "Pipeline Pachinko",
  description:
    "Launch ink-ball records with a spring plunger or backfill flood through a 5-stage data-engineering pachinko machine: ingest peg field, dedupe gate, join funnel, six-way partition splitter, and dead-letter queue gutter.",
};

export default function PachinkoPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="03d" hint="5-stage data pipeline · ink & washi verlet">
          Pipeline Pachinko
        </FigTitle>
        <p className="mt-2 text-muted">
          Pull the right-hand spring plunger—or trigger a backfill flood—to launch ink-ball records across a vertical
          washi board. Records bounce through the ingest peg field, filter past a deduplication gate that stamps
          duplicates <span className="font-mono">DUP</span>, pair inside a join funnel, hash-route into six partition
          buckets (<span className="font-mono">p0–p5</span>), or spill down the dead-letter queue gutter. Three
          consecutive <span className="font-mono">DLQ</span> spills page the on-call engineer.
        </p>
        <div className="mt-6">
          <PachinkoMachine />
        </div>
        <p className="mt-8 text-muted">
          <Link href="/play" className="link" data-testid="pachinko-back-to-play">
            Back to Play
          </Link>
        </p>
      </div>
    </ViewTransition>
  );
}
