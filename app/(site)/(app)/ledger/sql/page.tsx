import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { SqlDesk } from "@/components/sql-desk";
import { publicSqlData } from "@/lib/sql-data";
import "./sql.css";
export const metadata: Metadata = { title: "Ink Ledger SQL desk", description: "A hand-ruled SQL desk. Query Otohime's public archive with DuckDB in your browser." };
export default function SqlPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div className="rise">
    <FigTitle n="02d" hint="public data, private little queries">Ink Ledger SQL desk</FigTitle>
    <p className="mt-3 max-w-prose text-muted">Open the books. Ask a question in SQL. Count the ink. A small accounting desk for the things made here, with DuckDB running entirely in your browser.</p>
    <SqlDesk dataset={publicSqlData()} />
    <p className="mt-8"><Link href="/ledger" className="link">The Stamp Ledger</Link> · <Link href="/timeline" className="link">Pop-up Book Timeline</Link></p>
  </div></ViewTransition>;
}
