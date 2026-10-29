"use client";

import dynamic from "next/dynamic";

const StrataStage = dynamic(() => import("./strata-stage"), {
  ssr: false,
  loading: () => <div className="strata-loading" role="status">Cutting the paper layers…</div>,
});

export default function StrataLoader() {
  return <StrataStage />;
}
