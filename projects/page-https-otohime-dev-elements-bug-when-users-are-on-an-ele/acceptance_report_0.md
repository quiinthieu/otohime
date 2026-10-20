---
plan_id: pm-197
run_id: run-6667
kind: acceptance_report
verdict: pass
cycle: 0
cited_sha: e3a38540bcd62ee6782fd624abcbddbc32a2e681
---

# Acceptance: Still Elements Table (pm-197)

**Verdict: pass.** On https://otohime.dev/elements, closing an element's dialog no longer jiggles the table, whether you click outside it, press Esc or press Close. The table does not move or reflow on any close path. After a click outside, no cell springs up under a pointer that has not moved. A cell lifts again as soon as the pointer moves, and focus returns to the element you opened.

Walked on production with build-sha `e3a38540bcd62ee6782fd624abcbddbc32a2e681`, read from `<meta name="build-sha">` inside every page of the walk and curled three times in a row first. Headless Chromium (Playwright 1.64.0, chromium_headless_shell-1248) on a Linux job pod, launched with `--hide-scrollbars` removed. That gives a real classic 15 px scrollbar (`clientWidth` 1351 < `innerWidth` 1366), which each walk asserts as a precondition. The script is `acceptance-walk.mjs` next to this file.

| Starting state | Action | Observable result | Evidence |
|---|---|---|---|
| 1366x768, /elements loaded | read build-sha and scrollbar | build-sha e3a3854; clientWidth 1351 < innerWidth 1366 (classic scrollbar) | walk precondition row |
| 1366x768, Fe (26) dialog opened by mouse | click outside the dialog (backdrop at 40, Fe row) | table x 40.52 / width 1269.97 on every frame from open to close+500 ms (54 frames): x spread 0.00, width spread 0.00, Ar (18) cell x spread 0.00. Focus on 26 | rAF sampler |
| same | press Esc | 60 frames, all spreads 0.00 px; focus on 26 | rAF sampler |
| same | press the Close button | 59 frames, all spreads 0.00 px; focus on 26 | rAF sampler |
| 1366x768, Fe dialog open | click outside at (80, Fe row), pointer held still over potassium (19) | 19: `none` at +50, +150, +300, +450 and +800 ms (no lift by itself) | computed transform under pointer |
| same, pointer parked | move the mouse 2 px, wait 350 ms | 19: `matrix(1.08, 0, 0, 1.08, 0, 0)`: hover lift works | computed transform |
| 1920x900, /elements loaded | read scrollbar | clientWidth 1905 < 1920 | precondition |
| 1920x900, Fe dialog open | close by backdrop, Esc, Close button | table x 329.64 / width 1245.72 on every frame on all three paths (56/59/61 frames); focus on 26 each time | rAF sampler |
| 1920x900, Fe dialog open | click outside at (360, Fe row), pointer held still over 19 | `none` at +50 to +800 ms; after a 2 px move, `matrix(1.08…)` | computed transform |
| 1366x768, pointer off the table | focus Fe, Enter, Esc (keyboard only) | opener 26 is `:focus-visible` and lifted `matrix(1.08…)`: keyboard feedback kept | computed style |
| 390x844 phone, touch, build-sha e3a3854 | tap Fe, close by Esc / Close button / tap outside (195, 20) | bottom sheet 390x760 at y 84 opens; it closes on each path; table rect [-381, 1380] unchanged (the table's own horizontal scroller is on Fe); focus on 26 | walk rows + screenshot |
| all of the above | watch the console, page errors and HTTP responses | 0 console errors, 0 page errors, 0 responses ≥ 400 | Playwright listeners |
| control: the same walk on e3a3854 with the fix overridden (`html{scrollbar-gutter:auto}` plus the settle rule neutralised) | same actions | the original bug comes back: 1366 table x spread 3.00 px, width 9.00 px, Ar cell 11.50 px on all three paths; 1920 x spread 7.50 px; the parked cell springs to `matrix(1.0868…)` at +50 ms, then 1.08 | control run, proves the walk can detect the jiggle |
| committed probe | `BASE_URL=https://otohime.dev bash scripts/probe-elements-dialog.sh` | `probe: 10 ok, 0 failed` | probe output |

## Components and delivery

- **Site (Next.js on Vercel):** the deployed build-sha is `e3a38540bcd62ee6782fd624abcbddbc32a2e681` (`server: Vercel`). Production rolled from c56df92 to e3a3854 partway through the run. The full walk, the control and the probe were all re-run on e3a3854, and the first full walk on c56df92 matched it exactly. `/api/health` → `{"ok":true}` 200.
- **Delivery t-1134 `04f8c15`:** an ancestor of e3a3854 (`git merge-base --is-ancestor`). `git diff 04f8c15 e3a3854 -- 'app/(elements)' app/globals.css app/layout.tsx` is empty.
- **Commit identity:** `04f8c15` is authored by `Otohime <quiinthieu@gmail.com>` and has no Co-Authored-By trailer. That matches plan.commit_identity. No author.txt came with the evidence, so I read the identity from the commit.
- **Logs:** the touched service is the Vercel deployment. This pod has no Vercel token or CLI, and the service is not a cluster workload, so I could not read function logs. /elements is a cached static page (`x-vercel-cache: HIT`). The browser-side console, page-error and network capture above is the runtime evidence.

## Notes (non-blocking)

- At 390x844 under Chromium's mobile emulation, the screenshot shows the reserved gutter on the right. Real phones use overlay scrollbars, so they get no gutter. This is the cost the plan accepted.
- The QA report's hardening note still applies: the committed probe has no `clientWidth < innerWidth` precondition, so on an overlay-scrollbar host it can pass for nothing. On this Linux pod the precondition holds, so the probe result above is real.
