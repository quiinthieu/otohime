import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import SenkoLoader from "./_components/senko-loader";
import "./senko.css";

export const metadata: Metadata = {
  title: "Senko Hanabi",
  description: "A little summer held between your fingers. Light an ink sparkler, keep your hand still, and watch four fleeting flowers bloom.",
  twitter: { card: "summary_large_image" },
};

export default function SenkoPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise senko-page">
        <FigTitle n="03e" hint="線香花火 · a small summer ritual">Senko Hanabi</FigTitle>
        <p className="mt-2 text-muted">One paper stem. Four fleeting flowers. Hold gently; the smallest ember has a whole summer in it.</p>
        <SenkoLoader />
        <p className="mt-8"><Link className="link" href="/play">Back to Play</Link></p>
      </div>
    </ViewTransition>
  );
}
