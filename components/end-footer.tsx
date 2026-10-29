import { PaperHost } from "@/components/paper-host";
import { BottleButton } from "@/components/bottle/button";
import { RisoText } from "@/components/riso-heading";
import { EndStage, EndTop } from "@/components/end-stage";
import { SusukiFieldLoader } from "@/components/susuki-field-loader";
import { swatches } from "@/components/figures";
import { site } from "@/content/site";
import { away } from "@/lib/end";
import { CONSOLE_MENU } from "@/lib/pages";
import { PALACE_HREF } from "@/lib/urashima";
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
          <div className="relative min-w-0">
            <BottleButton entry="footer" />
            <EndStage />
          </div>

          <div className="end-copy">
            <p className="caption">{site.end.status}</p>
            <h2 id="end-title" className="end-title">
              <span className="end-title-text"><RisoText>{site.end.title}</RisoText></span>
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
                {/* A plain <a>: /zine is its own root layout, so it is a full page load. Not in CONSOLE_MENU: it is a
                   sheet to print, not a room. */}
                <a href="/zine" data-end-zine="" className="end-page-link mt-1">
                  <small aria-hidden="true">Print</small>
                  <span>Print a zine</span>
                </a>
              </nav>

              <div className="end-rise" style={{ "--i": 2 } as CSSProperties}>
                <p className="caption mb-2.5">Lines</p>
                <ul className="end-lines">
                  {site.lines.map((line) => (
                    <PaperHost as="li" key={line.label} data-paper-id={`line:${encodeURIComponent(line.label)}`} data-tossable="true" data-paper-fetch-only="true" data-paper-label={line.label}>
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
                    </PaperHost>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="paper-basket-slot" data-paper-basket-slot="">
          <svg data-paper-basket="" className="paper-basket" viewBox="0 0 148 100" role="img" aria-label="Wastepaper basket">
            <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M14 14Q74 7 134 14L117 92Q74 98 31 92Z" />
              <path d="M14 14Q74 23 134 14M26 32L124 50M29 52L120 70M32 73L116 89M38 19L47 93M61 20L65 95M86 20L83 95M109 18L101 94" />
            </g>
          </svg>
        </div>
        <PaperHost id="kame-shell" />

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

      <div className="end-susuki" aria-hidden="true">
        <SusukiFieldLoader />
      </div>

      {/* Below the waterline, past everything else: the way down to Ryugu-jo. A plain <a>: the palace is its own root
         layout (app/(ryugu)/), so it is a full page load. */}
      <div className="end-waterline" data-end-waterline="">
        <svg className="end-wave" viewBox="0 0 1000 16" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 8Q25 0 50 8T100 8T150 8T200 8T250 8T300 8T350 8T400 8T450 8T500 8T550 8T600 8T650 8T700 8T750 8T800 8T850 8T900 8T950 8T1000 8V16H0Z" />
        </svg>
        <p className="end-deep">
          <a href={PALACE_HREF} data-end-ryugu="" className="end-ryugu-link">
            {site.end.below}
          </a>
        </p>
      </div>
    </footer>
  );
}
