import type { Metadata, Viewport } from "next";
import { Nunito, Shantell_Sans } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

// ponytail: default axes; add axes: ["INFM"] if the hand reads too neat
const shantell = Shantell_Sans({
  variable: "--font-shantell",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Otohime", template: "%s · Otohime" },
  description: "A personal place at otohime.dev",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f1e6" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1631" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${shantell.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
