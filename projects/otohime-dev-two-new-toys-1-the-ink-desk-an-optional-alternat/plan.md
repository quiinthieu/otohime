# Ink Desk + Stamp Ledger (pm-250)

Two independent toys on existing otohime patterns (Next 16, React 19, no animation library). Read `node_modules/next/dist/docs/` before adding routes or caching (AGENTS.md). Research: rep-4956.

## Decisions
- No animation library: pure underdamped spring `step()` in `lib/`.
- Desk is opt-in (console "desk" cartridge + `/desk`); default home unchanged.
- Ledger lives at `/ledger`, linked from Work. Build-time data with committed `content/ledger.json` fallback; fetch failure never breaks the build.
- Determinism: stamp rotation/smudge and default desk rotation derive from hashes, never `Math.random` (SSR-safe).
- Pure logic in `lib/*.ts` with `lib/*.test.ts` (picked up by `npm test`); components stay thin.
- Nothing waits: every claim is proven by unit tests, a fake `fetch`, or an e2e on a local server. No operator action is needed (GITHUB_TOKEN is optional; absent token = fallback JSON).

## Sequence
1 sound cues -> Ledger (2-5) -> Desk (6-10). Ledger and Desk are independent after task 1.

## Tasks
1. Stamp and rustle sound cues (shared).
2. Ledger data pipeline: `scripts/ledger-fetch.mjs`, `content/ledger.json`, schema parser.
3. `lib/ledger.ts` pure model (intensity, stamp style, grid, milestones, receipt).
4. `/ledger` page: SVG calendar, receipts, a11y, link from Work.
5. Press replay + sound + reduced motion + e2e.
6. `lib/desk.ts` layout model + persistence parser.
7. `lib/desk-string.ts` + `lib/spring.ts`.
8. `/desk` page: items, drag, wobble, persistence, tidy, console cartridge, cork string.
9. Radial menu, keyboard controls, sounds, notebook page-turn.
10. Mobile stacked desk, reduced motion, e2e.

## Non-goals
Real-time GitHub data, private repo data, editing content from the desk, replacing the default home.
