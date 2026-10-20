import { BrandMark } from "@/components/brand-mark";
import { Notice } from "@/components/figures";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { ViewTransition } from "react";

// The parcel page, for an unknown address (app/global-not-found.tsx) and for a
// site page that calls notFound(). The brand mark is a way home too; the bar
// stays out of the wrapper, like every layout's masthead.
export default function NotFound() {
  return (
    <>
      <header className="masthead">
        <BrandMark />
        <ThemeToggle />
      </header>
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <main className="grid min-h-[calc(100dvh-4rem)] place-items-center p-6">
          <Notice n="404" title="Nothing in this parcel" figure="parcel">
            <p className="text-muted">There&apos;s no page at this address.</p>
            <Link href="/" className="btn btn-primary mt-2">
              Go home
            </Link>
          </Notice>
        </main>
      </ViewTransition>
    </>
  );
}
