---
plan_id: pm-195
run_id: run-6657
kind: acceptance_report
verdict: pass
cycle: 0
---

# Acceptance: a way back to the project list (pm-195, cycle 0)

**Verdict: pass.** On https://otohime.dev (build-sha `c2660b7`, then `04f8c15`; walked on both), every project page now has a `← All projects` link to the project list. It works on a 1366x768 desktop, on a 390x844 phone (touch) and from the keyboard.

| Starting state | Action | Observable result | Evidence |
|---|---|---|---|
| Desktop 1366x768, on `/projects` | Click Shore, Capsule, Sun, Elements, Vinyl in turn | Each project page opens. Its top bar shows `otohime.dev` and `← All projects` | walk rows "exactly one All projects link", "home link still there" (5/5); `bar-desktop-*.png` |
| Desktop, on each project page | Look at the top bar | The link points to `/projects`, sits above the fold, isn't covered by anything (elementFromPoint), and the page doesn't scroll sideways (scrollWidth 1366) | walk rows "visible above the fold and not covered", "no sideways scroll" (5/5) |
| Desktop, on each project page | Click `← All projects` | Lands on `/projects` with all 5 projects listed | walk rows "landed on the project list, 5/5" (5/5) |
| Desktop, on `/projects` after that click | Press browser Back | Returns to the project page the user came from | walk rows "browser Back returns" (5/5) |
| Desktop, fresh load of each project page | Press Tab (at most 6 times), then Enter | Focus reaches `← All projects`, and Enter opens `/projects` | walk rows "keyboard /x" (5/5) |
| Phone 390x844 (isMobile, touch), on `/projects` | Tap each project | The top bar shows both pills. On Shore they stack on the right, on Capsule they wrap under the brand, and on Vinyl they sit before the heading. Nothing overflows (scrollWidth 390) | `bar-phone-*.png` checked by eye; walk rows "no sideways scroll" (5/5) |
| Phone, on each project page | Tap `← All projects` | Lands on `/projects` with 5/5 projects. Back returns to the project | walk rows (5/5 + 5/5) |
| Any of the 10 page loads above | Watch the browser | No pageerror, no console.error, and no HTTP response at 400 or above | walk rows "no page errors" (10/10) |
| `/elements/fe` (non-goal) | none | Keeps only `← All elements`, as the plan chose | not re-walked; out of scope by design |

My walk script is `acceptance-walk.mjs` in this folder (Playwright 1.64.1, chromium-headless-shell). Run: `node acceptance-walk.mjs` → **92 ok, 3 not ok**. All three misses are one check I added myself, a 44px tap target, and it is not in the acceptance criteria. See the observation below.

## Deployed build and delivery

- Live build-sha: `04f8c15` (cited). Two other deploys rolled out during this run, so I recorded each one:
  - Before the walk, curl ×3 on each of `/shore /capsule /sun /elements /vinyl /projects` returned `91f1f8b`.
  - Walk 1: all 10 rows report `c2660b7`. Result: 92 ok, 3 not ok.
  - Walk 2 ran during the `c2660b7 → 04f8c15` rollout. It got 91 ok, 4 not ok, and I did not keep its per-row output. Mixed builds during a rollout are a known failure mode on this site (see the lessons).
  - Walk 3, once every curl returned `04f8c15`: all 10 rows report `04f8c15`. Result: 92 ok, 3 not ok, the same three tap-size rows as walk 1.
- The delivery commits `9911e40`, `81ae9af` and `9c7810d` are ancestors of `91f1f8b`, `c2660b7` and `04f8c15` (`git merge-base --is-ancestor`). The later two commits restyle Capsule and Elements but leave the `page.tsx` nav alone.
- Author and committer of all three: `Otohime <quiinthieu@gmail.com>`, with no `Co-Authored-By` trailer. This matches `plan.commit_identity`. There was no author.txt in the delivery evidence to cite.
- Hosting is Vercel (`server: Vercel`). All six routes return 200 and are prerendered (`x-nextjs-prerender: 1`). `/api/health` returns 200 `{"ok":true}`.

## Logs

otohime.dev is not in the cluster: `cluster_pods app=otohime` and `cluster_logs otohime` return nothing. This lease has no Vercel token, so I could not read Vercel runtime logs. The touched pages are static prerenders, so the walk runs no server function. Instead, the browser recorded pageerror, console.error and every response at 400 or above on all 10 page loads, and found none.

## Observation (not a defect)

At 390px the `← All projects` pill is 37px tall on Shore, 34px on Capsule and 24px on Sun. The existing `otohime.dev` link on the same pages is 37, 34 and 30px, so the new link copies each project's pill, as the plan intended. Sun's link is at the WCAG 2.5.8 AA minimum of 24px. Elements and Vinyl are 44px. If the product owner wants 44px touch targets everywhere, that applies to the home link as well and is a separate idea.
