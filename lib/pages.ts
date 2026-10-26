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

// The Ink Desk is a cartridge for the console only: it stays out of the nav,
// and the default home is unchanged.
export const DESK_PAGE = { href: "/desk", label: "Desk" } as const;

export type ConsoleItem = { href: Exclude<PublicPage["href"], "/"> | typeof DESK_PAGE.href; label: string };

export const CONSOLE_MENU = [
  ...PUBLIC_PAGES.filter((page) => page.href !== "/"),
  DESK_PAGE,
] as const satisfies readonly ConsoleItem[];

// The pocket console's screen and its menu lines, in the figure's units.
// Pitch 7.5 from -150 keeps seven labels inside the LCD (lib/pages.test.ts).
export const LCD = { y: -158, h: 56 };
export const MENU_PITCH = 7.5;
export const menuBaseline = (i: number) => -150 + i * MENU_PITCH;
