import { site } from "@/content/site";
import { away } from "@/lib/end";
import Link from "next/link";
import { type CSSProperties, ViewTransition } from "react";

const FEATURED_PROJECTS = site.projectList.slice(0, 6);
const RECENT_NOTES = site.notes.slice(0, 3);

export default function HomePage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise space-y-16">
        <section className="space-y-6 pt-3">
          <div className="space-y-3.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-2/60 px-3 py-1 backdrop-blur-xs">
              <span className="inline-block size-2 rounded-full bg-yellow" aria-hidden="true" />
              <p className="caption tracking-[0.1em]">Otohime · Staff Data Platform Architect &amp; Systems Engineer</p>
            </div>
            <h1 className="text-[clamp(2.75rem,6vw,4.25rem)] font-bold tracking-[-0.03em] leading-[1.06] text-ink">
              Otohime
            </h1>
            <p className="text-[17px] font-medium leading-relaxed text-ink/90">{site.tagline}</p>
          </div>
          <div className="max-w-2xl space-y-3.5 text-[14px] leading-relaxed text-muted">
            {site.bio.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/work" className="btn btn-primary">
              Work &amp; Stack
            </Link>
            <Link href="/projects" className="btn">
              Browse Curiosities ({site.projectList.length})
            </Link>
            <Link href="/notes" className="btn">
              Read Notes
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-line/60">
            <div className="card p-3 space-y-1">
              <span className="caption block">Throughput</span>
              <p className="font-mono text-[14px] font-semibold text-ink">10B+ daily events</p>
            </div>
            <div className="card p-3 space-y-1">
              <span className="caption block">SLA Guarantees</span>
              <p className="font-mono text-[14px] font-semibold text-ink">&lt;120ms P99 latency</p>
            </div>
            <div className="card p-3 space-y-1">
              <span className="caption block">Craft &amp; Systems</span>
              <p className="font-mono text-[14px] font-semibold text-ink">11 live exhibits</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="now-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="now-heading" className="caption">
              Now
            </h2>
            <span className="caption">Current focus</span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {site.now.map(({ what, note }, idx) => (
              <div
                key={what}
                className="card p-4 space-y-2 border-line/80 hover:border-ink/40 transition-colors duration-150"
              >
                <div className="flex items-center justify-between">
                  <dt className="text-muted font-mono text-[12px] uppercase tracking-wider font-semibold">
                    {what}
                  </dt>
                  <span className="text-[10px] font-mono text-muted/60">0{idx + 1}</span>
                </div>
                <dd className="text-[13px] leading-relaxed text-ink/90">{note}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="curiosities-heading" className="space-y-5">
          <div className="section-head">
            <h2 id="curiosities-heading" className="caption">
              Selected Curiosities
            </h2>
            <Link href="/projects" className="link text-[12px] text-muted hover:text-ink">
              All {site.projectList.length} projects →
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {FEATURED_PROJECTS.map((project, i) => (
              <li
                key={project.title}
                className="rise project-card group"
                style={{ "--i": i } as CSSProperties}
              >
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold tracking-tight">
                      {project.href ? (
                        <a href={project.href} className="row-link hover:underline underline-offset-4">
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    <span className="badge" data-tone="ok">{project.status}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted">{project.note}</p>
                </div>
                {project.href && (
                  <p className="caption flex items-center justify-between pt-1 text-muted/80 group-hover:text-ink">
                    <span className="font-mono text-[11px]">{project.href}</span>
                    <span aria-hidden="true" className="font-sans font-medium transition-transform duration-150 group-hover:translate-x-0.5">Open ↗</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="notes-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="notes-heading" className="caption">
              Recent Notes
            </h2>
            <Link href="/notes" className="link text-[12px] text-muted hover:text-ink">
              All notes →
            </Link>
          </div>
          <ol className="divide-y divide-line">
            {RECENT_NOTES.map(({ slug, date, title, body }) => (
              <li key={slug} className="py-4.5 first:pt-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="font-semibold tracking-tight">
                    <Link
                      href={`/notes/${slug}`}
                      className="underline decoration-line underline-offset-4 hover:decoration-ink transition-colors duration-150"
                    >
                      {title}
                    </Link>
                  </h3>
                  <time dateTime={date} className="caption shrink-0 font-mono">
                    {date}
                  </time>
                </div>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="elsewhere-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="elsewhere-heading" className="caption">
              Elsewhere
            </h2>
            <span className="caption">Direct channels</span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {site.lines.map((line) => (
              <li key={line.label} className="project-card">
                <div className="flex items-baseline justify-between gap-3">
                  <a
                    href={line.href}
                    className="row-link font-semibold tracking-tight hover:underline underline-offset-4"
                    {...away(line.href)}
                  >
                    {line.label}
                  </a>
                  <span className="badge">{line.code}</span>
                </div>
                <p className="text-[13px] text-muted">{line.handle}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ViewTransition>
  );
}
