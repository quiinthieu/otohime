import type { Metadata, Viewport } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./structures.css";

// Structures is its own root layout: its own <html>, <body> and stylesheet. It
// must not import the site's globals.css, Tailwind or anything from the site or
// another project. Both faces are self-hosted by next/font at build time, so
// the browser never asks Google for them; the cursive stacks cover a face that
// fails to load. next/font wants literal options, so each stack is spelled out.
const title = Caveat({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-title",
  display: "swap",
  fallback: ["Bradley Hand", "Segoe Print", "cursive"],
});
const hand = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
  display: "swap",
  fallback: ["Comic Sans MS", "Segoe Print", "cursive"],
});

export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Structures", template: "%s · Structures" },
  description: "Eight ways to keep things, drawn by hand so you can poke them: the array, the linked list, the stack, the queue, the hash table, the search tree, the heap and the graph.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ea" },
    { media: "(prefers-color-scheme: dark)", color: "#161513" },
  ],
};

// Applies a theme pinned by the site's toggle (localStorage.theme, same origin)
// before first paint; otherwise the OS setting decides. Elements' script.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// suppressHydrationWarning: the script adds data-theme before React hydrates.
export default function StructuresLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${title.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           structures.css can arrive too late on a first visit, so the opt-in is also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
