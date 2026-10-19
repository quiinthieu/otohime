import type { Metadata } from "next";
import { FactList } from "../_components/fact-list";
import { SunApp } from "../_components/sun-app";
import { CHAPTERS, SOURCES } from "../_lib/sun.ts";

// absolute: the layout's template would otherwise make this "Sun · Sun".
export const metadata: Metadata = { title: { absolute: "Sun" } };

export default function SunPage() {
  return (
    <div className="sun">
      <header className="topbar">
        <span className="brand">
          <span className="brand-mark" aria-hidden="true"></span>
          <span>
            <span className="brand-name">Sun</span>
            <span className="brand-detail">AN ANIMATED CUTAWAY OF OUR STAR</span>
          </span>
        </span>
        {/* A plain <a>: / is in another root layout, which needs a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/">
          otohime.dev
        </a>
      </header>
      <main>
        <h1 className="visually-hidden">The Sun, in eight chapters</h1>
        <SunApp />
        <div className="chapters">
          {CHAPTERS.map((c, i) => (
            <section key={c.id} className="chapter" id={c.id} data-chapter-section={c.id}>
              <p className="chapter-no">
                Chapter {i + 1} of {CHAPTERS.length}
              </p>
              <h2>{c.title}</h2>
              <p className="lede">{c.lede}</p>
              <FactList facts={c.facts} />
            </section>
          ))}
        </div>
      </main>
      <footer className="page-footer">
        <p>Facts from NASA (public domain), cross-checked with Wikipedia. Drawings are our own.</p>
        <p>
          <a href={SOURCES.nssdc.url} rel="noreferrer">
            NASA Sun fact sheet
          </a>
          {" · "}
          <a href={SOURCES["nasa-facts"].url} rel="noreferrer">
            NASA Sun facts
          </a>
          {" · "}
          <a href={SOURCES["wikipedia-sun"].url} rel="noreferrer">
            Wikipedia: Sun
          </a>
        </p>
      </footer>
    </div>
  );
}
