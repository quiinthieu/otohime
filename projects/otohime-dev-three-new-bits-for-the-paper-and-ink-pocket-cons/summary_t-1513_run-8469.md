# t-1513 Season model — summary (run-8469)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, sequence 3.

## Delivered

- `lib/seasons.ts`: `seasonFor(date, hemisphere, tz?)` uses meteorological months
  (Mar-May spring, Jun-Aug summer, Sep-Nov autumn, Dec-Feb winter), flipped for the
  south. The month is read on the wall clock in `tz` through Intl, or in UTC when no
  zone is given or the zone is invalid. `hemisphereFromZone(tz)` uses the exported
  `SOUTHERN_PREFIXES` (Australia/, America/Argentina/, Antarctica/) plus the
  `SOUTHERN_ZONES` list; anything else, including empty or unknown zones, is north.
  `resolveSeason(manual, date, tz)` returns a valid manual season first. It also
  exports `isSeason`, `monthIn` and `visitorZone` (Intl only, no geolocation or
  network).
- `lib/seasons.test.ts` covers 1st-of-month boundaries (including midnight), all
  twelve months, leap-year Feb 29 (2000/2024/2028) and the non-leap 2100, southern
  flips, the southern list resolving in Intl, the north default for unknown, empty,
  null and miscased zones, wall-clock month in Sydney and New York, manual
  precedence, and invalid manual values.
- `app/(site)/seasons.css` has one `:root[data-season]` block per season with
  `--paper`, `--paper-2` and `--ink` as `light-dark()` pairs. It declares
  `@keyframes almanac-petal|leaf|rain|snow` (transform/opacity only). It is not
  wired into any layout (non-goal).
- `lib/seasons-contrast.test.ts` parses seasons.css and computes WCAG 2 contrast of
  `--ink` on `--paper` and `--paper-2` for each season × {light, dark}, requiring
  at least 4.5:1. It also holds the untinted `--muted` from globals.css at 4.5:1 on
  the tinted papers. That check caught autumn light `--paper-2` #eadccc (4.36:1),
  which is now #eee3d5 (4.63:1). Self-check: the code reproduces the 14.4 / 14.1
  figures recorded in globals.css. Negative control: #999 on #fff is below 4.5.
- `scripts/probe-seasons.mjs` is a node-only smoke. It runs a CHECKS table against
  a fixed clock of 2026-01-15T12:00Z: Sydney is south and summer, London is
  winter, no zone gives winter, and manual autumn wins. It exits 1 on any
  mismatch. Negative control: a copy that expects winter for Sydney exited 1.

## Verification (local, node v22.12.0, darwin)

- `npm test`: 1664 tests, 1664 pass, 0 fail.
- `node --experimental-strip-types … scripts/probe-seasons.mjs`: exit 0, 5/5 checks.
- `npx eslint` on the four new TS/MJS files: exit 0. `tsc --noEmit` reports no
  errors in the season files.

## Boundaries

Everything here is pure logic and CSS text checked by tests. Nothing is rendered
in a browser: wiring, the ambient layer and the dial are tasks 4, 5 and 6.
