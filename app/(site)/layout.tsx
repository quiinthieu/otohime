import type { Metadata, Viewport } from "next";
import { site } from "@/content/site";
import { bootScript } from "@/lib/boot";
import "./globals.css";

export const metadata: Metadata = {
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

// Applies a pinned theme (components/theme-toggle.tsx) before first paint.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// A full load arrives inside the hop's transition, and React's streamed reveal would start its own while the hop
// is still active, which Chromium skips with an uncaught "Transition was skipped". React waits for
// document.__reactViewTransition to finish first, so the hop is handed to it until it ends.
const holdForHop = `addEventListener("pagereveal",function(e){var v=e.viewTransition;if(!v)return;document.__reactViewTransition=v;var c=function(){if(document.__reactViewTransition===v)document.__reactViewTransition=null};v.finished.then(c,c)})`;

// suppressHydrationWarning: the scripts add data-theme and data-booted (lib/boot.ts: the console already booted
// this session, so Home shows its menu at once) before React hydrates.
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
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
