import type { Metadata } from "next";
import { CC_BY_SA } from "../_components/element-detail";
import { Table } from "../_components/table";

// absolute: the layout's template would otherwise make this "Elements · Elements".
export const metadata: Metadata = { title: { absolute: "Elements" } };

const DATASET = "https://github.com/Bowserinator/Periodic-Table-JSON";

// /elements: the table is server-rendered HTML (118 links, the legend, the two
// series markers), made interactive by the Table island. No 3D code here.
export default function ElementsPage() {
  return (
    <div className="elements">
      <header className="topbar">
        {/* A plain <a>: / is in another root layout, which needs a full page load. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="home-link" href="/">
          otohime.dev
        </a>
      </header>
      <main className="atlas">
        <h1>Elements</h1>
        <p className="lede">All 118, each with its atom and one surprising fact. Pick an element.</p>
        <Table />
      </main>
      <footer className="page-footer">
        <p>
          {"Element data and summaries from "}
          <a href={DATASET} rel="noopener">
            Bowserinator/Periodic-Table-JSON
          </a>
          {", with text from Wikipedia, under "}
          <a href={CC_BY_SA} rel="license noopener">
            CC BY-SA 3.0
          </a>
          {". The fun facts are our own words; each one links the page it can be checked on."}
        </p>
      </footer>
    </div>
  );
}
