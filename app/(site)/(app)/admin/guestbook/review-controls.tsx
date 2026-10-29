"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReviewStatus } from "@/lib/guestbook-review";

export function ReviewControls({ id, status }: { id: string; status: ReviewStatus }) {
  const router = useRouter();
  const [current, setCurrent] = useState<ReviewStatus | "deleted">(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function review(next: ReviewStatus | "deleted") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/guestbook/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw Error("Review could not be saved.");
      setCurrent(next);
      setMessage(next === "approved" ? "Pinned to the wall." : next === "deleted" ? "Drawing deleted." : "Hidden from the wall.");
      router.refresh();
    } catch { setMessage("Review could not be saved. Please try again."); }
    finally { setBusy(false); }
  }
  return <div aria-busy={busy} className="mt-3">
    <div className="flex flex-wrap gap-2">
      <button className="btn btn-sm" type="button" disabled={busy || current === "approved" || current === "deleted"} onClick={() => void review("approved")}>Approve</button>
      <button className="btn btn-sm" type="button" disabled={busy || current === "rejected" || current === "deleted"} onClick={() => void review("rejected")}>Reject</button>
      <button className="btn btn-sm" type="button" disabled={busy || current === "deleted"} onClick={() => void review("deleted")}>Delete</button>
    </div>
    <p role="status" className="mt-2 text-sm">{message}</p>
  </div>;
}
