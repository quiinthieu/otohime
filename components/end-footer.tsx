import { EndStage, EndTop } from "@/components/end-stage";
import { swatches } from "@/components/figures";
import { site } from "@/content/site";
import { away } from "@/lib/end";
import { CONSOLE_MENU } from "@/lib/pages";
import { cacheLife } from "next/cache";
import Link from "next/link";
import type { CSSProperties } from "react";

async function EndYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getUTCFullYear()}</>;
}

export function EndFooter() {
  return (
    <footer className="end" aria-labelledby="end-title">
      <div className="end-inner mx-auto max-w-5xl px-5 sm:px-8">
        <div className="end-grid">
          <EndStage />

          <div className="end-copy">
            <p className="caption">{site.end.status}</p>
            <h2 id="end-title" className="end-title">
              <span className="end-title-text">{site.end.title}</span>
            </h2>
            <p className="end-sub end-rise" style={{ "--i": 0 } as CSSProperties}>
              {site.end.sub}
            </p>

            <div className="end-links">
              <nav
                aria-label="Footer"
                className="end-rise"
                style={{ "--i": 1 } as CSSProperties}
              >
                <p className="caption mb-2.5">Pages</p>
                <ul className="end-pages">
                  {CONSOLE_MENU.map(({ href, label }, i) => (
                    <li key={href}>
                      <Link href={href} data-end-page={href} className="end-page-link">
                        <small aria-hidden="true">
                          Fig. {String(i + 2).padStart(2, "0")}
                        </small>
                        <span>{label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="end-rise" style={{ "--i": 2 } as CSSProperties}>
                <p className="caption mb-2.5">Lines</p>
                <ul className="end-lines">
                  {site.lines.map((line) => (
                    <li key={line.label}>
                      <a
                        href={line.href}
                        data-end-line={line.label}
                        className="chip end-line-link"
                        style={{ "--fig": swatches[line.colour] } as CSSProperties}
                        {...away(line.href)}
                      >
                        <span className="end-line-code" aria-hidden="true">
                          {line.code}
                        </span>
                        <span>{line.label}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="end-bar">
          <p className="end-credits">
            <span data-end-signature="">{site.end.signature}</span>
            <span aria-hidden="true" className="end-dot">
              ·
            </span>
            <span data-end-copyright="">
              © <EndYear /> Otohime
            </span>
          </p>
          <EndTop />
        </div>
      </div>
    </footer>
  );
}
