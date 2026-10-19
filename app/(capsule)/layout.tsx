import type { Metadata, Viewport } from "next";
import "./capsule.css";

// Capsule is its own root layout: its own <html>, <body> and stylesheet. It must
// not import the site's globals.css, Tailwind or anything from the site or Shore.
export const metadata: Metadata = {
  title: { default: "Capsule", template: "%s · Capsule" },
  description: "A coin, a crank, and a hand-drawn card to keep.",
  other: { "build-sha": process.env.BUILD_SHA ?? "dev" },
};

export const viewport: Viewport = {
  themeColor: "#f6f1e7",
};

export default function CapsuleLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
