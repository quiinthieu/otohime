import { Pipeline } from "@/components/pipeline";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Work" };

const PRINCIPLES = [
  {
    title: "Idempotent by default",
    body: "Replays and multi-terabyte backfills must be zero-friction operations. If state cannot be safely recomputed in an afternoon, the architecture is broken.",
    accent: "before:from-yellow/80 before:to-yellow/20",
  },
  {
    title: "Contracts at the boundary",
    body: "Strict schema contracts, freshness SLAs, and column invariants belong at ingestion gates before corrupted data can reach analytical marts or financial models.",
    accent: "before:from-mint/80 before:to-mint/20",
  },
  {
    title: "Calm operations",
    body: "Deterministic distributed DAGs, sub-second streaming topologies, and observable lakehouse lineage beat clever, brittle pipelines that page at 3 a.m.",
    accent: "before:from-blue/80 before:to-blue/20",
  },
] as const;

export default function WorkPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise space-y-16">
        <header className="space-y-4 pt-2">
          <div className="inline-flex max-w-full items-center gap-2 rounded-2xl sm:rounded-full border border-line bg-paper-2/60 px-3 py-1.5 sm:py-1 backdrop-blur-xs">
            <span className="inline-block size-2 shrink-0 rounded-full bg-yellow" aria-hidden="true" />
            <p className="caption tracking-[0.06em] sm:tracking-[0.1em] break-words">Staff Data Platform Architecture</p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-ink">Work</h1>
          <p className="max-w-3xl text-[15px] leading-relaxed text-ink/85">{site.work}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-line/60">
            <div className="card p-3 space-y-1">
              <span className="caption block">Distributed Ingestion</span>
              <p className="font-mono text-[13px] font-semibold text-ink">10B+ daily events via Kafka</p>
            </div>
            <div className="card p-3 space-y-1">
              <span className="caption block">Lakehouse Storage</span>
              <p className="font-mono text-[13px] font-semibold text-ink">Apache Iceberg on S3</p>
            </div>
            <div className="card p-3 space-y-1">
              <span className="caption block">Analytical Compute</span>
              <p className="font-mono text-[13px] font-semibold text-ink">Snowflake · dbt · DuckDB</p>
            </div>
          </div>
        </header>

        <section aria-labelledby="principles-heading" className="space-y-5">
          <div className="section-head">
            <h2 id="principles-heading" className="caption">
              Principles
            </h2>
            <span className="caption">Operational philosophy</span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {PRINCIPLES.map((item, idx) => (
              <li
                key={item.title}
                className={`project-card justify-start relative overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r ${item.accent}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold tracking-tight text-ink text-[14.5px]">{item.title}</h3>
                  <span className="text-[10.5px] font-mono font-medium text-muted/80">0{idx + 1}</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="stack-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="stack-heading" className="caption">
              Technical Stack
            </h2>
            <span className="caption">7-Layer Systems Architecture</span>
          </div>
          <dl className="divide-y divide-line/60 border-t border-b border-line/60">
            {site.stack.map(({ what, tools, note }, idx) => (
              <div
                key={what}
                className="spec-row sm:grid-cols-[12rem_1fr] hover:bg-paper-2/40 px-3 py-3.5 rounded-lg transition-colors duration-150"
              >
                <dt className="flex items-center gap-2 text-muted font-medium text-[12.5px]">
                  <span className="font-mono text-[10px] text-muted/60 uppercase">L{idx + 1}</span>
                  <span>{what}</span>
                </dt>
                <dd className="space-y-1">
                  <span className="block font-semibold tracking-tight text-ink font-mono text-[13px]">{tools}</span>
                  <span className="block text-[13px] leading-relaxed text-muted">{note}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="pipeline-heading" className="space-y-4">
          <div className="section-head">
            <div className="flex items-center gap-2">
              <h2 id="pipeline-heading" className="caption">
                Interactive Pipeline
              </h2>
              <span className="badge" data-tone="ok">Live Engine</span>
            </div>
            <span className="caption">Stream &amp; batch processing simulation</span>
          </div>
          <div className="rounded-xl border border-line bg-field/70 p-4 sm:p-6 backdrop-blur-md shadow-xs">
            <Pipeline />
          </div>
        </section>
      </div>
    </ViewTransition>
  );
}
