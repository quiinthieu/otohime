import type { Metadata } from "next";
import { ShoreApp } from "../_components/shore-app";

// absolute: the layout's template would otherwise make this "Shore · Shore".
export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "/og?title=Shore&path=%2Fshore", width: 1200, height: 630, alt: "Shore, stamped on paper by otohime.dev" }],
  },
  twitter: { card: "summary_large_image" },
  title: { absolute: "Shore" },
};

export default function ShorePage() {
  return (
    <ShoreApp
      header={
        <header className="topbar">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span>
              shore
              <span className="brand-detail">A FOCUS TIMER</span>
            </span>
          </span>
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
          </nav>
        </header>
      }
      footer={
        <footer className="page-footer">
          <span>SEA GLASS RENDERER BY MTTMCKNN · APACHE-2.0</span>
        </footer>
      }
    />
  );
}
