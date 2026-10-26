import type { Metadata, Viewport } from "next";
import "./shore.css";

// Shore is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site.
export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Shore", template: "%s · Shore" },
  description: "A focus timer that leaves sea glass behind.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  themeColor: "#f4f5f0",
};

export default function ShoreLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           shore.css can arrive too late on a first visit (an inline script behind a loading stylesheet), so the opt-in is
           also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
