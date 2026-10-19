import type { Metadata, Viewport } from "next";
import "./sun.css";

// Sun is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site, Shore or Capsule.
export const metadata: Metadata = {
  title: { default: "Sun", template: "%s · Sun" },
  description: "An animated cutaway of our star, one layer at a time, with a NASA-sourced fact for every number.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
};

export default function SunLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
