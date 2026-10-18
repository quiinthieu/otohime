export type PublicPage = { href: "/" | "/work" | "/play" | "/notes" | "/music" | "/projects"; label: string };

export const PUBLIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/work", label: "Work" },
  { href: "/play", label: "Play" },
  { href: "/notes", label: "Notes" },
  { href: "/music", label: "Music" },
  { href: "/projects", label: "Projects" },
] as const satisfies readonly PublicPage[];

export const CONSOLE_MENU = PUBLIC_PAGES.filter((page) => page.href !== "/");

// The pocket console's screen and its menu lines, in the figure's units.
export const LCD = { y: -158, h: 56 };
export const MENU_PITCH = 10;
export const menuBaseline = (i: number) => -146 + i * MENU_PITCH;
