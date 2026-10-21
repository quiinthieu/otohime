import Link from "next/link";
import type { Page } from "../_lib/copy.ts";

// The notebook's furniture, shared by every Structures page: the top bar's ways
// out, Previous / Next between pages, and the colophon.

export function TopBar() {
  return (
    <header className="topbar">
      <nav className="ways-out" aria-label="Site">
        {/* Plain <a>s: / and /projects are in another root layout, which needs a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/">
          otohime.dev
        </a>
        <a href="/projects">
          <span aria-hidden="true">←</span> All projects
        </a>
      </nav>
    </header>
  );
}

export function Turn({ prev, next }: { prev?: Page; next?: Page }) {
  return (
    <nav className="turn" aria-label="Other pages">
      {prev ? (
        <Link href={`/structures/${prev.slug}`} rel="prev">
          <span aria-hidden="true">←</span> Previous: {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={`/structures/${next.slug}`} rel="next">
          Next: {next.title} <span aria-hidden="true">→</span>
        </Link>
      )}
    </nav>
  );
}

export function Colophon() {
  return (
    <footer className="colophon">
      <p>Every page lists where its facts come from. Every count is the machine&apos;s own.</p>
      <p>
        {/* The Gazette is another root layout: a plain <a>. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        More reading: <a href="/articles">The Otohime Gazette</a>
      </p>
      <p>Lettered in Caveat and Patrick Hand.</p>
    </footer>
  );
}
