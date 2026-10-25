# Research: Ink Radio & Fan-out Peeks (pm-247)

Prior report: rep-4848. Build both. Ship Fan-out Peeks first, then Ink Radio as an experimental lazy island below Television on `/music`.

The site uses Next 16.4.2, React 19.3 and Cache Components. Music already uses `ViewTransition`. `scripts/ask-index.ts` indexes notes and projects and may supply peek relationships. The inspiration tweets were unavailable during research; Radio Browser API fields and terms require live verification during implementation.

Peeks enhance explicitly marked links. A build-time relation index selects three internal sketches, notes or projects. Hover, focus and touch long-press reveal paper cards; Escape and pointer exit close them. Base links always navigate. Cards are keyboard reachable, respect reduced motion and remain within the viewport.

Radio uses a committed, reviewed snapshot of HTTPS MP3/AAC stations with coordinates and attribution. No browser directory call, autoplay, Web Audio or live stream in automated tests. A lazy client island renders an SVG ink globe and tuning control. A click or Enter starts audio at capped volume. Failure shows a no-signal state and an alternate station. Keyboard and reduced-motion paths are first-class. Confirm Radio Browser API and stream metadata before vendoring.

Repo lessons: do not add CSS custom properties to `app/(site)/globals.css`; its count is pinned. React compiler lint rejects `performance.now` and `Math.random` in component closures. Clear `.next` before build, install with `npm ci` on fresh leases, and use a free-port fallback for probes.
