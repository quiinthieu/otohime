export type PublicPage = {
  href: "/" | "/work" | "/play" | "/notes" | "/music" | "/projects" | "/sketches";
  label: string;
};

export const PUBLIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/work", label: "Work" },
  { href: "/play", label: "Play" },
  { href: "/notes", label: "Notes" },
  { href: "/music", label: "Music" },
  { href: "/projects", label: "Projects" },
  { href: "/sketches", label: "Sketches" },
] as const satisfies readonly PublicPage[];

export const CONSOLE_MENU = PUBLIC_PAGES.filter((page) => page.href !== "/");

// The pocket console's screen and its menu lines, in the figure's units.
// Pitch 8 keeps six labels inside the LCD (lib/pages.test.ts).
export const LCD = { y: -158, h: 56 };
export const MENU_PITCH = 8;
export const menuBaseline = (i: number) => -149 + i * MENU_PITCH;
