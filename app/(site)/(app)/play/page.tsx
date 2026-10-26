import { ClawMachine } from "@/components/claw-machine";
import { swatches } from "@/components/figures";
import { InkPressLoader } from "@/components/ink-press-loader";
import { PondLoader } from "@/components/pond-loader";
import { PondStatic } from "@/components/pond-static";
import { StampHeading } from "@/components/stamp-heading";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { ViewTransition } from "react";
import "../../pond.css";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <StampHeading n="03" morph="/play" hint="rigged in your favour">
          Play
        </StampHeading>
        <p className="mt-2 text-muted">{site.play}</p>
        <div className="mt-8">
          <ClawMachine games={site.games} />
        </div>
        <section className="mt-12" aria-labelledby="pond-heading">
          <h2 id="pond-heading" className="caption">
            Suminagashi pond
          </h2>
          <p className="mt-2 mb-4 text-muted">Float ink on still water, then comb and blow it into rings.</p>
          <PondLoader>
            <PondStatic />
          </PondLoader>
        </section>
        <section className="mt-12" aria-labelledby="press-heading">
          <h2 id="press-heading" className="caption">
            Ink poster press <span className="text-muted">(experimental)</span>
          </h2>
          <p className="mt-2 mb-4 text-muted">Type a word or a short phrase and pull a poster in wet ink: stamp, riso or brush. Shuffle for another print.</p>
          <InkPressLoader />
        </section>
        <h2 className="caption mt-12">In rotation</h2>
        <ul className="mt-3 grid gap-x-10 sm:grid-cols-2">
          {site.games.map((game) => (
            <li key={game.title} className="flex items-start gap-3 border-t border-line py-3">
              <span
                aria-hidden="true"
                className="mt-1 size-3 flex-none rounded-full border border-on-swatch"
                style={{ background: swatches[game.colour] }}
              />
              <span>
                <span className="block font-semibold">{game.title}</span>
                <span className="text-muted">{game.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ViewTransition>
  );
}
