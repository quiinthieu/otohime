import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Otohime", template: "%s · Otohime" },
  description: "A personal place at otohime.dev",
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

// suppressHydrationWarning: the script adds data-theme before React hydrates.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: pinTheme }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
