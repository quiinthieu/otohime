"use client";

import { useId, useState, type ComponentProps } from "react";

// A labelled input. Hint and error are tied to it with aria-describedby;
// password inputs get a Show toggle that keeps one accessible name.
export function Field({
  label,
  hint,
  error,
  type = "text",
  className = "",
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const password = type === "password";
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={password && shown ? "text" : type}
          className={`field ${password ? "pr-20" : ""} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {password ? (
          <button
            type="button"
            className="reveal"
            aria-controls={id}
            aria-pressed={shown}
            onClick={() => setShown((current) => !current)}
          >
            Show<span className="sr-only"> password</span>
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
