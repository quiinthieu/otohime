import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import "./capsule.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { PlotterToggle } from "@/components/plotter-toggle";
import { AppearanceRuntime } from "@/components/appearance-runtime";

// Capsule is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site or Shore.
// Fraunces is self-hosted by next/font at build time, so the browser never asks
// Google for it; the serif stack covers a font that fails to load.
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
  fallback: ["Iowan Old Style", "Georgia", "serif"],
});

export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Capsule", template: "%s · Capsule" },
  description: "A coin, a crank, and a printed card to keep.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ecdd" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1614" },
  ],
};

// Applies a theme pinned by the site's toggle (localStorage.theme, same origin)
// before first paint; otherwise the OS setting decides.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function CapsuleLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           capsule.css can arrive too late on a first visit (an inline script behind a loading stylesheet), so the opt-in is
           also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
        <AppearanceBoot root="capsule" />
      </head>
      <body>{children}<PlotterToggle fallback /><AppearanceRuntime /></body>
    </html>
  );
}
