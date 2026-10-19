---
plan_id: pm-190
run_id: run-6460
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 44c06ab095abd9d8017eaaf8e4ca83f654f5dfbc
---

# Acceptance: Elements Atlas (pm-190)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Fresh Chrome 1366×768, light OS, signed out | Open `https://otohime.dev/elements` | 200, title "Elements", 118 cells, 10 legend items, 18 grid columns; H reads "1 H Hydrogen 1.008" with aria-label "Hydrogen, atomic number 1, nonmetal"; smallest cell 66×70; no sideways page scroll; paper `rgb(250,248,243)` | `<meta name="build-sha" content="44c06ab095abd9d8017eaaf8e4ca83f654f5dfbc">` |
| Same page, before any click | Read the canvas count, loaded script bodies and requests | No `<canvas>`; none of the 10 loaded scripts contains `InstancedMesh`; no off-site request | walk `desktop.log` |
| Same page | Measure the series rows | La at x 192.64, the same as Sc; Ce under Ti, Ac under La, Lr under Lu; markers "57–71" and "89–103" | walk geometry |
| Same page | Hover legend "Noble gas", then hover Fe | `data-focus="noble-gas"`, H opacity 0.35, He 1; Fe lifts to `matrix(1.08…)` within 150 ms | probe 3/3 + walk; screenshot `probe-legend-1.png` |
| Focus on Ba | ArrowRight / ArrowDown / ArrowUp ×2 | Hf; Ra; Sr. Exactly one `tabindex=0` cell | walk |
| Table, nothing opened yet | Click H | `<dialog>` opens with "Did you know?" and hydrogen's own fact, a chip, 6 stats, a Wikipedia link and CC BY-SA 3.0. Order: viewport, name, fact, stats. Only now is chunk `27wvz16czfdew.js` (InstancedMesh) requested, and a **webgl2** canvas replaces the SVG. Caption "Bohr model: a simplified picture" | walk `desktop.log` |
| H dialog, 3D atom | Wait 800 ms; drag across the canvas | Frames differ (auto-rotate/orbits); the drag changes the view | walk |
| H dialog | Next, Previous, Esc | Helium's fact, then hydrogen's fact, with Previous disabled at H. Esc closes and focus returns to the H cell | walk |
| Focus on Fe | Enter; Close; Space; Tab ×12 | Iron's fact; Close returns focus to Fe; Space opens iron (24/24 in a dedicated probe); focus stays inside the dialog | walk + `probe-space.mjs` |
| H dialog | Next ×117 to Og, GC heap sample every 20 | 118/118 dialogs show their own `funFacts.json` fact. Next is disabled at Og, with the caption "nucleus showing 64 of 294 nucleons". It is the same canvas node (marker kept) and the only canvas. Heap 8.71 → 9.49 MB | walk, screenshot `desktop-og.png` |
| Same, sustained | 8 passes, about 1,880 swaps, GC before each sample | With WebGL: 7.91 → 9.39 (pass 1), then 10.17 to 10.33 (passes 4–7), then 9.97 (pass 8), so it plateaus. Without WebGL: 4.36 → 5.33, flat from pass 5. 1 canvas, 0 errors | `heap8-gl.log`, `heap8-nogpu.log` |
| 390×844 phone, touch, dark OS | Load `/elements`, tap H, tap Fe | No page overflow (390 = 390); the table scroller scrolls sideways; cells ≥44 px. The webgl2 atom loads after the first tap. Fe opens a sheet 390 wide, flush with the bottom (bottom 844), 760 high, with iron's fact. Close closes it | walk `phone.log` 39/39, screenshot `phone-sheet.png` |
| `reducedMotion: reduce` | Open H | The 3D atom shows, and two frames 800 ms apart are byte-identical (0 bytes differ) | walk `reduced.log` 50/50 |
| `--disable-gpu --disable-software-rasterizer` | Open H, sweep all 118 | Bohr SVG (`role=img`), no canvas, 3D chunk never requested, 118/118 facts | walk `nogpu.log` 45/45 |
| JavaScript off | Click Fe on `/elements`; open `/elements/xx` | Goes to `/elements/fe`: h1 Iron, iron's fact, "Did you know?", SVG, 6 stats, Wikipedia link. `/elements/xx` returns 404 (the only console line is that 404) | walk `nojs.log` |
| Any run | Console and page errors; off-site requests | 0 errors in every production run; no request to any host but otohime.dev (so no HDR, CDN or GLB fetch) | all walk logs |
| Lighthouse 12, desktop preset | `/elements` ×3 on production | perf 97 / 100 / 100; a11y, best practices and SEO 100; FCP 0.3 s, LCP 0.4 s, TBT 0 ms, CLS 0; the 3D chunk is not requested | `lh.mjs` |
| curl | `/`, `/projects`, `/shore`, `/capsule`, `/sun`, `/vinyl`, `/elements/og`, `/elements/xx` | 200 ×7, 404 for xx; `/projects` links `/elements` exactly once | curl |
| Clean `npm ci` of HEAD 174e3e2, Node 22.12.0 | lint, typecheck, `npm test`, `npm run elements:validate`, build, `next start -p 4031`, my walk + `scripts/walk-elements.sh` | lint/typecheck clean; 284/284 tests; validator 14/14. Build ok, build-sha 174e3e2. Local walks: desktop 50/50, phone 39/39, nogpu 45/45; repo walk 46/46. Server log has only the Ready lines | `server.log` |
| Production redeployed mid-run to pm-191's `0d3ac28` | `git diff 44c06ab 0d3ac28` on Elements paths; re-ran my desktop and phone walks on production | No change under `app/(elements)`, `package*.json` or `next.config.ts` (Vinyl files only). Desktop 50/50, phone 39/39 | build-sha `0d3ac28962a33cefc70390cbb087ddac65d9cb13`, `redeploy/*.log` |
| origin/main | `git log` for pm-190 commits 49d0661, d0a9e28, cce36cb, 68dc5c7, 44c06ab, 174e3e2 | Author and committer are `Otohime <quiinthieu@gmail.com>` on all six; no Co-Authored-By trailer. 44c06ab is an ancestor of main, and 44c06ab..174e3e2 changes only `qa-t-1085.md` | matches plan.commit_identity; there was no author.txt in the evidence |

Verdict: **pass**. A visitor gets the full periodic table, which works before any 3D code loads. Clicking or pressing a key opens a detail view, a bottom sheet on a phone. It shows a lazily loaded interactive 3D Bohr atom, the element's own sourced fun fact, key stats and Wikipedia attribution. There are fallbacks for reduced motion, for no WebGL and for no JavaScript.

## Deployed components

| Component | Sha / build | How read |
| --- | --- | --- |
| otohime.dev (Vercel, Next 16.4.2) | `44c06ab095abd9d8017eaaf8e4ca83f654f5dfbc` | `build-sha` meta on `/` and `/elements`, 2026-10-19 ~16:50–17:00Z |
| 3D chunk | `/_next/static/chunks/27wvz16czfdew.js` | the only script with `InstancedMesh`; the same name in production and in the local build |
| otohime.dev after the mid-run redeploy | `0d3ac28962a33cefc70390cbb087ddac65d9cb13` | `build-sha` meta; Elements code identical to 44c06ab |
| Repo HEAD (docs only past the deploy) | `174e3e2c78eaf66e8990bb7872e3b25f3bfc3066` | `git rev-parse HEAD`; local build carries it |

## Every done task, seen as a user

| Task | Delivery | Seen in this walk |
| --- | --- | --- |
| t-1083 data, facts, maths | d0a9e28 | 118 elements with CC BY-SA attribution on every summary; 118/118 own facts; La/Ac rows in the right place; ring count by shell (Og 7 rings); `elements:validate` 14/14 |
| t-1084 table, dialog, SVG | cce36cb | Grid, legend, lift, keys, dialog, sheet, Prev/Next/Esc/Close, focus return, no-JS page, themes (light and dark paper) |
| t-1085 3D atom | 44c06ab | Lazy chunk on first open, webgl2 canvas, motion, drag, reduced motion still, SVG without GPU, one canvas over 117+ swaps, heap plateau |

## Notes

- **My own flakes, not defects.** My first parallel walks missed the hover lift and one Space press. The transition read `matrix(1,0,0,1…)`, frozen at frame 0, under 5 parallel SwiftShader browsers. Dedicated probes and sequential walks pass every time (decision recorded).
- **Heap.** One sweep's first-vs-last ratio is +9% to +18%, depending on when the baseline is taken, because it includes warm-up. The multi-pass sweep shows a bounded plateau, not growth (decision recorded).
- **needsReview is empty.** The plan expected 104–118 there unless checked. I read all 118 facts and found none wrong.
- **Not covered.** The GLB flag (`NEXT_PUBLIC_ELEMENTS_GLB=1`) is off by default and was not built. The only WebGL tested was SwiftShader, not a physical phone GPU. Vercel's runtime logs are not reachable from this lease; the local server log and the production browser console were clean.
- Scripts and logs are in a scratch dir outside the repo (`/tmp/acc-pm190`).
