"use client";

import dynamic from "next/dynamic";

const SusukiField = dynamic(() => import("./susuki-field"), { ssr: false });

export function SusukiFieldLoader() {
  return <SusukiField />;
}
