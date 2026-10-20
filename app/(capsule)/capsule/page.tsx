import type { Metadata } from "next";
import { CapsuleApp } from "../_components/capsule-app";
import { ratesLine } from "../_lib/gacha.ts";

// absolute: the layout's template would otherwise make this "Capsule · Capsule".
export const metadata: Metadata = { title: { absolute: "Capsule" } };

export default function CapsulePage() {
  return (
    <CapsuleApp
      header={
        <header className="topbar">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true"></span>
            <span>
              capsule
              <span className="brand-detail">A COIN-AND-CRANK CARD MACHINE</span>
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
      rates={<p className="rates">{ratesLine()}</p>}
      footer={
        <footer className="page-footer">
          <span>
            Fan art, drawn by hand. The characters belong to Studio Ghibli. Not affiliated; nothing here is for sale.
          </span>
        </footer>
      }
    />
  );
}
