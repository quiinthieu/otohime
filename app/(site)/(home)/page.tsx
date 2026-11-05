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
        <section className="space-y-6 pt-2">
          <div className="space-y-2">
            <p className="caption">Engineering Portfolio</p>
            <h1 className="text-[clamp(2.25rem,5vw,3.25rem)] font-semibold tracking-tight leading-[1.1]">
              Otohime
            </h1>
            <p className="text-[15px] font-medium text-ink">{site.tagline}</p>
          </div>
          <div className="max-w-2xl space-y-3 text-muted">
            {site.bio.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/work" className="btn btn-primary">
              Work & Stack
            </Link>
            <Link href="/projects" className="btn">
              Browse Curiosities ({site.projectList.length})
            </Link>
            <Link href="/notes" className="btn">
              Read Notes
            </Link>
          </div>
        </section>

        <section aria-labelledby="now-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="now-heading" className="caption">
              Now
            </h2>
            <span className="caption">Current focus</span>
          </div>
          <dl>
            {site.now.map(({ what, note }) => (
              <div key={what} className="spec-row">
                <dt className="text-muted">{what}</dt>
                <dd>{note}</dd>
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
                className="rise project-card"
                style={{ "--i": i } as CSSProperties}
              >
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">
                      {project.href ? (
                        <a href={project.href} className="row-link hover:underline underline-offset-4">
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </h3>
                    <span className="badge">{project.status}</span>
                  </div>
                  <p className="text-muted">{project.note}</p>
                </div>
                {project.href && (
                  <p className="caption flex items-center gap-1 pt-1">
                    <span>{project.href}</span>
                    <span aria-hidden="true">↗</span>
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
              <li key={slug} className="py-4 first:pt-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="font-semibold">
                    <Link
                      href={`/notes/${slug}`}
                      className="underline decoration-line underline-offset-4 hover:decoration-ink"
                    >
                      {title}
                    </Link>
                  </h3>
                  <time dateTime={date} className="caption shrink-0">
                    {date}
                  </time>
                </div>
                <p className="mt-1 max-w-2xl text-muted">{body}</p>
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
                    className="row-link font-semibold hover:underline underline-offset-4"
                    {...away(line.href)}
                  >
                    {line.label}
                  </a>
                  <span className="badge">{line.code}</span>
                </div>
                <p className="text-muted">{line.handle}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ViewTransition>
  );
}
