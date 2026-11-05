import { site } from "@/content/site";
import { noteTargetId } from "@/lib/fortune-targets";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise space-y-10">
        <header className="space-y-3">
          <p className="caption">Field Notes &amp; Essays</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notes</h1>
          <p className="max-w-2xl text-muted">
            Short dispatches on data engineering, SQL, game mechanics, and software craft.
          </p>
        </header>

        <ol className="divide-y divide-line border-t border-line">
          {site.notes.map(({ slug, date, title, body, tags }) => (
            <li id={noteTargetId(date)} key={slug} className="py-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-[15px] font-semibold">
                  <Link
                    href={`/notes/${slug}`}
                    className="underline decoration-line underline-offset-4 hover:decoration-ink"
                  >
                    {title}
                  </Link>
                </h2>
                <time dateTime={date} className="caption shrink-0">
                  {date}
                </time>
              </div>
              <p className="mt-2 max-w-2xl text-muted">{body}</p>
              <ul aria-label="Tags" className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <li key={tag} className="caption">
                    #{tag}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </ViewTransition>
  );
}
