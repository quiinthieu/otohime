import type { Metadata, Viewport } from "next";
import "./ryugu.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { PlotterToggle } from "@/components/plotter-toggle";
import { AppearanceRuntime } from "@/components/appearance-runtime";

// Ryugu-jo is its own root layout: its own <html>, <body> and stylesheet, so none of the site's globals.css,
// Tailwind, cartridge styling, masthead or footer reaches the palace, and the palace reaches nothing of the site. The
// way down is a secret (typing "urashima", the Pocket console, the waterline under the site's footer), so search
// engines are asked to leave it be. The sea is dark in both themes, so there is no theme pin.
export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Ryugu-jo", template: "%s · Ryugu-jo" },
  description: "Otohime's palace, below the waterline.",
  robots: { index: false, follow: false },
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0e161d",
};

export default function RyuguLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame; ryugu.css
           carries the same rule, which can arrive too late on a first visit. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <AppearanceBoot root="ryugu" />
      </head>
      <body>{children}<PlotterToggle fallback /><AppearanceRuntime /></body>
    </html>
  );
}
