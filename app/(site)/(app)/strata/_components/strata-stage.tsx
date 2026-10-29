"use client";

import raw from "@/content/strata.json";
import {
  buildPaperRustleCue,
  buildStrataLayers,
  computeStrataParallax,
  findNearestStrataWeek,
  parseStrataData,
  resolveStrataYearSelection,
  shouldTriggerRustle,
  stepStrataWeekIndex,
  type StrataMetric,
  type StrataWeek,
} from "@/lib/strata";
import { playCustomCue } from "@/lib/sound-client";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";

const data = parseStrataData(raw);

function playRustle(muted: boolean, lastRustleAtMs: number, yearIndex: number, totalYears: number, now: number) {
  if (muted || !shouldTriggerRustle(lastRustleAtMs, now)) return lastRustleAtMs;
  playCustomCue(buildPaperRustleCue(yearIndex, totalYears), () => !muted);
  return now;
}

const METRICS = [
  { id: "activity", label: "All" },
  { id: "commits", label: "Commits" },
  { id: "notes", label: "Notes" },
] as const;

export default function StrataStage() {
  const grain = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const selection = data ? resolveStrataYearSelection(data.years) : null;
  const [year, setYear] = useState(selection?.current.year ?? 2026);
  const [metric, setMetric] = useState<StrataMetric>("activity");
  const [muted, setMuted] = useState(true);
  const archive = data ? resolveStrataYearSelection(data.years, year).current : null;
  const layers = useMemo(
    () => (archive ? buildStrataLayers(archive, { seed: archive.year, metric }) : []),
    [archive, metric],
  );
  const [active, setActive] = useState<StrataWeek | null>(null);
  const shown = active && archive?.weeks.some((week) => week.week === active.week)
    ? archive.weeks.find((week) => week.week === active.week) ?? active
    : archive?.weeks.find((week) => week.week === archive.peakWeek) ?? archive?.weeks[0] ?? null;
  const layersRef = useRef<(SVGGElement | null)[]>([]);
  const frame = useRef(0);
  const lastRustle = useRef(0);

  useEffect(() => {
    if (!reduced) return;
    for (const layer of layersRef.current) {
      layer?.style.setProperty("--strata-dx", "0px");
      layer?.style.setProperty("--strata-dy", "0px");
    }
  }, [reduced, layers]);

  if (!data || !archive || !shown) {
    return <p className="strata-loading">The paper index is not on this desk.</p>;
  }

  const years = resolveStrataYearSelection(data.years).availableYears;
  const canScrub = years.length > 1;

  function chooseYear(next: number, now: number) {
    setYear(next);
    lastRustle.current = playRustle(muted, lastRustle.current, years.indexOf(next), years.length, now);
  }

  function movePointer(clientX: number, clientY: number, bounds: DOMRect) {
    const nx = (clientX - bounds.left) / bounds.width;
    const ny = (clientY - bounds.top) / bounds.height;
    const week = findNearestStrataWeek(archive!.weeks, nx);
    setActive((current) => (current?.week === week.week ? current : week));
    const offsets = computeStrataParallax(nx * 2 - 1, ny * 2 - 1, reduced);
    layersRef.current.forEach((layer, index) => {
      layer?.style.setProperty("--strata-dx", `${offsets[index]?.dx ?? 0}px`);
      layer?.style.setProperty("--strata-dy", `${offsets[index]?.dy ?? 0}px`);
    });
  }

  return (
    <div className="strata-toy">
      <div className="strata-controls" data-strata-scrubber>
        <div className="strata-years" role="group" aria-label="Year">
          {years.map((item) => (
            <button key={item} type="button" aria-pressed={item === year} onClick={(event) => chooseYear(item, event.timeStamp)}>
              {item}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, years.length - 1)}
          step={1}
          value={Math.max(0, years.indexOf(year))}
          disabled={!canScrub}
          aria-label="Scrub the year"
          onChange={(event) => chooseYear(years[Number(event.target.value)] ?? year, event.timeStamp)}
        />
        <div role="group" aria-label="What the height shows">
          {METRICS.map((item) => (
            <button key={item.id} type="button" aria-pressed={metric === item.id} onClick={() => setMetric(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          data-strata-mute
          aria-pressed={!muted}
          onClick={(event) => {
            const next = !muted;
            setMuted(next);
            if (!next) lastRustle.current = playRustle(false, 0, years.indexOf(year), years.length, event.timeStamp);
          }}
        >
          {muted ? "Rustle off" : "Rustle on"}
        </button>
      </div>
      <div
        className="strata-stage"
        data-strata-stage
        data-reduced-motion={reduced ? "true" : "false"}
        data-year={year}
        data-active-week={shown.week}
        tabIndex={0}
        role="region"
        aria-label="Weekly activity strata"
        onKeyDown={(event) => {
          const current = archive.weeks.findIndex((week) => week.week === shown.week);
          const next = stepStrataWeekIndex(current, event.key, archive.weeks.length);
          if (next === current && event.key !== "Home" && event.key !== "End") return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setActive(archive.weeks[next]);
          }
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => movePointer(event.clientX, event.clientY, bounds));
        }}
        onPointerLeave={() => {
          cancelAnimationFrame(frame.current);
          for (const layer of layersRef.current) {
            layer?.style.setProperty("--strata-dx", "0px");
            layer?.style.setProperty("--strata-dy", "0px");
          }
        }}
      >
        <svg viewBox="0 0 960 420" role="img" aria-label={`Cut-paper terrain for ${year}`}>
          <defs>
            <filter id={grain} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" />
            </filter>
          </defs>
          {layers.map((layer, index) => (
            <g
              key={layer.index}
              ref={(node) => { layersRef.current[index] = node; }}
              className="strata-layer"
              data-layer-index={layer.index}
              style={{ "--strata-fill": `var(${layer.swatch})` } as CSSProperties}
            >
              <path d={layer.d} />
            </g>
          ))}
          <rect className="strata-deckle" width="960" height="420" filter={`url(#${grain})`} />
        </svg>
      </div>
      <div className="strata-inspector" data-strata-inspector aria-live="polite">
        <p>Week {shown.week}</p>
        <p>
          <time dateTime={shown.startDate}>{shown.startDate}</time>
          {" – "}
          <time dateTime={shown.endDate}>{shown.endDate}</time>
        </p>
        <p>
          {shown.commits} commits · {shown.notes} notes · {shown.activity} total
        </p>
        {shown.shippedProjects.length > 0 ? <p>Shipped: {shown.shippedProjects.join(", ")}</p> : null}
        {shown.highlights.length > 0 ? <p>{shown.highlights.join(" · ")}</p> : null}
      </div>
      <p className="strata-note">
        {archive.source === "git"
          ? "Heights follow commits and notes in this repository."
          : "An archive year: the public dates on this site begin in 2026."}
        {" "}Rustle uses the console sound switch, and stays under a whisper.
      </p>
    </div>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return reduced;
}
