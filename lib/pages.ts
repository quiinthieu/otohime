export type PublicPage = {
  href: "/" | "/work" | "/projects" | "/notes";
  label: string;
};

export const PUBLIC_PAGES = [
  { href: "/", label: "Home" },
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/notes", label: "Notes" },
] as const satisfies readonly PublicPage[];

export const DESK_PAGE = { href: "/projects", label: "Curiosities" } as const;

export type ConsoleItem = Exclude<(typeof PUBLIC_PAGES)[number], { href: "/" }>;

export const CONSOLE_MENU: readonly ConsoleItem[] = [
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/notes", label: "Notes" },
];

export const LCD = { y: -158, h: 56 };
export const MENU_PITCH = 7.5;
export const menuBaseline = (i: number) => -150 + i * MENU_PITCH;

