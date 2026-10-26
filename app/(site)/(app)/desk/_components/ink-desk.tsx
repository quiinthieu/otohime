"use client";

// The Ink Desk: the site's sections as objects on a paper desk, seen from above. Every object is a real link
// in the registry's order (lib/desk.ts), so the tab order and a screen reader read the desk the same way
// whatever lies on top. A press that travels DRAG_THRESHOLD px turns into a drag and the click is swallowed;
// a shorter one is a click. A dragged object follows the pointer on a spring (lib/spring.ts) and leans into
// the throw, then settles where it was dropped, which is kept in localStorage desk:v1 (parseDesk reads it
// back, garbled or blocked storage is a fresh desk). Tidy up springs everything home. In the cork corner the
// projects that share a tag are joined by a red string (lib/desk-string.ts), redrawn on every frame of a
// drag. Only the washi tape and the pins take touch-action: none, so a finger elsewhere still scrolls.
// Holding an item still for LONG_PRESS_MS (or a right click, Shift+F10, the menu key) opens a small radial
// menu: open, rotate, send to back; Esc closes it. A focused item also takes keys (lib/desk.ts deskKey):
// arrows nudge it NUDGE px (Shift: NUDGE_FAST), R rotates, [ and ] send it back or bring it front, and an
// aria-live line says what changed. A pickup and a send-to-back rustle, a drop and an open stamp (sound is
// off unless the visitor turned it on). The notebook's cover and pages turn about the spine on one spring:
// it peeks open under a hovering mouse or focus, and opening it turns every leaf before the page changes.
// Under reduced motion every spring snaps to its target and an open changes page at once. On a narrow or
// touch-first screen (STACKED) desk.css stacks the same markup as a list and the handlers stand aside.
import {
  DESK_ITEMS,
  DESK_KEY,
  MENU,
  NOTEBOOK_OPEN,
  NOTEBOOK_PEEK,
  NOTEBOOK_SHUT,
  bringToFront,
  defaultLayout,
  deskKey,
  deskSay,
  leafPose,
  menuSpots,
  moveTo,
  nudge,
  parseDesk,
  rotate,
  ROTATE_STEP,
  sendToBack,
  serializeDesk,
  tidy,
  type DeskLayout,
  type DeskNews,
  type MenuAction,
} from "@/lib/desk";
import { stringPath, type Point } from "@/lib/desk-string";
import { play } from "@/lib/sound-client";
import { advance, wobble, type Spring } from "@/lib/spring";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  anchor,
  CORK,
  dropAt,
  pastThreshold,
  PIN_PAIRS,
  pinHomes,
  PINS,
  rebase,
  STACKED,
  turn,
  type PinSpots,
  type Size,
} from "../_lib/drag";
import { longPress } from "../_lib/long-press";
import { DeskArt, PinCard } from "./desk-art";

// ---- the stored layout, shared by every tab -------------------------------------------------------------

const SERVER_LAYOUT = defaultLayout();
let layout: DeskLayout = SERVER_LAYOUT;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function readStored(): DeskLayout {
  try {
    return parseDesk(localStorage.getItem(DESK_KEY));
  } catch {
    return defaultLayout(); // storage blocked: a fresh desk
  }
}

// Another tab moved something, or cleared storage.
function onStorage(event: StorageEvent) {
  if (event.key !== DESK_KEY && event.key !== null) return;
  layout = parseDesk(event.key === null ? null : event.newValue);
  emit();
}

function subscribe(listener: () => void) {
  if (!loaded) {
    loaded = true;
    layout = readStored();
  }
  if (listeners.size === 0) addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) removeEventListener("storage", onStorage);
  };
}
const getLayout = () => layout;
// The server and the first client render lay out the default desk; the stored one follows hydration.
const getServerLayout = () => SERVER_LAYOUT;

function saveLayout(next: DeskLayout) {
  layout = next;
  try {
    localStorage.setItem(DESK_KEY, serializeDesk(next));
  } catch {
    // storage blocked: the desk keeps this visit
  }
  emit();
}

// ---- motion ---------------------------------------------------------------------------------------------

const REDUCED = "(prefers-reduced-motion: reduce)";
// The stacked desk (desk.css) is a list of links: nothing drags, holds or takes the desk's keys. Read in
// handlers only, never in render, so the server and the first client render stay the same markup.
const stacked = () => matchMedia(STACKED).matches;
const REST: Spring = { x: 0, v: 0 };
// The frame clock's zero for a loop that starts now (only ever read in event handlers).
const clock = () => performance.now();

// One body's offset from its committed spot: px on each axis and degrees, each on its own spring, with the
// targets the x and y springs are pulled toward (the rotation always springs to 0).
type Motion = { x: Spring; y: Spring; r: Spring; tx: number; ty: number };

// A press on a body, from pointerdown until it is let go.
type Press = {
  key: string;
  pointerId: number;
  startX: number;
  startY: number;
  // the offset target when the press began, so a press on a body still settling picks it up where it is
  baseX: number;
  baseY: number;
  size: Size;
  moved: boolean;
  // held still past the long press: the menu is open and the click this press ends with goes nowhere
  held: boolean;
};

// The notebook's leaves: how many have turned (a spring), what they are pulled to, whether frames are still
// needed, and what to do once the last leaf is over (the page change after an open).
type Flip = { s: Spring; to: number; live: boolean; then: (() => void) | null };

// The radial menu's choices sit this far from its centre, in px.
const MENU_RADIUS = 64;
const MENU_SPOTS = menuSpots(MENU.length, MENU_RADIUS);
// An open turns the leaves, then changes page once the last one is this close to over, or after FLIP_NAV_MS
// whatever the frames did (a throttled tab still gets there).
const FLIP_NAV_AT = 0.1;
const FLIP_NAV_MS = 900;

const labelOf = (id: string) => DESK_ITEMS.find((entry) => entry.id === id)?.label ?? id;

const itemKey = (id: string) => `item:${id}`;
const pinKey = (id: string) => `pin:${id}`;

// The CSS transform of a body at rest, before any offset: items hang from their centre, pins from their head.
const ITEM_BASE = "translate(-50%, -50%)";
const PIN_BASE = "translate(-50%, -0.5rem)";

const transform = (base: string, x: number, y: number, deg: number) =>
  `${base} translate(${round(x)}px, ${round(y)}px) rotate(${round(deg)}deg)`;
const round = (v: number) => Math.round(v * 100) / 100 || 0;

export function InkDesk({ labels }: { labels: { tidy: string; cork: string } }) {
  const desk = useSyncExternalStore(subscribe, getLayout, getServerLayout);
  const [pins, setPins] = useState<PinSpots>(pinHomes);

  const deskRef = useRef<HTMLDivElement>(null);
  const corkRef = useRef<HTMLDivElement>(null);
  const bodies = useRef(new Map<string, HTMLElement>());
  const paths = useRef(new Map<string, SVGPathElement>());
  const motion = useRef(new Map<string, Motion>());
  // What each body's transform is built from, as last committed: its base and its resting rotation.
  const rest = useRef(new Map<string, { base: string; rot: number }>());
  const pinsRef = useRef(pins);
  const corkPx = useRef(0);
  const press = useRef<Press | null>(null);
  // A drag just ended: the click it ends with is not a click on the link.
  const swallow = useRef(false);
  const frame = useRef(0);
  const last = useRef(0);
  const router = useRouter();
  const hintId = useId();
  // The item whose radial menu is open, if any.
  const [menu, setMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The aria-live line.
  const [said, setSaid] = useState("");
  const flip = useRef<Flip>({ s: REST, to: NOTEBOOK_SHUT, live: false, then: null });
  const leaves = useRef<(HTMLElement | null)[]>([]);
  // Fires LONG_PRESS_MS into a press on an item that has not moved; reads only refs and setters.
  const [hold] = useState(() =>
    longPress(() => {
      const p = press.current;
      if (!p || p.moved || !p.key.startsWith("item:")) return;
      p.held = true;
      // The menu opens under the pointer: keep its let-go on the item, so the press ends and its click is eaten.
      try {
        bodies.current.get(p.key)?.setPointerCapture(p.pointerId);
      } catch {
        // the pointer is already gone: its let-go was missed, and the next press starts over (onPointerDown)
      }
      openMenu(p.key.slice(5));
    }),
  );

  const motionOf = (key: string): Motion => {
    let m = motion.current.get(key);
    if (!m) {
      m = { x: REST, y: REST, r: REST, tx: 0, ty: 0 };
      motion.current.set(key, m);
    }
    return m;
  };

  function paint(key: string) {
    const el = bodies.current.get(key);
    const at = rest.current.get(key);
    if (!el || !at) return;
    const m = motion.current.get(key);
    el.style.transform = m ? transform(at.base, m.x.x, m.y.x, at.rot + m.r.x + wobble(m.x.v)) : transform(at.base, 0, 0, at.rot);
  }

  // The string follows the pins' heads as they are drawn now, offsets included.
  function paintStrings() {
    for (const [a, b] of PIN_PAIRS) {
      paths.current.get(`${a}~${b}`)?.setAttribute("d", stringPath(headOf(a), headOf(b)));
    }
  }
  function headOf(id: string): Point {
    const m = motion.current.get(pinKey(id));
    const spot = pinsRef.current[id];
    return anchor(spot, m ? { x: m.x.x, y: m.y.x } : { x: 0, y: 0 }, corkPx.current);
  }

  function paintLeaves() {
    leaves.current.forEach((el, i) => {
      if (!el) return;
      const pose = leafPose(flip.current.s.x, i);
      el.style.transform = `perspective(1200px) rotateY(${pose.deg}deg)`;
      el.style.zIndex = String(pose.z);
    });
  }

  // The open's last leaf is (nearly) over: change page, once.
  function flipLanded() {
    const f = flip.current;
    const then = f.then;
    f.then = null;
    then?.();
  }

  function tick(now: number) {
    const dt = (now - last.current) / 1000;
    last.current = now;
    const f = flip.current;
    if (f.live) {
      const s = advance(f.s, f.to, dt);
      f.s = s.state;
      f.live = !s.done;
      paintLeaves();
      if (f.then && (s.done || f.s.x >= f.to - FLIP_NAV_AT)) flipLanded();
    }
    const held = press.current?.moved ? press.current.key : null;
    for (const [key, m] of motion.current) {
      const x = advance(m.x, m.tx, dt);
      const y = advance(m.y, m.ty, dt);
      const r = advance(m.r, 0, dt);
      m.x = x.state;
      m.y = y.state;
      m.r = r.state;
      paint(key);
      // A body at rest on its spot needs no more frames; a held one keeps the loop going.
      if (x.done && y.done && r.done && m.tx === 0 && m.ty === 0 && key !== held) motion.current.delete(key);
    }
    paintStrings();
    frame.current = motion.current.size > 0 || f.live ? requestAnimationFrame(tick) : 0;
  }

  function kick() {
    if (matchMedia(REDUCED).matches) {
      // No springs and no lean: everything stands where it is pulled to.
      for (const [key, m] of motion.current) {
        m.x = { x: m.tx, v: 0 };
        m.y = { x: m.ty, v: 0 };
        m.r = REST;
        paint(key);
        if (m.tx === 0 && m.ty === 0 && press.current?.key !== key) motion.current.delete(key);
      }
      paintStrings();
      const f = flip.current;
      if (f.live) {
        f.s = { x: f.to, v: 0 };
        f.live = false;
        paintLeaves();
        flipLanded();
      }
      return;
    }
    if (frame.current) return;
    last.current = clock();
    frame.current = requestAnimationFrame(tick);
  }

  // After every commit, the rest poses are what React just drew; repaint before the browser does, so a moved
  // spot and its rebased offset land in the same frame.
  useLayoutEffect(() => {
    pinsRef.current = pins;
    for (const item of desk) rest.current.set(itemKey(item.id), { base: ITEM_BASE, rot: item.rot });
    for (const pin of PINS) rest.current.set(pinKey(pin.id), { base: PIN_BASE, rot: 0 });
    if (corkRef.current) corkPx.current = corkRef.current.getBoundingClientRect().width;
    for (const key of motion.current.keys()) paint(key);
    paintStrings();
  });

  useEffect(() => {
    const raf = frame;
    return () => {
      cancelAnimationFrame(raf.current);
      hold.cancel();
    };
  }, [hold]);

  // An open menu takes the focus, and a press anywhere outside it closes it.
  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [menu]);

  // A repeated line is still read out: it alternates a trailing no-break space.
  function say(id: string, news: DeskNews) {
    const line = deskSay(labelOf(id), news);
    setSaid((was) => (was === line ? `${line}\u00a0` : line));
  }

  // Turn the notebook's leaves toward a pose; then runs once the last leaf is over.
  function flipTo(to: number, then: (() => void) | null = null) {
    const f = flip.current;
    if (f.then && !then) return; // an open is under way: a hover or a blur does not undo it
    f.to = to;
    f.then = then;
    f.live = true;
    kick();
  }

  // Hover and focus only peek when motion is welcome: a cover snapping open under the mouse is just noise.
  function peek(open: boolean) {
    if (matchMedia(REDUCED).matches) return;
    flipTo(open ? NOTEBOOK_PEEK : NOTEBOOK_SHUT);
  }

  function openMenu(id: string) {
    setMenu(id);
    say(id, { type: "menu" });
  }

  // Close the menu; from the keyboard, the focus goes back to its item.
  function closeMenu(id: string, refocus: boolean) {
    setMenu(null);
    say(id, { type: "closed" });
    if (refocus) bodies.current.get(itemKey(id))?.querySelector<HTMLElement>(".desk-link")?.focus();
  }

  // Open an item: a stamp, then the page. The notebook turns its leaves first (at once if motion is reduced).
  function openItem(id: string) {
    const entry = DESK_ITEMS.find((e) => e.id === id);
    if (!entry) return;
    play("stamp");
    if (entry.kind !== "notebook") return router.push(entry.href);
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      router.push(entry.href);
    };
    setTimeout(go, FLIP_NAV_MS);
    flipTo(NOTEBOOK_OPEN, go);
  }

  // Rotate an item by a step: the committed angle moves now and the body springs round to it from where it is.
  function turnItem(id: string, by: number) {
    const item = layout.find((it) => it.id === id);
    if (!item) return;
    const next = rotate(layout, id, by);
    const rot = next.find((it) => it.id === id)?.rot ?? item.rot;
    const m = motionOf(itemKey(id));
    m.r = { x: m.r.x + turn(item.rot, rot), v: m.r.v };
    saveLayout(next);
    kick();
    say(id, { type: "rotated", rot });
  }

  // Nudge an item by px: the spot moves now and the body springs into it, the way a drop does.
  function nudgeItem(id: string, dx: number, dy: number) {
    const rect = deskRef.current?.getBoundingClientRect();
    const from = layout.find((it) => it.id === id);
    if (!rect || !from) return;
    const size = { w: rect.width, h: rect.height };
    const next = nudge(layout, id, dx, dy, size);
    const to = next.find((it) => it.id === id) ?? from;
    const m = motionOf(itemKey(id));
    const now = rebase({ x: m.x.x, y: m.y.x }, from, to, size);
    m.x = { x: now.x, v: m.x.v };
    m.y = { x: now.y, v: m.y.v };
    m.tx = 0;
    m.ty = 0;
    saveLayout(next);
    kick();
    say(id, { type: "moved", x: to.x, y: to.y });
  }

  function backItem(id: string) {
    play("rustle");
    saveLayout(sendToBack(layout, id));
    say(id, { type: "back" });
  }

  function frontItem(id: string) {
    saveLayout(bringToFront(layout, id));
    say(id, { type: "front" });
  }

  function choose(id: string, action: MenuAction) {
    if (action === "open") {
      setMenu(null);
      openItem(id);
    } else if (action === "rotate") {
      turnItem(id, ROTATE_STEP);
    } else {
      backItem(id);
      closeMenu(id, true);
    }
  }

  // A focused item's keys (lib/desk.ts deskKey). Modified keys stay the browser's.
  function onItemKey(id: string, event: ReactKeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || stacked()) return;
    const act = deskKey(event.key, event.shiftKey);
    if (!act) return;
    if (act.type === "close") {
      if (menu) closeMenu(menu, true);
      return;
    }
    event.preventDefault();
    if (act.type === "nudge") nudgeItem(id, act.dx, act.dy);
    else if (act.type === "rotate") turnItem(id, act.by);
    else if (act.type === "back") backItem(id);
    else if (act.type === "front") frontItem(id);
    else openMenu(id);
  }

  // The menu's keys: arrows go round it, Esc or Tab close it and hand the focus back to its item.
  function onMenuKey(id: string, event: ReactKeyboardEvent<HTMLElement>) {
    const buttons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus();
    switch (event.key) {
      case "Escape":
      case "Tab":
        event.preventDefault();
        closeMenu(id, true);
        return;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        return go(at + 1);
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        return go(at - 1);
      case "Home":
        event.preventDefault();
        return go(0);
      case "End":
        event.preventDefault();
        return go(-1);
    }
  }

  // A right click (or a touch browser's own long-press menu) opens the radial menu instead.
  function onContextMenu(id: string, event: ReactMouseEvent<HTMLElement>) {
    if (stacked()) return;
    event.preventDefault();
    hold.cancel();
    if (menu !== id) openMenu(id);
  }

  const surfaceOf = (key: string) => (key.startsWith("pin:") ? corkRef.current : deskRef.current);

  function onPointerDown(key: string, event: ReactPointerEvent<HTMLElement>) {
    swallow.current = false;
    // A hold whose let-go never came back to its item is over.
    if (press.current?.held) press.current = null;
    if (press.current || !event.isPrimary || event.button !== 0 || stacked()) return;
    const rect = surfaceOf(key)?.getBoundingClientRect();
    if (!rect) return;
    const m = motion.current.get(key);
    press.current = {
      key,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: m?.tx ?? 0,
      baseY: m?.ty ?? 0,
      size: { w: rect.width, h: rect.height },
      moved: false,
      held: false,
    };
    if (key.startsWith("pin:")) corkPx.current = rect.width;
    else hold.start(event.clientX, event.clientY);
  }

  function onPointerMove(key: string, event: ReactPointerEvent<HTMLElement>) {
    const p = press.current;
    if (!p || p.key !== key || p.pointerId !== event.pointerId || p.held) return;
    hold.move(event.clientX, event.clientY);
    const dx = event.clientX - p.startX;
    const dy = event.clientY - p.startY;
    if (!p.moved) {
      if (!pastThreshold(dx, dy)) return;
      p.moved = true;
      hold.cancel();
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = "";
      play("rustle");
      if (key.startsWith("item:")) {
        saveLayout(bringToFront(layout, key.slice(5)));
        if (key === itemKey("notes")) flipTo(NOTEBOOK_SHUT);
      }
    }
    const m = motionOf(key);
    m.tx = p.baseX + dx;
    m.ty = p.baseY + dy;
    kick();
  }

  // Let go: the body's new spot is committed, kept on its surface, and its offset rebased so it is drawn
  // where it is now and springs into the spot. A cancelled drag (the browser took the gesture) springs home.
  function onPointerEnd(key: string, event: ReactPointerEvent<HTMLElement>, dropped: boolean) {
    const p = press.current;
    if (!p || p.key !== key || p.pointerId !== event.pointerId) return;
    press.current = null;
    hold.cancel();
    // The click that follows this pointerup, if any, comes in the same task; nothing after it is swallowed.
    if (p.held) {
      swallow.current = true;
      setTimeout(() => (swallow.current = false), 0);
      return;
    }
    if (!p.moved) return;
    swallow.current = dropped;
    setTimeout(() => (swallow.current = false), 0);
    delete event.currentTarget.dataset.dragging;
    const m = motionOf(key);
    if (!dropped) {
      m.tx = p.baseX;
      m.ty = p.baseY;
      kick();
      return;
    }
    const id = key.slice(key.indexOf(":") + 1);
    const from = key.startsWith("pin:") ? pinsRef.current[id] : layout.find((item) => item.id === id);
    if (!from) return;
    play("stamp");
    const to = dropAt(from, m.tx, m.ty, p.size);
    const now = rebase({ x: m.x.x, y: m.y.x }, from, to, p.size);
    // The spring now pulls toward the spot itself, so a throw past the edge comes back onto the desk.
    m.x = { x: now.x, v: m.x.v };
    m.y = { x: now.y, v: m.y.v };
    m.tx = 0;
    m.ty = 0;
    if (key.startsWith("pin:")) setPins((spots) => ({ ...spots, [id]: to }));
    else saveLayout(moveTo(layout, id, to.x, to.y));
    kick();
  }

  // Everything springs home from where it is drawn now: items to their tidy spots, square, keeping the stack,
  // and the pins back to their places on the cork.
  function tidyUp() {
    const next = tidy(layout);
    const deskRect = deskRef.current?.getBoundingClientRect();
    const corkRect = corkRef.current?.getBoundingClientRect();
    if (deskRect) {
      const size = { w: deskRect.width, h: deskRect.height };
      for (const item of layout) {
        const home = next.find((n) => n.id === item.id);
        if (!home) continue;
        const m = motionOf(itemKey(item.id));
        const now = rebase({ x: m.x.x, y: m.y.x }, item, home, size);
        m.x = { x: now.x, v: m.x.v };
        m.y = { x: now.y, v: m.y.v };
        m.r = { x: m.r.x + turn(item.rot, home.rot), v: m.r.v };
        m.tx = 0;
        m.ty = 0;
      }
    }
    const homes = pinHomes();
    if (corkRect) {
      const size = { w: corkRect.width, h: corkRect.height };
      corkPx.current = corkRect.width;
      for (const pin of PINS) {
        const m = motionOf(pinKey(pin.id));
        const now = rebase({ x: m.x.x, y: m.y.x }, pinsRef.current[pin.id], homes[pin.id], size);
        m.x = { x: now.x, v: m.x.v };
        m.y = { x: now.y, v: m.y.v };
        m.tx = 0;
        m.ty = 0;
      }
    }
    saveLayout(next);
    setPins(homes);
    kick();
    setSaid(deskSay("", { type: "tidied" }));
  }

  const bind = (key: string) => ({
    ref: (el: HTMLElement | null) => {
      if (el) bodies.current.set(key, el);
      else bodies.current.delete(key);
    },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => onPointerDown(key, event),
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => onPointerMove(key, event),
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => onPointerEnd(key, event, true),
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => onPointerEnd(key, event, false),
  });

  // The click a drag or a long press ends with goes nowhere; any other click opens, with a stamp.
  const onClick = (event: ReactMouseEvent) => {
    if (!swallow.current) return play("stamp");
    swallow.current = false;
    event.preventDefault();
  };

  // An item's own click: as above, but a plain click on the notebook turns its leaves before the page changes.
  const onItemClick = (id: string, event: ReactMouseEvent) => {
    const plain = event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    if (swallow.current || !plain || id !== "notes") return onClick(event);
    event.preventDefault();
    openItem(id);
  };

  const setLeaf = (i: number, el: HTMLElement | null) => {
    leaves.current[i] = el;
  };

  const byId = new Map(desk.map((item) => [item.id, item]));
  const menuItem = menu ? byId.get(menu) : undefined;
  const heads = (id: string) => anchor(pins[id], { x: 0, y: 0 }, 0);

  return (
    <div className="desk-wrap">
      <div className="desk-bar">
        <button type="button" className="btn btn-sm" onClick={tidyUp}>
          {labels.tidy}
        </button>
      </div>
      <div ref={deskRef} className="desk" data-desk="">
        <div ref={corkRef} className="desk-cork" role="group" aria-label={labels.cork}>
          <svg className="desk-string" viewBox={`0 0 ${CORK.w} ${CORK.h}`} aria-hidden="true">
            {PIN_PAIRS.map(([a, b]) => (
              <path
                key={`${a}~${b}`}
                ref={(el) => {
                  if (el) paths.current.set(`${a}~${b}`, el);
                  else paths.current.delete(`${a}~${b}`);
                }}
                d={stringPath(heads(a), heads(b))}
              />
            ))}
          </svg>
          <ul className="desk-pins">
            {PINS.map((pin) => (
              <li
                key={pin.id}
                {...bind(pinKey(pin.id))}
                className="desk-pin"
                data-pin={pin.id}
                style={{ left: `${pins[pin.id].x * 100}%`, top: `${pins[pin.id].y * 100}%`, transform: transform(PIN_BASE, 0, 0, 0) }}
              >
                {/* Another root layout: a document hop, like the rows on /projects. */}
                <a href={pin.href} className="desk-pin-link" draggable={false} onClick={onClick}>
                  <PinCard title={pin.title} note={pin.note} />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <ul className="desk-items">
          {DESK_ITEMS.map((entry) => {
            const item = byId.get(entry.id);
            if (!item) return null;
            return (
              <li
                key={entry.id}
                {...bind(itemKey(entry.id))}
                onKeyDown={(event) => onItemKey(entry.id, event)}
                onContextMenu={(event) => onContextMenu(entry.id, event)}
                {...(entry.kind === "notebook"
                  ? {
                      onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => event.pointerType === "mouse" && peek(true),
                      onPointerLeave: () => peek(false),
                      onFocus: () => peek(true),
                      onBlur: () => peek(false),
                    }
                  : {})}
                className={`desk-item desk-${entry.kind}`}
                data-desk-item={entry.id}
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  zIndex: item.z + 1,
                  transform: transform(ITEM_BASE, 0, 0, item.rot),
                }}
              >
                <span className="desk-tape" aria-hidden="true" />
                <Link
                  href={entry.href}
                  className="desk-link"
                  draggable={false}
                  aria-describedby={hintId}
                  aria-haspopup="menu"
                  aria-expanded={menu === entry.id}
                  onClick={(event) => onItemClick(entry.id, event)}
                >
                  <DeskArt kind={entry.kind} id={entry.id} label={entry.label} leafRef={entry.kind === "notebook" ? setLeaf : undefined} />
                  <span className="sr-only">{entry.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {menu && menuItem && (
          <div
            ref={menuRef}
            className="desk-menu"
            role="menu"
            aria-label={`${labelOf(menu)} menu`}
            data-desk-menu={menu}
            // kept far enough in that its choices are not clipped at the desk's edge
            style={{
              left: `clamp(5.5rem, ${menuItem.x * 100}%, calc(100% - 5.5rem))`,
              top: `clamp(4.5rem, ${menuItem.y * 100}%, calc(100% - 4.5rem))`,
            }}
            onKeyDown={(event) => onMenuKey(menu, event)}
          >
            {MENU.map((choice, i) => (
              <button
                key={choice.action}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="btn btn-sm desk-menu-item"
                data-menu={choice.action}
                style={{ transform: `translate(-50%, -50%) translate(${MENU_SPOTS[i].x}px, ${MENU_SPOTS[i].y}px)` }}
                onClick={() => choose(menu, choice.action)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p id={hintId} className="sr-only">
        Arrow keys move it, with Shift for bigger steps. R rotates it, open bracket sends it to the back, close bracket
        brings it to the front, and Shift F10 opens its menu.
      </p>
      <p className="sr-only" aria-live="polite" data-desk-said="">
        {said}
      </p>
    </div>
  );
}
