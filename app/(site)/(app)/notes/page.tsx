import { site } from "@/content/site";
import { noteTargetId } from "@/lib/fortune-targets";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Notes" };

export default function NotesPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise space-y-12">
        <header className="space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2/60 px-3 py-1 backdrop-blur-xs">
            <span className="inline-block size-2 rounded-full bg-yellow" aria-hidden="true" />
            <p className="caption tracking-[0.1em]">Field Notes &amp; Technical Dispatches</p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-ink">Notes</h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink/85">
            Dispatches on high-throughput data platforms, distributed streaming, game systems, and software craft.
          </p>
        </header>

        <ol className="divide-y divide-line/70 border-t border-b border-line/70">
          {site.notes.map(({ slug, date, title, body, tags }) => (
            <li
              id={noteTargetId(date)}
              key={slug}
              className="py-7 group hover:bg-paper-2/30 px-3 -mx-3 rounded-xl transition-colors duration-150"
            >
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                  <Link
                    href={`/notes/${slug}`}
                    className="underline decoration-line/80 underline-offset-4 hover:decoration-ink transition-colors duration-150"
                  >
                    {title}
                  </Link>
                </h2>
                <time
                  dateTime={date}
                  className="caption shrink-0 font-mono text-[11px] rounded-full border border-line px-2.5 py-0.5 bg-paper-2/50"
                >
                  {date}
                </time>
              </div>
              <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-muted">{body}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <ul aria-label="Tags" className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <li
                      key={tag}
                      className="badge text-[10.5px] px-2.5 py-0.5 hover:border-ink transition-colors duration-150"
                    >
                      #{tag}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/notes/${slug}`}
                  className="caption text-[11px] text-muted group-hover:text-ink font-sans font-medium flex items-center gap-1 transition-colors duration-150"
                >
                  <span>Read essay</span>
                  <span aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </ViewTransition>
  );
}
