import Link from "next/link";

// The paper's furniture, shared by every Gazette page: the top bar's ways out,
// the masthead (in full on the front page, where it is the page's one h1, and
// in one line above a story or the 404), and the colophon.

export function TopBar() {
  return (
    <header className="topbar">
      <nav className="ways-out" aria-label="Site">
        {/* Plain <a>s: / and /projects are in another root layout, which needs a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/">
          otohime.dev
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/projects">
          <span aria-hidden="true">←</span> All projects
        </a>
      </nav>
    </header>
  );
}

export function Masthead({ dateline }: { dateline: string }) {
  return (
    <header className="masthead">
      <h1 className="nameplate">The Otohime Gazette</h1>
      <p className="dateline">{dateline}</p>
    </header>
  );
}

export function MastheadLine() {
  return (
    <header className="masthead masthead-line">
      <p className="nameplate">
        <Link href="/articles">The Otohime Gazette</Link>
      </p>
      <Link className="front-link" href="/articles">
        <span aria-hidden="true">←</span> Front page
      </Link>
    </header>
  );
}

export function Colophon() {
  return (
    <footer className="colophon">
      <p>Every number links to where it came from.</p>
      <p>Set in Playfair Display, Old Standard TT and UnifrakturMaguntia.</p>
    </footer>
  );
}
