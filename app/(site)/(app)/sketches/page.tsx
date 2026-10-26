import { RisoText } from "@/components/riso-heading";
import { FigTitle } from "@/components/figures";
import { site, type Sketch } from "@/content/site";
import { getSketchDimensions } from "@/lib/sketches";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Sketches" };

// A hand-drawn rectangle over the sheet in its own pixels, so the viewBox scales evenly: four wobbly corners, a
// wobble mid-edge, and a short overshoot past the start, the way a pen closes a box. Hashed from the src, so every
// sketch has its own frame and the server draws the same one each time.
function frame(src: string, width: number, height: number): { d: string; stroke: number } {
  let seed = 0;
  for (const c of src) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
  const stroke = Math.round(width / 240);
  const wobble = width / 220;
  const inset = stroke + wobble;
  const at = (x: number, y: number) => `${Math.round(x + next() * wobble)} ${Math.round(y + next() * wobble)}`;
  const [l, t, r, b] = [inset, inset, width - inset, height - inset];
  const points = [at(l, t), at((l + r) / 2, t), at(r, t), at(r, (t + b) / 2), at(r, b), at((l + r) / 2, b), at(l, b), at(l, (t + b) / 2)];
  return { d: `M${points.join("L")}L${at(l, t)}L${at(l + width / 10, t)}`, stroke };
}

function Sheet({ sketch }: { sketch: Sketch }) {
  const dims = getSketchDimensions(sketch.kind);
  const ink = frame(sketch.src, dims.width, dims.height);
  return (
    <figure>
      {/* The art, a paper wash that slides off it and an ink frame that draws round it as the sheet scrolls in
          (globals.css, .sheet). At rest the wash is gone and the frame drawn, so the still is the whole sketch. */}
      <div className="sheet">
        <Image
          src={sketch.src}
          alt=""
          width={dims.width}
          height={dims.height}
          sizes={dims.sizes}
          className="h-auto w-full border border-line bg-field"
        />
        <span className="sheet-wash" aria-hidden="true" />
        <svg className="sheet-frame" viewBox={`0 0 ${dims.width} ${dims.height}`} aria-hidden="true" focusable="false">
          <path d={ink.d} pathLength={1} strokeWidth={ink.stroke} />
        </svg>
      </div>
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
        <FigTitle n="07" morph="/sketches" hint={site.sketchesHint}>
          Sketches
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">{site.sketchesIntro}</p>
        <p className="mt-2">
          <Link href="/postcard" className="link">
            Send one as a postcard
          </Link>
        </p>
        {/* Chromium runs scroll timelines with JavaScript off too; without it the sheets stand still and whole. */}
        <noscript>
          <style>{".sheet-wash,.sheet-frame path{animation:none!important}"}</style>
        </noscript>
        <section aria-labelledby="places" className="mt-8">
          <h2 id="places" className="caption"><RisoText>Places</RisoText></h2>
          <ul className="mt-3 grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {places.map((sketch) => (
              <li key={sketch.src}>
                <Sheet sketch={sketch} />
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="objects" className="mt-12">
          <h2 id="objects" className="caption"><RisoText>Small things</RisoText></h2>
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
            <h2 id="people" className="caption"><RisoText>People</RisoText></h2>
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
