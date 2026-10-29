# pm-301 — Ennichi Night

`/play/ennichi` is the missing piece. Departures and Senko were already on https://otohime.dev. Ennichi returned 404.

The page is a four-colour inline SVG (cyan, magenta, yellow, key) with a halftone screen, seven keyboard-focusable keepsakes, pan/zoom, a hint lantern, and a stamp saved in `ennichi:v1`.

## Verification

- `lib/ennichi.test.ts`, `lib/motion.test.ts`, and `lib/sound.test.ts`: 138 passed.
- ESLint on the new files: 0 errors.
- `npm run build`: TypeScript finished and `/play/ennichi` is in the route table.
- Orca browser at 1280 and 390: zoom, drag-without-finding, hint cooldown, all seven finds, stamp, reload storage, and reset. Mobile hit target measured 46.6px. Plates use `mix-blend-mode: multiply` and a resting misregistration.
- Playwright could not launch in this sandbox (`bootstrap_check_in` permission denied). `e2e/ennichi.test.ts` is the suite CI runs.
