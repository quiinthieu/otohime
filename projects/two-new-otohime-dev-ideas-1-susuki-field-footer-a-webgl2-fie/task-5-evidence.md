# Task 5 — Book-to-page View Transitions, `/projects` discovery link, and `/shelf` browser E2E

## Summary

Completed Task 5 of `pm-299` (`Susuki Field & Ink Shelf`):
- Wired 3D and flat-shelf book click View Transitions in `components/ink-shelf.tsx` and `components/ink-shelf-3d.tsx` using `projectBookScreenRect` (`lib/shelf.ts`) and `[data-testid="shelf-transition-proxy"]` to morph from the clicked book's projected screen bounding box to the destination project or note heading via `document.startViewTransition` when motion is allowed, skipping `startViewTransition` and hover springs under `prefers-reduced-motion: reduce`.
- Added `transitionName` support to `FigTitle` (`components/figures.tsx`) and paired `app/(site)/(app)/notes/[slug]/page.tsx` headings with `note-${note.slug}`.
- Added the paper-and-ink discovery link (`data-testid="projects-shelf-link"`, `"Browse the 3D Ink Shelf →"`) to `app/(site)/(app)/projects/page.tsx`.
- Added `e2e/shelf.test.ts` covering `/projects` → `/shelf` navigation, desktop (`1366×768`) and mobile (`390×844`) crawlable links + non-blank sumi-e WebGL canvas + keyboard focus and pointer hover sync, book-to-page View Transitions, reduced-motion suppression, no-WebGL flat fallback, `?outlineDebug=1` grazing-angle shader uniforms, `/` bundle isolation, and `WEBGL_lose_context` recovery.

## Verification

| Check | Result |
| --- | --- |
| `shelf-and-susuki-e2e` (`scripts/e2e.mjs --test e2e/shelf.test.ts e2e/susuki.test.ts`) | **18 / 18 tests pass** (9 in `e2e/shelf.test.ts`, 9 in `e2e/susuki.test.ts`), 0 failures |
| `npm test` | **2,798 / 2,798 tests pass** across all unit and regression suites |
| `npm run typecheck` | Route type generation and `tsc --noEmit` pass with 0 errors |
| `npm run lint` | 0 errors (13 existing warnings in unrelated files) |
| `node scripts/check-gate-closure.mjs` | Exits `0` (`certified: true`, `local_controls: "pass"`, `failures: []`) |
