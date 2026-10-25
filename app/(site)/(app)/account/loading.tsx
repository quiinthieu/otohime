import { ViewTransition } from "react";

// The skeleton fades out as its page fades in (the page's own enter="page-in").
export default function Loading() {
  return (
    <ViewTransition exit="page-out" default="none">
      <div className="grid gap-6">
        <p role="status" className="sr-only">
          Loading…
        </p>
        <div className="skeleton h-5 w-1/2 max-w-sm" />
        <div className="skeleton h-64" />
      </div>
    </ViewTransition>
  );
}
