"use client";

import dynamic from "next/dynamic";

const SenkoStage = dynamic(() => import("./senko-stage"), {
  ssr: false,
  loading: () => <p className="senko-loading" role="status">Laying out the paper sparkler…</p>,
});

export default function SenkoLoader() {
  return <SenkoStage />;
}
