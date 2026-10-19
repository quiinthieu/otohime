import type { CSSProperties } from "react";
import { categoryOf } from "../_lib/categories.ts";
import type { Element } from "../_lib/elements.ts";
import { cellLabel, mass, slug } from "../_lib/format.ts";
import { place } from "../_lib/grid.ts";
import { tint } from "./tint.ts";

// One element: a real link to its static page, so it works before (and
// without) JavaScript. The table's handlers turn a plain click into the dialog.
// tabIndex is undefined until hydration, then -1 on all but the roving cell.
export function Cell({ el, tabIndex }: { el: Element; tabIndex?: number }) {
  const cat = categoryOf(el);
  const { col, row } = place(el);
  const style: CSSProperties = { ...tint(cat), gridColumn: col, gridRow: row };
  return (
    <a
      className="cell tint"
      data-element={el.number}
      data-cat={cat.id}
      href={`/elements/${slug(el)}`}
      aria-label={cellLabel(el)}
      tabIndex={tabIndex}
      style={style}
    >
      <span className="cell-number">{el.number}</span>
      <span className="cell-symbol">{el.symbol}</span>
      <span className="cell-name">{el.name}</span>
      <span className="cell-mass">{mass(el)}</span>
    </a>
  );
}
