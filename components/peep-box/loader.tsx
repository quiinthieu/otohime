"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";

// peep-box-loader: the controller is never fetched on hover, viewport entry or Save-Data.
const Active = dynamic(() => import("./active"), {
  ssr: false,
  loading: () => <p className="peep-status">Opening the paper window…</p>,
});

export function PeepBoxLoader({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  return (
    <div ref={root} data-peep="peep-box-loader">
      {children}
      <div className="peep-tools">
        <button
          type="button"
          className="btn"
          aria-pressed={enabled}
          onClick={() => setEnabled((v) => !v)}
        >
          {enabled ? "Disable" : "Look inside"}
        </button>
        {enabled ? (
          <Active root={root} />
        ) : (
          <p className="peep-status">
            A still paper sea. Look inside to move the view.
          </p>
        )}
        <noscript>
          <p className="peep-status">
            The paper scene is here to enjoy. Moving the view needs JavaScript.
          </p>
        </noscript>
      </div>
    </div>
  );
}
