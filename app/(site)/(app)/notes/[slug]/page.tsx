import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
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
      <article className="rise">
        <Link href="/notes" className="caption underline underline-offset-4">← All notes</Link>
        <header className="mt-6">
          <time dateTime={note.date} className="caption">{note.date}</time>
          <FigTitle n="04">{note.title}</FigTitle>
        </header>
        <p className="mt-6 max-w-prose text-muted">{note.body}</p>
        <ul aria-label="Tags" className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-muted">
          {note.tags.map((tag) => <li key={tag}>#{tag}</li>)}
        </ul>
      </article>
    </ViewTransition>
  );
}
