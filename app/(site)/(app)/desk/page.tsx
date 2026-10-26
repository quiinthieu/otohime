import { FigTitle } from "@/components/figures";
import type { Metadata } from "next";
import { ViewTransition } from "react";
import { InkDesk } from "./_components/ink-desk";
import "./desk.css";

export const metadata: Metadata = { title: "Desk" };

// The Ink Desk: the site as a paper desk seen from above, a cartridge on the pocket console. Opt-in: the
// default home is unchanged.
export default function DeskPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="08" morph="/desk" hint="drag anything">
          Desk
        </FigTitle>
        <p className="mt-2 text-muted">
          The whole site, spread out on the desk. Push things around; the desk remembers where you left them.
        </p>
        <div className="mt-8">
          <InkDesk labels={{ tidy: "Tidy up", cork: "Pinned projects" }} />
        </div>
      </div>
    </ViewTransition>
  );
}
