"use client";

// Fan-out peeks, the shared layer: one per page, mounted by the (app) layout.
// It listens on the document for elements marked data-peek="<key>"
// (lib/peek-marks.ts) and fans the key's three related items out as paper
// cards from under the pointer, then tucks them back.
//   mouse   hover with intent (HOVER_MS); leaving link and cards closes
//   keys    keyboard focus opens at once; Down arrow walks into the cards,
//           arrows move between them, Escape closes and returns to the link
//   touch   a long-press (PRESS_MS) opens and swallows the click; moving the
//           finger cancels; a plain tap still follows the link
//   button  a marked button (a credit) toggles on click, Enter or Space
// The marked element keeps its own behaviour, and with no layer (no script,
// no /peeks.json) it is just a link. Cards are ordinary links; following one
// tucks the fan away inside the navigation's view transition.
import { PEEK_HINT_ID, peeksFor, type PeekIndex, type PeekItem } from "@/lib/peeks";
import { fanOrigin, placePeek, type PeekAnchor } from "@/lib/peek-place";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, ViewTransition, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";

const HOVER_MS = 250;
const LEAVE_MS = 220;
const PRESS_MS = 450;
const PRESS_SLOP = 10;
const TUCK_MS = 200;
const PANEL_ID = "peek-panel";
const TRIGGER = "[data-peek]";
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const KIND_LABEL: Record<PeekItem["kind"], string> = { sketch: "Sketch", note: "Note", project: "Project", article: "Gazette" };

type Via = "hover" | "focus" | "touch" | "click";
type Open = { n: number; label: string; items: PeekItem[]; via: Via; anchor: PeekAnchor; path: string; closing: boolean };

let loading: Promise<PeekIndex | null> | null = null;
function loadIndex(): Promise<PeekIndex | null> {
  loading ??= fetch("/peeks.json")
    .then((r) => (r.ok ? (r.json() as Promise<PeekIndex>) : null))
    .catch(() => null);
  return loading;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pointAnchor = (x: number, y: number): PeekAnchor => ({ x, top: y, bottom: y });
const boxAnchor = (el: Element): PeekAnchor => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom };
};
const triggerOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>(TRIGGER) : null;
const nameOf = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
const pathOf = (href: string) => new URL(href, window.location.href).pathname;

// The hint is in the static shell for every marked link; the fan reads the path, so it waits behind Suspense.
export function PeekLayer() {
  return (
    <>
      <span id={PEEK_HINT_ID} hidden>
        Shows three related items. Press Down arrow to reach them, Escape to close.
      </span>
      <Suspense fallback={null}>
        <Fan />
      </Suspense>
    </>
  );
}

function Fan() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Open | null>(null);
  const live = useRef<Open | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const closer = useRef<(now?: boolean) => void>(() => {});
  const renamed = useRef<{ el: HTMLElement; value: string }[]>([]);

  useLayoutEffect(() => {
    live.current = open;
  }, [open]);

  // Place the fan before it paints: inside the viewport, its cards pivoting on the anchor.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
    const place = placePeek(open.anchor, { width: el.offsetWidth, height: el.offsetHeight }, viewport);
    el.style.left = `${place.left}px`;
    el.style.top = `${place.top}px`;
    el.dataset.side = place.above ? "above" : "below";
    const origin = fanOrigin(open.anchor, place);
    for (const card of el.querySelectorAll<HTMLElement>(".peek-card")) {
      card.style.transformOrigin = `${origin.x - card.offsetLeft}px ${origin.y - card.offsetTop}px`;
    }
  }, [open]);

  // The fan leaves with its page inside the navigation (see `shown`); this drops what is left of it after.
  useEffect(() => {
    if (live.current && live.current.path !== pathname) closer.current(true);
  }, [pathname]);

  useEffect(() => {
    const t = { hover: 0, leave: 0, press: 0, tuck: 0 };
    const clear = (name: keyof typeof t) => {
      window.clearTimeout(t[name]);
      t[name] = 0;
    };
    let wanted = 0;
    let count = 0;
    let press: { el: HTMLElement; x: number; y: number } | null = null;
    let swallow: HTMLElement | null = null;
    let refocusing = false;

    const show = (next: Open | null) => {
      live.current = next;
      setOpen(next);
    };
    const release = (el: HTMLElement | null) => {
      el?.removeAttribute("aria-expanded");
      el?.removeAttribute("aria-controls");
    };
    const inPanel = (node: EventTarget | null) => node instanceof Node && !!panel.current?.contains(node);
    const inTrigger = (node: EventTarget | null) => node instanceof Node && !!trigger.current?.contains(node);
    const openFor = (el: HTMLElement | null) => !!el && !!live.current && !live.current.closing && trigger.current === el;

    const close = (now = false) => {
      wanted++;
      clear("hover");
      clear("leave");
      const current = live.current;
      if (!current) return;
      release(trigger.current);
      if (now || reduced()) {
        clear("tuck");
        show(null);
        return;
      }
      if (current.closing) return;
      show({ ...current, closing: true });
      t.tuck = window.setTimeout(() => {
        if (live.current?.n === current.n) show(null);
      }, TUCK_MS);
    };
    closer.current = close;

    // Ask for el's peek; it opens once the index is in, unless something else was asked for since.
    const request = (el: HTMLElement, via: Via, anchor: PeekAnchor) => {
      const ticket = ++wanted;
      const key = el.dataset.peek ?? "";
      void loadIndex().then((index) => {
        if (ticket !== wanted || !index || !el.isConnected) return;
        const items = peeksFor(index, key);
        if (!items.length) return;
        clear("tuck");
        if (trigger.current !== el) release(trigger.current);
        trigger.current = el;
        el.setAttribute("aria-expanded", "true");
        el.setAttribute("aria-controls", PANEL_ID);
        show({ n: ++count, label: nameOf(el), items, via, anchor, path: window.location.pathname, closing: false });
      });
    };

    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (inPanel(e.target)) {
        clear("leave");
        return;
      }
      const el = triggerOf(e.target);
      if (!el) return;
      if (openFor(el)) {
        clear("leave");
        return;
      }
      void loadIndex();
      clear("hover");
      let x = e.clientX;
      let y = e.clientY;
      const follow = (m: PointerEvent) => {
        x = m.clientX;
        y = m.clientY;
      };
      el.addEventListener("pointermove", follow);
      el.addEventListener("pointerleave", () => el.removeEventListener("pointermove", follow), { once: true });
      t.hover = window.setTimeout(() => {
        t.hover = 0;
        el.removeEventListener("pointermove", follow);
        if (el.matches(":hover")) request(el, "hover", pointAnchor(x, y));
      }, HOVER_MS);
    };

    const onPointerOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const from = triggerOf(e.target);
      const to = e.relatedTarget;
      if (from && !(to instanceof Node && from.contains(to))) clear("hover");
      const current = live.current;
      if (!current || current.via !== "hover" || current.closing) return;
      if (!inTrigger(e.target) && !inPanel(e.target)) return;
      if (inPanel(to) || inTrigger(to)) return;
      clear("leave");
      t.leave = window.setTimeout(() => close(), LEAVE_MS);
    };

    const onPointerDown = (e: PointerEvent) => {
      swallow = null;
      if (live.current && !inPanel(e.target) && !inTrigger(e.target)) close();
      if (e.pointerType !== "touch" || !e.isPrimary) return;
      const el = triggerOf(e.target);
      if (!el) return;
      void loadIndex();
      const start = { el, x: e.clientX, y: e.clientY };
      press = start;
      clear("press");
      t.press = window.setTimeout(() => {
        if (press !== start) return;
        swallow = el;
        request(el, "touch", pointAnchor(start.x, start.y));
      }, PRESS_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!press || e.pointerType !== "touch" || swallow) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS_SLOP) {
        clear("press");
        press = null;
      }
    };

    const onPointerEnd = () => {
      clear("press");
      press = null;
    };

    // A long-press is ours: no context menu, and the click it ends in does not follow the link.
    const onContextMenu = (e: MouseEvent) => {
      const el = triggerOf(e.target);
      if (el && (press?.el === el || swallow === el)) e.preventDefault();
    };

    const onClick = (e: MouseEvent) => {
      const el = triggerOf(e.target);
      if (swallow && el === swallow) {
        swallow = null;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      swallow = null;
      if (!el || el.tagName !== "BUTTON") return;
      clear("hover");
      const current = live.current;
      if (current && openFor(el)) {
        if (current.via === "hover") show({ ...current, via: "click" });
        else close();
        return;
      }
      request(el, "click", e.detail === 0 ? boxAnchor(el) : pointAnchor(e.clientX, e.clientY));
    };

    const onFocusIn = (e: FocusEvent) => {
      if (inPanel(e.target)) {
        clear("leave");
        return;
      }
      const el = e.target instanceof HTMLElement && e.target.matches(TRIGGER) ? e.target : null;
      if (!el || refocusing || openFor(el) || !el.matches(":focus-visible")) return;
      request(el, "focus", boxAnchor(el));
    };

    const onFocusOut = (e: FocusEvent) => {
      const current = live.current;
      if (!current || current.via === "hover") return;
      if (!inPanel(e.target) && !inTrigger(e.target)) return;
      if (!inPanel(e.relatedTarget) && !inTrigger(e.relatedTarget)) close();
    };

    const refocus = (el: HTMLElement) => {
      refocusing = true;
      el.focus({ preventScroll: true });
      refocusing = false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const current = live.current;
      if (!current || current.closing) return;
      const active = document.activeElement;
      const from = trigger.current;
      if (e.key === "Escape") {
        e.preventDefault();
        const back = inPanel(active) || inTrigger(active);
        close();
        if (back && from) refocus(from);
        return;
      }
      const cards = [...(panel.current?.querySelectorAll<HTMLElement>(".peek-card") ?? [])];
      if (!cards.length) return;
      if (inTrigger(active) && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        cards[e.key === "ArrowDown" ? 0 : cards.length - 1].focus({ preventScroll: true });
        return;
      }
      if (!inPanel(active)) return;
      const i = cards.indexOf(active as HTMLElement);
      const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key];
      if (step) {
        e.preventDefault();
        cards[(i + step + cards.length) % cards.length].focus({ preventScroll: true });
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        cards[e.key === "Home" ? 0 : cards.length - 1].focus({ preventScroll: true });
      } else if (e.key === "Tab" && from && (e.shiftKey ? i === 0 : i === cards.length - 1)) {
        // The cards sit at the end of the page; Tab leaves them where the link sits.
        e.preventDefault();
        if (e.shiftKey) {
          refocus(from);
          return;
        }
        const order = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
          (n) => !panel.current?.contains(n) && n.getClientRects().length > 0,
        );
        const next = order[order.indexOf(from) + 1];
        close();
        if (next) next.focus();
        else refocus(from);
      }
    };

    // A fan under the pointer cannot follow a scroll; one under a focused link or a pressed button moves with it.
    const onMove = () => {
      const current = live.current;
      if (!current || current.closing) return;
      if ((current.via === "focus" || current.via === "click") && trigger.current?.isConnected) {
        show({ ...current, anchor: boxAnchor(trigger.current) });
      } else close(true);
    };

    // Back from the back-forward cache: no fan, and the names a card borrowed go home.
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      for (const { el, value } of renamed.current) el.style.viewTransitionName = value;
      renamed.current = [];
      close(true);
    };

    const on: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [
      [document, "pointerover", onPointerOver as EventListener],
      [document, "pointerout", onPointerOut as EventListener],
      [document, "pointerdown", onPointerDown as EventListener],
      [document, "pointermove", onPointerMove as EventListener, { passive: true }],
      [document, "pointerup", onPointerEnd],
      [document, "pointercancel", onPointerEnd],
      [document, "contextmenu", onContextMenu as EventListener],
      [window, "click", onClick as EventListener, { capture: true }],
      [document, "focusin", onFocusIn as EventListener],
      [document, "focusout", onFocusOut as EventListener],
      [document, "keydown", onKeyDown as EventListener],
      [window, "scroll", onMove, { passive: true, capture: true }],
      [window, "resize", onMove],
      [window, "pageshow", onPageShow as EventListener],
    ];
    for (const [target, type, fn, opts] of on) target.addEventListener(type, fn, opts);
    return () => {
      for (const [target, type, fn, opts] of on) target.removeEventListener(type, fn, opts);
      for (const name of Object.keys(t) as (keyof typeof t)[]) clear(name);
    };
  }, []);

  const follow = (e: ReactMouseEvent<HTMLAnchorElement>, item: PeekItem) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Same page (a #section of it): nothing navigates, so the fan tucks away now.
    if (pathOf(item.href) === window.location.pathname) {
      closer.current();
      return;
    }
    // A project card hops to another root layout: its title takes the name the project's h1 answers to, and
    // a cartridge that already carries that name on this page lends it, so the hop has exactly one of each.
    if (item.kind !== "project" || !/^\/[a-z0-9-]+$/.test(item.href) || item.href === "/projects") return;
    const name = `project-${item.href.slice(1)}`;
    for (const el of document.querySelectorAll<HTMLElement>(".project-title")) {
      if (getComputedStyle(el).viewTransitionName !== name) continue;
      renamed.current.push({ el, value: el.style.viewTransitionName });
      el.style.viewTransitionName = "none";
    }
    const title = e.currentTarget.querySelector<HTMLElement>(".peek-title");
    if (title) title.style.viewTransitionName = name;
  };

  const shown = open && open.path === pathname ? open : null;

  return shown ? (
    <ViewTransition exit="peek-out" default="none">
      <div
        key={shown.n}
        ref={panel}
        id={PANEL_ID}
        role="group"
        aria-label={`Related to ${shown.label}`}
        className="peek-layer"
        data-state={shown.closing ? "closing" : "open"}
        data-via={shown.via}
      >
        {shown.items.map((item, k) => (
          <Link
            key={`${item.kind}:${item.href}:${item.title}`}
            href={item.href}
            className="peek-card"
            data-kind={item.kind}
            style={{ "--k": k } as CSSProperties}
            tabIndex={shown.closing ? -1 : undefined}
            onClick={(e) => follow(e, item)}
          >
            {item.src ? <Image src={item.src} alt="" width={144} height={96} sizes="144px" className="peek-thumb" /> : null}
            <span className="peek-kind">{KIND_LABEL[item.kind]}</span>
            <span className="peek-title">{item.title}</span>
            <span className="peek-blurb">{item.blurb}</span>
          </Link>
        ))}
      </div>
    </ViewTransition>
  ) : null;
}
