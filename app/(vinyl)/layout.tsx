import type { Metadata, Viewport } from "next";
import "./vinyl.css";

// Vinyl is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site or another
// project. A system font stack, so the build needs no font download.
// No referrer metadata on purpose: YouTube's embed needs the browser's default
// Referer (strict-origin-when-cross-origin), or it refuses to play (error 153).

export const metadata: Metadata = {
  title: { default: "Vinyl", template: "%s · Vinyl" },
  description: "Dig through a crate of records, drop the needle and watch it play.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#1b1714",
};

export default function VinylLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
