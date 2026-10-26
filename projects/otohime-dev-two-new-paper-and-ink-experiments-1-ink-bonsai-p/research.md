# pm-287 research: Ink Bonsai and Hand Shadow Theatre

Prior report: rep-5359. Both experiments fit the existing Next.js app. Bonsai uses pure SVG and a build-time count snapshot; Shadows reuses the pinned MediaPipe package, camera lifecycle and ink patterns from Peep Box.

## Repository findings

- Routes live below `app/(site)/(app)/play`. The season layer exposes `data-season`; SVG ink filters and a shared sound switch already exist.
- `@mediapipe/tasks-vision` 0.10.32 is pinned. The Peep Box vendor manifest, hash test and camera controller provide the asset and lifecycle pattern.
- The requested four pose labels remain in scope. The research report called deer harder but the idea requires it.
- Browser tests should use semantic heading names because RisoText duplicates visible text in the DOM. New e2e filenames must enter `scripts/check-gate-closure.mjs`.

## Risks and proof boundaries

A snapshot fallback preserves builds during a public activity outage and shows its as-of date. The model must be hash-pinned and locally loaded, and browser video must never be uploaded. Fake webcam input proves permission flow, while landmark fixtures prove pose decisions; QA still needs an independent browser walk. `next/og` has limited SVG filter support, so the OG route uses flat strokes.

The research body in report rep-5359 is the original source; this file carries the decisions that control implementation.
