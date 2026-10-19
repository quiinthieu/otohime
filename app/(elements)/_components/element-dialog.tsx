"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { neutronsOf, nucleus } from "../_lib/atom.ts";
import { ELEMENTS, type Element } from "../_lib/elements.ts";
import { FIRST, LAST, type View, type ViewAction } from "../_lib/view.ts";
import { hasWebGL } from "../_lib/webgl.ts";
import { BohrSvg } from "./bohr-svg";
import { ElementDetail } from "./element-detail";

const NAME_ID = "element-dialog-name";

// The element on show, for the 3D chunk's loading state: next/dynamic passes
// loading() no props, so the Bohr SVG it shows meanwhile reads it from here.
const Shown = createContext<Element | null>(null);

function Loading() {
  const el = useContext(Shown);
  return el && <BohrSvg el={el} />;
}

// The only way into three, fiber and drei: requested after the first open.
const Atom3D = dynamic(() => import("./atom-3d"), { ssr: false, loading: Loading });

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeMotion(change: () => void) {
  const mq = matchMedia(REDUCE);
  mq.addEventListener("change", change);
  return () => mq.removeEventListener("change", change);
}
const reducedNow = () => matchMedia(REDUCE).matches;
const reducedOnServer = () => false;

// The 3D atom once it is wanted and the browser can draw it, else the Bohr SVG.
// "none" until the first open, so nothing asks for the chunk before a click.
type Viewer = "none" | "3d" | "svg";

function Viewport({ el, viewer, active, onFail }: { el: Element; viewer: Viewer; active: boolean; onFail: () => void }) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, reducedNow, reducedOnServer);
  if (viewer !== "3d") return <BohrSvg el={el} />;
  const nuc = nucleus(el.number, neutronsOf(el));
  return (
    <figure className="bohr">
      <Atom3D element={el} reducedMotion={reducedMotion} active={active} onFail={onFail} />
      <figcaption>
        {"Bohr model: a simplified picture"}
        {nuc.label && <span>{` · nucleus ${nuc.label}`}</span>}
      </figcaption>
    </figure>
  );
}

// The detail view: one native <dialog> opened with showModal(), so the browser
// traps focus and makes the page inert. Esc (cancel then close), the Close
// button and a click on the backdrop all end in the dialog's close event, and
// onClosed puts focus back on the cell that opened it. A bottom sheet under
// 768 px (elements.css). The URL never changes. The viewport is the Bohr SVG
// until the first open asks for the 3D chunk, and stays the SVG without WebGL.
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
  // The body stays rendered with the last element after closing, so the 3D
  // Canvas (and its WebGL context) persists across close and reopen.
  const [last, setLast] = useState<number | null>(null);
  if (n !== null && n !== last) setLast(n);
  const [viewer, setViewer] = useState<Viewer>("none");
  if (n !== null && viewer === "none") setViewer(hasWebGL() ? "3d" : "svg");

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

  const shown = n ?? last;
  const el = shown === null ? null : ELEMENTS[shown - 1];

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
          <Shown value={el}>
            <ElementDetail
              el={el}
              headingId={NAME_ID}
              viewport={<Viewport el={el} viewer={viewer} active={n !== null} onFail={() => setViewer("svg")} />}
            />
          </Shown>
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
