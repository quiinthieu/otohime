"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { GhostRoom } from "./config.ts";

const GhostCanvas = dynamic(() => import("./canvas"), { ssr: false });

/** Neutral boundary shared by pages in both independent roots; no site CSS or code. */
export function GhostLoader({ room }: { room: GhostRoom }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => setReady(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(load, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 200);
    return () => window.clearTimeout(id);
  }, []);
  return ready ? <GhostCanvas room={room} /> : null;
}
