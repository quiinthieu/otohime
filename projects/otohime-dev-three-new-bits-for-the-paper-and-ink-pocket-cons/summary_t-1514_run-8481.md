# t-1514 Season tokens on site — summary (run-8481)

Role: software_engineer. Model: claude-opus-5-5. Plan pm-248, sequence 4.

## Delivered

- `lib/seasons.ts` now exports `SEASON_KEY` ("season"), `SEASON_ATTR`
  ("data-season") and `seasonScript`. `seasonScript` is `resolveSeason` written
  as an inline ES5 script and built from `SEASONS`, `SOUTHERN_PREFIXES`,
  `SOUTHERN_ZONES` and `seasonFor`, so it cannot drift from the model. It reads
  localStorage `season`, which wins only when it is valid. Otherwise it takes the
  month on the wall clock of the Intl zone (UTC when there is no zone or an
  unknown one) plus that zone's hemisphere. It then sets `data-season` on
  `<html>`. If storage throws, it falls back to the clock.
- `app/(site)/layout.tsx` and `app/global-not-found.tsx` run `seasonScript` in
  `<head>` right after `pinTheme`. Both import `seasons.css` after
  `globals.css`; the 404 is its own document, so it needs the sheet too. No
  client component, no `usePathname`, and nothing was added before `<Masthead />`.
- No hard-coded paper or ink was left to move. The only literal house colours in
  (site) are the `globals.css` tokens, the figure fills that stay dark in both
  themes by design, and `viewport.themeColor`, which stays static (it is metadata;
  making it follow the season would need client code, which is out of scope here).

## Tests

- `lib/motion.test.ts`: a root layout still imports exactly one root stylesheet.
  `TINTS` names the site's `seasons.css` as the only allowed extra. New tests:
  - the import order is globals then seasons, in the layout and in the 404;
  - only the site has tints;
  - seasons.css holds just the four `:root[data-season="…"]` rules plus keyframes;
  - both documents run `seasonScript` right after `pinTheme` in `<head>`;
  - the script is plain ES5 and uses the key and attribute from `lib/seasons.ts`.
- `app/(design-system)/_lib/siblings.test.ts`: `seasons.css` is excluded from
  the sister sheets, so the 10/11/8 counts and the site pin `#f2efe7` hold. A new
  test checks that it is still imported and tints only `--ink`, `--paper` and
  `--paper-2`, which globals.css declares.
- `lib/seasons.test.ts` runs the shipped script string with a fake `document`,
  storage, `Date` and `Intl` and compares it with `resolveSeason`. The grid is
  36 clocks (each month's turn and its 15th) × 64 zones (all southern ones,
  prefixes, northern, unknown, padded, empty, undefined) × 8 stored values,
  18,432 cases. Storage that throws is covered too. Negative control: a
  north-only copy of the script is caught in Sydney.
- `scripts/probe-seasons.mjs` has 9 more checks: script vs resolveSeason for
  Sydney, London, no zone, an unknown zone, Auckland at the month turn
  (2026-02-28T23:30Z is March there), a stored autumn, a stored nonsense value,
  storage that throws, and a north-only negative control.

The test fake first built the `Intl.DateTimeFormat` stub as an arrow function.
`new` on it threw inside the script's try, so the script silently fell back to
UTC. The Auckland month-turn case caught it. The fix was in the fake; the script
was right.

## Verification (local, node v22, linux)

- `npm test`: 1687 tests, 1687 pass, 0 fail (1680 before).
- `npm run typecheck`: exit 0. `npx eslint` on the touched files: exit 0.
- `npm run build`: exit 0, 182/182 static pages, Cache Components enabled.
- probe-seasons.mjs: 14/14 checks, exit 0.
- Negative controls on the layout tests: dropping the `seasons.css` import fails
  2 tests, and dropping the `seasonScript` tag fails 1.
- Browser (ad hoc, not committed): a temporary Playwright 1.64.0 Chromium
  headless shell against `next start` of this build, with probe placeholder env.
  The matrix was light/dark × {London, Sydney} × stored {none, winter, monsoon} ×
  {/, /work, /notes, /nope-xyz (global 404)}. Every page had the right
  `data-season` already when `<body>` was first parsed, and the body background
  was the tinted `--paper` (e.g. London autumn #f2e9de / #1e1712, Sydney spring
  #eff0e4 / #191c16). A pinned dark theme on a light OS got the dark pair.
  Negative control: with the script stripped from the HTML, no `data-season` was
  set and the background was the house #f2efe7. 34/34 ok.

## Boundaries

What is proven: the build, the served HTML and real Chromium rendering, locally.
The deployed site has not been checked; plan-manager's QA owns that. The ambient
layer and the dial (tasks 5 and 6) are not part of this task.
