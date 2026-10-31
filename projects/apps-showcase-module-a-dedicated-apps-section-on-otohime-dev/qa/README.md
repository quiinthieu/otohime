# QA Suite — Ink Apps Workshop (`pm-303` / `t-1882` & `t-1883`)

Executable `platform.role-suite.v1` verification suite for plan `pm-303` (`Ink Apps Workshop`), tasks `t-1882` (`run-10090`) and `t-1883` (`run-10097`).

## Required Coverage

- `t-1882:sha256:0589346a70c8df8f407cf7a5016267205eb159078e44e35dc1b8a0380078da4a`
  > Adding a JSON file in `content/apps/<slug>.json` populates `/apps` and `/apps/<slug>` without code changes; Apps appears in the main sidebar nav and Pocket Terminal (`go apps` / `apps`) while `CONSOLE_MENU` stays at 7 items; `/apps` renders all four app cards (Bento, Niwa, Kakeibo, Shiki) with carved hanko status stamps, platform badges, generated ink illustrations, and accessible platform/status filters; `/apps/[slug]` renders each app's hero, description, key features, copyable install snippet, 5-stage lifecycle and milestones, dated changelog, and repo/Homebrew/zero-backend follow links (with HTTP 404 for unknown slugs); and `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- `t-1883:sha256:35304ad919bef86caf22c4c7304671952ff5b1e106ba37aee4691c759169da49`
  > Every app manifest with a preview descriptor renders an accessible, responsive terminal preview on `/apps/[slug]` (`Niwa` 5-stage growing ASCII garden + simulated macOS menu bar header; `Shiki` continuous Dawn/Noon/Sunset/Midnight x 4-season gradient drift with live WCAG contrast ratio >= 7.0 across the full `[0, 1]` solar cycle; declarative `frames` CLI output stepper for `Bento`, `Kakeibo`, and custom JSON manifests); under `prefers-reduced-motion: reduce` (and before hydration / without JS) automatic timers do not run and a complete static frame renders immediately while manual keyboard controls (`Play`/`Pause`, stage/time/season selectors) remain operable; zero finite mount animations block `probe-motion-state.mjs`; and `lib/apps-preview.test.ts`, `npm test`, and `npm run build` pass.

## Cases & Budget (`declared_s = 960 <= budget_s = 1800`)

1. `t1882-data-nav-and-dropin-contract` (`timeout_s: 30`, `check_data_and_nav.mts`)
   - Real imports of `lib/apps.ts`, `lib/apps-server.ts`, `lib/pages.ts`, `lib/terminal.ts`, `lib/hanko.ts`, and `content/apps/*.json`.
2. `t1883-preview-engine-and-contrast-contract` (`timeout_s: 30`, `check_preview_engine.mts`)
   - Dynamically imports `lib/apps-preview.ts` and verifies 5-stage Niwa garden + macOS menu bar header (`NIWA_STATIC_STAGE = 3`), Shiki 4-season x 4-phase solar drift with `contrastRatio >= 7.0` and independent WCAG luminance check across 804 sampled points in `[0, 1]` (`SHIKI_STATIC_PROGRESS = 0.68`), `resolveFramePreview` for Bento, Kakeibo, and custom JSON manifests, `lib/apps-preview.test.ts` execution, and `apps.css` final `@media (prefers-reduced-motion: reduce)` rule block.
3. `t1883-lint-typecheck-and-unit-tests` (`timeout_s: 120`, `check_gates.mjs`)
   - Executes `npm run lint`, `npm run typecheck`, `node --test lib/apps-preview.test.ts` (requiring the file on disk), `TMPDIR=/tmp npm test`, and `DEPLOY_AUTHOR_EMAIL=quiinthieu@gmail.com node scripts/check-deploy-author.mjs`.
4. `t1883-build-and-browser-preview-journey` (`timeout_s: 300`, `check_browser_journey.mjs`)
   - Runs `TMPDIR=/tmp npm run build`, starts `next start` in a detached process group (killing `-server.pid` on cleanup and exiting explicitly), and drives headless Chromium (`playwright-core`) across `/apps`, `/apps/{bento,niwa,kakeibo,shiki}`, a dynamically dropped-in 5th manifest `/apps/zzzz-qa-workshop-probe` (with custom `frames` preview), `prefers-reduced-motion: reduce` context, `javaScriptEnabled: false` context, and `probe-motion-state.mjs` finite animation checks.
