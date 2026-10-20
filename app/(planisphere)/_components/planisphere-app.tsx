"use client";

import { useEffect, useReducer, useRef, useSyncExternalStore, type ChangeEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { litPath, moonPosition, moonSentence, phase } from "../_lib/moon.ts";
import { dateTickAngle, discPoint, discRotation, framePoint, hemisphereOf, hourTickAngle, upNow, type StarLike } from "../_lib/sky.ts";
import { sunAltitude, sunPosition } from "../_lib/sun.ts";
import { localToUtc, lstHours } from "../_lib/time.ts";
import { placeName, reducer, toQuery, type State } from "../_lib/wheel.ts";

// The one client island. The server draws the chart (the ink, the window and
// the star disc) and passes it in as children, so rough.js and the star data
// never reach the browser; with JavaScript off that HTML is the whole page.
// Hydrated, the island turns the disc: dragging it, the arrow keys, Now. Each
// change of hour or date rewrites the few things that follow from the time
// (the disc's rotate(), the Sun and Moon, the daylight flag, the Moon corner,
// the "up now" line, the form) straight in the server's markup, and the URL
// through history.replaceState. A new place needs a new window, so a city
// change and "Use my location" navigate and the server inks it again.

const UP_SHOWN = 14;
const HOUR_MS = 3_600_000;

const pad2 = (n: number) => String(n).padStart(2, "0");
const clock = (hour: number) => {
  const minutes = Math.round(hour * 60);
  return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
};
const r1 = (n: number) => String(Number(n.toFixed(1)) + 0);
const wrap180 = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
const hydrated = (): Element | null => document.querySelector("[data-actions]");
const noop = () => () => {};
const noMount = () => null;

/** The disc's angle in degrees for a state. */
function rotationOf(state: State): number {
  const ms = localToUtc(state.date, state.hour, state.place.tz);
  return discRotation(lstHours(ms, state.place.lon), hemisphereOf(state.place.lat));
}

/** How far the disc turns, in degrees, for one more clock hour. */
function degreesPerHour(state: State): number {
  const ms = localToUtc(state.date, state.hour, state.place.tz);
  const hemisphere = hemisphereOf(state.place.lat);
  const at = (t: number) => discRotation(lstHours(t, state.place.lon), hemisphere);
  return wrap180(at(ms + HOUR_MS) - at(ms));
}

const attr = (el: Element | null, name: string) => Number(el?.getAttribute(name) ?? 0);
const setText = (el: Element | null, text: string) => {
  if (el && el.textContent !== text) el.textContent = text;
};

type Spin = { angle: number | null };

/** Rewrite everything in the server's markup that follows from the time. */
function paint(root: HTMLElement, state: State, named: readonly StarLike[], spin: Spin) {
  const { place } = state;
  const hemisphere = hemisphereOf(place.lat);
  const ms = localToUtc(state.date, state.hour, place.tz);
  const rotation = rotationOf(state);
  const when = `${state.date} ${clock(state.hour)}`;
  const name = placeName(state);

  // One continuous angle, so a turn across 0° takes the short way round.
  const from = spin.angle ?? rotation;
  spin.angle = from + wrap180(rotation - from);
  for (const el of root.querySelectorAll<SVGElement>("[data-disc], [data-rim]")) {
    el.style.transform = `rotate(${r1(spin.angle)}deg)`;
  }
  const disc = root.querySelector("[data-disc]");
  disc?.setAttribute("aria-valuenow", String(state.hour));
  disc?.setAttribute("aria-valuetext", clock(state.hour));

  const R = attr(root.querySelector(".frame-face"), "r");
  const place2 = (selector: string, ra: number, dec: number) => {
    const el = root.querySelector(selector);
    const at = discPoint(ra, dec, place.lat, R);
    if (!el) return;
    if (at) {
      el.setAttribute("transform", `translate(${r1(at.x)} ${r1(at.y)})`);
      el.removeAttribute("visibility");
    } else el.setAttribute("visibility", "hidden");
  };
  const sun = sunPosition(ms);
  place2("[data-sun]", sun.ra, sun.dec);
  const moon = moonPosition(ms);
  place2("[data-moon]", moon.ra, moon.dec);

  const phaseDeg = phase(ms);
  const moonDisc = root.querySelector("[data-moon] .moon-lit");
  moonDisc?.setAttribute("d", litPath(phaseDeg, attr(root.querySelector("[data-moon] .moon-dark"), "r")));
  const corner = root.querySelector(".moon-corner");
  corner?.setAttribute("data-phase", phaseDeg.toFixed(1));
  corner?.querySelector(".moon-lit")?.setAttribute("d", litPath(phaseDeg, attr(corner.querySelector(".moon-dark"), "r")));
  setText(corner?.querySelector("p") ?? null, moonSentence(phaseDeg));

  // The date and the hour on the rim and the ring.
  const mark = root.querySelector("[data-date-mark]");
  if (mark) {
    const r = Math.hypot(attr(mark, "cx"), attr(mark, "cy"));
    const a = (dateTickAngle(state.date, place.tz) * Math.PI) / 180;
    mark.setAttribute("cx", r1(-r * Math.sin(a)));
    mark.setAttribute("cy", r1((hemisphere === "north" ? 1 : -1) * r * Math.cos(a)));
  }
  const hand = root.querySelector("[data-hour-mark]");
  if (hand) {
    const angle = hourTickAngle(state.hour, place, state.date);
    const inner = framePoint(angle, Math.hypot(attr(hand, "x1"), attr(hand, "y1")), hemisphere);
    const outer = framePoint(angle, Math.hypot(attr(hand, "x2"), attr(hand, "y2")), hemisphere);
    hand.setAttribute("x1", r1(inner.x));
    hand.setAttribute("y1", r1(inner.y));
    hand.setAttribute("x2", r1(outer.x));
    hand.setAttribute("y2", r1(outer.y));
  }

  // Daylight: the Sun above civil twilight.
  const daylight = sunAltitude(place, ms) > -6;
  const svg = root.querySelector("svg.wheel");
  if (svg) {
    if (daylight) svg.setAttribute("data-daylight", "");
    else svg.removeAttribute("data-daylight");
  }
  setText(root.querySelector("#wheel-title"), `Star wheel for ${name}, ${when}`);
  setText(root.querySelector("#wheel-desc"), (root.querySelector("#wheel-desc")?.textContent ?? "").replace(/on \d{4}-\d\d-\d\d at \d\d:\d\d local time/, `on ${state.date} at ${clock(state.hour)} local time`).replace(/The Sun is (?:up, so the window is pale|down)\./, daylight ? "The Sun is up, so the window is pale." : "The Sun is down."));
  setText(root.querySelector(".caption.soft"), `${when} · ${place.tz}`);
  let line = root.querySelector(".daytime");
  const up = root.querySelector("[data-up]");
  if (daylight && !line && up) {
    line = document.createElement("p");
    line.className = "daytime";
    up.before(line);
  }
  if (daylight) setText(line, `The Sun is up over ${name} at this hour. Come back after dark, or turn the ring.`);
  else line?.remove();

  const names = upNow(place, ms, named).slice(0, UP_SHOWN);
  setText(up, names.length ? `Up now: ${names.join(", ")}.` : "No named star is above the horizon.");

  // The form follows, so a Show press after turning the wheel sends what is drawn.
  const date = root.querySelector<HTMLInputElement>('input[name="date"]');
  if (date && date.value !== state.date) date.value = state.date;
  const hour = root.querySelector<HTMLInputElement>('input[name="hour"]');
  if (hour && Number(hour.value) !== state.hour) hour.value = String(state.hour);
  setText(root.querySelector(".hour-value"), clock(state.hour));
}

type Drag = { id: number; centre: { x: number; y: number }; last: number; total: number; applied: number; rate: number };

export function PlanisphereApp({ initial, named, children }: { initial: State; named: readonly StarLike[]; children: ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initial);
  const root = useRef<HTMLDivElement>(null);
  const spin = useRef<Spin>({ angle: null });
  const drag = useRef<Drag | null>(null);
  const painted = useRef<State>(initial);
  // The buttons render only after hydration, into the server's empty mount point.
  const mount = useSyncExternalStore(noop, hydrated, noMount);
  const [note, say] = useReducer((_: string, next: string) => next, "");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    spin.current.angle ??= rotationOf(initial);
    if (painted.current === state) return;
    painted.current = state;
    paint(el, state, named, spin.current);
    window.history.replaceState(null, "", `/planisphere?${toQuery(state)}`);
    say(`${placeName(state)}, ${state.date} ${clock(state.hour)}`);
  }, [state, initial, named]);

  const angleOf = (e: PointerEvent, centre: { x: number; y: number }) => (Math.atan2(e.clientY - centre.y, e.clientX - centre.x) * 180) / Math.PI;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const disc = (e.target as Element).closest("[data-disc]");
    const face = root.current?.querySelector(".frame-face");
    if (!disc || !face || (e.pointerType === "mouse" && e.button !== 0)) return;
    const box = face.getBoundingClientRect();
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    disc.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, centre, last: angleOf(e, centre), total: 0, applied: 0, rate: degreesPerHour(state) };
    for (const el of root.current?.querySelectorAll("[data-disc], [data-rim]") ?? []) el.setAttribute("data-dragging", "");
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const a = angleOf(e, d.centre);
    d.total += wrap180(a - d.last);
    d.last = a;
    const snapped = Math.round((d.total / d.rate) * 4) / 4;
    if (snapped !== d.applied) {
      dispatch({ type: "turn", delta: snapped - d.applied });
      d.applied = snapped;
    }
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    for (const el of root.current?.querySelectorAll("[data-disc], [data-rim]") ?? []) el.removeAttribute("data-dragging");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target as Element).closest("[data-disc]") || e.ctrlKey || e.altKey || e.metaKey) return;
    const sign = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!sign) return;
    e.preventDefault();
    dispatch({ type: "turn", delta: sign * (e.shiftKey ? 1 : 0.25) });
  };

  // The form's own fields move the wheel too; a city is a new window, so it navigates.
  const onChange = (e: ChangeEvent<HTMLDivElement>) => {
    const field = e.target as HTMLInputElement | HTMLSelectElement;
    if (field.name === "city" && field.value) {
      router.push(`/planisphere?${toQuery(reducer(state, { type: "city", slug: field.value }))}`);
    } else if (field.name === "date") dispatch({ type: "date", date: field.value });
    else if (field.name === "hour") dispatch({ type: "hour", hour: Number(field.value) });
  };

  const now = () => dispatch({ type: "now", ms: Date.now() });

  const locate = () => {
    if (!("geolocation" in navigator)) {
      say("This browser cannot tell where you are.");
      return;
    }
    say("Asking where you are…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const next = reducer(state, { type: "locate", lat: pos.coords.latitude, lon: pos.coords.longitude, tz });
        if (next === state) {
          say("Could not use that position.");
          return;
        }
        router.push(`/planisphere?${toQuery(next)}`);
      },
      (err) => say(err.code === err.PERMISSION_DENIED ? "Location was not shared, so the sky stays as it was." : "Could not find where you are, so the sky stays as it was."),
    );
  };

  return (
    <div className="island" ref={root} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown} onChange={onChange}>
      {children}
      {mount &&
        createPortal(
          <>
            <button type="button" onClick={now}>
              Now
            </button>
            <button type="button" onClick={locate}>
              Use my location
            </button>
            <p className="live" role="status" aria-live="polite">
              {note}
            </p>
          </>,
          mount,
        )}
    </div>
  );
}
