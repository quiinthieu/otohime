import { ClawMachine } from "@/components/claw-machine";
import { FigTitle, swatches } from "@/components/figures";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="03" hint="rigged in your favour">
          Play
        </FigTitle>
        <p className="mt-2 text-muted">{site.play}</p>
        <div className="mt-8">
          <ClawMachine games={site.games} />
        </div>
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
