"use client";

import dynamic from "next/dynamic";

const MouldStage = dynamic(() => import("./mould-stage"), {
  ssr: false,
  loading: () => <div className="mould-loading" role="status">Warming the petri dish…</div>,
});

export default function MouldLoader() {
  return <MouldStage />;
}
