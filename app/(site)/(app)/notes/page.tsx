import { PaperHost } from "@/components/paper-host";
import { HankoSignature } from "@/components/hanko-signature";
import { RisoText } from "@/components/riso-heading";
import { stableSurfaceId } from "@/lib/tactile";
import { FigTitle, Figure } from "@/components/figures";
import { site } from "@/content/site";
import { noteTargetId } from "@/lib/fortune-targets";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="04" morph="/notes" hint="short ones">
          Notes
        </FigTitle>
        <p className="mt-3"><Link href="/notes/sky" className="link">Explore the Paper Star Chart →</Link></p>
        <div className="mt-8 grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_16rem]">
          <ol>
            {site.notes.map(({ slug, date, title, body }) => (
              <PaperHost as="li" id={noteTargetId(date)} key={slug} className="border-t border-line py-5" data-paper-id={stableSurfaceId("note", date)} data-tossable="true" data-paper-margin="A thought kept in the margin, for another tide.">
                <time dateTime={date} className="caption">
                  {date}
                </time>
                <h2 className="mt-1"><Link href={`/notes/${slug}`} className="underline decoration-line underline-offset-4 hover:decoration-ink"><RisoText>{title}</RisoText></Link></h2>
                <p className="mt-1 max-w-prose text-muted">{body}</p>
              </PaperHost>
            ))}
          </ol>
          <Figure kind="parcel" className="mx-auto w-full max-w-64" />
        </div>
        <div className="mt-6"><HankoSignature /></div>
      </div>
    </ViewTransition>
  );
}
