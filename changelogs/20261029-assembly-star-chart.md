# Ink Assembly Line and Paper Star Chart

Work opens with a five-station paper factory: ingest, clean, transform, load
and serve. Scrolling moves the crate, gears and stamps through the guide;
phones use a vertical belt. Visitors can run a word through the local cutter,
sorter and packer and read a receipt. Station tools come from the published
stack; impact is qualitative because verified project metrics are unavailable.
Reduced motion and no JavaScript show a static diagram and readable cards.

Notes links to `/notes/sky`. All published notes are linked ink stars, with
size, brightness and shared-tag constellations from the existing deterministic
geometry. The chart supports mouse/touch pan, arrow keys, recentering,
hover/focus titles and note navigation through the site's view transitions.
Dragging a star does not open it. The ordinary Notes list remains available.

Validation: 2,798 unit and regression assertions, lint, type checking and a
production build passed locally. Five browser tests cover forward/reverse
scroll, word receipts, constellation membership, hover/focus, drag suppression,
actual touch panning, all note destinations, view transitions, live reduced
motion changes and navigation without JavaScript.
