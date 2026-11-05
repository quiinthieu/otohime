import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { site } from "@/content/site";
import { noteBySlug } from "../_lib/notes";

export function generateStaticParams() {
  return site.notes.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/notes/[slug]">): Promise<Metadata> {
  const note = noteBySlug((await params).slug);
  return note ? {
    title: note.title,
    description: note.body,
    openGraph: {
      images: [{ url: `/og?${new URLSearchParams({ title: note.title, path: `/notes/${note.slug}` })}`, width: 1200, height: 630, alt: `${note.title}, stamped on paper by otohime.dev` }],
    },
    twitter: { card: "summary_large_image" },
  } : {};
}

export default async function NotePage({ params }: PageProps<"/notes/[slug]">) {
  const note = noteBySlug((await params).slug);
  if (!note) notFound();

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <article className="rise space-y-6">
        <Link href="/notes" className="caption link">
          ← All notes
        </Link>
        <header className="space-y-2 border-b border-line pb-6">
          <time dateTime={note.date} className="caption block">
            {note.date}
          </time>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{note.title}</h1>
        </header>
        <p className="max-w-2xl text-[14px] leading-relaxed text-ink">{note.body}</p>
        <ul aria-label="Tags" className="flex flex-wrap gap-3 pt-2 text-muted">
          {note.tags.map((tag) => (
            <li key={tag} className="caption">
              #{tag}
            </li>
          ))}
        </ul>
      </article>
    </ViewTransition>
  );
}
