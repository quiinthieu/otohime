import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { site } from "@/content/site";
import { buildSky } from "../_lib/sky";
import { PaperSky } from "./paper-sky";

export const metadata: Metadata = {
  title: "Paper Star Chart",
  description: "Notes drawn as ink stars. Follow a constellation of shared ideas.",
};

export default function SkyPage() {
  const chart = buildSky(site.notes, process.env.BUILD_DATE!);
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <Link href="/notes" className="caption underline underline-offset-4">← Notes as a list</Link>
        <FigTitle n="04" hint="an atlas of small thoughts">Paper Star Chart</FigTitle>
        <p className="mt-3 max-w-prose text-muted">A small sky, charted in ink. Each star is a note; shared tags thread them into constellations.</p>
        <PaperSky chart={chart} />
      </div>
    </ViewTransition>
  );
}
