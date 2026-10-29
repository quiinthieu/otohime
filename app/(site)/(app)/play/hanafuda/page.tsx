import { FigTitle } from "@/components/figures";
import rawYearlyLog from "@/content/yearly-log.json";
import { readYearlyLog } from "@/lib/yearly-log";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { HanafudaBoard } from "./_components/hanafuda-board";
import "./hanafuda.css";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Hanafuda+Koi-Koi&path=%2Fplay%2Fhanafuda", width: 1200, height: 630, alt: "Hanafuda Koi-Koi, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "Hanafuda Koi-Koi",
  description:
    "Play a 48-card ink-and-washi Hanafuda Koi-Koi match against the CPU and flip monthly card backs to inspect the yearly shipped log.",
};

export default function HanafudaPage() {
  const yearlyLog = readYearlyLog(rawYearlyLog);

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="03b" hint="48 flower cards · ink & washi">
          Hanafuda Koi-Koi
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          A 48-card traditional Hanafuda deck across the 12 monthly flower suits. Match cards by month against a
          greedy CPU opponent, stamp yaku in red hanko ink, call <em>Koi-koi?</em> or <em>Shobu</em>, and flip any
          month’s card back to read what shipped on otohime.dev that month.
        </p>

        <HanafudaBoard yearlyLog={yearlyLog} />

        <p className="mt-8">
          <Link href="/play" className="link">
            Back to Play
          </Link>
        </p>
      </div>
    </ViewTransition>
  );
}
