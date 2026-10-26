# Paper Experiments: Pen Plotter Mode

Plan `pm-282`, revision 1. Product-owner run `run-9053`. The research for all three experiments is preserved in [research.md](research.md). This is part 1 of three linked plans: Pen Plotter Mode here, Pop-up Book Timeline in part 2, and Ink Ledger SQL in part 3. A part starts planning only after the previous part is done. The current repository base is identified by the commit containing this plan.

## Outcome

A visitor can enable Pen Plotter Mode from the site masthead, watch an overlay redraw the current page's inline SVG strokes, skip the drawing, and download a layered, physical-size SVG suited to a pen-plotter workflow. The mode works on any public page with inline SVG and explains when a page has no eligible strokes. It preserves the underlying page and keyboard access. Sound begins off and follows the existing sound preference. Reduced motion displays the completed drawing immediately.

This part ships a complete visitor-facing feature. It does not claim that HTML typography or raster JPG sketches become single-stroke geometry. The UI states that export includes only eligible inline vector art. SVG text is not silently represented as plotted outlines. No Python/vpype runtime, external service, scheduled job, database, or secret is needed.

## Design and interfaces

1. **Geometry contract.** `PlotStroke` has a stable source id, resolved ink colour, and finite points in page coordinates. A browser collector walks same-origin inline SVG primitive shapes (`path`, `line`, `polyline`, `polygon`, `rect`, `circle`, `ellipse`), resolves the complete CTM and presentation colour, samples curves at bounded geometric tolerance, and caps total work. Decorative clones and hidden SVGs are ignored. A pure core validates, simplifies, merges nearby endpoints and sorts by pen-up travel inside colour layers. It reports distance before and after. Tests use an in-memory collector adapter; a real browser test checks CTM and path sampling.
2. **Presentation.** A masthead toggle controls a cloned, pointer-transparent overlay. The original DOM is never rewritten. A carriage follows the current stroke and pauses on pen-up movement. Playback has Play/Skip/Exit controls, a bounded duration and cleanup on navigation, visibility changes and exit. A live `prefers-reduced-motion` change completes playback immediately. Audio is a gesture-initiated WebAudio scratch shaped by motion and gated by the existing shared preference; teardown closes or releases it.
3. **Export.** A4 and A5 output has explicit millimetre dimensions and viewBox. Each ink colour is an Inkscape layer of unfilled, single-line paths or polylines with flattened coordinates and no inherited transforms. The download name is safe and the generated SVG contains neither scripts nor external resources. Geometry and serialisation share the same strokes as playback.
4. **Validation.** Red/green unit tests for geometry and output, a local browser probe for real SVG collection, and e2e tests for toggle, playback, export, reduced motion and an empty-vector page. The project suite, typecheck, lint and build remain green. QA independently checks the shipped browser behavior and a negative control; final acceptance uses the delivered SHA and deployed page when available. Browser proof identifies real collection separately from fake geometry tests.

## Task graph

| Sequence | Build contract | Depends on | Observable result |
| --- | --- | --- | --- |
| 1 | Define and test plot strokes | — | Finite, transform-aware stroke extraction with bounded browser sampling. |
| 2 | Optimise layered strokes | 1 | Endpoint merge, simplify and travel sorting measurably reduce pen-up movement without changing colour order. |
| 3 | Add plotter overlay and controls | 2 | Toggle, drawing carriage, skip/exit and reduced-motion behavior work on a real page. |
| 4 | Export plotter SVG | 2, 3 | A4/A5 downloads contain flattened unfilled ink layers. |
| 5 | Finish sound and browser regression | 3, 4 | Sound obeys preference; browser happy and negative paths and full suite pass. |

These five overlapping tasks have a five-task dependency path, inside the configured six-hour deterministic proposal ceiling at the fallback one-hour task estimate. Each task is a build contract in the proposal, with paths, exclusions and commands. UI tasks require QA; pure internal geometry tasks can use `qa=skip` only when their verification is complete.

## Boundaries for the later parts

**Part 2: Pop-up Book Timeline.** `/timeline` is an accessible ordered list for 2018–2026, enhanced into CSS 3D/SVG spreads. Year navigation supports keyboard and scroll; tabs/wheels expose details with keyboard controls. Reduced motion and no JS use the flat illustrated list. The implementer must use verifiable public facts from `content/site.ts`, visibly mark missing career details for owner review, and never invent biographical claims. Missing optional owner details are advisory, not a launch gate. Local browser tests cover keyboard turning, controls, responsive layout and reduced motion. Timeline art should be eligible for plotter export where it is genuine vector geometry.

**Part 3: Ink Ledger SQL.** Use `/ledger/sql`, preserving the existing `/ledger` Stamp Ledger. Load a locally hosted, pinned DuckDB-WASM worker only on explicit use of this route. Export safe public JSON from existing committed data (`content/history.json`, public notes and curated sketches/ledger data); do not expose private database tables. Music and projects enter only if a reviewed public aggregate export can be produced without secrets; otherwise the UI explains their absence. Saved queries and static precomputed examples work without the worker. SQL is confined to public in-browser data, with external access disabled, bounded execution and result rendering, accessible real tables and ink charts. Verify locked WASM/worker construction in Chromium, a real query, an unsafe-query negative control and first-load asset behavior. Generated WASM is ignored and built from a pinned package, never committed as a binary.

## Dependencies and evidence

The repository owns the plotter's geometry, UI and tests. Delivery depends on the already configured GitHub SSH deploy key and GitHub Actions/Vercel project behind this repository. The prerequisite manifest names external capabilities and probes their context; a probe of a control-plane API does not prove the execution runner's SSH key. Runtime capacity is platform scheduling, not a human prerequisite. The plan adds no person-started runtime step.

The revision-1 probe returned `missing` for GitHub authenticated API read because the registered repository has no `ci_token`; this does not show SSH clone/push failure. The task-manager probe target does not cover repository CI, and `service_capability` does not allowlist Vercel. They remain unproven, not declared ready. This plan is `legacy_v1`, where prerequisite admission is shadow-only; if a real person-owned configuration gap emerges, the first affected task raises an operator action immediately. No credential is requested in chat.

The actual CI file is `.github/workflows/ci.yml`, with preview/production deployment as configured there. The generic mono-v2 GitLab/k3s deployment rules in the shared guide do not describe this GitHub repository. Software engineers stop at a tested push; the green gate and QA/acceptance own deployment evidence. No natural run or soak is part of any task proof.

## Decision log

- Order the experiments plotter, timeline, SQL to deliver the smallest reusable visual core first.
- Use `/ledger/sql` because `/ledger` is occupied.
- Treat vector-only plotting and JSON-first SQL data as honest v1 scope.
- Keep all human preferences advisory; no approval or waiting step blocks implementation.
