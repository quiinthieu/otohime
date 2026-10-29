import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import { InkLab } from "@/components/ink-lab";
import { RisoHeading } from "@/components/riso-heading";
import "@/components/ink-lab.css";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Ink+Lab&path=%2Flab", width: 1200, height: 630, alt: "Ink Lab, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: "Ink Lab",
  description: "A public proof sheet for Otohime. Mix ink, paper and print plates; share a recipe or try it for this tab session.",
};

export default function LabPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><section aria-labelledby="lab-title">
    <p className="caption">Materials / proof no. 01</p>
    <RisoHeading as="h1" id="lab-title" className="lab-title">Ink Lab</RisoHeading>
    <p className="lab-intro">A little print shop for this very site. Tune the proof, share the recipe, or take the ink for a walk.</p>
    <Suspense fallback={<p role="status" className="lab-loading">Laying out the proof sheet… The controls need JavaScript.</p>}>
      <InkLab />
    </Suspense>
  </section></ViewTransition>;
}
