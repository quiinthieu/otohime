import Link from "next/link";
import type { Metadata } from "next";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { requirePermission } from "@/lib/dal";
import { bottleDeps } from "@/lib/bottles-server";
import { validBottleCursor, type BottlePage } from "@/lib/bottles-service";
import type { BottleStatus } from "@/lib/bottles";
import { ReviewControls } from "./review-controls";
export const metadata: Metadata = {
  title: "Bottles",
  robots: { index: false, follow: false },
};
export default async function BottlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("/admin/bottles", {
    bottle: ["moderate"],
  });
  const params = await searchParams;
  const status: BottleStatus =
    typeof params.status === "string" &&
    ["approved", "rejected"].includes(params.status)
      ? (params.status as BottleStatus)
      : "pending";
  const cursor =
    typeof params.cursor === "string" && validBottleCursor(params.cursor)
      ? params.cursor
      : null;
  let page: BottlePage | null = null;
  try {
    page = await bottleDeps().service.review(status, cursor, {
      id: session.user.id,
      role: session.user.role,
    });
  } catch {}
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="12" hint="discoveries waiting on the shore">
          Bottles
        </FigTitle>
        <p className="mt-2 text-muted">
          Read each suggestion before approving it. Only approved discoveries
          join the public pool. Rejecting one removes it immediately.
        </p>
        <p className="mt-2 text-muted">
          Submitted addresses and notes appear as plain text. Review a
          destination separately before approving it.
        </p>
        <nav aria-label="Bottle status" className="mt-5 flex flex-wrap gap-3">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <Link
              key={s}
              href={`/admin/bottles?status=${s}`}
              aria-current={status === s ? "page" : undefined}
              className="btn btn-sm"
            >
              {s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </nav>
        {page === null ? (
          <p role="alert" className="card mt-6">
            The review queue is temporarily unavailable. Please try again.
          </p>
        ) : (
          <>
            {!page.suggestions.length ? (
              <p className="card mt-6">No {status} suggestions.</p>
            ) : (
              <ul className="mt-6 grid gap-4">
                {page.suggestions.map((b) => (
                  <li
                    key={b.id}
                    data-bottle-id={b.id}
                    className="card min-w-0 p-5"
                  >
                    <h2 className="text-lg font-bold break-words">{b.title}</h2>
                    <p className="mt-2 break-all font-mono text-sm">{b.url}</p>
                    <p className="mt-2 break-words">{b.note}</p>
                    <p className="mt-2 text-sm text-muted">
                      {b.kind} · {b.status} · Submitted {b.createdAt}
                    </p>
                    <ReviewControls
                      id={b.id}
                      title={b.title}
                      status={b.status}
                    />
                  </li>
                ))}
              </ul>
            )}
            <nav aria-label="Review pages" className="mt-5 flex gap-3">
              {cursor ? (
                <Link
                  href={`/admin/bottles?status=${status}`}
                  className="btn btn-sm"
                >
                  First page
                </Link>
              ) : null}
              {page.nextCursor ? (
                <Link
                  href={`/admin/bottles?status=${status}&cursor=${encodeURIComponent(page.nextCursor)}`}
                  className="btn btn-sm"
                >
                  Next page
                </Link>
              ) : null}
            </nav>
          </>
        )}
      </div>
    </ViewTransition>
  );
}
