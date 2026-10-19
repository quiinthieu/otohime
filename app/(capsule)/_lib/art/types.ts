// A drawing is data: flat shapes on the 0 0 120 160 card face, filled by role
// so one drawing takes its card's own colour. See plan.md's art brief.

export type Role = "ink" | "paper" | "blush" | "white" | "main" | "shade" | "none";

// d uses absolute commands only: M L H V C S Q T Z (no arcs, no lowercase).
// stroke defaults to true: one ink outline, 3.5 wide, round joins and caps.
export type Shape = { d: string; fill: Role; stroke?: boolean };

export type Drawing = { shapes: Shape[] };

export const ROLES: readonly Role[] = ["ink", "paper", "blush", "white", "main", "shade", "none"];

// The fixed roles; main and shade come from the card.
export const PALETTE = {
  ink: "#3a2a28",
  paper: "#f6f1e7",
  blush: "#f3a6bb",
  white: "#fffdf8",
} as const;

export const STROKE_WIDTH = 3.5;

export const VIEW_W = 120;
export const VIEW_H = 160;
