import type { Metadata, Viewport } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./design-system.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { PlotterToggle } from "@/components/plotter-toggle";
import { AppearanceRuntime } from "@/components/appearance-runtime";

// Design system is its own root layout: its own <html>, <body> and stylesheet.
// It must not import the site's globals.css, Tailwind or anything from the
// site or another project. The two faces are Structures' (the explainers read
// as one series), self-hosted by next/font at build time, so the browser never
// asks Google for them; the cursive stacks cover a face that fails to load.
// next/font wants literal options, so each stack is spelled out.
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
  title: { default: "Design system", template: "%s · Design system" },
  description: "A box of decisions made once, drawn so you can turn the knobs: turn one and watch nine parts follow, switch the system off and watch nothing follow.",
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
export default function DesignSystemLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${title.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           design-system.css can arrive too late on a first visit, so the opt-in is also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
        <AppearanceBoot root="design-system" />
      </head>
      <body>{children}<PlotterToggle fallback /><AppearanceRuntime /></body>
    </html>
  );
}
