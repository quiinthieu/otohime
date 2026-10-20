import type { Metadata } from "next";
import { VinylApp } from "../_components/vinyl-app";
import raw from "../_lib/records.json";
import { parseRecords, watchUrl } from "../_lib/records.ts";

// absolute: the layout's template would otherwise make this "Vinyl · Vinyl".
export const metadata: Metadata = { title: { absolute: "Vinyl" } };

// Checked once, when the module loads: a broken records.json fails the build.
const RECORDS = parseRecords(raw);

// /vinyl: the crate, the turntable and the monitor are one client island; the
// player script loads only when a record is placed. The list under it is plain
// HTML, so every record can still be heard on YouTube without JavaScript.
export default function VinylPage() {
  return (
    <div className="vinyl">
      <header className="topbar">
        <nav className="ways-out" aria-label="Site">
          {/* A plain <a>: / is in another root layout, which needs a full page load. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="home-link" href="/">
            otohime.dev
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="home-link" href="/projects">
            <span aria-hidden="true">←</span> All projects
          </a>
        </nav>
        <h1>Vinyl</h1>
      </header>
      <main>
        <VinylApp records={RECORDS} />
        <section className="all-records" aria-labelledby="all-records">
          <h2 id="all-records">Every record in the crate</h2>
          <ul>
            {RECORDS.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.title}</strong> by {r.artist}, {r.year} · {r.genre}
                </span>
                <a href={watchUrl(r)} target="_blank" rel="noopener" aria-label={`Watch on YouTube: ${r.title}`}>
                  Watch on YouTube
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="credit">
        <p>
          Sleeves and labels are drawn by code from each record&apos;s colours; no artwork is fetched. The music plays in
          YouTube&apos;s own player. The turntable was studied from shadcn.io&apos;s Vinyl blocks, Fitbert/the-shelf,
          thebuggeddev/vinyl and bitu467/record-player; nothing was copied from them.
        </p>
      </footer>
    </div>
  );
}
