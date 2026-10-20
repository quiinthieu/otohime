// A drawing is data: flat shapes on the 0 0 120 160 card face, filled by role
// so one drawing takes its card's own colour. See plan.md's printed-ink brief.

// hatch is shade: rough hachure in the card's shade colour, never outlined.
export type Role = "ink" | "paper" | "blush" | "white" | "main" | "hatch" | "none";

// d uses absolute commands only: M L H V C S Q T Z (no arcs, no lowercase).
// stroke defaults to true: one rough ink outline over the flat fill, STROKE wide
// (fine for whiskers, fur and hair). A hatch shape is never outlined. A blush
// shape with stroke: false is a cheek mark, printed as a light pink hatch.
export type Shape = { d: string; fill: Role; stroke?: boolean; weight?: "fine" };

export type Drawing = { shapes: Shape[] };

export const ROLES: readonly Role[] = ["ink", "paper", "blush", "white", "main", "hatch", "none"];

// The fixed roles; main and hatch come from the card.
export const PALETTE = {
  ink: "#2b2320",
  paper: "#f3ecdd",
  blush: "#d98a9a",
  white: "#fffaf0",
} as const;

export const STROKE = { normal: 1.9, fine: 1.2 } as const;

export const VIEW_W = 120;
export const VIEW_H = 160;
