import { site } from "@/content/site";
import { away } from "@/lib/end";
import { PUBLIC_PAGES } from "@/lib/pages";
import { cacheLife } from "next/cache";
import Link from "next/link";

async function EndYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getUTCFullYear()}</>;
}

export function EndFooter() {
  return (
    <footer className="end" aria-label="Footer">
      <div className="end-inner mx-auto max-w-4xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-start">
          <div className="space-y-1.5">
            <p className="font-semibold tracking-[0.02em]">Otohime</p>
            <p className="text-[12px] text-muted">{site.tagline}</p>
          </div>

          <div className="flex flex-wrap gap-x-12 gap-y-6">
            <nav aria-label="Footer navigation">
              <p className="caption mb-2">Pages</p>
              <ul className="space-y-1.5">
                {PUBLIC_PAGES.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} data-end-page={href} className="link text-muted hover:text-ink">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className="caption mb-2">Elsewhere</p>
              <ul className="space-y-1.5">
                {site.lines.map((line) => (
                  <li key={line.label}>
                    <a
                      href={line.href}
                      data-end-line={line.label}
                      className="link text-muted hover:text-ink"
                      {...away(line.href)}
                    >
                      {line.label}
                    </a>
                  </li>
                ))}
              </ul>
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
          <a href="#main" className="link text-[12px] text-muted hover:text-ink">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
