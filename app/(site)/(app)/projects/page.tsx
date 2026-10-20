import { FigTitle, Notice, swatches } from "@/components/figures";
import { site } from "@/content/site";
import type { Metadata } from "next";
import { type CSSProperties, ViewTransition } from "react";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="06" hint="own time">
          Projects
        </FigTitle>
        <p className="mt-2 text-muted">{site.projects}</p>
        {site.projectList.length === 0 ? (
          <div className="mt-8">
            <Notice n="—" title="Nothing on the bench yet" figure="parcel" heading="h2">
              <p className="text-muted">Check back later.</p>
            </Notice>
          </div>
        ) : (
          <ul className="mt-8 grid gap-x-10 sm:grid-cols-2">
            {site.projectList.map((project, i) => (
              <li
                key={project.title}
                className="rise flex items-start gap-3 border-t border-line py-3"
                style={{ "--i": i } as CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className="mt-1 size-3 flex-none rounded-full border border-on-swatch"
                  style={{ background: swatches[project.colour] }}
                />
                <span>
                  <span className="block">
                    <span className="font-semibold">
                      {project.href ? (
                        // The title travels to the project's h1 on the hop: globals.css names it from --vt.
                        <a
                          href={project.href}
                          className="project-title"
                          style={{ "--vt": `project-${project.href.slice(1)}` } as CSSProperties}
                        >
                          {project.title}
                        </a>
                      ) : (
                        project.title
                      )}
                    </span>{" "}
                    <span className="badge">{project.status}</span>
                  </span>
                  <span className="text-muted">{project.note}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ViewTransition>
  );
}
