# QA report: t-1473 Build the console save-point footer (pm-241, run-8318)

**Verdict: pass.** Delivery sha **368d15ef6faf73f934a3ec01eaa60eb55ca41862** (`pm-241/t-1473`).
`origin/main` is that same sha, so the deployed/pushed commit contains the delivery sha
(`git merge-base --is-ancestor 368d15e origin/main` is true). The green gate for 368d15e is `pass`.
Author and committer are `Otohime <quiinthieu@gmail.com>`; the commit body has no Co-Authored-By trailer.

Run profile: quality_engineer on claude-sonnet-5-5. Browser: Google Chrome 154.0.8037.57 headless via a temporary
`playwright-core@1.49` in `/tmp` (not in the repo). Chromium only; Firefox and Safari were not run.

## Boundaries

| Item | Real or fake |
| --- | --- |
| Build, server, browser | Real: `npm ci`, `npm run build` of the checkout at 368d15e, `next start`, real Chrome |
| Database | Fake: a placeholder `DATABASE_URL`, so auth/DB paths were not exercised |
| Live otohime.dev | Not visited. Deployed-site `build-sha` was not checked and is left to acceptance |

My local build had no `GITHUB_SHA`, so its `build-sha` meta was `dev`. This is not an executable-fingerprint match
for a deployed build.

## Contract verification (re-run independently here)

| Check | Result |
| --- | --- |
| `npm test` | 1440 pass, 0 fail |
| `npm run lint` | exit 0 (0 errors, 9 pre-existing unused-eslint-disable warnings in project roots) |
| `npm run typecheck` | pass |
| `npm run build` | pass, 181/181 pages |
| `SKIP_BUILD=1 PORT=4081 bash scripts/walk-end.sh` | `walk: 67 ok, 0 failed` |

History scan: only the gate result and my own runs were read. There was no CI/job history to paginate for this
task; completeness is limited to those.

## Independent browser walkthrough (my own script, not the author's)

Format: starting state · action · observable result.

| Area | Starting state · action | Observable result |
| --- | --- | --- |
| Entrance | Home at top; no `data-seen`. Scroll to the bottom | `data-seen=true`, ambient `data-active=true` |
| Mascot | Click, Enter and Space on the console button | LCD SAVE/POINT → HI/THERE → 7 PAGES/INDEXED → 12 FPS/ON TWOS; the readout changes; `aria-pressed` returns to false |
| LCD fit | Poke through the cycle, then unlock | Every rendered LCD row stays inside the LCD screen rect |
| Negative control (editable) | Type the full Konami code into a focused `<input>` | Stays locked: badge `data-unlocked=false`, LCD unchanged |
| Negative control (wrong order) | Konami with an inserted wrong key | Stays locked |
| Achievement | Real in-view sequence ending in Shift+A | `REACHED/THE END`, badge visible, no navigation, `localStorage end:achievement=1` |
| Layout stability | Stage rect before and after reveal, poke and unlock | 448.84×487.81 both times, delta 0 |
| Restore | Reload, scroll down | Badge unlocked |
| Eyes | Pointer at the stage corners; pointer leaves | Pupils translate within about ±2.2/1.8px; reset to 0,0 on leave |
| Filter isolation | Computed-style/attribute walk from each cloud, star, lamp and packet up to the footer | No `filter` ancestor; all are inside `.end-sky` |
| Offscreen pause | Scroll back to the top | `data-active` removed |
| Group transition | Home → footer link Work → footer link Projects (and a third hop back to Work) | Navigation works; the visible footer is single |
| Back to top | After three hops, click Back to top | scrollY=0 and the visible `main#main` has focus |
| Overflow | /, /work, /music, /projects, /play, /notes, /sketches at 1366px; /, /work, /music, /projects at 390px | No horizontal overflow; exactly one footer on each of the seven pages |
| Reduced motion | Context with `reducedMotion=reduce` | Ambient not active; the press settles; poke still works; eyes stay at 0,0 |
| Blocked storage | `localStorage` getter throws | Unlock still works; no page error |
| Touch mobile (390×844) | Tap mascot; Enter on the "Customize scene" summary | Tap pokes; eyes still; disclosure closed by default and opens by keyboard |
| Accent and wobble | Click each of the 5 swatches; set wobble to 6 | `--fig` takes 5 distinct values (#f4b829, #ef6a4c, #93d3b0, #76a0e2, #f3a6bb) |
| No-JS | `javaScriptEnabled=false` on /notes | Heading, 6 page links, 4 contact links, `#main` anchor and 3 SVG layers present |
| Visuals | Desktop dark /music and mobile home screenshots | Coherent, unclipped, readable; the scene matches the ink style |

### Negative control for the walk script

I put a proxy in front of the production server that rewrites the Work footer `href` to `/wrok`
(`BASE_URL=http://localhost:4092 bash scripts/walk-end.sh`). The footer structure check failed on all seven
public pages with `page link 0 href '/wrok' !== '/work'`. The same walk against the unmodified server passed
those seven structure checks. So the walk's href assertion detects a corrupted canonical link. The remaining
build-sha lines failed only because my local build had no 40-hex sha, which is a property of this setup.

## Observations and limits (not defects)

- After a client-side hop (/ → /work) the previous route stays mounted in the DOM as `display:none`. This
  includes its `main#main`, its masthead and its footer, so `document.querySelectorAll("footer")` returns 2 while
  only one is visible. The retained tree is hidden, not visible duplicated content, so assistive tech ignores it.
  The same retention applies to the existing `main#main` and masthead, so it is not specific to this delivery.
  Back to top still focused the visible `main` after three hops. Task 2's probe should count visible footers
  (`checkVisibility()`), not raw `footer` elements.
- One Chrome console message, "Permissions policy violation: compute-pressure is not allowed", appeared once in a
  combined run. It was not reproduced on /, /shore or /sign-in at desktop or mobile, nor under reduced motion or
  blocked storage. No `pageerror`, hydration or footer-related error was seen.
- Not verified: idle rAF/timer count, real frame-rate smoothness, a plain `prefers-reduced-motion` toggle mid-press,
  Firefox and Safari, signed-in rooms (they need the DB-backed e2e), and a deployed `build-sha` match. Task 2
  (browser probe, CI wiring) and acceptance own those.
- `scripts/walk-end.sh` was read only through its observed behaviour (67 checks plus the negative control above).
