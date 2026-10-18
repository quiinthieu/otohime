import { Handheld } from "@/components/handheld";
import { Switchboard } from "@/components/switchboard";
import { site } from "@/content/site";
import { ViewTransition } from "react";

// The front page: a pocket console boots up and its menu is the way in.
// The sidebar waits on the pages behind it; the rest is below the fold.
export default function HomePage() {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <section className="grid min-h-[calc(100dvh-8rem)] items-center gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div>
            <p className="caption">Fig. 01 — Home</p>
            <h1 className="mt-3 text-[clamp(2.5rem,8vw,4.5rem)] leading-none">Otohime</h1>
            <p className="mt-4 text-[15px] font-semibold">{site.tagline}</p>
            <p className="mt-6 max-w-sm text-muted">
              Pick a page on the console: ▲ ▼ or the arrow keys, then A or Enter.
            </p>
          </div>
          <Handheld />
        </section>
        <section aria-labelledby="about" className="mt-8 grid items-start gap-x-12 gap-y-8 border-t border-line pt-8 lg:grid-cols-2">
          <div>
            <h2 id="about" className="caption">
              About
            </h2>
            {site.bio.map((line) => (
              <p key={line} className="mt-3 max-w-prose text-muted">
                {line}
              </p>
            ))}
          </div>
          <div>
            <h2 className="caption">Now</h2>
            <dl className="mt-2">
              {site.now.map(({ what, note }) => (
                <div key={what} className="grid grid-cols-[6rem_1fr] gap-x-4 border-t border-line py-2.5">
                  <dt className="text-muted">{what}</dt>
                  <dd>{note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <section aria-labelledby="elsewhere" className="mt-12">
          <h2 id="elsewhere" className="caption">
            Elsewhere
          </h2>
          <div className="mt-4">
            <Switchboard lines={site.lines} />
          </div>
        </section>
      </div>
    </ViewTransition>
  );
}
