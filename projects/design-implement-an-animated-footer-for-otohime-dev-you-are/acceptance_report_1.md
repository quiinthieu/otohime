---
plan_id: pm-241
run_id: run-8461
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: ef8035cc950f54a58f3bd714f49415f3c79e2dbc
---

# Acceptance: Internet Save Point (pm-241), cycle 1

**Verdict: pass.** A visitor to https://otohime.dev now finds the "End of the Internet" console save-point footer at the bottom of every public site page. They can poke the mascot, unlock the Konami achievement, restyle the scene, use every footer link and go back to the top, at desktop and on touch mobile, in both themes, with reduced motion, without JavaScript and with storage blocked.

## Walkthrough (live https://otohime.dev, my own Playwright script, Chromium 156.0.8078.4)

Script: `/tmp/acc8461/walk.mjs` (lease-local, not committed). Final run: **41 ok / 0 failed**. Every page load read `build-sha` = `ef8035c`.

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| fresh `/`, `/work`, `/play`, `/notes`, `/music`, `/projects`, `/sketches` at 1366×768 | load, read the visible footer | 1 visible `footer.end` after `main#main` on each page; both requested sentences; hrefs `/work,/play,/notes,/music,/projects,/sketches`; 4 `site.lines` hrefs; "© 2026 Otohime"; top=`#main`; 0 px overflow; `/` still has no `aria-label="Main"` | walk rows 2–9 |
| `/` footer | read contact link target/rel | Telegram/X/Spotify `_blank` + `me noreferrer`; Email plain `mailto:` | row 3 |
| `/` at top, footer offscreen | read stage | `data-seen` absent, ambient not active, LCD "SAVE / POINT", stage 487.8×448.8 | row 10 |
| footer offscreen | scroll into view | `data-seen=true`, `data-active=true`, Δh 0.0 (no layout shift) | row 11 |
| idle LCD | click mascot | LCD "SAVE/POINT" → "HI/THERE", polite readout changes, `aria-pressed` settles to false | row 12 |
| mascot focused | Enter, then Space | LCD advances "7 PAGES/INDEXED" → "12 FPS/ON TWOS" | row 13 |
| desktop pointer | move to the stage's corners, then away | pupils (−2.2, −1.47) → (2.2, 1.8) → (0, 0): bounded and reset | row 14 |
| **Negative control:** fresh storage, footer in view, textarea focused | type the full Konami code | stays locked, storage `null`, textarea received "ba" | row 15 |
| locked, in view | wrong sequence | stays locked | row 16 |
| locked, in view, body focused | ↑↑↓↓←→←→BA | unlocked; LCD "REACHED / THE END"; readout "Achievement unlocked: Reached the end."; badge opacity 1; `end:achievement=1`; URL stays `/`; Δh 0.0 | row 17, screenshot desk-home-unlocked |
| unlocked | reload | achievement restored | row 18 |
| footer knobs | click all 5 swatches, set wobble to 6 | `--fig` #f4b829 #ef6a4c #93d3b0 #76a0e2 #f3a6bb; `feDisplacementMap` scale 3.5 → 6 | row 19 |
| `/` footer | click footer **Work**, then footer **Projects** | `/work`, then `/projects`; 1 visible footer each (client navigation in the group transition) | rows 20–21 |
| `/projects` footer | click **Back to top** | scrollY 0, focus `MAIN#main` | row 22 |
| `/notes`, mascot focused | Tab through the footer | mascot → wobble → swatch → 6 pages → Telegram → X → Spotify → Email → Back to top, each with a visible focus ring, no trap | row 23 |
| `/music` desktop | compare the television and footer rects | iframe bottom 572 px, footer top 1767 px: the television is not covered | row 24 |
| `/music` default theme | click the theme toggle | `data-theme` null → dark; title/paper contrast 14.4:1 → 14.06:1 | row 25, screenshot desk-music-dark |
| `/sign-in`, unknown route (404), `/shore` project root | load | 0 `footer.end` on each | rows 26–28 |
| fresh `/work`, footer offscreen | type Konami at the top, then scroll down | stays locked, storage null (inactive-footer exclusion) | row 29 |
| fresh `/`, `/work`, `/music`, `/projects` at 390×844 touch | load | 1 footer, 0 px overflow, 6+4 links | rows 30–33 |
| 390×844, mascot focused | Tab, Enter, Enter | focus reaches "Customize scene"; it opens, then closes | row 34 |
| 390×844, footer in view | tap Customize scene, tap the 5th swatch | details closed → open; `--fig` #93d3b0 → #f3a6bb | rows 35–36, screenshot mobile-home-open |
| mobile mascot | tap | LCD advances; pupils stay at identity; clouds/packets `display:none`; 7 stars | row 37 |
| mobile footer | tap Back to top | scrollY 0, focus `MAIN#main` | row 38 |
| reduced-motion context, footer in view | pointer sweep, click mascot | 0 running footer animations >1 ms; eyes still; LCD advances; press settled | row 39 |
| JavaScript disabled, `/notes` | read the footer, click Back to top, click footer Music | heading, 6 page hrefs, 4 lines, "© 2026 Otohime", 3 SVG layers; `#main` anchor; navigates to `/music` | rows 40–41 |
| `localStorage` getter throws SecurityError, `/play` | Konami in view | unlocks ephemerally, 0 page/console errors | row 42 |
| all contexts | collect pageerror/console errors | 1 error total: the deliberate 404 navigation's own "Failed to load resource 404". No hydration, page or footer error | ERRORS block |

Visual quality, judged from my own screenshots (kept out of git): desktop light Home, dark Music, unlocked Home and Projects, mobile Home and Work. The console mascot, signpost and slab use the site's wobbly isometric ink and the selected pastel. The LCD rows ("SAVE POINT", "HI THERE", "REACHED THE END") sit inside the screen. Nothing is clipped or overlapping. The headline and links read clearly in both themes. On mobile the layout stacks: scene, readout, "Customize scene", copy, two link columns, credits, Back to top.

## Identities and delivery chain

| Item | Value |
| --- | --- |
| Deliveries | t-1473 `368d15ef6faf73f934a3ec01eaa60eb55ca41862`; t-1474 `791f08d36a0f836b1104289b7d114a74e6cbfe91` |
| Live build | `ef8035cc950f54a58f3bd714f49415f3c79e2dbc` (it moved from `eddc84c` during this run). `git merge-base --is-ancestor` is true for both deliveries against both `eddc84c` and `ef8035c` |
| Drift since delivery | 791f08d..eddc84c touches no footer file (`end-footer.tsx`, `end-stage.tsx`, `lib/end.ts`, `content/site.ts` unchanged). It changes the shared `globals.css` (+52), `figures.tsx`, `handheld.tsx` and `/music` (Ink Radio, pm-247/pm-242). eddc84c..ef8035c changes only `scripts/sketches-handoff.ts` and its test. The live walk above exercises the drifted shared code |
| Layout inheritance at ef8035c | `app/(site)/(app)/layout.tsx:54` and `app/(site)/(home)/layout.tsx:16`: `<EndFooter />` follows the grid/`</main>` inside `<ViewTransition>` |
| Lockfile | `package-lock.json` sha256 `e7aa5d85…be96877` at ef8035c. No pm-241 commit touched `package.json` or the lockfile (all changes there come from pm-240/243/247), so pm-241 adds no runtime dependency |
| CI | GitHub Actions run **40237665683** (eddc84c): `checks` success, including the step "Footer walk and Chromium probe"; `production` success (`vercel deploy --prebuilt --prod`). Delivery run 40236091838 (791f08d) succeeded |
| CI history read | The last 40 of 258 main-branch runs (one page): 12 success, 14 failure, 12 cancelled, 2 in progress. The footer step failed at 18ef637 (immediately before the 791f08d fix of the probe's attribution/badge timing, rep-4879 D1/D2) and earlier at dea7f76 and e6e5c3e. It has passed on all 4 completed runs since 791f08d (791f08d, c885936, 84dc823, eddc84c). The other failures are the signed-in motion probe (fixed by 9612064) and one `npm test`. Raw job logs need an auth token and were not read; these counts come from step conclusions |
| Author | All 8 pm-241 commits on main (cc52f9e…ab3a5ae) are authored and committed by `Otohime <quiinthieu@gmail.com>`, with 0 Co-Authored-By trailers. No author.txt was supplied |
| Run profile | acceptance_engineer, Claude Agent SDK, model `claude-opus-5-5` |

## Supplementary live evidence (author scripts, read-only BASE_URL mode)

- `BASE_URL=https://otohime.dev EXPECT_SHA=eddc84c… bash scripts/walk-end.sh`: **65 ok / 0 failed** (seven pages, auth, 404 and the eleven isolated project roots).
- `BASE_URL=https://otohime.dev EXPECT_SHA=<live sha> bash scripts/probe-end.sh`, run twice: **inconclusive, not a product failure.**
  - Run 1 (eddc84c): 55 ok / 0 failed before `page.goto /barometer` timed out on the `load` event after 30 s.
  - Run 2 (ef8035c): 52 ok / 0 failed before the same timeout on `/planisphere`.
  - Both stops happened in the probe's project-root isolation loop, which pm-241 does not touch. Measured alone right after, `/barometer` fires `load` in 727–927 ms and `/planisphere` in 1189–1192 ms (2 tries each), both with 0 `footer.end`.
  - The lease also produced `net::ERR_NETWORK_CHANGED` once during my own walk. That matches QA run-8449's live-mode timeouts on the same lease.
  - No check that ran failed. The full browser matrix was instead covered by my own walkthrough above and by CI 40237665683's local-server footer probe.

## Real/fake boundaries and limits

- Real: the production deployment, real Chromium, real network. My only DOM mutations (the textarea used for the negative control, the blocked-storage init script) were local to my own browser context. Nothing deployed was changed.
- Not walked live: signed-in rooms. No production test credentials are documented. Coverage comes from CI 40237665683's checks job (isolated e2e plus the signed-in motion probe, green), and the delivered app layout places the footer for every `(app)` room.
- Chromium only; Firefox and Safari were not run.
- Production service logs (Vercel) cannot be read from this lease. Browser console, pageerror and response codes served as the touched service's log evidence.
- Frame-rate smoothness was judged only from the bounded-animation checks and screenshots, not from a profiler trace.
- The cached UTC year revalidates daily on request (`cacheLife("days")`), with no schedule, so there is nothing to watch.
- No open advisory questions or escalations on the plan.
