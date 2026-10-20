import type { Metadata } from "next";
import { connection } from "next/server";
import { PlanisphereApp } from "../_components/planisphere-app";
import { MoonCorner } from "../_components/moon-corner";
import { clock, Wheel } from "../_components/wheel";
import { CITIES } from "../_lib/cities.ts";
import { phase } from "../_lib/moon.ts";
import { upNow } from "../_lib/sky.ts";
import { STARS } from "../_lib/stars.ts";
import { sunAltitude } from "../_lib/sun.ts";
import { localToUtc } from "../_lib/time.ts";
import { parseQuery, placeName, toQuery } from "../_lib/wheel.ts";

// absolute: the layout's template would otherwise make this "Planisphere · Planisphere".
export const metadata: Metadata = { title: { absolute: "Planisphere" } };

// The whole page depends on the query, and it must work with JavaScript off.
// Inside a streamed boundary it would arrive into a hidden <div> that only a script
// swaps in, so the page renders blocking instead: no static shell and no boundary.
export const instant = false;

const UP_SHOWN = 14;

const EXPLAINER = [
  "A planisphere is a star map you can turn. The disc holds the stars, centred on the celestial pole you can see. The frame's oval window is your horizon, so whatever shows through it is above the horizon now.",
  "The outer ring is the clock and the disc's rim is the calendar. Line up today's date with the hour and the sky is right. Stars are drawn to magnitude 4.5, and positions are about a degree true.",
];

const SOURCES = {
  celestial: "https://github.com/ofrohn/d3-celestial",
  vizier: "https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D",
  iau: "https://www.iau.org/public/themes/constellations/",
};

// /planisphere: the inked star wheel for a city, a date and an hour, set by a
// plain GET form. Each query field falls back to its default on its own.
export default async function PlanispherePage({ searchParams }: PageProps<"/planisphere">) {
  const query = await searchParams;
  // connection() marks the request as live, so reading the clock below is not a prerender error. The page still blocks, with no boundary.
  await connection();
  // The clock is read after that, per request: the sky is always for now unless the query says otherwise.
  // eslint-disable-next-line react-hooks/purity
  const state = parseQuery(query, Date.now());
  const ms = localToUtc(state.date, state.hour, state.place.tz);
  const daylight = sunAltitude(state.place, ms) > -6;
  const name = placeName(state);
  const up = upNow(state.place, ms, STARS).slice(0, UP_SHOWN);
  const moonPhase = phase(ms);

  return (
    <div className="planisphere">
      <header className="topbar">
        <nav className="ways-out" aria-label="Site">
          {/* Plain <a>s: / and /projects are in another root layout, which needs a full page load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="home-link" href="/">
            otohime.dev
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="home-link" href="/projects">
            <span aria-hidden="true">←</span> All projects
          </a>
        </nav>
      </header>
      {/* The island wraps the whole bench; its key restarts it when the server draws a new window. */}
      <PlanisphereApp key={toQuery(state)} initial={state} named={STARS.filter((s) => s[4])}>
      <main className="bench">
        <header className="title">
          <h1>Planisphere</h1>
          <p className="tagline">Tonight&apos;s sky for your city, on a star wheel drawn in ink.</p>
        </header>
        <section className="chart" aria-label="Star wheel">
          <Wheel state={state} daylight={daylight} />
          {daylight && (
            <p className="daytime">{`The Sun is up over ${name} at this hour. Come back after dark, or turn the ring.`}</p>
          )}
          <p className="up" data-up="">
            {up.length ? `Up now: ${up.join(", ")}.` : "No named star is above the horizon."}
          </p>
        </section>
        <div className="controls">
          <form method="get" action="/planisphere" className="picker">
            <label className="field">
              <span>City</span>
              <select name="city" defaultValue={state.city ?? ""}>
                {state.city === null && <option value="">Your location</option>}
                {CITIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Date</span>
              <input type="date" name="date" defaultValue={state.date} min="1900-01-01" max="2100-12-31" required />
            </label>
            <label className="field">
              <span>
                Hour <b className="hour-value">{clock(state.hour)}</b>
              </span>
              <input type="range" name="hour" min="0" max="23.75" step="0.25" defaultValue={state.hour} />
            </label>
            <button type="submit">Show</button>
          </form>
          <div className="actions" data-actions="" />
          <MoonCorner phaseDeg={moonPhase} />
          <section className="explainer" data-explainer="" aria-labelledby="how">
            <h2 id="how">How to read it</h2>
            {EXPLAINER.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
        </div>
      </main>
      </PlanisphereApp>
      <footer className="credit">
        <p>
          Stars and constellation lines from <a href={SOURCES.celestial}>d3-celestial</a> (BSD-3-Clause), built on the Hipparcos catalogue as{" "}
          <a href={SOURCES.vizier}>VizieR V/137D</a>; lines after the <a href={SOURCES.iau}>IAU</a>. Next door: the planets, in{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/orrery">Orrery</a>.
        </p>
      </footer>
    </div>
  );
}
