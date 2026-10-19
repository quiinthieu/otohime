import type { Metadata, Viewport } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./sun.css";

// Sun is its own root layout: its own <html>, <body> and stylesheet. It must
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
  title: { default: "Sun", template: "%s · Sun" },
  description: "Our star on one hand-drawn poster: six layers cut open, Earth to scale and four NASA-sourced numbers.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  themeColor: "#f6f1e7",
};

export default function SunLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${title.variable} ${hand.variable}`}>
      <body>{children}</body>
    </html>
  );
}
