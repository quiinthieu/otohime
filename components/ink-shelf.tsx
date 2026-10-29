"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Component, startTransition, useCallback, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { FigTitle } from "@/components/figures";
import { SHELF_ROW_GAP, SHELF_WIDTH, shelfBookExtent, shelfRowCount, type BookScreenRect, type ShelfBook } from "@/lib/shelf";

const filters = [["all", "All"], ["project", "Projects"], ["note", "Notes"]] as const;
const Shelf3D = dynamic(() => import("@/components/ink-shelf-3d"), { ssr: false });

let webglAvailable: boolean | undefined;
const subscribe = () => () => {};
function canEnhance() {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return false;
  if (webglAvailable === undefined) {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      webglAvailable = !!context;
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch { webglAvailable = false; }
  }
  return webglAvailable;
}

class EnhancementBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error("Ink Shelf enhancement failed", error); this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function InkShelf({ books }: { books: readonly ShelfBook[] }) {
  const router = useRouter();
  const capable = useSyncExternalStore(subscribe, canEnhance, () => false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  const onReady = useCallback(() => setReady(true), []);
  const measureRef = useRef<((id: string) => BookScreenRect | null) | null>(null);
  const proxyRef = useRef<HTMLDivElement>(null);
  const openBook = useCallback((book: ShelfBook, rect?: BookScreenRect | null) => {
    const go = () => startTransition(() => router.push(book.href));
    // A full load does not call the JS API. Reduced motion must not start one,
    // including the transition React starts for a client navigation.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { window.location.assign(book.href); return; }
    const link = document.querySelector<HTMLElement>(`a.shelf-book[data-book-id="${CSS.escape(book.id)}"]`);
    const proxy = proxyRef.current;
    const projected = rect?.visible ? rect : measureRef.current?.(book.id);
    const clear = () => {
      if (!proxy) return;
      proxy.style.display = "none";
      proxy.style.viewTransitionName = "none";
      delete proxy.dataset.vtActive;
    };
    if (projected?.visible && proxy) {
      proxy.style.display = "block";
      proxy.style.left = `${projected.left}px`;
      proxy.style.top = `${projected.top}px`;
      proxy.style.width = `${projected.width}px`;
      proxy.style.height = `${projected.height}px`;
      proxy.style.viewTransitionName = book.viewTransitionName;
      proxy.dataset.vtActive = "true";
      if (link) { link.style.viewTransitionName = "none"; delete link.dataset.vtActive; }
    } else if (link) {
      link.style.viewTransitionName = book.viewTransitionName;
      link.dataset.vtActive = "true";
      clear();
    }
    if (typeof document.startViewTransition !== "function") { go(); return; }
    // Notes stay in this document: React's page <ViewTransition> starts the
    // one transition, and the proxy is already in place for its snapshot.
    // A project is another root layout, so the hop is a full load. Start the
    // transition here or the navigation API never calls this method.
    if (book.kind === "note") { go(); return; }
    const pending = document.startViewTransition(() => { go(); });
    pending.finished.finally(() => { if (location.pathname === "/shelf") clear(); });
  }, [router]);
  const enhanced = capable && !failed && ready;
  const [filter, setFilter] = useState<"all" | ShelfBook["kind"]>("all");
  const [focusedBook, setFocusedBook] = useState<string | null>(null);
  const rows = shelfRowCount(books.length);
  const shown = books.filter((book) => filter === "all" || book.kind === filter).length;
  return (
    <section className="ink-shelf" data-shelf-mode={enhanced ? "3d" : "flat"} data-focused-book={focusedBook ?? ""}>
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
        <div className="shelf-planks" aria-hidden="true" style={{ visibility: enhanced ? "hidden" : undefined }}>
          {Array.from({ length: rows }, (_, row) => <div className="shelf-plank" key={row} style={{ top: `${(row + 1) * 12 - 1}rem` }} />)}
        </div>
        <ul id="shelf-books" data-testid="shelf-book-list" aria-label="Projects and notes" className="shelf-books"
          style={enhanced ? { opacity: 0, pointerEvents: "none" } : undefined}>
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
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  openBook(book, measureRef.current?.(book.id) ?? null);
                }}
                onFocus={() => setFocusedBook(book.id)} onBlur={() => setFocusedBook(null)}>
                <span className="shelf-spine-title">{book.title}</span>
                <span className="shelf-spine-kind" aria-hidden="true">{book.kind === "project" ? "P" : "N"}</span>
              </Link>
            </li>
          ))}
        </ul>
        {capable && !failed && books.length > 0 && (
          <EnhancementBoundary onFail={onFail}>
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: enhanced ? 1 : 0, pointerEvents: enhanced ? "auto" : "none" }}>
              <Shelf3D books={books} filter={filter} focusedBook={focusedBook} measureRef={measureRef} onReady={onReady} onFail={onFail} onActivate={openBook} />
            </div>
          </EnhancementBoundary>
        )}
        {books.length === 0 && <p className="shelf-empty">A little space for the next story.</p>}
        <div ref={proxyRef} data-testid="shelf-transition-proxy" aria-hidden="true" className="shelf-transition-proxy" />
      </div>
      <p className="shelf-colophon">Paper spines, ink lines. P = project · N = note.</p>
    </section>
  );
}
