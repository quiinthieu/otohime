import type { Metadata, Viewport } from "next";
import "./vinyl.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { PlotterToggle } from "@/components/plotter-toggle";
import { AppearanceRuntime } from "@/components/appearance-runtime";

// Vinyl is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site or another
// project. A system font stack, so the build needs no font download.
// No referrer metadata on purpose: YouTube's embed needs the browser's default
// Referer (strict-origin-when-cross-origin), or it refuses to play (error 153).

export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Vinyl", template: "%s · Vinyl" },
  description: "Dig through a crate of records, drop the needle and watch it play.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#1b1714",
};

export default function VinylLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           vinyl.css can arrive too late on a first visit (an inline script behind a loading stylesheet), so the opt-in is
           also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <AppearanceBoot root="vinyl" />
      </head>
      <body>{children}<PlotterToggle fallback /><AppearanceRuntime /></body>
    </html>
  );
}
