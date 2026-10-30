import type { Metadata, Viewport } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./barometer.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { PlotterToggle } from "@/components/plotter-toggle";
import { AppearanceRuntime } from "@/components/appearance-runtime";

// Barometer is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site or another
// project. The hand lettering is Orrery's, self-hosted by next/font at build
// time, so the browser never asks Google for it; the cursive stack covers a
// font that fails to load. next/font wants literal options, so the fallback
// stack is spelled out twice.
const title = Caveat({
  subsets: ["latin"],
  variable: "--font-title",
  display: "swap",
  fallback: ["Chalkboard SE", "Comic Neue", "Comic Sans MS", "cursive"],
});
const hand = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hand",
  display: "swap",
  fallback: ["Chalkboard SE", "Comic Neue", "Comic Sans MS", "cursive"],
});

export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Barometer", template: "%s · Barometer" },
  description: "A brass weather station for a chosen city, drawn in ink: an aneroid dial, a thermometer, a wind vane and a rain cup, read from Open-Meteo.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe3c8" },
    { media: "(prefers-color-scheme: dark)", color: "#2b1d14" },
  ],
};

// Applies a theme pinned by the site's toggle (localStorage.theme, same origin)
// before first paint; otherwise the OS setting decides. Elements' script.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// suppressHydrationWarning: the script adds data-theme before React hydrates.
export default function BarometerLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${title.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           barometer.css can arrive too late on a first visit (an inline script behind a loading stylesheet), so the opt-in is
           also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
        <AppearanceBoot root="barometer" />
      </head>
      <body>{children}<PlotterToggle fallback /><AppearanceRuntime /></body>
    </html>
  );
}
