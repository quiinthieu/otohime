import { FigTitle } from "@/components/figures";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { BoothStudio } from "./_components/booth-studio";
import "./booth.css";

export const metadata: Metadata = {
  title: "Ink Purikura Photobooth",
  description:
    "Take a 4-frame paper-and-ink photobooth strip in sumi-e wash, riso two-tone halftone, or newsprint dot screen, decorate with purikura ink pen and stickers, and export or print locally.",
};

export default function BoothPage() {
  const buildDate = process.env.BUILD_DATE ?? "2026-10-28";

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <div className="booth-no-print">
          <FigTitle n="03c" hint="4-frame ink photobooth · sumi-e, riso & newsprint">
            Ink Purikura Photobooth
          </FigTitle>
          <p className="mt-2 max-w-prose text-muted">
            Step into a paper photo-booth: open your webcam locally in this tab or use the procedural paper portrait,
            choose a film stock (<em>sumi-e</em> ink wash, <em>riso</em> two-colour halftone, or <em>newsprint</em>{" "}
            45° dot screen), count down 3-2-1 for four shutter clacks, then doodle with the purikura pen and stickers
            before downloading a PNG or printing a 5×15cm strip.
          </p>
        </div>

        <BoothStudio initialDate={buildDate} />

        <p className="mt-8 booth-no-print">
          <Link href="/play" className="link" data-testid="booth-back-to-play">
            Back to Play
          </Link>
        </p>
      </div>
    </ViewTransition>
  );
}
