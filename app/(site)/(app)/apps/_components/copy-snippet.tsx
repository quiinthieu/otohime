"use client";

import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export function CopySnippet({
  label,
  command,
  note,
}: {
  label: string;
  command: string;
  note?: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
      timerRef.current = setTimeout(() => {
        setCopyState("idle");
        timerRef.current = null;
      }, 2200);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="app-snippet" data-copy-state={copyState}>
      <div className="app-snippet-header">
        <span className="caption">{label}</span>
        <button
          type="button"
          className="btn btn-sm app-snippet-btn"
          onClick={handleCopy}
          aria-label={`Copy command: ${command}`}
        >
          {copyState === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="app-snippet-pre">
        <code className="app-snippet-code">
          <span className="app-snippet-prompt" aria-hidden="true">
            ${" "}
          </span>
          {command}
        </code>
      </pre>
      <p
        className={`app-snippet-status ${copyState === "failed" ? "app-snippet-status-error" : ""}`.trim()}
        role="status"
        aria-live="polite"
      >
        {copyState === "copied"
          ? "Copied command to clipboard."
          : copyState === "failed"
            ? "Clipboard unavailable — select and copy the command manually."
            : ""}
      </p>
      {note ? <p className="hint app-snippet-note">{note}</p> : null}
    </div>
  );
}
