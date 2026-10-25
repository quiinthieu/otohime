import { FigTitle } from "@/components/figures";
import { site, type Sketch } from "@/content/site";
import { getSketchDimensions } from "@/lib/sketches";
import type { Metadata } from "next";
import Image from "next/image";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Sketches" };

function Sheet({ sketch }: { sketch: Sketch }) {
  const dims = getSketchDimensions(sketch.kind);
  return (
    <figure>
      <Image
        src={sketch.src}
        alt=""
        width={dims.width}
        height={dims.height}
        sizes={dims.sizes}
        className="h-auto w-full border border-line bg-field"
      />
      <figcaption className="mt-2">
        {sketch.downloadHref && sketch.downloadFilename ? (
          <div className="flex items-baseline justify-between gap-2">
            <span className="block font-semibold">{sketch.title}</span>
            <a
              href={sketch.downloadHref}
              download={sketch.downloadFilename}
              className="text-xs text-muted underline underline-offset-4 hover:text-ink"
            >
              PNG ({sketch.downloadFilename})
            </a>
          </div>
        ) : (
          <span className="block font-semibold">{sketch.title}</span>
        )}
        <span className="text-muted">{sketch.note}</span>
      </figcaption>
    </figure>
  );
}

export default function SketchesPage() {
  const places = site.sketches.filter((sketch) => sketch.kind === "place");
  const objects = site.sketches.filter((sketch) => sketch.kind === "object");
  const people = site.sketches.filter((sketch) => sketch.kind === "person");
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="07" hint={site.sketchesHint}>
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
        {people.length > 0 ? (
          <section aria-labelledby="people" className="mt-12">
            <h2 id="people" className="caption">
              People
            </h2>
            <ul className="mt-3 grid gap-x-8 gap-y-8 sm:grid-cols-2 md:grid-cols-3">
              {people.map((sketch) => (
                <li key={sketch.src}>
                  <Sheet sketch={sketch} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ViewTransition>
  );
}
