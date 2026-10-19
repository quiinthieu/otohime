// The words and numbers the cells, the dialog and the static pages print.
// Pure, so the server page and the client dialog print the same thing.

import { categoryOf } from "./categories.ts";
import type { Element } from "./elements.ts";

/** The cell's mass: three decimals, as the brief asks. */
export function mass(el: Pick<Element, "atomic_mass">): string {
  return el.atomic_mass.toFixed(3);
}

/** The URL segment for an element: its symbol in lower case ("fe"). */
export function slug(el: Pick<Element, "symbol">): string {
  return el.symbol.toLowerCase();
}

/** "Hydrogen, atomic number 1, nonmetal": the cell's accessible name. */
export function cellLabel(el: Pick<Element, "name" | "number" | "category">): string {
  return `${el.name}, atomic number ${el.number}, ${categoryOf(el).label.toLowerCase()}`;
}

const trim = (n: number) => String(Number(n.toFixed(2)));

/** "1811 K (1537.85 °C)", or "not known" when upstream has no value. */
export function temperature(kelvin: number | null): string {
  if (kelvin === null) return "not known";
  const celsius = Number((kelvin - 273.15).toFixed(2));
  return `${trim(kelvin)} K (${celsius < 0 ? `−${trim(-celsius)}` : trim(celsius)} °C)`;
}

/** "2, 8, 14 and 2" */
function list(xs: readonly number[]): string {
  return xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** The Bohr diagram's accessible name: "Bohr diagram of iron: shells of 2, 8, 14 and 2 electrons". */
export function diagramLabel(el: Pick<Element, "name" | "shells">): string {
  const shells =
    el.shells.length === 1
      ? `one shell of ${el.shells[0]} ${el.shells[0] === 1 ? "electron" : "electrons"}`
      : `shells of ${list(el.shells)} electrons`;
  return `Bohr diagram of ${el.name.toLowerCase()}: ${shells}`;
}

/** The host a fact cites, for its "source" link text. */
export function sourceHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}
