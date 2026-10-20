"use client";

import { useReducer, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent } from "react";
import { CATEGORIES, type CategoryId } from "../_lib/categories.ts";
import { ELEMENTS } from "../_lib/elements.ts";
import { MARKERS, neighbour, rowEnd, rowStart, type Direction } from "../_lib/grid.ts";
import { closed, view } from "../_lib/view.ts";
import { Cell } from "./cell";
import { ElementDialog } from "./element-dialog";
import { Legend } from "./legend";
import { tint } from "./tint.ts";

const ARROWS = new Set<string>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
const noop = () => () => {};

const cellOf = (target: EventTarget) =>
  target instanceof Element ? target.closest<HTMLAnchorElement>("a[data-element]") : null;
const numberOf = (a: HTMLAnchorElement) => Number(a.dataset.element);

// The table's behaviour, over cells that are plain links in the server HTML.
// After hydration the cells share one tab stop (roving tabindex): arrow keys
// move between elements, skipping gaps, Home and End go to the ends of the row.
// A plain click, Enter or Space opens the dialog; a click with a modifier or a
// middle click follows the link as usual. The legend sets data-focus on the
// table, and elements.css dims the other categories. When the dialog closes the
// table is marked settling (data-settle) until the pointer next moves, so a cell
// that only became hovered because the backdrop went away does not lift.
export function Table() {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [active, setActive] = useState(1);
  const [preview, setPreview] = useState<CategoryId | null>(null);
  const [pinned, setPinned] = useState<CategoryId | null>(null);
  const [settle, setSettle] = useState(false);
  const [state, dispatch] = useReducer(view, closed);
  const grid = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLAnchorElement | null>(null);
  // Space opens on keyup, so the keyup cannot land on the dialog's Close button.
  const spaceDown = useRef<number | null>(null);

  const focusCell = (n: number) => {
    setActive(n);
    grid.current?.querySelector<HTMLAnchorElement>(`a[data-element="${n}"]`)?.focus();
  };

  const open = (a: HTMLAnchorElement) => {
    opener.current = a;
    setActive(numberOf(a));
    dispatch({ type: "open", n: numberOf(a) });
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = cellOf(e.target);
    if (!a || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    open(a);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const a = cellOf(e.target);
    if (!a || e.altKey || e.ctrlKey || e.metaKey) return;
    const n = numberOf(a);
    if (ARROWS.has(e.key)) focusCell(neighbour(n, e.key as Direction, ELEMENTS));
    else if (e.key === "Home") focusCell(rowStart(n, ELEMENTS));
    else if (e.key === "End") focusCell(rowEnd(n, ELEMENTS));
    else if (e.key === " ") spaceDown.current = n;
    else return;
    e.preventDefault();
  };

  const onKeyUp = (e: KeyboardEvent<HTMLDivElement>) => {
    const a = cellOf(e.target);
    if (e.key !== " " || !a) return;
    e.preventDefault();
    if (spaceDown.current === numberOf(a)) open(a);
    spaceDown.current = null;
  };

  const onClosed = () => {
    dispatch({ type: "close" });
    setSettle(true);
    opener.current?.focus();
  };

  const focus = preview ?? pinned;

  return (
    <>
      <Legend pinned={pinned} onPreview={setPreview} onPin={(id) => setPinned((p) => (p === id ? null : id))} />
      <div className="scroller" role="region" aria-label="Periodic table">
        <div
          ref={grid}
          className="table"
          data-focus={focus ?? undefined}
          data-settle={settle || undefined}
          onPointerMove={settle ? () => setSettle(false) : undefined}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onFocus={(e) => {
            const a = cellOf(e.target);
            if (a) setActive(numberOf(a));
          }}
        >
          {ELEMENTS.map((el) => (
            <Cell key={el.number} el={el} tabIndex={hydrated ? (el.number === active ? 0 : -1) : undefined} />
          ))}
          {MARKERS.map((m) => {
            const cat = CATEGORIES.find((c) => c.id === m.series)!;
            return (
              <div
                key={m.series}
                className="marker tint"
                data-cat={cat.id}
                style={{ ...tint(cat), gridColumn: m.col, gridRow: m.row }}
              >
                <span className="marker-range">{m.label}</span>
                <span className="marker-name">{`${cat.label}s`}</span>
              </div>
            );
          })}
        </div>
      </div>
      <ElementDialog state={state} dispatch={dispatch} onClosed={onClosed} />
    </>
  );
}
