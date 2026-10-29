import { RisoText } from "@/components/riso-heading";
import { DeparturesBoard } from "@/components/departures-board";
import { buildWorkDepartures } from "@/lib/departures";
import { Conveyor } from "@/components/conveyor";
import { FigTitle } from "@/components/figures";
import { Pipeline } from "@/components/pipeline";
import { ServerRack } from "@/components/server-rack";
import { site } from "@/content/site";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Work" };

export default function WorkPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="02" morph="/work" hint="extract, transform, load">
          Work
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">{site.work}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/ledger" className="link">
            The year in ink stamps
          </Link>
          <Link href="/timeline" className="link">Pop-up Book Timeline</Link>
          <Link href="/ledger/sql" className="link">Ink Ledger SQL desk</Link>
          <span aria-hidden="true" className="text-muted">
            ·
          </span>
          <Link href="/making-of" className="link">
            Making-of Emaki handscroll
          </Link>
        </p>
        <DeparturesBoard kind="work" rows={buildWorkDepartures()} />
        <div className="mt-8">
          <Pipeline />
        </div>
        <div className="mt-14">
          <Conveyor />
        </div>
        <div className="mt-14 grid items-start gap-12 lg:grid-cols-2">
          <section aria-labelledby="stack">
            <h2 id="stack" className="caption"><RisoText>Stack</RisoText></h2>
            <dl className="mt-3">
              {site.stack.map(({ what, tools, note }) => (
                <div key={what} className="grid gap-x-6 border-t border-line py-3 sm:grid-cols-[9rem_1fr]">
                  <dt className="text-muted">{what}</dt>
                  <dd>
                    <span className="font-semibold">{tools}</span>
                    <span className="block text-muted">{note}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <ServerRack />
        </div>
      </div>
    </ViewTransition>
  );
}
