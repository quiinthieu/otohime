# Task t-1681 Execution Evidence — Hanafuda Mobile Viewport-Visible Koi-Koi and Round-Over Prompts

- **Plan ID**: `pm-293` (Washi Daruma, Emaki, and Hanafuda)
- **Run ID**: `run-9255`
- **Task ID**: `t-1681`
- **Role**: `software_engineer` (`profile_id=agy-argon-high`, `model_id=gemini-4-argon`, `effort=high`)
- **Execution Classification**: `execution_demonstrated` & `product_delivered` (built and verified against production Next.js 16.4.2 server + embedded PostgreSQL + real Chromium via Playwright at `390x844` mobile and `1366x768` desktop viewports)

## 1. Root Cause & Changes Implemented

### Root Cause (`acceptance_report_1.md` F2 / `change_request_1.md`)
1. **Off-screen decision prompts on mobile (`390x844`)**: On a `390x844` mobile viewport, `/play/hanafuda` is ~2591 px tall and the player must scroll to `scrollY > 1000` (up to `~1747`) to tap hand cards at the bottom of the board. Because `.hanafuda-koikoi-modal` (`[data-testid="koi-koi-prompt"]`) and `.hanafuda-round-banner` (`[data-testid="round-result-banner"]`) were rendered in-flow near the top of `.hanafuda-root` with `position: relative` and no scroll/focus management, entering `phase === 'koi-koi-decision'`, `'round-over'`, or `'match-over'` left the prompt far above the viewport (`top = -1015, bottom = -640` at `scrollY = 1747`) with the hand disabled below.
2. **Ancestor transform containing block**: `app/(site)/(app)/play/hanafuda/page.tsx` wraps `<HanafudaBoard />` in `<div className="rise">`, which in `app/(site)/globals.css` applies `translate: 0 6px -> 0 0` via `@keyframes rise`, creating a transform containing block that would otherwise scope `position: fixed` descendants to `.rise` rather than the viewport.
3. **Playwright CLI verification compatibility**: Running `npx playwright test e2e/hanafuda.test.ts` invoked `@playwright/test`'s CLI loader against a `node:test` file and exited with `Error: No tests found`.

### Solution
1. **Viewport-pinned mobile sheet & sticky desktop banner (`app/(site)/(app)/play/hanafuda/hanafuda.css`)**:
   - Disabled `.rise` transform/translate on `.rise:has(.hanafuda-root)` so `position: fixed` descendants are strictly viewport-relative.
   - Changed `.hanafuda-root` to `display: flex; flex-direction: column` and set `position: sticky; top: 0.75rem; bottom: 0.75rem; z-index: 40;` on `.hanafuda-koikoi-modal` and `.hanafuda-round-banner`.
   - Under `@media (max-width: 52rem)` (covering `390x844` mobile viewports), pinned `.hanafuda-koikoi-modal` and `.hanafuda-round-banner` to the bottom of the viewport (`position: fixed; left: 0.75rem; right: 0.75rem; top: auto; bottom: 0.75rem; z-index: 60; max-height: calc(100vh - 1.5rem); overflow-y: auto;`).
2. **Focus, viewport visibility, and deterministic `?fixture=koi-koi-ready` (`app/(site)/(app)/play/hanafuda/_components/hanafuda-board.tsx`)**:
   - Added deterministic `?fixture=koi-koi-ready` (and `?fixture=match-over-ready`) query param support via `createKoiKoiReadyState`, conserving all 48 cards while placing `03-hikari-curtain` in the player's hand matching `03-tanzaku-akatan` on the field and `09-tane-sake-cup` on top of the stock matching `09-kasu-2` so a single tap on `03-hikari-curtain` immediately forms *Hanami-zake* (`5 pts`) and enters `phase === 'koi-koi-decision'`.
   - Added a `useIsomorphicLayoutEffect` on `[state.phase, state.round, state.turnCount]` that ensures `[data-testid="koi-koi-prompt"]` (on `koi-koi-decision`) or `[data-testid="round-result-banner"]` (on `round-over` / `match-over`) is strictly within `[0, window.innerHeight]` and moves keyboard focus (`focus({ preventScroll: true })`) to the primary action button (`decide-koi-koi`, `next-round-btn`, or `play-again-btn`).
   - Added explicit `role="region"` and `aria-live="polite"` attributes to both `<section data-testid="koi-koi-prompt">` and `<section data-testid="round-result-banner">` while preserving `[data-testid="hanafuda-live-status"]` (`role="status" aria-live="polite"`).
3. **E2E verification (`e2e/hanafuda.test.ts`)**:
   - Added a CLI bridge at the top of `e2e/hanafuda.test.ts` so `npx playwright test e2e/hanafuda.test.ts` executes the `node:test` + `playwright-core` E2E suite via `scripts/e2e.mjs --test e2e/hanafuda.test.ts`.
   - Added the `390x844` mobile and `1366x768` desktop E2E test verifying that after scrolling to the player hand at the bottom of the board (`scrollY > 1000`) and tapping `03-hikari-curtain`, `koi-koi-prompt`, `decide-koi-koi`, `decide-shobu`, `round-result-banner`, `next-round-btn`, and `play-again-btn` all have bounding boxes strictly inside `[0, window.innerHeight]` (`844` on mobile, `768` on desktop), keyboard focus moves to the primary button, and `aria-live="polite"` announcements remain intact.

## 2. Verification & Negative Controls

- **Command**: `(test -d node_modules || npm ci) && npx playwright test e2e/hanafuda.test.ts`
  - **Result**: Exit `0` (`tests 6, pass 6, fail 0`).
  - **Real/Fake Boundary**: Real Next.js 16.4.2 production build (`next build` + `next start`), real embedded PostgreSQL migration, real headless Chromium browser via `playwright-core` at `390x844` (`isMobile: true, hasTouch: true`) and `1366x768`. Zero mocked DOM or fake layout measurements.
  - **Negative Controls Exercised**:
    1. Sound off-by-default (`aria-pressed="false"`) verified to construct `0` `AudioContext` instances during gameplay until explicitly toggled on, and capped at `<= -18 dB` when enabled.
    2. Month `01` (Pine) card back flip verified to show `0 commits` and `0` shipped project items (`card-back-projects-01` count `0`).
    3. `prefers-reduced-motion: reduce` verified to record `0` View Transitions (`data-view-transitions="0"`) and `0` running animations (`animationName: "none"`).
- **Unit, Typecheck, and Lint Suites**:
  - `TMPDIR=/tmp npm test && npm run typecheck && npm run lint`: Exit `0` (0 errors).
