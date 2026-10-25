import { FigTitle, Figure } from "@/components/figures";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="04" morph="/notes" hint="short ones">
          Notes
        </FigTitle>
        <div className="mt-8 grid items-start gap-10 md:grid-cols-[minmax(0,1fr)_16rem]">
          <ol>
            {site.notes.map(({ date, title, body }) => (
              <li key={date} className="border-t border-line py-5">
                <time dateTime={date} className="caption">
                  {date}
                </time>
                <h2 className="mt-1">{title}</h2>
                <p className="mt-1 max-w-prose text-muted">{body}</p>
              </li>
            ))}
          </ol>
          <Figure kind="parcel" className="mx-auto w-full max-w-64" />
        </div>
      </div>
    </ViewTransition>
  );
}
