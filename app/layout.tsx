import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Otohime", template: "%s · Otohime" },
  description: "A personal place at otohime.dev",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f2efe7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
