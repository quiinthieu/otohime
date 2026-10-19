import type { Metadata } from "next";
import { ShoreApp } from "../_components/shore-app";

// absolute: the layout's template would otherwise make this "Shore · Shore".
export const metadata: Metadata = { title: { absolute: "Shore" } };

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
          {/* A plain <a>: / is in another root layout, which needs a full page load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="home-link" href="/">
            otohime.dev
          </a>
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
