import { FigTitle } from "@/components/figures";
import raw from "@/content/ledger.json";
import { endOf, ledgerGrid } from "@/lib/ledger";
import { parseLedger } from "@/lib/ledger-data";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import Link from "next/link";
import { ViewTransition } from "react";
import { StampCalendar } from "./_components/stamp-calendar";
import { daysOf, longDate, totals } from "./_lib/calendar";
import "./ledger.css";

export const metadata: Metadata = { title: "Ledger" };

// content/ledger.json is written by the prebuild step (scripts/ledger-fetch.mjs) and committed as the fallback, so
// the page never fetches. Cached for a day (cacheLife under cacheComponents, the Next 16 way to revalidate). An
// empty ledger with no date ends on the build's day.
async function loadLedger() {
  "use cache";
  cacheLife("days");
  const ledger = parseLedger(raw);
  const end = endOf(ledger) ?? process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10);
  return { ledger, end };
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

// The Stamp Ledger: a year of commits, notes and sketches pressed as rubber stamps. Linked from Work.
export default async function LedgerPage() {
  const { ledger, end } = await loadLedger();
  const grid = ledgerGrid(ledger, end);
  const t = totals(daysOf(grid));
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle
          n="02b"
          hint={
            <>
              as of <time dateTime={grid.to}>{longDate(grid.to)}</time>
            </>
          }
        >
          Ledger
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          A year of work pressed by hand: one stamp a day, darker for a busier one, a rosette for a release and a NEW
          for a post. Hover, focus or tap a day for its receipt.
        </p>
        <p className="mt-2">
          {count(t.commits, "commit", "commits")} · {count(t.notes, "note", "notes")} ·{" "}
          {count(t.sketches, "sketch", "sketches")} · {count(t.releases, "release", "releases")} on{" "}
          {count(t.inked, "day", "days")}
        </p>
        <div className="mt-8">
          <StampCalendar ledger={ledger} end={end} />
        </div>
        <p className="mt-8 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/strata" className="link">
            Paper Strata
          </Link>
          <Link href="/work" className="link">
            Back to Work
          </Link>
        </p>
      </div>
    </ViewTransition>
  );
}
