import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { ViewTransition } from "react";

const CRUMPLE_SCALE = 14;
const WAYS = [
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/notes", label: "Notes" },
] as const;

export default function NotFound() {
  return (
    <>
      <header className="masthead">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <BrandMark />
          <ThemeToggle />
        </div>
      </header>
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <main className="grid min-h-[calc(100dvh-4rem)] place-items-center p-6">
          <div className="rise mx-auto grid max-w-md justify-items-center gap-4 py-8 text-center">
            <svg width="0" height="0" className="sr-only" aria-hidden="true" focusable="false">
              <filter id="lost-crumple" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.03" data-ap-frequency="0.03" numOctaves="2" seed="4" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale={CRUMPLE_SCALE} data-ap-scale={CRUMPLE_SCALE} xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </svg>
            <p className="caption">Error 404</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Page not found</h1>
            <p className="text-muted">The page you are looking for does not exist or has moved.</p>
            <nav aria-label="Ways back" className="lost-ways">
              <Link href="/" className="btn btn-primary">
                Go home
              </Link>
              {WAYS.map((w) => (
                <Link key={w.href} href={w.href} className="btn">
                  {w.label}
                </Link>
              ))}
            </nav>
          </div>
        </main>
      </ViewTransition>
    </>
  );
}
