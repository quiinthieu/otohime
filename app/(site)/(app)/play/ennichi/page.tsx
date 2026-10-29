import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { EnnichiScene } from "./_components/ennichi-scene";
import "./ennichi.css";

export const metadata: Metadata = {
  title: "Ennichi Night",
  description: "A shrine festival printed in four misregistered inks. Seek seven small otohime keepsakes and take the stamp home.",
  twitter: { card: "summary_large_image" },
};

export default function EnnichiPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise ennichi-page">
        <FigTitle n="03f" hint="four-colour Showa offset · seek & find">Ennichi Night</FigTitle>
        <p className="mt-2 text-muted">
          A night festival, printed a little out of register. Pan the sheet, raise the lantern when you are stuck, and find seven small keepsakes hidden in the stalls.
        </p>
        <EnnichiScene />
        <p className="mt-8"><Link className="link" href="/play">Back to Play</Link></p>
      </div>
    </ViewTransition>
  );
}
