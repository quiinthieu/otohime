"use client";

import dynamic from "next/dynamic";

const MouldVeins = dynamic(() => import("./mould-veins"), {
  ssr: false,
  loading: () => <div className="mould-veins-loading" role="status">Growing the ink veins…</div>,
});

export default function MouldVeinsLoader({ variant }: { variant: "work" | "projects" }) {
  return <MouldVeins variant={variant} />;
}
