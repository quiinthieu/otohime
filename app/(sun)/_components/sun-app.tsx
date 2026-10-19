"use client";

import { useEffect, useReducer, type KeyboardEvent } from "react";
import { lightTime, years } from "../_lib/format.ts";
import { CHAPTERS, LIGHT_SECONDS, PHOTON_YEARS } from "../_lib/sun.ts";
import { newTour, step, type TourAction } from "../_lib/tour.ts";
import { FactList } from "./fact-list";
import { Stage } from "./stage";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SunApp() {
  // The server render and the first client render are both chapter 0, settled, not playing.
  const [tour, dispatch] = useReducer(step, newTour());
  const chapter = CHAPTERS[tour.chapter];
  const last = CHAPTERS.length - 1;

  // 12 fps while a slide is entering or Play is running. Reduced motion settles after every tick.
  const busy = tour.phase === "entering" || tour.playing;
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => {
      dispatch("tick");
      if (reducedMotion()) dispatch("settle");
    }, 1000 / 12);
    return () => clearInterval(id);
  }, [busy]);

  const press = (action: TourAction) => {
    dispatch(action);
    if (reducedMotion()) dispatch("settle");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") press("next");
    else if (e.key === "ArrowLeft") press("back");
    else return;
    e.preventDefault();
  };

  return (
    <div className="tour">
      <div
        className="stage"
        tabIndex={0}
        role="group"
        aria-label="Sun cutaway. Use the left and right arrow keys to change chapter."
        onKeyDown={onKeyDown}
      >
        <Stage chapter={chapter.id} title={chapter.title} />
      </div>

      <div className="controls">
        <button type="button" className="button" disabled={tour.chapter === 0} onClick={() => press("back")}>
          Back
        </button>
        <button type="button" className="button play" onClick={() => press(tour.playing ? "pause" : "play")}>
          {tour.playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="button" disabled={tour.chapter === last} onClick={() => press("next")}>
          Next
        </button>
      </div>

      <div className="dots" role="group" aria-label="Chapters">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className="dot"
            aria-label={`Chapter ${i + 1}: ${c.title}`}
            aria-current={i === tour.chapter ? "step" : undefined}
            onClick={() => press({ goto: i })}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="caption" aria-live="polite">
        <p className="caption-title">
          {tour.chapter + 1}. {chapter.title}
        </p>
        <p className="caption-lede">{chapter.lede}</p>
      </div>

      <dl className="counters">
        <div className="counter" data-active={chapter.id === "scale" ? "true" : undefined}>
          <dt>Light from the Sun to Earth</dt>
          <dd>{lightTime(LIGHT_SECONDS)}</dd>
        </div>
        <div className="counter" data-active={chapter.id === "radiative" ? "true" : undefined}>
          <dt>A photon&rsquo;s trip out of the radiative zone</dt>
          <dd>{years(PHOTON_YEARS)}</dd>
        </div>
      </dl>

      <div className="facts" data-phase={tour.phase}>
        <FactList facts={chapter.facts} />
      </div>
    </div>
  );
}
