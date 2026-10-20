import type { Metadata, Viewport } from "next";
import { Caveat, Patrick_Hand } from "next/font/google";
import "./rotor.css";

// Rotor is its own root layout: its own <html>, <body> and stylesheet. It must
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
  title: { default: "Rotor", template: "%s · Rotor" },
  description: "An Enigma I drawn in ink: type on it and watch the rotors step and the lamps light, or encode through a plain form.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1916" },
  ],
};

// Applies a theme pinned by the site's toggle (localStorage.theme, same origin)
// before first paint; otherwise the OS setting decides. Orrery has no pin, so
// this is Elements' script.
const pinTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// suppressHydrationWarning: the script adds data-theme before React hydrates.
export default function RotorLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${title.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
