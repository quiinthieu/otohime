"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { GhostRoom } from "./config.ts";
import { getGhostsHidden, useGhostsHidden } from "./pref-client.ts";

const GhostCanvas = dynamic(() => import("./canvas"), { ssr: false });

/** Neutral boundary shared by pages in both independent roots; no site CSS or code. */
export function GhostLoader({ room }: { room: GhostRoom }) {
  const hidden = useGhostsHidden();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (hidden || ready) return;
    const load = () => { if (!getGhostsHidden()) setReady(true); };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(load, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, [hidden, ready]);
  // Once loaded, preserve the session and its retry budget while suppressed.
  return ready ? <GhostCanvas room={room} /> : null;
}
