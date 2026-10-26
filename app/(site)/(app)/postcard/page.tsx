import { FigTitle } from "@/components/figures";
import { NOTE_MAX, POSTCARD_SKETCHES } from "@/lib/postcard";
import type { Metadata } from "next";
import Image from "next/image";
import { Suspense, ViewTransition } from "react";
import { Desk, DeskFromQuery } from "./_components/desk";

export const metadata: Metadata = {
  title: "Postcard",
  description: "Pick a sketch, write a short note, and send it as a postcard.",
};

// The postcard desk. Nothing is stored: the postcard travels in its own link (lib/postcard.ts), opened at
// /postcard/view and drawn at /postcard/image.
// The sheets' thumbnails, drawn here so the client desk need not import next/image.
const thumbs = Object.fromEntries(
  POSTCARD_SKETCHES.map((s) => [
    s.id,
    <Image key={s.id} src={s.src} alt="" width={160} height={120} sizes="120px" className="aspect-4/3 h-auto w-full object-cover" />,
  ]),
) as Record<(typeof POSTCARD_SKETCHES)[number]["id"], React.ReactNode>;

export default function PostcardPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="08" hint="stamped by hand">
          Send a postcard
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          Pick a sketch from the book, write up to {NOTE_MAX} characters, and stamp it. The link is the postcard:
          whoever opens it reads your note on the front of the sketch.
        </p>
        {/* ?s= picks the sketch; it is read in the browser, so the desk itself prerenders. */}
        <Suspense fallback={<Desk thumbs={thumbs} />}>
          <DeskFromQuery thumbs={thumbs} />
        </Suspense>
      </div>
    </ViewTransition>
  );
}
