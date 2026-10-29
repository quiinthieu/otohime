import type { Metadata, Viewport } from "next";
import "./zine.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { PlotterToggle } from "@/components/plotter-toggle";
import { AppearanceRuntime } from "@/components/appearance-runtime";

// Fold-a-Zine is its own root layout: its own <html>, <body> and stylesheet, so the printed sheet carries nothing of
// the site's globals.css, Tailwind, masthead or footer. The type is the system's serif: no font file to wait for
// before printing. The sheet is paper in both themes, so there is no theme pin.
export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Fold-a-Zine", template: "%s · Fold-a-Zine" },
  description: "A one-sheet, eight-page otohime zine for A4 or Letter: print it, fold it, cut once, read it.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f2efe7",
};

export default function ZineLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame; zine.css
           carries the same rule, which can arrive too late on a first visit. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <AppearanceBoot root="zine" />
      </head>
      <body>{children}<PlotterToggle fallback /><AppearanceRuntime /></body>
    </html>
  );
}
