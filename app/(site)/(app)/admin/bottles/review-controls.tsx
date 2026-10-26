"use client";
import { useEffect, useRef, useState } from "react";
import type { BottleStatus } from "@/lib/bottles";
export function ReviewControls({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: BottleStatus;
}) {
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function review(next: "approved" | "rejected") {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/bottles/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
          signal: active.signal,
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(result.message ?? "The review could not be saved.");
      setCurrent(next);
      setMessage(
        next === "approved"
          ? "Approved. This discovery is now public."
          : "Rejected. This discovery is hidden from the public pool.",
      );
    } catch (e) {
      if (!active.signal.aborted)
        setError(
          e instanceof Error ? e.message : "The review could not be saved.",
        );
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="mt-4" aria-busy={busy}>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-sm"
          aria-label={`Approve ${title}`}
          disabled={busy || current === "approved"}
          onClick={() => void review("approved")}
        >
          Approve
        </button>
        <button
          type="button"
          className="btn btn-sm"
          aria-label={`Reject ${title}`}
          disabled={busy || current === "rejected"}
          onClick={() => void review("rejected")}
        >
          Reject
        </button>
      </div>
      <p role="status" className="mt-2 text-sm">
        {busy ? "Saving review…" : message}
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
