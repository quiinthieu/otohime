"use client";

// The Ink Desk: the site's sections as objects on a paper desk, seen from above. Every object is a real link
// in the registry's order (lib/desk.ts), so the tab order and a screen reader read the desk the same way
// whatever lies on top. A press that travels DRAG_THRESHOLD px turns into a drag and the click is swallowed;
// a shorter one is a click. A dragged object follows the pointer on a spring (lib/spring.ts) and leans into
// the throw, then settles where it was dropped, which is kept in localStorage desk:v1 (parseDesk reads it
// back, garbled or blocked storage is a fresh desk). Tidy up springs everything home. In the cork corner the
// projects that share a tag are joined by a red string (lib/desk-string.ts), redrawn on every frame of a
// drag. Only the washi tape and the pins take touch-action: none, so a finger elsewhere still scrolls.
import { DESK_ITEMS, DESK_KEY, bringToFront, defaultLayout, moveTo, parseDesk, serializeDesk, tidy, type DeskLayout } from "@/lib/desk";
import { stringPath, type Point } from "@/lib/desk-string";
import { advance, wobble, type Spring } from "@/lib/spring";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { anchor, CORK, dropAt, pastThreshold, PIN_PAIRS, pinHomes, PINS, rebase, turn, type PinSpots, type Size } from "../_lib/drag";
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
};

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

  function tick(now: number) {
    const dt = (now - last.current) / 1000;
    last.current = now;
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
    frame.current = motion.current.size > 0 ? requestAnimationFrame(tick) : 0;
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
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const surfaceOf = (key: string) => (key.startsWith("pin:") ? corkRef.current : deskRef.current);

  function onPointerDown(key: string, event: ReactPointerEvent<HTMLElement>) {
    swallow.current = false;
    if (press.current || !event.isPrimary || event.button !== 0) return;
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
    };
    if (key.startsWith("pin:")) corkPx.current = rect.width;
  }

  function onPointerMove(key: string, event: ReactPointerEvent<HTMLElement>) {
    const p = press.current;
    if (!p || p.key !== key || p.pointerId !== event.pointerId) return;
    const dx = event.clientX - p.startX;
    const dy = event.clientY - p.startY;
    if (!p.moved) {
      if (!pastThreshold(dx, dy)) return;
      p.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = "";
      if (key.startsWith("item:")) saveLayout(bringToFront(layout, key.slice(5)));
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
    if (!p.moved) return;
    // The click that follows this pointerup, if any, comes in the same task; nothing after it is swallowed.
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

  // The click a drag ends with goes nowhere.
  const onClick = (event: React.MouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    event.preventDefault();
  };

  const byId = new Map(desk.map((item) => [item.id, item]));
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
                <Link href={entry.href} className="desk-link" draggable={false} onClick={onClick}>
                  <DeskArt kind={entry.kind} id={entry.id} label={entry.label} />
                  <span className="sr-only">{entry.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
