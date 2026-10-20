---
plan_id: pm-206
run_id: run-6973
kind: acceptance_report
verdict: pass
cycle: 2
---

# Acceptance: Hop and Settle (pm-206), cycle 2

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev at 872a225, fresh load of `/projects`, 1366×768 and 390×844 | open it | 8 rows rise 40 ms apart (delays 0…280 ms), the last ends at 680 ms | walk-out; `projects-rise-*.png` |
| `/projects` | click each of the 8 rows (shore … barometer), both viewports | 16/16 hops crossfade. `pageswap` and `pagereveal` both carry a transition of type `hop`. The old root fades out over 150 ms, the new root fades in over 210 ms after 150 ms, and `::view-transition-group(project-<slug>)` runs, so the title travels | walk-out; `hop-projects-{shore,planisphere}-*-mid.png` |
| each project | click its "All projects", both viewports | 16/16 crossfade back, and the title morphs back into its row | walk-out |
| `/planisphere` | click the footer's "Next door: … Orrery" | crossfade at both viewports | walk-out |
| `/orrery/sun` | `location.assign('/planisphere')` | crossfade at both viewports | walk-out |
| `/shore` | full load into `/work`, `/sign-in`, `/` and `/does-not-exist` | each crossfades, with no page error and no console error. The 404 hop no longer logs "opt-in disabled" | walk-out (8/8) |
| `/work` | sidebar Projects | the old page fades out (`fade-out` 0+150) and the new page fades in (`fade-in` 150+210). The sidebar and the masthead stay still | walk-out |
| `/work`, `/`, `/sign-in` | brand mark to `/`, the console's "A Open" to `/work`, the masthead's Sign in, the brand mark from `/sign-in`, Forgot password | all 5 moves fade out and in at both viewports | walk-out; `-work-console-Open--*.png` |
| the 404, by `page.goto` and by `router.push` from `/work` | its Go home, and its brand mark | 8/8 fade out and in (root `fade-out` 0+150, `fade-in` 150+210) | walk-out; `404-*-Go-home-*.png` |
| `/barometer?city=tokyo` (reading face) | open it | needle `swing` 0+1100, mercury `rise` 150+1100, vane `vane-swing` 300+1100, water `rise` 450+1100 | walk-out |
| `/planisphere` | open it, then ArrowRight on the wheel | 150 lines draw on, then the stars fade up at 400 ms and the other layers at 1300 ms. The turn replays 0 draws (150 → 150) | walk-out |
| `/rotor` reading AAA | press A (desktop), tap the A key (390×844) | nothing rolls at first paint. AAA → AAB, and exactly one window rolls, in 170 ms | walk-out |
| reduced motion, both viewports | everything above | every hop and move completes. Every transition part lasts 0 ms, and nothing is still running after load. Rows, instruments and the roll are still | walk-out (reduced rows) |
| JavaScript off, both viewports | `/does-not-exist`, then Go home. `/projects`, `/planisphere`, `/rotor` | 404 with "Fig. 404 — Nothing in this parcel", and Go home reaches `/`. 8 rows at opacity 1, 150 lines at dashoffset 0, Rotor reads AAA with nothing rolled | walk-out |
| local stack at 872a225, docker Postgres, owner account | sign in through the `/sign-in` form | full load to `/dashboard` that crossfades (type `hop`, root `fade-out` 150, `fade-in` 150+210). **No page error and no console error**, at both viewports, motion on and reduced | walk-in |
| plain account | sign in with `/sign-in?next=/account` | lands on `/account`, crossfades, no error, both viewports and both motion modes | walk-in |
| owner, on `/shore` | full load into `/dashboard`, `/account`, `/admin/users`, `/admin/users/<plain id>`, `/admin/roles`, `/work` | 12/12 crossfade with no error (6 rooms × 2 viewports). The same 12 under reduced motion are still, with no error | walk-in |
| plain, on `/shore` | full load into `/dashboard` and `/admin/roles` | both are clean. `/admin/roles` is the 403 ("This room is locked") | walk-in |
| the 403, by `page.goto` and by `router.push` from `/dashboard` | its Go home, the brand mark, the nav's Projects, the nav's Dashboard | 16/16 fade out (`fade-out` 0+150) and in (`fade-in` 150+210) at both viewports. Reduced: 16/16 complete and are still | walk-in; `403-go-home-*.png` |
| owner | sidebar Dashboard → Account → Users, and the brand mark → `/` | each fades out and in, at both viewports | walk-in |
| owner, the room's RSC slowed by 1.5 s | sidebar Account | the skeleton shows, then fades out as the room fades in | walk-in; `skeleton-1366x768.png` |

## Verdict: pass

On otohime.dev, every hop between the site and a project crossfades, and the title travels from its
row to the project's heading and back. The site's pages hand over, and the rows on `/projects`
rise. Barometer, Planisphere and Rotor settle as the plan describes. Reduced motion and JavaScript
off show the finished, still drawing.

Both defects from cycle 1 are gone:

- Signing in ends on `/dashboard`, or on the `?next` room, with the crossfade and no page error.
- The 403's own Go home fades, and so does every other exit from the 403 and the 404.

The group swaps (`/` ↔ `/work`, `/work → /sign-in`, `/sign-in → /`) fade too, and a full load into the
404 is clean.

Mid-transition frames look right. In `hop-projects-shore-1366x768-mid.png`, the list ghosts out
behind the sea-glass page while "shore" settles into the heading. In `403-go-home-390x844.png`, the
locked room fades while the masthead stays solid.

## Deployed build

- **Site (otohime.dev, Vercel): `872a225da5d4b960c0c0763e9e3f4f70300129fd`.** `<meta name="build-sha">` on
  `/`, `/work`, `/sign-in`, `/projects`, `/shore` and `/barometer` gives this sha. `git diff --stat e965dd2 872a225`
  touches only `projects/add-motion-to-the-app/qa-t-1210.md`, so the code is t-1210's delivery
  `e965dd2`. That delivery contains t-1184 `697a62b`, t-1185 `738437f`, t-1186 `90e4ebe` and t-1209 `e24d1a0`
  (each is an ancestor of HEAD).
- The 404 page (`app/global-not-found.tsx`) carries no build-sha meta. It is served by the same deployment.
- CI: the `production` job has `needs: checks` (`.github/workflows/ci.yml:157`), so the deploy of 872a225
  shows that `checks` passed, the "Motion probe, signed in" step included. `gh` is not logged in on this
  worker, so I could not read the run itself.
- The local stack served a `npm ci && npm run build` of the checkout at 872a225 (`next start` on :4081, docker
  `postgres:17-alpine`, migrations applied).

## How I walked it

- **My own walk** (a throwaway script outside the repo, Playwright 1.64.0, Chrome Headless Shell 156.0.8078.4). Every
  document gets listeners on `pageswap` and `pagereveal`, plus a once-a-frame sampler of
  `document.getAnimations()` that records every `::view-transition-*` part with its name, delay and
  duration. A fade only counts if it is the house `fade-out` / `fade-in` (not the browser's `-ua-` default)
  and runs for at least 100 ms. At 390×844 the walk uses `isMobile` and `hasTouch`, with taps.
  - Signed out, against otohime.dev: **290 ok, 0 failed**. That is 145 checks per viewport, across motion on,
    reduced motion and JavaScript off.
  - Signed in, on the local stack: **173 ok, 0 failed**. It made two accounts `*-acc<ts>@accept.test`
    through `/api/auth/sign-up/email`, promoted one to owner by SQL (the repo's documented local path), and
    deleted both at the end ("deleted 2 accounts").
  - The first signed-in run was 171 ok, 1 failed. My walk clicked the phone sidebar's Account link 250 ms
    after load, before the nav had streamed in. With a 10 s wait for the control, the rerun was clean, and
    no control took more than 1 s to show (decision recorded).
- **My checks can fail.** With `@view-transition` stripped from `/shore`'s HTML and CSS by `page.route`
  (3 rewrites), the `/projects → /shore` hop reveals with `viewTransition === false`. Intact, it reveals
  with `true`. In reduced motion, the sampler reads the same parts at `0+0`, which the motion-on check
  would reject.
- **Cross-check with the repo's tools:**
  - `BASE_URL=https://otohime.dev bash scripts/probe-motion.sh` exits 0 with **438 ok, 0 failed**.
  - `SKIP_BUILD=1 bash scripts/probe-motion-signed-in.sh` (its own docker Postgres) exits 0 with **356 ok, 0 failed**.
  - `npm test` gives 741 pass, 0 fail.
  - The nine walks with `BASE_URL=https://otohime.dev` all exit 0, with 0 failed: shore 22, capsule 42,
    orrery 260, elements 47, vinyl 48, rotor 56, planisphere 83, barometer 88 and music 11 ok. The
    remote counts are lower than the local ones only by the server-log checks.
- I created no accounts on otohime.dev and typed no credentials into any public form.

## Logs

- Local `next start` (872a225), over the whole signed-in walk: 5 lines, all startup, with no error or warning.
- Browser console and `pageerror` on otohime.dev: 0 errors over the whole walk, at both viewports and in
  every mode. The only line not counted is the 404 document's own status line.
- Vercel's production logs cannot be read from this worker, because there is no token (decision
  recorded). The browser side shows no errors, and the server-side code path is the one the local log
  covered.

## Commit identity

All 16 plan commits, `01a668e`…`872a225`, are authored and committed by `Otohime <quiinthieu@gmail.com>`,
with 0 Co-Authored-By trailers. The delivery evidence has no author.txt.

## Not proven, and observations

- A person signing in on otohime.dev with an operator-owned account is advisory in the plan. I was given
  no production credentials. The same build was signed into on the local stack.
- `/orrery/nope` and `/elements/zz` still serve the `__next_error__` shell from those projects' own
  `notFound()`, as qa-t-1210 noted. The plan's 404 is the site's, and projects are a non-goal. This is an
  observation, not a failure.
- There were no open questions on the plan.
