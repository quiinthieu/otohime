---
plan_id: pm-249
run_id: run-9138
kind: acceptance_report
verdict: pass
cycle: 3
---

# Acceptance: Postcard Press Terminal (live https://otohime.dev)

Deployed build: `/api/health` = `{"ok":true,"sha":"79f7813e939d92610a86540c71783c02973d737e"}`. It is an ancestor of origin/main 9e7500e. 79f7813 contains the deliveries 49d4fac, 654c406, 1417dd8, 76141f1 and 54a9583. The commits after it change only projects/**, README.md and scripts/verify-deploy.sh, none of which is shipped product.
Walked with my own Playwright scripts (outside the repo, in /tmp), real Chrome, real site, at 1366x768 and 390x844.

| Starting state | Action | Observable result | Evidence |
|---|---|---|---|
| /notes, no terminal in DOM | press `/` | `dialog.pocket-terminal` opens (pre-count 0), both viewports | PASS 1366 and 390 |
| terminal open | type `adventure`, Enter | output contains "The Warehouse" | PASS both |
| terminal open | Ctrl-K, `quit`, `go music`, Enter | navigates to /music | PASS both |
| /play | scroll to the Ink poster press | `data-renderer=webgl2`, poster rendered | PASS both |
| press rendered | click export | PNG download `ink-press-wet-ink-riso-cde9c196.png` (390: brush layout, different seed) | PASS both |
| /play, WebGL getContext returns null, reduced motion on (negative control) | load /play | `data-renderer=svg` fallback | PASS |
| /postcard | pick Lake, note `acceptance <b>note</b>`, Stamp it | Download PNG, Share link, Open it appear; download is `postcard-lake-2026-10-27.png` | PASS both |
| Open it | load /postcard/view?c=… | note shown as escaped literal text, `noindex, nofollow`, og:image is /postcard/image?c=… | PASS (390 first read raced, rechecked at 1366) |
| bad code (negative control) | GET /postcard/image?c=zzz | 404 | PASS |
| any page | read og:image of /, /play, /notes, /music, /sketches | each is 200 image/png 1200x630 | PASS |
| each walk | pageerror and console errors | 0 errors; no horizontal overflow on /postcard | PASS |

Identity: 49d4fac, 654c406, 1417dd8, 76141f1, 54a9583, b742a04 and a7da8e8 are authored by Otohime <quiinthieu@gmail.com> with 0 Co-Authored-By trailers. 93413db has 1 trailer, waived by the operator for that message only (fix_plan rep-5001). No author.txt was in this run's evidence.

Boundaries: real site, real Chrome, WebGL2 through SwiftShader (not a GPU). The WebGL absence is simulated in-page. Not covered: Safari/iOS, a real share sheet, audible sound cues, a screen reader. Server logs: Vercel logs are not reachable from this lease, so only browser-side errors were read (none). No queue or job executable exists in this plan, so there is no FAILED/COMPLETED history to scan. I did not read the CI run history. The check of the natural deploy of main HEAD is not needed: HEAD differs from the live sha only by non-shipped files. Run profile: Sonnet 5.5. No deferred checks.
