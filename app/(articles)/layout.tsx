import type { Metadata, Viewport } from "next";
import { Old_Standard_TT, Playfair_Display, UnifrakturMaguntia } from "next/font/google";
import "./articles.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { AppearanceRuntime } from "@/components/appearance-runtime";

// The Gazette is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site or another
// project. The three faces are self-hosted by next/font at build time, so the
// browser never asks Google for them; the serif stacks cover a face that fails to
// load. next/font wants literal options, so each fallback stack is spelled out.
const masthead = UnifrakturMaguntia({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-masthead",
  display: "swap",
  fallback: ["Old English Text MT", "Georgia", "serif"],
});
const headline = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
const body = Old_Standard_TT({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "The Otohime Gazette", template: "%s · The Otohime Gazette" },
  description: "A small newspaper: six short pieces on everyday science, each with a drawn infographic and its sources.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3eee3" },
    { media: "(prefers-color-scheme: dark)", color: "#171513" },
  ],
};

// Applies a theme pinned by the site's toggle (localStorage.theme, same origin)
// before first paint; otherwise the OS setting decides. Elements' script.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// suppressHydrationWarning: the script adds data-theme before React hydrates.
export default function ArticlesLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${masthead.variable} ${headline.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           articles.css can arrive too late on a first visit (an inline script behind a loading stylesheet), so the opt-in is
           also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
        <AppearanceBoot root="articles" />
      </head>
      <body>{children}<AppearanceRuntime /></body>
    </html>
  );
}
