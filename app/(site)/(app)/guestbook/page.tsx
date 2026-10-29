import Link from "next/link";
import type { Metadata } from "next";
import { Pool } from "pg";
import { ViewTransition } from "react";
import { connection } from "next/server";
import { FigTitle } from "@/components/figures";
import { GuestbookArt } from "@/components/guestbook-art";
import { decodeCursor } from "@/lib/guestbook";
import { createGuestbookStore } from "@/lib/guestbook-store";
import { DrawingForm } from "./drawing-form";
import "./guestbook.css";

export const metadata: Metadata = { title: "Ink Guestbook", description: "Draw a small note for Otohime's paper wall." };
export const instant = false;
let pool: Pool | undefined;

export default async function GuestbookPage({ searchParams }: PageProps<"/guestbook">) {
  await connection();
  const params = await searchParams;
  const cursor = typeof params.cursor === "string" ? decodeCursor(params.cursor) : null;
  let page: Awaited<ReturnType<ReturnType<typeof createGuestbookStore>["list"]>> | null = null;
  if (process.env.DATABASE_URL) {
    try { page = await createGuestbookStore(pool ??= new Pool({ connectionString: process.env.DATABASE_URL })).list(cursor); } catch {}
  }
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <FigTitle n="09" hint="small marks left by visitors">Ink Guestbook</FigTitle>
    <p className="mt-2 max-w-prose text-muted">A paper wall for the little things people draw on their way through. Every mark is reviewed before it appears here.</p>
    <div className="mt-8"><DrawingForm /></div>
    <section className="mt-12" aria-labelledby="guestbook-wall-title">
      <h2 id="guestbook-wall-title" className="caption">The wall</h2>
      {page === null ? <p role="status" className="mt-5">The wall is resting. Please check back soon.</p> : page.entries.length === 0 ? <p className="mt-5">No drawings pinned here yet. Yours could be the first.</p> :
        <ul className="guestbook-wall mt-5">
          {page.entries.map((entry) => <li key={entry.id} className="guestbook-card" tabIndex={0} style={{ transform: `rotate(${entry.tilt}deg)` }}>
            <span className={`guestbook-tape tape-${entry.tape}`} aria-hidden="true" />
            <GuestbookArt strokes={entry.strokes} durationMs={entry.durationMs} replay />
            <p className="mt-2 font-semibold break-words">{entry.name || "Anonymous"}</p>
            {entry.note && <p className="break-words">{entry.note}</p>}
            <time className="text-xs text-muted" dateTime={entry.createdAt}>{entry.createdAt.slice(0, 10)}</time>
          </li>)}
        </ul>}
      {page?.nextCursor && <nav aria-label="Guestbook pages" className="mt-8"><Link className="btn" href={`/guestbook?cursor=${encodeURIComponent(page.nextCursor)}`}>More drawings</Link></nav>}
      {cursor && <p className="mt-4"><Link className="link" href="/guestbook">Back to the first page</Link></p>}
    </section>
  </div></ViewTransition>;
}
