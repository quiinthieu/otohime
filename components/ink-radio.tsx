"use client";

// Ink Radio on /music: an inked globe you spin to tune into live stations around the world, and a dial
// that runs west to east under it. Loaded lazily by components/ink-radio-loader.tsx; the stations are the
// committed snapshot (app/(site)/(app)/music/_lib/stations.json), so the page never calls a directory.
// Nothing plays until the listener presses Play. A stream that fails shows no signal and the nearest
// station that has not failed; it is never retried on its own. Playing here pauses the Television, and
// the Television playing stops the radio (lib/on-air.ts).
import snapshot from "@/app/(site)/(app)/music/_lib/stations.json";
import {
  dialOrder,
  dragView,
  initialRadio,
  LOAD_TIMEOUT_MS,
  nearby,
  nearest,
  nextAfterFailure,
  onAir,
  project,
  radioReducer,
  seedOf,
  settled,
  springStep,
  stepDial,
  unproject,
  viewOf,
  wobble,
  type LatLon,
  type RadioEvent,
  type RadioState,
  type Snapshot,
  type Station,
} from "@/app/(site)/(app)/music/_lib/tuning";
import { Inked } from "@/components/figures";
import { Chip, Machine, Stat, type Pen } from "@/components/machine";
import { air } from "@/lib/on-air";
import { useEffect, useId, useReducer, useRef, useState, useSyncExternalStore } from "react";

const STATIONS = (snapshot as Snapshot).stations;
const DIAL = dialOrder(STATIONS);
const BY_ID = new Map(STATIONS.map((s) => [s.id, s]));
// Tuned to the station nearest Tokyo on arrival, so the first visit is always the same.
const HOME = nearest(STATIONS, { lat: 35.68, lon: 139.69 }) ?? DIAL[0];
// Streams vary wildly in loudness; never start one at full volume.
const VOLUME = 0.6;

const regions = new Intl.DisplayNames(["en"], { type: "region" });
function country(cc: string): string {
  try {
    return regions.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const onReducedChange = (listener: () => void) => {
  const query = matchMedia(REDUCED);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

const reduce = (state: RadioState, event: RadioEvent) => radioReducer(state, event, STATIONS);

// The drawing, 400 × 420: the globe, then the dial under it.
const ART = { w: 400, h: 420 };
const GLOBE = { cx: 200, cy: 166, r: 150 };
const DIAL_BOX = { x: 30, y: 350, w: 340, h: 40 };
const pct = (n: number, of: number) => `${(n / of) * 100}%`;

// A point on the globe in the drawing's coordinates, or null on the far side.
function toArt(p: LatLon, view: LatLon): [number, number] | null {
  const q = project(p, view);
  return q.visible ? [GLOBE.cx + q.x * GLOBE.r, GLOBE.cy - q.y * GLOBE.r] : null;
}

// A polyline through the near side only: the pen lifts where the line goes round the back.
function path(points: LatLon[], view: LatLon): string {
  let d = "";
  let down = false;
  for (const p of points) {
    const at = toArt(p, view);
    if (!at) {
      down = false;
      continue;
    }
    d += `${down ? "L" : "M"}${at[0].toFixed(1)} ${at[1].toFixed(1)}`;
    down = true;
  }
  return d;
}

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const MERIDIANS = range(-180, 150, 30).map((lon) => range(-90, 90, 5).map((lat) => ({ lat, lon })));
const PARALLELS = range(-60, 60, 30).map((lat) => range(-180, 180, 5).map((lon) => ({ lat, lon })));

const dialIndex = (id: string | null) =>
  Math.max(
    0,
    DIAL.findIndex((s) => s.id === id),
  );
// The needle's place along the dial, 0 (far west) to 1 (far east).
const dialFrac = (index: number) => (DIAL.length > 1 ? index / (DIAL.length - 1) : 0.5);

export default function InkRadio() {
  const [radio, dispatch] = useReducer(reduce, { ...initialRadio, station: HOME.id });
  const [view, setView] = useState<LatLon>(() => viewOf(HOME));
  const [preview, setPreview] = useState<Station | null>(null);
  const reduced = useSyncExternalStore(
    onReducedChange,
    () => matchMedia(REDUCED).matches,
    () => false,
  );
  const audio = useRef<HTMLAudioElement>(null);
  const grab = useRef<{ id: number; x: number; y: number; view: LatLon; moved: boolean } | null>(null);
  const dialId = useId();

  const station = BY_ID.get(radio.station ?? "") ?? HOME;
  const index = dialIndex(station.id);
  const live = radio.status === "loading" || radio.status === "playing";
  const suggestion = radio.status === "no-signal" ? nextAfterFailure(radio, STATIONS) : null;
  const around = nearby(STATIONS, station, 3, { exclude: new Set([station.id]) });

  function tune(next: Station) {
    dispatch({ type: "tune", id: next.id });
    setView(viewOf(next));
  }

  // The stream: set only on a loading attempt, which only Play (or tuning while on air) starts.
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    if (radio.status !== "loading") {
      if (radio.status !== "playing") {
        silence(el);
        air.release("radio");
      }
      return;
    }
    const s = BY_ID.get(radio.station ?? "");
    if (!s) return;
    const attempt = radio.attempt;
    air.claim("radio");
    el.dataset.attempt = String(attempt);
    el.volume = VOLUME;
    el.src = s.url;
    el.play().catch((e: DOMException) => {
      if (e.name === "AbortError") return; // a newer tune or stop took over
      if (e.name === "NotAllowedError") dispatch({ type: "stop" });
      else dispatch({ type: "fail", reason: "error", attempt });
    });
    const timer = setTimeout(() => dispatch({ type: "fail", reason: "timeout", attempt }), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [radio.status, radio.attempt, radio.station]);

  // The Television starting stops the radio; leaving the page (or <Activity> hiding it) stops it too. The
  // takeover silences the stream there and then, not after the next render: both never sound together. A late
  // `playing` from the interrupted attempt changes nothing, as the radio is idle by then.
  useEffect(() => {
    const el = audio.current;
    const off = air.subscribe("radio", () => {
      if (el) silence(el);
      dispatch({ type: "stop" });
    });
    return () => {
      off();
      if (el) silence(el);
      dispatch({ type: "stop" });
    };
  }, []);

  const attemptOf = () => Number(audio.current?.dataset.attempt ?? -1);
  const fail = (reason: "error" | "stalled") => dispatch({ type: "fail", reason, attempt: attemptOf() });

  // Drag the globe to spin it; let go and the station nearest the crosshair comes in. A tap tunes the
  // station nearest the point tapped.
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    grab.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view, moved: false };
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const g = grab.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    const next = dragView(g.view, dx, dy, event.currentTarget.getBoundingClientRect().width / 2);
    setView(next);
    setPreview(nearest(STATIONS, next));
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const g = grab.current;
    if (!g || g.id !== event.pointerId) return;
    grab.current = null;
    setPreview(null);
    let target: Station | null;
    if (g.moved) {
      target = nearest(STATIONS, view);
    } else {
      const r = event.currentTarget.getBoundingClientRect();
      const at = unproject(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        1 - ((event.clientY - r.top) / r.height) * 2,
        view,
      );
      target = at ? nearest(STATIONS, at) : null;
    }
    if (target) tune(target);
  }
  function onPointerCancel() {
    grab.current = null;
    setPreview(null);
  }

  const name = station.name;
  const where = country(station.cc);
  const readout = preview
    ? `Between stations… ${preview.name}`
    : radio.status === "loading"
      ? `Tuning in to ${name}…`
      : radio.status === "playing"
        ? `On air: ${name}, ${where}.`
        : radio.status === "no-signal"
          ? radio.reason === "blocked"
            ? `${name} isn't on a safe stream. Try another station.`
            : `No signal from ${name}.${suggestion ? ` Try ${suggestion.name}, ${country(suggestion.cc)}.` : ""}`
          : `${name}, ${where}. Press play.`;

  return (
    <>
      <Machine
        label="Ink Radio"
        caption="Tuner"
        colour="mint"
        busy={onAir(radio)}
        readout={readout}
        figure={(wobbleAmount, pen) => (
          <RadioSet
            wobble={wobbleAmount}
            pen={pen}
            view={view}
            station={station}
            highlight={preview}
            frac={dialFrac(preview ? dialIndex(preview.id) : index)}
            status={radio.status}
            hiss={preview !== null || radio.status === "loading"}
            reduced={reduced}
            dial={
              <input
                id={dialId}
                type="range"
                min={0}
                max={DIAL.length - 1}
                step={1}
                value={index}
                aria-label="Tuning dial, west to east"
                aria-valuetext={`${name}, ${where}`}
                onChange={(event) => tune(DIAL[Number(event.target.value)])}
              />
            }
            grab={{ onPointerDown, onPointerMove, onPointerUp, onPointerCancel }}
          />
        )}
        controls={
          <>
            <Chip
              aria-label={live ? "Stop the radio" : "Play the radio"}
              data-radio="play"
              onClick={() => dispatch({ type: live ? "stop" : "play" })}
            >
              {live ? "■ Stop" : "▶ Play"}
            </Chip>
            <Chip aria-label="Tune west" onClick={() => tune(DIAL[stepDial(index, "ArrowLeft", DIAL.length) ?? index])}>
              ◀ West
            </Chip>
            <Chip
              aria-label="Tune east"
              onClick={() => tune(DIAL[stepDial(index, "ArrowRight", DIAL.length) ?? index])}
            >
              East ▶
            </Chip>
          </>
        }
        stats={
          <>
            <Stat k="Dial" v={index + 1} />
            <Stat k="From" v={where} small />
          </>
        }
        below={
          <div className="radio-near">
            {suggestion ? (
              <Chip data-radio="suggestion" onClick={() => tune(suggestion)}>
                Try {suggestion.name}
              </Chip>
            ) : null}
            <span className="caption">Nearby</span>
            <ul className="radio-near-list">
              {around.map((s) => (
                <li key={s.id}>
                  <Chip aria-label={`Tune to ${s.name}, ${country(s.cc)}`} onClick={() => tune(s)}>
                    {s.name}
                  </Chip>
                </li>
              ))}
            </ul>
            {station.homepage?.startsWith("https://") ? (
              <a className="radio-home" href={station.homepage} target="_blank" rel="noreferrer">
                {name}&apos;s site <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
        }
      />
      {/* Nothing plays or preloads on its own: the stream opens on Play and closes on Stop. */}
      <audio
        ref={audio}
        preload="none"
        data-radio="audio"
        onPlaying={() => dispatch({ type: "playing", attempt: attemptOf() })}
        onError={() => fail("error")}
        onStalled={() => fail("stalled")}
        onEnded={() => fail("error")}
      />
    </>
  );
}

// Stop the stream and drop its connection.
function silence(el: HTMLAudioElement) {
  el.pause();
  if (el.hasAttribute("src")) {
    el.removeAttribute("src");
    delete el.dataset.attempt;
    el.load();
  }
}

type Grab = Pick<
  React.DOMAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
>;

// The set: an inked globe with the stations dotted on it and a crosshair at its centre, the dial under it,
// and the label maker's tape with the station's name. The needle, the static and the lamp are drawn outside
// the ink filter, so they move without the line work being redrawn.
function RadioSet({
  wobble: amount,
  pen,
  view,
  station,
  highlight,
  frac,
  status,
  hiss,
  reduced,
  dial,
  grab,
}: {
  wobble: number;
  pen: Pen;
  view: LatLon;
  station: Station;
  highlight: Station | null;
  frac: number;
  status: RadioState["status"];
  hiss: boolean;
  reduced: boolean;
  dial: React.ReactNode;
  grab: Grab;
}) {
  const id = useId().replace(/[^\w-]/g, "");
  const here = toArt(station, view);
  const near = highlight ? toArt(highlight, view) : null;
  const playing = status === "playing";
  return (
    <div className="radio-set" data-status={status}>
      <div className="radio-art">
        <Inked
          viewBox={`0 0 ${ART.w} ${ART.h}`}
          wobble={amount}
          hand={pen.hand}
          seed={pen.seed}
          className="block w-full"
        >
          <circle cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.r} className="fig-lit" />
          <g fill="none" strokeWidth={1} className="radio-graticule">
            {[...MERIDIANS, ...PARALLELS].map((line, i) => (
              <path key={i} d={path(line, view)} />
            ))}
          </g>
          {STATIONS.map((s) => {
            const at = toArt(s, view);
            return at ? <circle key={s.id} cx={at[0]} cy={at[1]} r={2.2} className="fig-ink" stroke="none" /> : null;
          })}
          {here ? <circle cx={here[0]} cy={here[1]} r={7} fill="none" strokeWidth={2} /> : null}
          {near ? <circle cx={near[0]} cy={near[1]} r={5} fill="none" strokeWidth={1.4} strokeDasharray="2 2" /> : null}
          {/* the dial's window and its ticks, one per ten stations */}
          <rect
            x={DIAL_BOX.x - 8}
            y={DIAL_BOX.y - 6}
            width={DIAL_BOX.w + 16}
            height={DIAL_BOX.h + 12}
            rx={8}
            className="fig-top"
          />
          <rect x={DIAL_BOX.x} y={DIAL_BOX.y} width={DIAL_BOX.w} height={DIAL_BOX.h} rx={3} className="fig-paper" />
          {range(0, DIAL.length - 1, 10).map((i) => {
            const x = DIAL_BOX.x + dialFrac(i) * DIAL_BOX.w;
            return (
              <path
                key={i}
                d={`M${x.toFixed(1)} ${DIAL_BOX.y + DIAL_BOX.h}v${i % 50 === 0 ? -14 : -7}`}
                strokeWidth={1.2}
              />
            );
          })}
          <text x={DIAL_BOX.x + 4} y={DIAL_BOX.y + 12} className="fig-text">
            W
          </text>
          <text x={DIAL_BOX.x + DIAL_BOX.w - 4} y={DIAL_BOX.y + 12} textAnchor="end" className="fig-text">
            E
          </text>
        </Inked>
        <svg viewBox={`0 0 ${ART.w} ${ART.h}`} aria-hidden="true" className="radio-overlay">
          <defs>
            <filter id={`${id}-hiss`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={seedOf(station.id) % 997} />
              <feColorMatrix type="matrix" values="0 0 0 0 0.14  0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 -2.4 1.4" />
            </filter>
            <clipPath id={`${id}-disc`}>
              <circle cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.r} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-disc)`}>
            <rect
              className="radio-static"
              data-on={hiss || status === "no-signal" || undefined}
              data-still={!hiss || undefined}
              x={GLOBE.cx - GLOBE.r - 8}
              y={GLOBE.cy - GLOBE.r - 8}
              width={GLOBE.r * 2 + 16}
              height={GLOBE.r * 2 + 16}
              filter={`url(#${id}-hiss)`}
            />
          </g>
          {/* the crosshair: let go of the globe and the station nearest it comes in */}
          <path
            d={`M${GLOBE.cx - 10} ${GLOBE.cy}h20M${GLOBE.cx} ${GLOBE.cy - 10}v20`}
            className="radio-cross"
            strokeWidth={1.4}
          />
          <Needle frac={frac} seed={seedOf(station.id)} playing={playing} reduced={reduced} />
          <g className="radio-lamp" data-on={playing || undefined}>
            <circle cx={352} cy={28} r={6} />
            <text x={340} y={32} textAnchor="end">
              ON AIR
            </text>
          </g>
        </svg>
        <div
          className="radio-globe-hit"
          style={{
            left: pct(GLOBE.cx - GLOBE.r, ART.w),
            top: pct(GLOBE.cy - GLOBE.r, ART.h),
            width: pct(GLOBE.r * 2, ART.w),
            height: pct(GLOBE.r * 2, ART.h),
          }}
          data-radio="globe"
          {...grab}
        />
        <div
          className="radio-dial"
          style={{
            left: pct(DIAL_BOX.x - 8, ART.w),
            top: pct(DIAL_BOX.y, ART.h),
            width: pct(DIAL_BOX.w + 16, ART.w),
            height: pct(DIAL_BOX.h, ART.h),
          }}
        >
          {dial}
        </div>
      </div>
      <p className="radio-tape" aria-hidden="true">
        <span key={station.id} className="radio-type" style={{ "--n": station.name.length } as React.CSSProperties}>
          {station.name}
        </span>
      </p>
    </div>
  );
}

// The needle springs to the station and, on air, wobbles a little in its own way. It is moved by its
// transform, frame by frame, without a render; under reduced motion it jumps and stays still.
function Needle({ frac, seed, playing, reduced }: { frac: number; seed: number; playing: boolean; reduced: boolean }) {
  const g = useRef<SVGGElement>(null);
  const spring = useRef({ x: frac, v: 0 });
  useEffect(() => {
    const el = g.current;
    if (!el) return;
    const put = (x: number) => el.setAttribute("transform", `translate(${(x * DIAL_BOX.w).toFixed(2)} 0)`);
    if (reduced) {
      spring.current = { x: frac, v: 0 };
      put(frac);
      return;
    }
    let raf = 0;
    let last = 0;
    const frame = (t: number) => {
      const dt = last ? (t - last) / 1000 : 0;
      last = t;
      spring.current = springStep(spring.current, frac, dt);
      put(spring.current.x + (playing ? wobble(seed, t / 1000) * 0.006 : 0));
      if (playing || !settled(spring.current, frac)) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [frac, seed, playing, reduced]);
  return (
    <g ref={g} className="radio-needle" data-frac={frac.toFixed(4)}>
      <path d={`M${DIAL_BOX.x} ${DIAL_BOX.y - 4}v${DIAL_BOX.h + 8}`} strokeWidth={2.2} />
    </g>
  );
}
