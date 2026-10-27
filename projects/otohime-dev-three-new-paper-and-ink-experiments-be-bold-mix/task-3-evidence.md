# Task 3 Evidence — `pm-293` / `t-1682`: Truthful Daruma project statuses and opt-in Kuyo fixture on `/projects`

- **Plan**: `pm-293` (Washi Daruma, Emaki, and Hanafuda — Revision 2, Cycle 1)
- **Task**: `t-1682` (Truthful Daruma project statuses and opt-in Kuyo fixture on `/projects`)
- **Run**: `run-9256` (`role=software_engineer`, `agent_profile=agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`)

## 1. Summary of Changes

1. **Truthful Project Lifecycle Statuses (`content/site.ts`, `content/yearly-log.json`)**:
   - Restored `Barometer`, `Structures`, and `Design system` to `status: "live"` with their real October 2026 repository dates (`started`, `shipped`, `lastActivityAt` in `2026-10-19..26`), removing the pre-repository May/June 2026 dates and `abandoned: true` flags introduced in `8b0c491`.
   - Aligned all 11 live projects in `content/site.ts` (`Shore`, `Capsule`, `Orrery`, `Elements`, `Vinyl`, `Rotor`, `Planisphere`, `Barometer`, `Gazette`, `Structures`, `Design system`) with `content/yearly-log.json` Month `10` (`shippedProjects`), with `0` entries in months `05` and `06`.
2. **Honest Unfinished Shelf Empty State & Opt-In Kuyo Demo Fixture (`lib/daruma.ts`, `components/daruma-board.tsx`, `app/(site)/(app)/projects/daruma.css`)**:
   - Added `KUYO_DEMO_FIXTURES` (`DARUMA_KUYO_FIXTURES`), `parseFixtureParam`, `resolveDarumaFixtureProjects`, and `formatUnfinishedEmptyState` in `lib/daruma.ts`, plus `incomplete` and `fixtureActive` on `DarumaShelves`.
   - When all real projects have shipped (`unfinished.length === 0` / `incomplete.length === 0`), `section[data-shelf="unfinished"]` renders `[data-testid="daruma-unfinished-empty"]` explaining that all 11 current projects have shipped with both eyes painted, and lighting Daruma Kuyo announces `"Daruma Kuyo ink-fire ceremony lit: no abandoned Daruma dolls to retire."` with `0` ink-fire overlays.
   - Supported explicit opt-in demo fixtures via `?fixture=kuyo`, `window.__DARUMA_FIXTURES__`, and the interactive `[data-testid="daruma-fixture-toggle"]` button on the unfinished shelf, loading 3 clearly badged (`data-demo-fixture="true"`, `[data-testid="daruma-fixture-badge"]`) non-route demo dolls (`Demo: Night Backfill` with `eyeState="left"`, `Demo: Winter Sketchbook` with `eyeState="left"` and `abandoned=true`, and `Demo: Unturned Ledger` with `eyeState="none"` and 90-day `abandoned=true`) without altering any of the 11 live projects.
3. **Unit, Generator, and Browser E2E Verification (`lib/daruma.test.ts`, `scripts/yearly-log.test.ts`, `e2e/daruma.test.ts`)**:
   - Updated `lib/daruma.test.ts` and `scripts/yearly-log.test.ts` to verify that all 11 projects in `content/site.ts` have `status: "live"` and real October 2026 dates matching `content/yearly-log.json`, that months `05` and `06` have `0` entries, and that both the default empty unfinished shelf and `?fixture=kuyo` / custom fixture overrides behave as specified.
   - Updated `e2e/daruma.test.ts` (including a CLI bridge when invoked via `npx playwright test e2e/daruma.test.ts`) to verify the default truthful `/projects` state (`11` live badges in Cartridges, `11` two-eyed dolls on the shipped shelf, `0` unfinished cards, honest empty state, and `0` Kuyo fires) as well as the `?fixture=kuyo`, interactive shelf toggle, and `window.__DARUMA_FIXTURES__` flows (one-eyed and blank-eyed demo dolls, Kuyo trigger button, `.daruma-kuyo-flame` and `.daruma-kuyo-ember` animations, `aria-live="polite"` announcement, hover/focus `daruma-wobble`, and `prefers-reduced-motion: reduce` static fallback).

## 2. Verification & Execution Evidence

- **Real vs. Fake Boundaries**:
  - **Real**: `content/site.ts`, `content/yearly-log.json`, `lib/daruma.ts`, `components/daruma-board.tsx`, Next.js `16.4.2` production build (`next build` + `next start`), embedded PostgreSQL `17` (`scripts/e2e.mjs`), and headless Chromium via `playwright-core@1.64.0`.
  - **Fixture / Injected**: Opt-in `KUYO_DEMO_FIXTURES` (`?fixture=kuyo`, `window.__DARUMA_FIXTURES__`, and `[data-testid="daruma-fixture-toggle"]`) and injectable clock (`?now=YYYY-MM-DD` / `window.__DARUMA_NOW__`).
- **Verification Commands**:
  1. `(test -d node_modules || npm ci) && node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/daruma.test.ts scripts/yearly-log.test.ts && npm run yearly-log:check` -> `15 / 15` tests passed, `yearly-log:check` exit `0`.
  2. `(test -d node_modules || npm ci) && npx playwright test e2e/daruma.test.ts` -> `3 / 3` Chromium E2E suites passed, exit `0`.
  3. `(test -d node_modules || npm ci) && TMPDIR=/tmp npm test && npm run typecheck && npm run lint` -> full repository unit suite, TypeScript check, and ESLint check exit `0`.
