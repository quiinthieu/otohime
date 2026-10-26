# Delivery summary · pm-264/t-1590 · run-8885

This run follows fix_plan_run-8876 and repairs the delivered Peep-box browser verifier. No product code changed: the emitted Play chunk `b399ef8c…` and lazy controller `3570b1f3…` are byte-identical to delivery `28d4542`.

- **Geometry flake (`e2e/peep-box.test.ts`, formerly :225).** The cause is a verifier race, not the projection. Direction input is ignored until the controller's effect has run and its IntersectionObserver sets `data-running="true"`, and the test pressed Enter before that. A production probe reproduced the race on demand: an early click left the transform unchanged, and the same click after running moved the far layer by exactly the analytic 54.545 SVG units. `activate()` now waits for a running pointer source, and the 0.1px assertion reports full CTM, bounds, scroll and state on failure. The tolerance is unchanged.
- **Touch flake (formerly :636).** The control now finishes Ink Press's layout first, measures `scrollY` and the maximum scroll, pans toward the side with room, waits up to 2s for a delta above 30px, and prints start, end and maximum values on failure. The real CDP touch events and the `pan-y` check are kept.
- **CI concurrency.** The `ci.yml` change is left to plan pm-270, which owns its sequenced edits. The live site already serves a descendant of the delivery.

Local results on the macOS lease: Node 22.23.3, Chrome 156.0.8078.48, build `L7KbzHbgDU2LtGMkvOaz_`.

| Check | Result |
| --- | --- |
| Pure projection contract | 6/6 |
| `npm test` | 2155/2155 |
| Lint and typecheck | exit 0 (10 existing warnings) |
| Focused browser suite | 8/8 on four runs plus one run with 12 CPUs saturated |
| Full serial browser suite | 110/110, none skipped |

Measured at both viewports: 8,456 bytes gzip, CLS 0. Orientation and permission inputs are synthetic fixtures, not real-device sensor evidence. CI, the green gate, deployment and QA belong to plan-manager after the push.
