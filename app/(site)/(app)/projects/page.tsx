import { site } from "@/content/site";
import { projectTargetId } from "@/lib/fortune-targets";
import type { Metadata } from "next";
import { type CSSProperties, ViewTransition } from "react";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise space-y-14">
        <header className="space-y-3 pt-2">
          <div className="inline-flex max-w-full items-center gap-2 rounded-2xl sm:rounded-full border border-line bg-paper-2/60 px-3 py-1.5 sm:py-1 backdrop-blur-xs">
            <span className="inline-block size-2 shrink-0 rounded-full bg-yellow" aria-hidden="true" />
            <p className="caption tracking-[0.06em] sm:tracking-[0.1em] break-words">Bespoke Software &amp; Interactive Experiments</p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-ink">Projects</h1>
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink/85">{site.projects}</p>
        </header>

        <section aria-labelledby="curiosities-grid-heading" className="space-y-5">
          <div className="section-head">
            <h2 id="curiosities-grid-heading" className="caption">
              Directory ({site.projectList.length})
            </h2>
            <span className="caption">Tactile software &amp; computational models</span>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {site.projectList.map((project, i) => (
              <li
                id={project.href ? undefined : projectTargetId(project.title)}
                key={project.title}
                className="rise project-card group"
                style={{ "--i": i } as CSSProperties}
              >
                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold tracking-tight text-ink text-[15px]">
                      <span className="mr-2.5 text-[11px] font-mono font-medium text-muted/70">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {project.href ? (
                        // The title travels to the project's h1 on the hop: globals.css names it from --vt.
                        <a
                          href={project.href}
                          className="project-title row-link hover:underline underline-offset-4"
                          style={{ "--vt": `project-${project.href.slice(1)}` } as CSSProperties}
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </span>
                    <span className="badge" data-tone="ok">{project.status}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted">{project.note}</p>
                </div>
                {project.href && (
                  <p className="caption flex items-center justify-between pt-1 text-muted/80 group-hover:text-ink">
                    <span className="font-mono text-[11px]">{project.href}</span>
                    <span aria-hidden="true" className="font-sans font-medium text-ink transition-transform duration-150 group-hover:translate-x-0.5">
                      Open ↗
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="editions-heading" className="space-y-4">
          <div className="section-head">
            <h2 id="editions-heading" className="caption">
              Print &amp; Special Editions
            </h2>
            <span className="caption">Standalone tactile layouts</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="project-card group">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <a href="/zine" className="row-link font-semibold tracking-tight text-[15px] hover:underline underline-offset-4">
                    Print Zine Edition
                  </a>
                  <span className="badge" data-tone="ok">print</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">
                  A single-sheet broadside version of the site formatted for folding and printing on paper.
                </p>
              </div>
              <p className="caption flex items-center justify-between pt-1 text-muted/80 group-hover:text-ink">
                <span className="font-mono text-[11px]">/zine</span>
                <span aria-hidden="true" className="font-sans font-medium text-ink transition-transform duration-150 group-hover:translate-x-0.5">
                  Open edition ↗
                </span>
              </p>
            </div>
            <div className="project-card group">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <a href="/ryugu" className="row-link font-semibold tracking-tight text-[15px] hover:underline underline-offset-4">
                    Ryūgū-jō
                  </a>
                  <span className="badge" data-role="owner">edition</span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">
                  An alternate deep-sea colophon and archive beneath the main site.
                </p>
              </div>
              <p className="caption flex items-center justify-between pt-1 text-muted/80 group-hover:text-ink">
                <span className="font-mono text-[11px]">/ryugu</span>
                <span aria-hidden="true" className="font-sans font-medium text-ink transition-transform duration-150 group-hover:translate-x-0.5">
                  Open archive ↗
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </ViewTransition>
  );
}
