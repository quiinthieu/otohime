import Link from "next/link";
import { neighbours } from "../_lib/bodies.ts";

// The parts every Orrery page shares: the top bar's ways out, and Previous /
// Next in the one fixed order of bodies.

export function TopBar({ orrery = true }: { orrery?: boolean }) {
  return (
    <header className="topbar">
      <nav className="ways-out" aria-label="Site">
        {/* A plain <a>: / is in another root layout, which needs a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/">
          otohime.dev
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/projects">
          <span aria-hidden="true">←</span> All projects
        </a>
        {orrery && (
          <Link className="home-link" href="/orrery">
            <span aria-hidden="true">←</span> Orrery
          </Link>
        )}
      </nav>
    </header>
  );
}

export function Steps({ slug }: { slug: string }) {
  const { prev, next } = neighbours(slug);
  return (
    <nav className="steps" aria-label="Other bodies">
      {prev ? (
        <Link href={`/orrery/${prev.slug}`} rel="prev">
          <span aria-hidden="true">←</span> Previous: {prev.name}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={`/orrery/${next.slug}`} rel="next">
          Next: {next.name} <span aria-hidden="true">→</span>
        </Link>
      )}
    </nav>
  );
}
