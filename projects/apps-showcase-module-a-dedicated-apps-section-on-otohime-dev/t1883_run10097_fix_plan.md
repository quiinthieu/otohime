# Fix Plan — `pm-303` / `t-1883` (`run-10097`)

- **Target Task**: `t-1883` ("Animated ASCII and solar-drift terminal previews with contrast and reduced-motion safety")
- **Cause**: `code` (`run-10095` exited without committing or pushing the `t-1883` implementation after a background `check_browser_journey.mjs` run hung on `avietidol-z490`)

## Required Changes for `software_engineer` (`t-1883`)

1. **Implement `lib/apps-preview.ts`** (pure TypeScript, zero DOM/React imports):
   - `NIWA_STAGES` (`5` stages, each with `lines: string[]` (`>= 4` non-empty lines) and `menuBar` / `status` text containing `"niwa"`), `NIWA_STATIC_STAGE = 3`, and `niwaStageAt(index)` (clamping out-of-range indices to `[0, 4]`).
   - `SHIKI_SEASONS = ["spring", "summer", "autumn", "winter"] as const`, `SHIKI_PHASES` covering `Dawn`, `Noon`, `Sunset`, `Midnight`, `SHIKI_STATIC_PROGRESS = 0.68`, `wcagContrastRatio(fgHex, bgHex)`, and `shikiPaletteAt(progress01, season)` clamping `progress01` to `[0, 1]` and returning `bg`, `fg`, `prompt`, `accent`, `horizonStops`, `phaseLabel`, and `contrastRatio >= 7.0` across all `progress01 in [0, 1]` and all 4 seasons.
   - `resolveFramePreview(preview, frameIndex)` clamping out-of-range indices safely for `kind: "frames"` manifests (`Bento`, `Kakeibo`, and custom JSON manifests).

2. **Implement `app/(site)/(app)/apps/_components/terminal-preview.tsx` (`"use client"`)**:
   - Render `<section role="region" aria-label={preview.title} data-terminal-preview={preview.kind} data-reduced-motion={reducedMotion ? "true" : "false"} data-playing={playing ? "true" : "false"}>`.
   - Subscribe to `window.matchMedia("(prefers-reduced-motion: reduce)")` via `useSyncExternalStore` with server snapshot `"true"` so SSR / no-JS and reduced-motion render a complete static frame with `data-reduced-motion="true"` and `data-playing="false"` and zero automatic timer ticks, while manual keyboard controls remain operable.
   - Render operable buttons matching the QA suite selectors:
     - All preview kinds: `Play` / `Pause` toggle button (`button` with text `"Play"` or `"Pause"`).
     - `niwa-garden`: simulated macOS menu bar header containing `"niwa"`, monospace garden frame, and 5 stage selector buttons (`Stage 1` .. `Stage 5`).
     - `shiki-drift`: `<canvas>` solar/horizon strip, solar phase buttons (`Dawn`, `Noon`, `Sunset`, `Midnight`), season buttons (`Spring`, `Summer`, `Autumn`, `Winter`), and live WCAG contrast badge formatted with `<ratio>:1` (e.g. `11.4:1 AAA`, always `>= 7.0`).
     - `frames`: `$ <command>` prompt, current frame lines, and `Prev` / `Next` frame step buttons.
   - Ensure zero finite CSS/WAAPI animations (`endTime !== Infinity`) run on mount so `scripts/probe-motion-state.mjs` settles immediately.

3. **Wire `<TerminalPreview />` & Styles**:
   - Mount `{app.preview ? <TerminalPreview preview={app.preview} /> : null}` in `app/(site)/(app)/apps/[slug]/page.tsx`.
   - Add terminal preview styles in `app/(site)/(app)/apps/apps.css` keeping `@media (prefers-reduced-motion: reduce)` as the final block in `apps.css` (do not modify `app/(site)/globals.css` or `package.json`).

4. **Add `lib/apps-preview.test.ts` & `projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/task-2-evidence.md`**:
   - Cover all 5 Niwa stages, 200+ sampled Shiki points across all 4 seasons (`contrastRatio >= 7.0`), boundary clamping, `wcagContrastRatio` positive/negative controls (`21:1` and `1:1`), and `resolveFramePreview`.
   - Verify with `make -C projects/apps-showcase-module-a-dedicated-apps-section-on-otohime-dev/qa test` ( note: `check_browser_journey.mjs` now kills detached `next start` process groups and exits explicitly so it will not hang on Linux).
   - Commit with `Otohime <quiinthieu@gmail.com>` (no `Co-Authored-By`), push to `origin/main`, and submit `plan_manager_submit_report(kind="summary")`.
