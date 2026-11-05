import { site } from "@/content/site";
import { projectTargetId } from "@/lib/fortune-targets";
import type { Metadata } from "next";
import { type CSSProperties, ViewTransition } from "react";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise space-y-12">
        <header className="space-y-3">
          <p className="caption">Curiosities &amp; Standalone Experiments</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h1>
          <p className="max-w-2xl text-muted">{site.projects}</p>
        </header>

        <section aria-labelledby="curiosities-grid-heading" className="space-y-5">
          <div className="section-head">
            <h2 id="curiosities-grid-heading" className="caption">
              Directory ({site.projectList.length})
            </h2>
            <span className="caption">Interactive web experiments</span>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {site.projectList.map((project, i) => (
              <li
                id={project.href ? undefined : projectTargetId(project.title)}
                key={project.title}
                className="rise project-card"
                style={{ "--i": i } as CSSProperties}
              >
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">
                      <span className="mr-2 text-[11px] font-normal text-muted">
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
                    <span className="badge">{project.status}</span>
                  </div>
                  <p className="text-muted">{project.note}</p>
                </div>
                {project.href && (
                  <p className="caption flex items-center justify-between pt-1">
                    <span>{project.href}</span>
                    <span aria-hidden="true">Open ↗</span>
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
            <span className="caption">Standalone layouts</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="project-card">
              <div className="flex items-baseline justify-between gap-3">
                <a href="/zine" className="row-link font-semibold hover:underline underline-offset-4">
                  Print Zine Edition
                </a>
                <span className="badge">print</span>
              </div>
              <p className="text-muted">
                A single-sheet broadside version of the site formatted for folding and printing on paper.
              </p>
            </div>
            <div className="project-card">
              <div className="flex items-baseline justify-between gap-3">
                <a href="/ryugu" className="row-link font-semibold hover:underline underline-offset-4">
                  Ryūgū-jō
                </a>
                <span className="badge">edition</span>
              </div>
              <p className="text-muted">
                An alternate deep-sea colophon and archive beneath the main site.
              </p>
            </div>
          </div>
        </section>
      </div>
    </ViewTransition>
  );
}
