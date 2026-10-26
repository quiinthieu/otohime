# Revision 2 planning evidence

Plan pm-259; product owner run-8806; 2026-10-26.
Actual profile: codex-sol-6-1-high, model gpt-6.1-sol, high effort, fleet worker avietidol-z490 (read from the run record, not current defaults).
Planning base: 15fd171. This document and plan.md are planning artifacts; no application executable changed.

## Result

Retain landed Kame (dd21add) and paper peel/registry (a46ad8e). Replace superseded unfinished work with four serial software-engineer build contracts: complete fetch, reversible Canvas fold, basket/ironing recovery, and measured loading/composition gates. Every task has problem, action items, repository paths, non-goals, readable acceptance criteria and executable verification entries; all require QA. The proposal is extracted directly from the JSON blocks in plan.md. The board summary report records the actual admission receipt and final pushed SHA.

The implementation remains dependency-free Canvas 2D. Deliberate grips protect touch scrolling and native links. One gesture owner and explicit actual-arrival feedback compose the existing modules. Read/Reset/focus preserve source content and accessibility. Rendering, physics and final performance gates are separate tasks so each delivery has bounded scope.

Current settings: max_plan_elapsed 6h; max_live_runs_per_plan 1. Four-task fallback estimate is 4h; server admission uses measured role p50. No later part is filed unless admission exceeds the ceiling.

## Local verification

- npm test: 2,078 passed; zero failures/skips.
- npm run lint: exit 0, ten existing warnings, no errors.
- npm run typecheck: exit 0.
- Production npm run build with the repository CI placeholder secret: exit 0.
- Existing production Kame and tear suites, serial scripts/e2e.mjs with SKIP_BUILD=1, real Chromium and temporary PostgreSQL: 16 passed; zero failures/skips.
- Extracted all four JSON contracts and validated required fields, earlier-sequence dependencies, nonempty path lists, verifier commands and bounded timeouts.
- research.md matches the rep-5095 board body verbatim apart from its trailing newline; it is already committed and needs no rewrite.
- git diff --check passes.

The real production app imports/build/renderer were exercised locally. Time/calendar/storage/media/idle fixtures control policy; mouse, keyboard, CDP touch and production Canvas/Web Audio paths run in the browser suites. This does not prove the new fetch/crumple features, which are explicitly future implementation contracts. Existing suites include native navigation, excluded desk/stamp gestures, sound-off and held-idle negative controls.

## Evidence limits and handoff

Only projects/** Markdown changed. The application executable fingerprint is unchanged at the planning base. Deployed integration, CI outcome and full product acceptance are unproven by this planning artifact; the final board report names any visible CI result at the pushed SHA. Per-task green gate/QA and final acceptance own deployed identity, independent browser observations and the complete toy walkthrough. New contracts require full serial e2e plus CI-equivalent footer walk/probe and measured performance.

No external async executable, queued capacity job or callback/history system applies to this browser-only planning change. No history-completeness or execution-recovery claim is made. The previous research and implementation reports are context, not independent acceptance evidence.

Explicit decisions record the role boundary, landed/superseded distinction, four-task split, grip arbitration, actual-arrival port, content recovery, fixture/browser boundary and commit naming. The surprise about superseded tasks retaining landed code and recovered instruction paths is recorded as kind=lesson. The requested shared planning and standing-rule documents were read from /home/avietidol/codes/mono-v2 because they are absent in this checkout; standing rules were not copied or changed.
