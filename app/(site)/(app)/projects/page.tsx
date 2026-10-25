import { Cartridge } from "@/components/cartridge";
import { FigTitle, Notice } from "@/components/figures";
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
          <ul className="cartridges mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-6 sm:gap-y-7 lg:grid-cols-3">
            {site.projectList.map((project, i) => (
              <li key={project.title} className="rise cartridge-slot" style={{ "--i": i } as CSSProperties}>
                <Cartridge project={project}>
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
                  <span className="cartridge-note">{project.note}</span>
                </Cartridge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ViewTransition>
  );
}
