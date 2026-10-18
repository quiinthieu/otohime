import { FigTitle } from "@/components/figures";
import { Handheld } from "@/components/handheld";
import { site } from "@/content/site";
import { ViewTransition } from "react";

// The public front page, for everyone.
export default function HomePage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="01" hint={site.tagline.toLowerCase()}>
          Otohime
        </FigTitle>
        <div className="mt-8 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[15px] font-semibold">{site.tagline}</p>
            {site.bio.map((line) => (
              <p key={line} className="mt-3 max-w-prose text-muted">
                {line}
              </p>
            ))}
            <h2 className="caption mt-10">Now</h2>
            <dl className="mt-2">
              {site.now.map(({ what, note }) => (
                <div key={what} className="grid grid-cols-[6rem_1fr] gap-x-4 border-t border-line py-2.5">
                  <dt className="text-muted">{what}</dt>
                  <dd>{note}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-8 flex flex-wrap gap-3">
              {site.links.map(({ label, href }) => (
                <li key={href}>
                  <a href={href} className="btn">
                    {label} <span aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <Handheld />
        </div>
      </div>
    </ViewTransition>
  );
}
