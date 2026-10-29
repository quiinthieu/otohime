import Link from "next/link";
import type { Metadata } from "next";
import { Pool } from "pg";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { GuestbookArt } from "@/components/guestbook-art";
import { requirePermission } from "@/lib/dal";
import { decodeCursor } from "@/lib/guestbook";
import { listReviewEntries, type ReviewStatus } from "@/lib/guestbook-review";
import { ReviewControls } from "./review-controls";
import "../../guestbook/guestbook.css";

export const metadata: Metadata = { title: "Guestbook review", robots: { index: false, follow: false } };
let pool: Pool | undefined;

export default async function GuestbookReviewPage({ searchParams }: PageProps<"/admin/guestbook">) {
  await requirePermission("/admin/guestbook", { guestbook: ["moderate"] });
  const params = await searchParams;
  const status: ReviewStatus = params.status === "approved" || params.status === "rejected" ? params.status : "pending";
  const cursor = typeof params.cursor === "string" ? decodeCursor(params.cursor) : null;
  let page: Awaited<ReturnType<typeof listReviewEntries>> | null = null;
  if (process.env.DATABASE_URL) {
    try { page = await listReviewEntries(pool ??= new Pool({ connectionString: process.env.DATABASE_URL }), status, cursor); } catch {}
  }
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <FigTitle n="12" hint="small drawings awaiting a place">Guestbook review</FigTitle>
    <p className="mt-2 text-muted">Only approved drawings appear on the public wall. Review each doodle and note before pinning it up.</p>
    <nav aria-label="Guestbook status" className="mt-5 flex flex-wrap gap-3">
      {(["pending", "approved", "rejected"] as const).map((item) => <Link key={item} className="btn btn-sm" aria-current={item === status ? "page" : undefined} href={`/admin/guestbook?status=${item}`}>{item}</Link>)}
    </nav>
    {page === null ? <p role="alert" className="card mt-6">The review queue is unavailable.</p> : page.entries.length === 0 ? <p className="card mt-6">No {status} drawings.</p> :
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {page.entries.map((entry) => <li key={entry.id} className="guestbook-card" data-guestbook-id={entry.id}>
          <GuestbookArt strokes={entry.strokes} durationMs={entry.durationMs} />
          <p className="font-semibold">{entry.name || "Anonymous"}</p>
          {entry.note && <p className="break-words">{entry.note}</p>}
          <p className="text-xs text-muted">{entry.createdAt}</p>
          <ReviewControls id={entry.id} status={entry.status} />
        </li>)}
      </ul>}
    {page?.nextCursor && <Link className="btn mt-6" href={`/admin/guestbook?status=${status}&cursor=${encodeURIComponent(page.nextCursor)}`}>Next page</Link>}
  </div></ViewTransition>;
}
