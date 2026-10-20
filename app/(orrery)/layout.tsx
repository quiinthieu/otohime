import type { Metadata, Viewport } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./orrery.css";

// Orrery is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site, Shore or Capsule.
// The hand lettering is self-hosted by next/font at build time, so the browser
// never asks Google for it; the cursive stack covers a font that fails to load.
// next/font wants literal options, so the fallback stack is spelled out twice.
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
  title: { default: "Orrery", template: "%s · Orrery" },
  description: "The Sun, the eight planets and five stars, each cut open on a hand-drawn poster with its layers numbered and four sourced numbers.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  themeColor: "#f6f1e7",
};

export default function OrreryLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${title.variable} ${hand.variable}`}>
      <head>
        {/* The hop between root layouts crossfades only if this document opts in before its first frame. The copy in
           orrery.css can arrive too late on a first visit (an inline script behind a loading stylesheet), so the opt-in is
           also parsed with the HTML. */}
        <style>{"@view-transition{navigation:auto;types:hop}"}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
