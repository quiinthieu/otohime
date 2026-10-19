"use client";

import { useState, type PointerEvent, type Ref } from "react";
import { boxOf } from "../_lib/flight.ts";
import type { Box } from "../_lib/geometry.ts";
import { filterRecords, genres, watchUrl, type VinylRecord } from "../_lib/records.ts";
import { Sleeve } from "./sleeve";

// The crate: search, a genre filter and a sleeve per record. A record
// reaches the platter by dragging its sleeve art there (sleeve-drag.ts) or
// with its "Place on turntable" button, the non-drag alternative; either way
// it flies from the sleeve, whose box onPlace receives.
export function Crate({
  records,
  current,
  dragging,
  sectionRef,
  onPlace,
  onDragStart,
}: {
  records: readonly VinylRecord[];
  current: string | null;
  dragging: string | null; // the record whose sleeve is being dragged
  sectionRef: Ref<HTMLElement>;
  onPlace: (index: number, from: Box | null) => void;
  onDragStart: (e: PointerEvent, index: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const shown = filterRecords(records, { query, genre });

  return (
    <section className="crate" aria-labelledby="crate-title" ref={sectionRef}>
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
              <article
                className="sleeve"
                data-record={r.id}
                data-dragging={r.id === dragging ? "true" : undefined}
                aria-current={r.id === current ? "true" : undefined}
              >
                <div className="sleeve-grip" title="Drag onto the platter" onPointerDown={(e) => onDragStart(e, records.indexOf(r))}>
                  <Sleeve record={r} />
                </div>
                <h3>{r.title}</h3>
                <p className="artist">{r.artist}</p>
                <p className="badges">
                  <span>{r.year}</span>
                  <span>{r.rpm} rpm</span>
                  <span>{r.genre}</span>
                  {r.id === current && <span className="on-platter">On the platter</span>}
                </p>
                <button type="button" className="place" onClick={(e) => onPlace(records.indexOf(r), boxOf(e.currentTarget.closest("article")?.querySelector(".sleeve-art")))} aria-label={`Place on turntable: ${r.title} by ${r.artist}`}>
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
