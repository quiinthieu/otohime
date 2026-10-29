import { FigTitle } from "@/components/figures";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import MouldLoader from "./_components/mould-loader";
import "./mould.css";

export const metadata: Metadata = {
  title: "Ink Slime Mould",
  description: "A sumi-ink physarum. Project and pipeline nodes are the food, and the veins trace them.",
  twitter: { card: "summary_large_image" },
};

export default function MouldPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise mould-page">
        <FigTitle n="16" hint="physarum · sumi on washi">Ink Slime Mould</FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          A dish of agents, after Jeff Jones. Each one sniffs the ink ahead, turns toward the stronger trail, and
          leaves a little more. Food is a project or a pipe. The vein between them thickens with commits, or with an
          illustrative throughput when the pipe has no count of its own.
        </p>
        <MouldLoader />
        <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/work" className="link">Work</Link>
          <Link href="/projects" className="link">Projects</Link>
          <Link href="/play" className="link">Back to Play</Link>
        </p>
      </div>
    </ViewTransition>
  );
}
