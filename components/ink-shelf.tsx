"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { FigTitle } from "@/components/figures";
import { SHELF_ROW_GAP, SHELF_WIDTH, shelfBookExtent, shelfRowCount, type ShelfBook } from "@/lib/shelf";

const filters = [["all", "All"], ["project", "Projects"], ["note", "Notes"]] as const;

export function InkShelf({ books }: { books: readonly ShelfBook[] }) {
  const [filter, setFilter] = useState<"all" | ShelfBook["kind"]>("all");
  const [focusedBook, setFocusedBook] = useState<string | null>(null);
  const rows = shelfRowCount(books.length);
  const shown = books.filter((book) => filter === "all" || book.kind === filter).length;
  return (
    <section className="ink-shelf" data-shelf-mode="flat" data-focused-book={focusedBook ?? ""}>
      <FigTitle n="棚" hint="a little collection">Ink Shelf</FigTitle>
      <p className="shelf-intro">Projects and short notes, bound in paper. Pick a spine to open its story.</p>
      <div className="shelf-toolbar">
        <div role="group" aria-label="Filter the shelf" className="shelf-filters">
          {filters.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} aria-controls="shelf-books" onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <p role="status" className="shelf-status">{shown} {shown === 1 ? "volume" : "volumes"} · newest first</p>
      </div>
      <div className="shelf-frame" style={{ height: `${rows * 12}rem` }}>
        <div className="shelf-planks" aria-hidden="true">
          {Array.from({ length: rows }, (_, row) => <div className="shelf-plank" key={row} style={{ top: `${(row + 1) * 12 - 1}rem` }} />)}
        </div>
        <ul id="shelf-books" data-testid="shelf-book-list" aria-label="Projects and notes" className="shelf-books">
          {books.map((book) => (
            <li key={book.id} hidden={filter !== "all" && filter !== book.kind} className="shelf-slot" style={{
              left: `${(book.x + SHELF_WIDTH / 2) / SHELF_WIDTH * 100}%`,
              bottom: `${(rows - book.row - 1) * 12 + 1 + (shelfBookExtent(book).height - book.height) / SHELF_ROW_GAP * 6}rem`,
              width: `${book.thickness / SHELF_WIDTH * 100}%`,
              height: `${book.height / SHELF_ROW_GAP * 12}rem`,
              transform: `translateX(-50%) rotate(${-book.tiltRad}rad)`,
            }}>
              <Link href={book.href} prefetch={false} className="shelf-book" data-book-id={book.id}
                aria-label={`${book.title} — ${book.kind}${book.date ? `, ${book.date}` : ""}`}
                title={`${book.title} · ${book.subtitle}`}
                style={{ viewTransitionName: book.viewTransitionName, borderTopColor: `var(--${book.swatch})` } as CSSProperties}
                onFocus={() => setFocusedBook(book.id)} onBlur={() => setFocusedBook(null)}>
                <span className="shelf-spine-title">{book.title}</span>
                <span className="shelf-spine-kind" aria-hidden="true">{book.kind === "project" ? "P" : "N"}</span>
              </Link>
            </li>
          ))}
        </ul>
        {books.length === 0 && <p className="shelf-empty">A little space for the next story.</p>}
      </div>
      <p className="shelf-colophon">Paper spines, ink lines. P = project · N = note.</p>
    </section>
  );
}
