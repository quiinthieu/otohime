import { RisoText } from "@/components/riso-heading";
import { ClawMachine } from "@/components/claw-machine";
import { swatches } from "@/components/figures";
import { InkPressLoader } from "@/components/ink-press-loader";
import { PondLoader } from "@/components/pond-loader";
import { PondStatic } from "@/components/pond-static";
import { PeepBoxLoader } from "@/components/peep-box/loader";
import { PeepBoxScene } from "@/components/peep-box/scene";
import { StampHeading } from "@/components/stamp-heading";
import { BrushHeading } from "@/components/brush-heading";
import { site } from "@/content/site";
import type { Metadata } from "next";
import Link from "next/link";
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
        <section className="mt-8 grid gap-6 sm:grid-cols-2" aria-label="Little ink keepsakes">
          <div className="border-y border-line py-5"><h2 className="caption"><BrushHeading>Ink Gashapon &amp; Sticker Book</BrushHeading></h2><p className="my-3 text-muted">Earn paper coins as you explore, crank out tiny ink companions, and arrange a book of keepsakes.</p><Link href="/play/gashapon" className="btn">Turn the capsule machine →</Link></div>
          <div className="border-y border-line py-5"><h2 className="caption"><BrushHeading>Shodo Practice Desk</BrushHeading></h2><p className="my-3 text-muted">Dip a bristle brush, trace today’s kanji on washi, and sign a sheet with your own red seal.</p><Link href="/play/shodo" className="btn">Sit at the Shodo desk →</Link></div>
        </section>
        <div className="mt-8">
          <ClawMachine games={site.games} />
        </div>
        <section className="mt-12" aria-labelledby="senko-heading">
          <h2 id="senko-heading" className="caption"><RisoText>Senko Hanabi</RisoText></h2>
          <p className="mt-2 mb-4 text-muted">Hold a tiny ink sparkler steady as peony, pine needles, willow and falling chrysanthemum bloom across the paper. A quiet summer ritual, with optional crackle.</p>
          <p><Link href="/play/senko" className="btn" data-testid="play-senko-link">Light a Senko Hanabi →</Link></p>
        </section>
        <section className="mt-12" aria-labelledby="ennichi-heading">
          <h2 id="ennichi-heading" className="caption"><RisoText>Ennichi Night</RisoText></h2>
          <p className="mt-2 mb-4 text-muted">A shrine festival printed in four slightly mismatched inks. Look through the stalls for seven small keepsakes and take the stamp when the night is complete.</p>
          <p><Link href="/play/ennichi" className="btn" data-testid="play-ennichi-link">Enter Ennichi Night →</Link></p>
        </section>
        <section className="mt-12" aria-labelledby="inkblot-heading">
          <h2 id="inkblot-heading" className="caption"><RisoText>Ink Blot Test</RisoText></h2>
          <p className="mt-2 mb-4 text-muted">Drip sumi on half a sheet, fold it into a symmetric blot, and write what you see. A paper-and-ink toy, not a diagnosis.</p>
          <p><Link href="/play/inkblot" className="btn" data-testid="play-inkblot-link">Open Ink Blot Test →</Link></p>
        </section>
        <section className="mt-12" aria-labelledby="hanafuda-heading">
          <h2 id="hanafuda-heading" className="caption">
            <RisoText>Hanafuda Koi-Koi</RisoText>
          </h2>
          <p className="mt-2 mb-4 text-muted">
            Forty-eight ink-and-washi flower cards across the twelve months. Match suits against the CPU, call Koi-koi
            under a red hanko stamp, and flip any month’s card back to read what shipped that month.
          </p>
          <p>
            <Link href="/play/hanafuda" className="btn" data-testid="play-hanafuda-link">
              Play Hanafuda Koi-Koi →
            </Link>
          </p>
        </section>
        <section className="mt-12" aria-labelledby="booth-heading">
          <h2 id="booth-heading" className="caption">
            <RisoText>Ink Purikura Photobooth</RisoText>
          </h2>
          <p className="mt-2 mb-4 text-muted">
            Step into a paper photo-booth or load the sample portrait, pull four frames in sumi-e ink wash, two-colour
            risograph halftone, or newsprint dot screen, then stamp and doodle your vertical washi strip.
          </p>
          <p>
            <Link href="/play/booth" className="btn" data-testid="play-booth-link">
              Open Ink Purikura Photobooth →
            </Link>
          </p>
        </section>
        <section className="mt-12" aria-labelledby="pachinko-heading">
          <h2 id="pachinko-heading" className="caption">
            <RisoText>Pipeline Pachinko</RisoText>
          </h2>
          <p className="mt-2 mb-4 text-muted">
            Pull the spring plunger or dump a backfill flood to bounce ink-ball records through an ingest peg field,
            dedupe filter gate, join funnel, six-way partition splitter, and dead-letter queue gutter.
          </p>
          <p>
            <Link href="/play/pachinko" className="btn" data-testid="play-pachinko-link">
              Play Pipeline Pachinko →
            </Link>
          </p>
        </section>
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
