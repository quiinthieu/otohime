import { colophon } from "../_lib/copy.ts";

// The page's furniture: the top bar's ways out and the colophon. Structures'
// chrome, copied: every way out is another root layout, so each is a plain
// <a>, which a full page load (and the hop) needs.

export function TopBar() {
  return (
    <header className="topbar">
      <nav className="ways-out" aria-label="Site">
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

export function Colophon() {
  return (
    <footer className="colophon">
      <p>Every count on this page is the board&apos;s own, and every source is listed above.</p>
      <p>
        {colophon.map((l, i) => (
          <span key={l.href}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            <a href={l.href}>{l.label}</a>
          </span>
        ))}
      </p>
      <p>Lettered in Caveat and Patrick Hand.</p>
    </footer>
  );
}
