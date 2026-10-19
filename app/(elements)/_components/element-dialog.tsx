"use client";

import { useEffect, useRef, type Dispatch, type KeyboardEvent, type MouseEvent } from "react";
import { ELEMENTS } from "../_lib/elements.ts";
import { FIRST, LAST, type View, type ViewAction } from "../_lib/view.ts";
import { BohrSvg } from "./bohr-svg";
import { ElementDetail } from "./element-detail";

const NAME_ID = "element-dialog-name";

// The detail view: one native <dialog> opened with showModal(), so the browser
// traps focus and makes the page inert. Esc (cancel then close), the Close
// button and a click on the backdrop all end in the dialog's close event, and
// onClosed puts focus back on the cell that opened it. A bottom sheet under
// 768 px (elements.css). The URL never changes.
export function ElementDialog({
  state,
  dispatch,
  onClosed,
}: {
  state: View;
  dispatch: Dispatch<ViewAction>;
  onClosed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const n = state.open;

  useEffect(() => {
    const d = dialog.current;
    if (n !== null && d && !d.open) d.showModal();
  }, [n]);

  // Stepping onto 1 or 118 disables the button just pressed; keep focus in the dialog.
  useEffect(() => {
    if (n === FIRST && document.activeElement === prev.current) next.current?.focus();
    if (n === LAST && document.activeElement === next.current) prev.current?.focus();
  }, [n]);

  const close = () => dialog.current?.close();

  // The inner wrapper fills the dialog, so a click whose target is the dialog
  // itself landed on the backdrop.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "ArrowLeft") dispatch({ type: "prev" });
    else if (e.key === "ArrowRight") dispatch({ type: "next" });
    else return;
    e.preventDefault();
  };

  const el = n === null ? null : ELEMENTS[n - 1];

  return (
    <dialog
      ref={dialog}
      className="element-dialog"
      aria-labelledby={el ? NAME_ID : undefined}
      onClose={onClosed}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {el && (
        <div className="dialog-body">
          <div className="dialog-bar">
            <span className="dialog-grip" aria-hidden="true" />
            <button type="button" className="button dialog-close" onClick={close}>
              Close
            </button>
          </div>
          <ElementDetail el={el} headingId={NAME_ID} viewport={<BohrSvg el={el} />} />
          <nav className="dialog-steps" aria-label="Other elements">
            <button
              ref={prev}
              type="button"
              className="button"
              disabled={el.number === FIRST}
              onClick={() => dispatch({ type: "prev" })}
            >
              <span aria-hidden="true">←</span> Previous
              {el.number > FIRST && <span className="step-name">{ELEMENTS[el.number - 2].name}</span>}
            </button>
            <button
              ref={next}
              type="button"
              className="button"
              disabled={el.number === LAST}
              onClick={() => dispatch({ type: "next" })}
            >
              Next <span aria-hidden="true">→</span>
              {el.number < LAST && <span className="step-name">{ELEMENTS[el.number].name}</span>}
            </button>
          </nav>
        </div>
      )}
    </dialog>
  );
}
