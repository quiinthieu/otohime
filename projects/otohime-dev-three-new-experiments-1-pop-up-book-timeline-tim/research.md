# Research preserved from report rep-5313

The research run found that `/ledger` already serves a Stamp Ledger with `lib/ledger.ts`, `lib/ledger-data.ts`, `content/ledger.json` and tests. The SQL experiment belongs at `/ledger/sql`. `/desk` is also occupied.

The site uses Next 16.4.2, React 19.3, Three.js, R3F and route CSS. It already has build-time `content/history.json`, ledger, portraits, bottles, and public ask/peeks indexes. Notes are in `content/site.ts`. Music plays and projects are database-backed, so a public aggregate export needs separate review. Sketches are JPGs; existing inline SVG lives in figures, headings and other ink components.

Timeline can use an ordered list of 2018–2026 years as its accessible source, then CSS 3D/SVG hinged spreads. Keyboard page turning, tabs and wheels need controls and announcements; reduced motion should use the flat list. Real biographical facts must come from existing content or be marked as missing, never invented. Test data shape, state transitions and browser navigation.

SQL can use route-local DuckDB-WASM, generated local WASM/worker assets, public JSON first, a real table and small SVG charts. It needs unsafe-query limits, row and cell caps, static saved-query examples and browser smoke proof. Do not make private database-backed play or project data public by accident. Parquet is optional for this small dataset.

Plotter can collect inline SVG primitives, flatten transforms and curves, split by ink colour, join nearby endpoints, simplify and sort travel. A cloned overlay animates sorted strokes with a carriage; reduced motion shows completion immediately. WebAudio is opt-in through existing sound preference. Export millimetre-sized, layered, unfilled SVG. Raster sketches and HTML text cannot honestly be promised as single-stroke output in v1. Unit tests cover geometry/export; browser tests cover collection, lifecycle, download and reduced motion.

Research recommended geometry first, timeline second, SQL third, with separate plans so each experiment ships independently. Its open questions were public music history, missing career facts, and Hershey-style single-stroke text. Defaults are public aggregates only or omission, flagged biography gaps, and text outside plotter v1.
