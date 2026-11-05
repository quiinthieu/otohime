import { Pipeline } from "@/components/pipeline";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Work" };

const PRINCIPLES = [
  {
    title: "Idempotent by default",
    body: "Backfills and replays should be safe to run at any hour without manual state surgery or duplicate downstream rows.",
  },
  {
    title: "Contracts at the boundary",
    body: "Schemas, freshness SLAs, and row-count invariants belong at ingestion and mart boundaries before bad data fans out.",
  },
  {
    title: "Calm operations",
    body: "Boring, observable DAGs with deterministic SQL and clear lineage beat clever pipelines that page at 3 a.m.",
  },
] as const;

export default function WorkPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise space-y-14">
        <header className="space-y-3">
          <p className="caption">Data Engineering</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Work</h1>
          <p className="max-w-2xl text-muted">{site.work}</p>
        </header>

        <section aria-labelledby="principles-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="principles-heading" className="caption">
              Principles
            </h2>
            <span className="caption">How I build</span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((item) => (
              <li key={item.title} className="project-card justify-start">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="stack-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="stack-heading" className="caption">
              Technical Stack
            </h2>
            <span className="caption">Extract · Transform · Load</span>
          </div>
          <dl>
            {site.stack.map(({ what, tools, note }) => (
              <div key={what} className="spec-row sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted">{what}</dt>
                <dd className="space-y-0.5">
                  <span className=" block font-semibold">{tools}</span>
                  <span className="block text-muted">{note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="pipeline-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="pipeline-heading" className="caption">
              Interactive Pipeline
            </h2>
            <span className="caption">Batch &amp; stream simulation</span>
          </div>
          <Pipeline />
        </section>
      </div>
    </ViewTransition>
  );
}
