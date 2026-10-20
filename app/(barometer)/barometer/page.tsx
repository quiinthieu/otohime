import type { Metadata } from "next";
import { HandApp } from "../_components/hand-app";
import { Station } from "../_components/station";
import { CITIES, findCity } from "../_lib/cities.ts";
import { describe } from "../_lib/reading.ts";
import { readStation } from "../_lib/station.ts";

// absolute: the layout's template would otherwise make this "Barometer · Barometer".
export const metadata: Metadata = { title: { absolute: "Barometer" } };

// The whole page depends on the query, and it must work with JavaScript off.
// Inside a streamed boundary it would arrive into a hidden <div> that only a script
// swaps in, so the page renders blocking instead: no static shell and no boundary.
export const instant = false;

const EXPLAINER = [
  "An aneroid barometer has no liquid. Inside the brass case a sealed metal capsule, with most of its air pumped out, is squeezed by the weather. When the pressure rises the capsule shrinks, and when it falls the capsule swells.",
  "A chain of levers turns that tiny movement into the needle's swing across the dial. The words on the dial are old advice. The second brass hand is yours to set, so next time you can see which way the air went.",
];

const SOURCES = {
  openMeteo: "https://open-meteo.com/",
  licence: "https://creativecommons.org/licenses/by/4.0/",
};

// /barometer: the brass station for one city's current reading, chosen by a
// plain GET form. An unknown or missing city draws the first one, always 200.
// A dead or slow feed draws the quiet face, also 200.
export default async function BarometerPage({ searchParams }: PageProps<"/barometer">) {
  const query = await searchParams;
  const asked = Array.isArray(query.city) ? query.city[0] : query.city;
  const city = findCity(asked ?? "") ?? CITIES[0];
  const reading = await readStation(city.slug);

  return (
    <div className="barometer">
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
      <main className="bench">
        <header className="title">
          <h1>Barometer</h1>
          <p className="tagline">A brass weather station for your city, drawn by hand.</p>
        </header>
        <HandApp city={city.slug} reading={reading ? { hpa: reading.pressureHpa, at: reading.at } : null}>
          <form method="get" action="/barometer" className="picker">
            <label className="field">
              <span>City</span>
              <select name="city" defaultValue={city.slug}>
                {CITIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Read</button>
          </form>
          <Station city={city} reading={reading} />
          <p className="sentence" data-sentence="">
            {reading ? describe(city, reading) : "The station is quiet."}
          </p>
        </HandApp>
        <section className="explainer" data-explainer="" aria-labelledby="how">
          <h2 id="how">How to read it</h2>
          {EXPLAINER.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      </main>
      <footer className="credit">
        <p>
          Weather data by <a href={SOURCES.openMeteo}>Open-Meteo.com</a>, <a href={SOURCES.licence}>CC BY 4.0</a>.
        </p>
      </footer>
    </div>
  );
}
