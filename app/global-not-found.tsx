import type { Metadata } from "next";
import { site } from "@/content/site";
import NotFound from "./(site)/not-found";
import "./(site)/globals.css";

// An address no route matches. The site and the projects are separate root layouts, so Next renders this whole
// document instead of a layout (experimental.globalNotFound). A notFound() from a catch-all page cannot do it:
// outside a Suspense boundary it is served as Next's empty error shell and drawn on the client, so its head had no
// opt-in (a hop into it aborted with "ViewTransition opt-in disabled") and its body was blank without JavaScript.
// This one is drawn on the server, with its 404, and every way out is a hop between documents that crossfades.

export const metadata: Metadata = {
  title: "Otohime",
  description: `Otohime. ${site.tagline}`,
};

// The same as app/(site)/layout.tsx: a pinned theme before first paint.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function GlobalNotFound() {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Parsed with the HTML, so the hop into and out of the 404 crossfades on a first visit (see the site layout). */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
      </head>
      <body className="min-h-full">
        <NotFound />
      </body>
    </html>
  );
}
