import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { PocketTerminalLoader } from "@/components/pocket-terminal-loader";
import { TactileLoader } from "@/components/tactile/loader";
import { PressSound } from "@/components/press-sound";
import { SeasonLayer } from "@/components/season-layer";
import { UrashimaKeys } from "@/components/urashima-keys";
import { KameLoader } from "@/components/kame/loader";
import { site } from "@/content/site";
import { bootScript } from "@/lib/boot";
import { pondPrintScript } from "@/lib/pond-print";
import { seasonScript } from "@/lib/seasons";
import "./globals.css";
import "./seasons.css";
import "./letterpress.css";
import { AppearanceBoot } from "@/components/appearance-boot";
import { AppearanceRuntime } from "@/components/appearance-runtime";
import { KintsugiMotion } from "@/components/kintsugi-card";

export const metadata: Metadata = {
  // The postmarked card every page shares (app/og/route.tsx); a segment's own opengraph-image file wins.
  metadataBase: new URL(process.env.SITE_URL ?? "https://otohime.dev"),
  openGraph: { images: [{ url: "/og", alt: "Otohime, stamped on paper by otohime.dev", width: 1200, height: 630 }] },
  title: { default: "Otohime", template: "%s · Otohime" },
  description: `Otohime. ${site.tagline}`,
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1915" },
  ],
};

// Applies a pinned theme (components/theme-toggle.tsx) before first paint; seasonScript (lib/seasons.ts) pins
// data-season the same way, from the stored choice or the visitor's clock, so seasons.css tints the first frame.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// A full load arrives inside the hop's transition, and React's streamed reveal would start its own while the hop
// is still active, which Chromium skips with an uncaught "Transition was skipped". React waits for
// document.__reactViewTransition to finish first, so the hop is handed to it until it ends.
const holdForHop = `addEventListener("pagereveal",function(e){var v=e.viewTransition;if(!v)return;document.__reactViewTransition=v;var c=function(){if(document.__reactViewTransition===v)document.__reactViewTransition=null};v.finished.then(c,c)})`;

// suppressHydrationWarning: the scripts add data-theme, data-season and data-booted (lib/boot.ts: the console already booted
// this session, so Home shows its menu at once) before React hydrates, and pondPrintScript (lib/pond-print.ts) sets a
// kept pond print as --pond-print, so the pond's page wears it from the first frame (app/(site)/pond.css).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           globals.css can arrive too late on a first visit (an inline script behind a loading stylesheet), so the opt-in is
           also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <script dangerouslySetInnerHTML={{ __html: holdForHop }} />
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
        <script dangerouslySetInnerHTML={{ __html: seasonScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <script dangerouslySetInnerHTML={{ __html: pondPrintScript }} />
        <AppearanceBoot root="site" />
      </head>
      <body className="min-h-full">
        {/* The season's ambient bits, fixed behind every page and ahead of each group's masthead; mounted here once,
           so a move between groups does not restart them. */}
        <SeasonLayer />
        {/* The letterpress keys' press cue (components/press-sound.tsx): one document listener for every page. */}
        <PressSound />
        <KintsugiMotion />
        {/* "/" or Cmd/Ctrl-K opens the Pocket Terminal (components/pocket-terminal.tsx, its own chunk). Ahead of the
           pages, so its capture-phase key listener is added before the handheld's and can stop keys while open. */}
        <PocketTerminalLoader />
        {/* Typing "urashima" goes down to Ryugu-jo (components/urashima-keys.tsx). Also ahead of the pages: its capture
           listener takes the word's a's before the Pocket console can open a page with them. */}
        <UrashimaKeys />
        {children}
        {/* Overlays follow route content and wait for each paper host's React commit. */}
        <Suspense fallback={null}><KameLoader /></Suspense>
        <Suspense fallback={null}><TactileLoader /></Suspense>
        <AppearanceRuntime />
      </body>
    </html>
  );
}
