import { TheatreLoader } from "@/components/kamishibai/loader";
import { DeparturesBoard } from "@/components/departures-board";
import { buildProjectDepartures } from "@/lib/departures";
import { ProjectStories } from "@/components/kamishibai/stories";
import { RisoText } from "@/components/riso-heading";
import { Cartridge } from "@/components/cartridge";
import { DarumaBoard } from "@/components/daruma-board";
import { FigTitle, Notice } from "@/components/figures";
import { site } from "@/content/site";
import { peekMark, peekTags } from "@/lib/peek-marks";
import { peekSlug } from "@/lib/peeks";
import type { Metadata } from "next";
import Link from "next/link";
import { type CSSProperties, ViewTransition } from "react";
import "./daruma.css";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="06" morph="/projects" hint="own time">
          Projects
        </FigTitle>
        <p className="mt-2 text-muted">{site.projects}</p>
        <DeparturesBoard kind="projects" rows={buildProjectDepartures()} />
        {site.projectList.length === 0 ? (
          <div className="mt-8">
            <Notice n="—" title="Nothing on the bench yet" figure="parcel" heading="h2">
              <p className="text-muted">Check back later.</p>
            </Notice>
          </div>
        ) : (
          <DarumaBoard projects={site.projectList}>
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
                            {...peekMark(`project:${peekSlug(project.title)}`)}
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
          </DarumaBoard>
        )}
        <TheatreLoader><ProjectStories /></TheatreLoader>
        <GazetteDesks />
      </div>
    </ViewTransition>
  );
}

// The Gazette's desks as tags: each goes to the paper's front page and peeks at three pieces near it.
function GazetteDesks() {
  const tags = peekTags();
  if (tags.length === 0) return null;
  return (
    <section aria-labelledby="desks" className="mt-10">
      <h2 id="desks" className="caption"><RisoText>Gazette desks</RisoText></h2>
      <ul className="peek-tags mt-2">
        {tags.map(({ key, label }) => (
          <li key={key}>
            <Link href="/articles" className="badge" {...peekMark(key)}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
