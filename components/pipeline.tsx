"use client";

import { box, swatches, type Point, type Swatch } from "@/components/figures";
import { Chip, Machine, press, Stat, useTick } from "@/components/machine";
import { site } from "@/content/site";
import { CAP, counters, initialPipeline, pipeline, progress, type Packet, type Place } from "@/lib/pipeline";
import { useEffect, useReducer, useRef, useState, type RefObject } from "react";

// The whole path on one sheet: source -> queue -> warehouse -> dashboard, joined by pipes, with made-up packets
// walking it (lib/pipeline.ts). An illustrative simulation: it reads no clock but its own and calls nothing.
const O: [number, number] = [90, 70];
const W = 60; // a station's size along the line (x)
const D = 50; // and across it (y)
const GAP = 50; // a pipe's length
const Z = 16; // the pipes' height
const CUBE = 10;
const at = (i: number) => i * (W + GAP); // a station's back corner along the line

const STATIONS = [
  { key: "source", h: 40 },
  { key: "queue", h: 30 },
  { key: "warehouse", h: 54 },
  { key: "dashboard", h: 60 },
] as const;
const station = STATIONS.map(({ h }, i) => box(O, W, D, h, [at(i), 0, 0]));
const { poly } = box(O, 0, 0, 0);
const PIPES = ["to-queue", "to-warehouse", "to-dashboard"] as const;
// A packet's colour is its id's, so one can be followed down the line.
const COLOURS: Swatch[] = ["yellow", "coral", "blue", "pink", "mint"];

// A pipe: an ink edge round a metal bore, like the conveyor's legs.
function Pipe({ i }: { i: number }) {
  const points = poly([[at(i) + W, D / 2, Z], [at(i + 1), D / 2, Z]]);
  return (
    <>
      <polyline points={points} fill="none" strokeWidth={14} />
      <polyline points={points} fill="none" className="fig-metal" strokeWidth={9} />
    </>
  );
}

function Cube({ p, corner }: { p: Packet; corner: Point }) {
  const b = box(O, CUBE, CUBE, CUBE - 2, corner);
  return (
    <g data-packet={p.id} data-place={p.place} style={{ "--fig": swatches[COLOURS[p.id % COLOURS.length]] } as React.CSSProperties}>
      <polygon className="fig-top" points={b.top} />
      <polygon className="fig-shaded" points={b.shaded} />
      <polygon className="fig-lit" points={b.lit} />
    </g>
  );
}

// Packets waiting on a station's lid, the next to leave nearest its exit: four across, four deep, then a second
// layer, which holds CAP (32) exactly. Drawn back to front.
function Lid({ i, h, packets }: { i: number; h: number; packets: Packet[] }) {
  const placed = packets.map((p, n) => {
    const layer = Math.floor(n / 16);
    const row = Math.floor((n % 16) / 4);
    const col = n % 4;
    const corner: Point = [at(i) + W - 15 - row * 13, 3 + col * 12, h + layer * (CUBE - 1)];
    return { p, corner, order: layer * 1000 + corner[0] + corner[1] };
  });
  placed.sort((a, b) => a.order - b.order);
  return placed.map(({ p, corner }) => <Cube key={p.id} p={p} corner={corner} />);
}

// A pipe's packets, along its length by how far through it they are.
function InPipe({ i, packets }: { i: number; packets: Packet[] }) {
  return packets.map((p) => (
    <Cube key={p.id} p={p} corner={[at(i) + W + progress(p) * GAP - CUBE / 2, D / 2 - CUBE / 2, Z - CUBE / 2]} />
  ));
}

function Label({ i, text }: { i: number; text: string }) {
  return (
    <g transform={station[i].onShaded} data-station={STATIONS[i].key}>
      <rect x={3} y={-18} width={W - 6} height={12} rx={2} className="fig-paper" strokeWidth={1.4} />
      <text x={W / 2} y={-9.2} textAnchor="middle" className="fig-text" style={{ fontSize: 7.5 }}>
        {text}
      </text>
    </g>
  );
}

// The figure's clock may run only while its drawing is on screen and the page is shown.
function useSeen(ref: RefObject<HTMLDivElement | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current?.querySelector(".machine-figure");
    if (!el) return;
    let onscreen = false;
    const update = () => setSeen(onscreen && !document.hidden);
    const view = new IntersectionObserver(([entry]) => {
      onscreen = entry.isIntersecting;
      update();
    });
    view.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      view.disconnect();
      document.removeEventListener("visibilitychange", update);
      setSeen(false);
    };
  }, [ref]);
  return seen;
}

export function Pipeline() {
  const [s, dispatch] = useReducer(pipeline, initialPipeline);
  const c = counters(s);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref);
  useTick(c.busy && seen, dispatch);
  // A live switch to reduced motion lands everything where it would come to rest.
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const settle = () => {
      if (query.matches) dispatch("settle");
    };
    query.addEventListener("change", settle);
    return () => query.removeEventListener("change", settle);
  }, []);

  const t = site.pipeline;
  const full = s.packets.length >= CAP;
  const readout =
    s.paused && !c.busy
      ? t.held(c.queued)
      : full
        ? t.full
        : s.paused
          ? t.filling
          : c.busy
            ? t.flowing
            : c.emitted
              ? t.caught(c.shown)
              : t.idle;
  const by = (place: Place) => s.packets.filter((p) => p.place === place);
  const lit = Math.min(8, c.shown); // a bar on the dashboard per packet shown, up to eight

  return (
    <div ref={ref}>
      <Machine
        label={t.label}
        caption={t.caption}
        colour="blue"
        viewBox="0 0 440 330"
        busy={c.busy}
        readout={readout}
        controls={
          <>
            <Chip aria-disabled={full || undefined} onClick={() => press(dispatch, "emit")}>
              {t.emit}
            </Chip>
            <Chip aria-disabled={full || undefined} onClick={() => press(dispatch, "backfill")}>
              {t.backfill}
            </Chip>
            <Chip onClick={() => press(dispatch, s.paused ? "resume" : "pause")}>{s.paused ? t.resume : t.pause}</Chip>
          </>
        }
        stats={
          <>
            <Stat k={t.stats.inFlight} v={c.inFlight} />
            <Stat k={t.stats.queued} v={c.queued} />
            <Stat k={t.stats.stored} v={c.stored} />
            <Stat k={t.stats.lag} v={c.lag} />
            <Stat k={t.stats.emitted} v={c.emitted} small />
            <Stat k={t.stats.shown} v={c.shown} small />
          </>
        }
        below={<p className="caption mt-3">{t.note}</p>}
      >
        {station.map((b, i) => (
          <polygon key={i} className="fig-shade" points={b.shadow} />
        ))}
        {STATIONS.map(({ key, h }, i) => {
          const b = station[i];
          return (
            <g key={key}>
              <polygon className="fig-top" points={b.top} />
              <polygon className="fig-shaded" points={b.shaded} />
              <polygon className="fig-lit" points={b.lit} />
              <Label i={i} text={t.stations[key]} />
              {key === "source" ? <Lid i={i} h={h} packets={by("source")} /> : null}
              {key === "queue" ? <Lid i={i} h={h} packets={by("queue")} /> : null}
              {key === "warehouse" ? (
                <>
                  {/* shelves on the warehouse's side */}
                  <g transform={b.onLit}>
                    <path d="M8 -20h34M8 -34h34" fill="none" strokeWidth={1.6} />
                  </g>
                  <Lid i={i} h={h} packets={by("warehouse")} />
                </>
              ) : null}
              {key === "dashboard" ? (
                <g transform={b.onLit}>
                  <rect x={4} y={-54} width={D - 8} height={36} rx={3} className="fig-dark" />
                  {Array.from({ length: 8 }, (_, k) => {
                    const tall = [8, 14, 10, 18, 12, 22, 16, 26][k];
                    return (
                      <rect
                        key={k}
                        data-bar={k < lit ? "on" : undefined}
                        x={7 + k * 4.6}
                        y={-22 - tall}
                        width={3.2}
                        height={tall}
                        className={k < lit ? "fig-lcd" : "fig-inside"}
                        stroke="none"
                      />
                    );
                  })}
                  <text x={D / 2} y={-5} textAnchor="middle" className="fig-text" style={{ fontSize: 10 }} data-shown={c.shown}>
                    {c.shown}
                  </text>
                </g>
              ) : null}
              {i < PIPES.length ? (
                <>
                  <Pipe i={i} />
                  {PIPES[i] === "to-warehouse" ? (
                    // the queue's valve: open along the pipe, shut across it while paused
                    <g transform={`translate(${poly([[at(i) + W + 10, D / 2, Z + 9]])})`}>
                      <circle r={5} className={s.paused ? "fig-lamp" : "fig-paper"} strokeWidth={1.6} />
                      <path d={s.paused ? "M0 -5V5" : "M-4.3 -2.5L4.3 2.5"} fill="none" strokeWidth={1.8} />
                      {s.paused ? (
                        <>
                          <rect x={-12} y={-19} width={24} height={10} rx={2} className="fig-paper" strokeWidth={1.4} />
                          <text y={-11.5} textAnchor="middle" className="fig-text" style={{ fontSize: 6 }}>
                            {t.hold}
                          </text>
                        </>
                      ) : null}
                    </g>
                  ) : null}
                  <InPipe i={i} packets={by(PIPES[i])} />
                </>
              ) : null}
            </g>
          );
        })}
      </Machine>
    </div>
  );
}
