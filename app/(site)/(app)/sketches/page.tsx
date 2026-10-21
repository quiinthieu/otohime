import { FigTitle } from "@/components/figures";
import { site, type Sketch } from "@/content/site";
import type { Metadata } from "next";
import Image from "next/image";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Sketches" };

function Sheet({ sketch }: { sketch: Sketch }) {
  return (
    <figure>
      <Image
        src={sketch.src}
        alt=""
        width={sketch.kind === "place" ? 1248 : 1024}
        height={sketch.kind === "place" ? 832 : 1024}
        className="h-auto w-full border border-line bg-field"
      />
      <figcaption className="mt-2">
        <span className="block font-semibold">{sketch.title}</span>
        <span className="text-muted">{sketch.note}</span>
      </figcaption>
    </figure>
  );
}

export default function SketchesPage() {
  const places = site.sketches.filter((sketch) => sketch.kind === "place");
  const objects = site.sketches.filter((sketch) => sketch.kind === "object");
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="07" hint="places and small things">
          Sketches
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">{site.sketchesIntro}</p>
        <section aria-labelledby="places" className="mt-8">
          <h2 id="places" className="caption">
            Places
          </h2>
          <ul className="mt-3 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {places.map((sketch) => (
              <li key={sketch.src}>
                <Sheet sketch={sketch} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="objects" className="mt-12">
          <h2 id="objects" className="caption">
            Small things
          </h2>
          <ul className="mt-3 grid gap-x-8 gap-y-8 sm:grid-cols-2 md:grid-cols-3">
            {objects.map((sketch) => (
              <li key={sketch.src}>
                <Sheet sketch={sketch} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ViewTransition>
  );
}
