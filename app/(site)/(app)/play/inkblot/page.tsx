import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import InkblotStudio from "./_components/inkblot-studio";
import "./inkblot.css";

export const metadata: Metadata = {
  title: "Ink Blot Test",
  description: "Drip sumi on half a sheet, fold a symmetric blot, and write what you see. A paper-and-ink toy.",
  twitter: { card: "summary_large_image" },
};

export default function InkblotPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise inkblot-page">
        <FigTitle n="03d" hint="fold the sheet · symmetric sumi blot">Ink Blot Test</FigTitle>
        <p className="mt-2 text-muted">
          Drip ink on the left half, fold the sheet, and tell the paper ward what you see. A toy, not a diagnosis.
        </p>
        <InkblotStudio />
        <p className="mt-8"><Link className="link" href="/play">Back to Play</Link></p>
      </div>
    </ViewTransition>
  );
}
