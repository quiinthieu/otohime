import { RisoText } from "@/components/riso-heading";
import { ClawMachine } from "@/components/claw-machine";
import { swatches } from "@/components/figures";
import { InkPressLoader } from "@/components/ink-press-loader";
import { PondLoader } from "@/components/pond-loader";
import { PondStatic } from "@/components/pond-static";
import { PeepBoxLoader } from "@/components/peep-box/loader";
import { PeepBoxScene } from "@/components/peep-box/scene";
import { StampHeading } from "@/components/stamp-heading";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { ViewTransition } from "react";
import "../../pond.css";
import "@/components/peep-box/peep-box.css";

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
          <h2 id="pond-heading" className="caption"><RisoText>Suminagashi pond</RisoText></h2>
          <p className="mt-2 mb-4 text-muted">Float ink on still water, then comb and blow it into rings.</p>
          <PondLoader>
            <PondStatic />
          </PondLoader>
        </section>
        <section className="mt-12" aria-labelledby="press-heading">
          <h2 id="press-heading" className="caption">
            <RisoText>Ink poster press</RisoText>{" "}<span className="text-muted"><RisoText>(experimental)</RisoText></span>
          </h2>
          <p className="mt-2 mb-4 text-muted">Type a word or a short phrase and pull a poster in wet ink: stamp, riso or brush. Shuffle for another print.</p>
          <InkPressLoader />
        </section>
        <section className="peep-box" aria-labelledby="peep-heading">
          <h2 id="peep-heading" className="caption"><RisoText>Ryugu-jo peep-box</RisoText></h2>
          <p className="mt-2 mb-4 text-muted">Peek through a paper window into the sea princess’s palace. Move your pointer, use the direction buttons, or choose tilt.</p>
          <PeepBoxLoader><PeepBoxScene /></PeepBoxLoader>
        </section>
        <h2 className="caption mt-12"><RisoText>In rotation</RisoText></h2>
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
