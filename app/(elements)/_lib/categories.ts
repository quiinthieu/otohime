// The dataset's 15 raw category strings folded into the ten legend categories.
// Each category has a colour per paper: `light` sits on the light paper and
// `dark` on the dark one, each at least 3:1 against its paper (tested).

import type { Element } from "./elements.ts";

export type CategoryId =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "nonmetal"
  | "noble-gas"
  | "lanthanide"
  | "actinide"
  | "unknown";

export interface Category {
  id: CategoryId;
  label: string;
  light: string;
  dark: string;
}

export const PAPER = { light: "#faf8f3", dark: "#15171c" } as const;

// Legend order: left to right across the table, then the two series, then unknown.
export const CATEGORIES: readonly Category[] = [
  { id: "alkali-metal", label: "Alkali metal", light: "#c2410c", dark: "#fb923c" },
  { id: "alkaline-earth-metal", label: "Alkaline earth metal", light: "#a16207", dark: "#facc15" },
  { id: "transition-metal", label: "Transition metal", light: "#be185d", dark: "#f472b6" },
  { id: "post-transition-metal", label: "Post-transition metal", light: "#0f766e", dark: "#5eead4" },
  { id: "metalloid", label: "Metalloid", light: "#4d7c0f", dark: "#a3e635" },
  { id: "nonmetal", label: "Nonmetal", light: "#1d4ed8", dark: "#93c5fd" },
  { id: "noble-gas", label: "Noble gas", light: "#7e22ce", dark: "#d8b4fe" },
  { id: "lanthanide", label: "Lanthanide", light: "#0369a1", dark: "#7dd3fc" },
  { id: "actinide", label: "Actinide", light: "#b91c1c", dark: "#fca5a5" },
  { id: "unknown", label: "Unknown properties", light: "#57534e", dark: "#a8a29e" },
];

// Every raw string upstream uses, including the "unknown, …" predictions for
// the superheavy elements (the last one belongs to element 119, which is not vendored).
export const RAW_CATEGORIES: Readonly<Record<string, CategoryId>> = {
  "alkali metal": "alkali-metal",
  "alkaline earth metal": "alkaline-earth-metal",
  "transition metal": "transition-metal",
  "post-transition metal": "post-transition-metal",
  metalloid: "metalloid",
  "diatomic nonmetal": "nonmetal",
  "polyatomic nonmetal": "nonmetal",
  "noble gas": "noble-gas",
  lanthanide: "lanthanide",
  actinide: "actinide",
  "unknown, probably transition metal": "unknown",
  "unknown, probably post-transition metal": "unknown",
  "unknown, probably metalloid": "unknown",
  "unknown, predicted to be noble gas": "unknown",
  "unknown, but predicted to be an alkali metal": "unknown",
};

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(el: Pick<Element, "category">): Category {
  const id = RAW_CATEGORIES[el.category];
  if (!id) throw new Error(`unmapped category: ${el.category}`);
  return BY_ID.get(id)!;
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
