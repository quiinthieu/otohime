import { FigTitle } from "@/components/figures";
import rawMakingOf from "@/content/making-of.json";
import { readMakingOf } from "@/lib/making-of";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { EmakiScroll } from "./_components/emaki-scroll";
import "./making-of.css";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Making-of+Emaki&path=%2Fmaking-of", width: 1200, height: 630, alt: "Making-of Emaki, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "Making-of Emaki",
  description:
    "A horizontal ink-and-washi handscroll (emaki) tracing how AI agent roles collaborate across plans to build otohime.dev.",
};

export default function MakingOfPage() {
  const snapshot = readMakingOf(rawMakingOf);

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="02c" hint="agent handscroll · ink & washi">
          Making-of Emaki
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          An unrolling picture handscroll (<em>emaki</em>) of the plans that built this site. In each scene, four
          reusable sumi-ink figures—Researcher, Product Owner, Software Engineer, and Quality Engineer—pass the scroll
          along with the public model ID per role and the commit receipt on GitHub.
        </p>

        <EmakiScroll scenes={snapshot.scenes} head={snapshot.head} />

        <p className="mt-8">
          <Link href="/work" className="link">
            Back to Work
          </Link>
        </p>
      </div>
    </ViewTransition>
  );
}
