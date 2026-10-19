import type { CSSProperties } from "react";
import type { Category } from "../_lib/categories.ts";

// A category's two colours as custom properties; elements.css picks
// --cat-light or --cat-dark into --cat for anything with the .tint class.
export function tint(c: Category): CSSProperties {
  return { "--cat-light": c.light, "--cat-dark": c.dark } as CSSProperties;
}
