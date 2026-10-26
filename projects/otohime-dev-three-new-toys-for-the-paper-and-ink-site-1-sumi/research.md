# pm-251 research summary (rep-5009)

Full research body was submitted as report rep-5009; this is the condensed record of its decisions.

- Pond: Jaffer/Lu closed-form marbling (drop, line tine, comb, circular tine, vortex) on vector polygons, not stable fluids. Prototype: 0.9 ms avg / 3.6 ms worst per frame at 20k vertices. Draw with WebGL2 stencil even-odd fill, Canvas2D fallback, server-rendered SVG (<= 60 KB) for reduced motion / no JS. Print = Canvas2D redraw at 2400x1800, PNG. Page background = 1280px JPEG in localStorage, wash <= 6% so muted text stays >= 4.5:1.
- Letterpress: grain as `background-image` data-URI (no `filter`, so probe-cartridges stays green), new `app/(site)/letterpress.css` inside `@layer components`, new quiet `press` cue (sine/triangle, -28 dB) via one delegated listener, `[data-own-sound]` opt-out.
- Zine: new `app/(zine)/` route group at `/zine`, portrait 2x4 imposition (right column 5,4,3,2 rotated CCW; left column 6,7,8,1 rotated CW; cut = middle half of vertical centre line), one `@page` rule, proven by Playwright `page.pdf` MediaBox (595x842 A4, 612x792 Letter).
- Constraints: Next 16.4.2 + cacheComponents (wrap searchParams in Suspense); run `npm ci` first; avoid globals.css and lib/pages.ts (pm-250 is editing); no new dependencies.
