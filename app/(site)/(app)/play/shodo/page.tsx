import type { Metadata } from "next";
import Link from "next/link";
import { ShodoDesk } from "@/components/shodo-desk";
import { BrushHeading } from "@/components/brush-heading";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Shodo Practice Desk", description: "A quiet washi sheet, a dry-bristle ink brush, and a daily kanji to trace." };
export default function ShodoPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div><p className="caption"><Link href="/play">← Play</Link> / a quiet practice</p><h1 className="mt-4 text-4xl font-serif"><BrushHeading>Shodo Practice Desk</BrushHeading></h1><ShodoDesk /></div></ViewTransition>;
}
