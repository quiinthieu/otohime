import type { Metadata } from "next";
import { ViewTransition } from "react";
import { site } from "@/content/site";
import { InkShelf } from "@/components/ink-shelf";
import { buildShelfBooks } from "@/lib/shelf";
import "./shelf.css";

export const metadata: Metadata = {
  title: "Ink Shelf",
  description: "Projects and little notes, bound in paper and kept on an ink-drawn shelf.",
};

export default function ShelfPage() {
  const books = buildShelfBooks(site.projectList, site.notes);
  const bound = new Set(books.map((book) => book.href));
  const overflow = [
    ...site.projectList.flatMap((project) => project.href ? [{ title: project.title, href: project.href }] : []),
    ...site.notes.map((note) => ({ title: note.title, href: `/notes/${note.slug}` })),
  ].filter((entry) => !bound.has(entry.href));
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="ink-shelf-page">
        <InkShelf books={books} />
        {overflow.length > 0 && (
          <section className="shelf-overflow" aria-labelledby="shelf-overflow-title">
            <h2 id="shelf-overflow-title">More from the collection</h2>
            <ul>{overflow.map((entry) => <li key={entry.href}><a href={entry.href}>{entry.title}</a></li>)}</ul>
          </section>
        )}
      </div>
    </ViewTransition>
  );
}
