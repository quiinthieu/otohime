"use client";

import { Notice } from "@/components/doodles";
import Link from "next/link";
import { useEffect } from "react";

// ponytail: one root boundary renders without the app shell; add an
// (app)/error.tsx when in-shell recovery matters.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Notice page mood="worried" title="Something went wrong">
        <p className="text-muted">The current got choppy. Try again in a moment.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => retry()}>
            Try again
          </button>
          <Link href="/" className="btn">
            Go home
          </Link>
        </div>
      </Notice>
    </main>
  );
}
