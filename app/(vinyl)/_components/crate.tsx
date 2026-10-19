"use client";

import { useState } from "react";
import { filterRecords, genres, watchUrl, type VinylRecord } from "../_lib/records.ts";
import { Sleeve } from "./sleeve";

// The crate: search, a genre filter and a sleeve per record. Each sleeve's
// button is how a record reaches the platter (drag-and-drop arrives later
// and will keep this button as its alternative).
export function Crate({
  records,
  current,
  onPlace,
}: {
  records: readonly VinylRecord[];
  current: string | null;
  onPlace: (index: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const shown = filterRecords(records, { query, genre });

  return (
    <section className="crate" aria-labelledby="crate-title">
      <h2 id="crate-title">Crate</h2>
      <div className="crate-filters">
        <label>
          <span>Search</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title or artist" />
        </label>
        <label>
          <span>Genre</span>
          <select value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">All</option>
            {genres(records).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="crate-empty" role="status">
          No records match
        </p>
      ) : (
        <ul className="crate-list">
          {shown.map((r) => (
            <li key={r.id}>
              <article className="sleeve" data-record={r.id} aria-current={r.id === current ? "true" : undefined}>
                <Sleeve record={r} />
                <h3>{r.title}</h3>
                <p className="artist">{r.artist}</p>
                <p className="badges">
                  <span>{r.year}</span>
                  <span>{r.rpm} rpm</span>
                  <span>{r.genre}</span>
                  {r.id === current && <span className="on-platter">On the platter</span>}
                </p>
                <button type="button" className="place" onClick={() => onPlace(records.indexOf(r))} aria-label={`Place on turntable: ${r.title} by ${r.artist}`}>
                  Place on turntable
                </button>
                <a className="watch" href={watchUrl(r)} target="_blank" rel="noopener" aria-label={`Watch on YouTube: ${r.title}`}>
                  Watch on YouTube
                </a>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
