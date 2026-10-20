---
plan_id: pm-203
run_id: run-6841
kind: acceptance_report
verdict: fail
cycle: 1
cited_sha: 6997065c2eee6ce503845de556f29c97a16b0be5
---

# Acceptance: Planisphere Star Wheel (pm-203)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, any page | read `<meta name="build-sha">` on `/`, `/projects` and `/planisphere` | `6997065c2eee6ce503845de556f29c97a16b0be5` on all three. That is t-1163's delivery sha, and it contains t-1161 (4bb995f) and t-1162 (992bfb1) | curl |
| production | `BASE_URL=https://otohime.dev EXPECT_SHA=6997065… bash scripts/walk-planisphere.sh` | `walk: 83 ok, 0 failed`, exit 0 | walk-prod.log |
| local build of 6997065 | `bash scripts/walk-planisphere.sh` | `walk: 83 ok, 0 failed`, exit 0; :4037 free afterwards | walk-local.log |
| JS off, 1366 light, 390 dark and 320 dark | open `/planisphere` | "Star wheel for Ho Chi Minh City, 2026-10-20 21:45" (now); 917 drawn stars and 9 inked paths; 0 console errors | nojs-default-*.png |
| same | choose Tokyo, type 2026-10-20, set the hour range to 21 with the keyboard, press Show | URL `/planisphere?city=tokyo&date=2026-10-20&hour=21`; `data-hemisphere="north"`; 4 compass letters; "Up now: Vega, Capella, Altair, …", with no Sirius; no Now or Use my location buttons; no sideways scroll | nojs-tokyo-*.png |
| same | `?city=hcmc&date=2026-10-20&hour=12` | `data-daylight`, and the page says "The Sun is up over Ho Chi Minh City at this hour…" | nojs-noon-*.png |
| same | `?city=sydney&date=2026-10-20&hour=21` | south disc; "Up now: Canopus, Rigil Kentaurus, …, Acrux, …" | nojs-sydney-*.png |
| same | `?city=nope&date=x&hour=99` | 200, Ho Chi Minh City selected | probe |
| `/projects`, 1366 | read the list, click the row | one `/planisphere` link, "Planisphere · live · Tonight's sky for your city, on a star wheel drawn in ink.", dot rgb(118,160,226) (blue); the click opens the chart | projects.png |
| JS on, Tokyo 21:00, 1366 and 390 | focus the disc, press ArrowRight | 21:15; URL `hour=21.25` with `history.length` unchanged (replaceState); form 21.25; disc `style.transform` rotate(11.3) → rotate(7.6deg); live region "Tokyo, 2026-10-20 21:15" | probe |
| same | Shift+ArrowRight ×3, then back | 22:15, then 00:15 on 2026-10-21 (URL and form date move), Moon phase 110.7 → 111.7; back to 22:00 on 2026-10-20 | probe |
| HCMC 12:00, JS on | Shift+ArrowRight ×9 | daytime tint gone at 21:00 | probe |
| HCMC 2026-01-01 03:00 | press Now | `date=2026-10-20&hour=21.75`, the present in Asia/Ho_Chi_Minh | probe |
| Tokyo, geolocation granted at −33.87, 151.21 | press Use my location | `?lat=-33.87&lon=151.21&tz=Australia/Sydney&date=2026-10-20&hour=21`; "Star wheel for Your location, …"; south disc; nothing stored | js-located-*.png |
| Tokyo, geolocation denied | press Use my location | "Location was not shared, so the sky stays as it was."; URL and disc unchanged | probe |
| Tokyo, JS on | choose Sydney in the select | navigates to `?city=sydney&…`, south disc | probe |
| motion no-preference / reduce | read the disc's `transition-duration` | 0.4s / 0s | probe |
| **mouse**, 1366, Tokyo 21:00 | drag the disc 90° inside the window | 15:00 (−6 h); URL, form, live region, title, up-now line (Arcturus, Spica rise), Sun marker and rotation follow | js-drag-tokyo-1366.png |
| **mouse**, 1366, Sydney 21:00 | drag 90° inside the window (upper half on the south chart) | 03:00 on 2026-10-21 (+6 h) | js-drag-sydney-1366.png |
| **touch**, 390×844 mobile, Tokyo 21:00 | drag the disc 90° by finger, starting inside the window (CDP `Input.dispatchTouchEvent`) | **Fail.** 21:00 → 20:00 only. The browser fires `pointercancel` after 4 moves and the rest of the drag is lost. Clockwise 90° gives 22:00, and 30° gives 20:15 | touch.mjs, touch2.mjs |
| **touch**, 390×844, page scrolled to 120 | drag 60° (should be 4 h), finger moving upward first | **Fail.** 21:00 → 21:45, and the **page scrolls** 120 → 177 px instead | touch-drag-390.png |
| same page, with `svg.wheel{touch-action:none}` injected by the probe | the same 90° touch drags | 21:00 → 15:00 and 21:00 → 03:00, 0 `pointercancel` (diagnosis only; the product was not changed) | touch2.mjs |
| JS on, 1366 and 390 | axe-core wcag2a/aa/21aa | 1 violation: `nested-interactive` (serious), the slider inside `svg role="img"` (known, non-blocking) | probe |
| all of the above | console and page errors | 0 | probe |
| local `next start` of the same build | read the server log during a browser walk of the same steps | **38 × `Error: Route "/planisphere": Next.js encountered the unstable value Date.now() while prerendering`**, one per render, and no other error; every response is 200 and correct | server.log |

**Verdict: fail.** Planisphere works for a visitor with a mouse, a keyboard or
no JavaScript: the inked wheel, the GET form, the city fallbacks, Now, Use my
location, the Moon corner, the daytime tint and the `/projects` row all do what
the idea asked. On a phone, though, the wheel cannot be turned by dragging it,
which is the plan's main gesture ("A paper planisphere is used by turning it")
and part of t-1163's acceptance line. A finger drag on the disc turns it for
about 15° (≤1 h). Then the browser takes over the gesture: it cancels the
pointer, and the page pans or scrolls under the finger.

## Why

The island puts `touch-action: none` on the disc `<g data-disc>`. Its
computed value is `none`, but Chrome decides touch-action from boxed elements
only, so the outer `<svg class="wheel">` (`auto`) is what counts. The same
touch drags with `touch-action: none` on the svg turn the full 6 h. The
earlier task QA reported a "390 touch" drag as passing, but that probe used
mouse events. Here the touches went through Chrome's touch pipeline
(`Input.dispatchTouchEvent`), which is the path a phone uses.

## Also found (not by themselves a fail)

- **Error log on every page view.** Each `/planisphere` render logs the
  error above from `app/(planisphere)/planisphere/page.tsx:40`
  (`parseQuery(query, Date.now())`). This was read from a local `next start`
  of the deployed commit, because Vercel's logs are not reachable from this
  lease. Production runs the same build, so it very likely writes the same
  line on every view.
- **axe `nested-interactive`.** This is the known follow-up from QA. The
  plan's Lighthouse bar of ≥95 is met (QA: 100).

## Delivery

- Deployed sha: `6997065c2eee6ce503845de556f29c97a16b0be5`, on `/`,
  `/projects` and `/planisphere`. It contains t-1161 `4bb995f`, t-1162
  `992bfb1` and t-1163 `4614f13` and `6997065`.
- Author and committer of every pm-203 commit: `Otohime
  <quiinthieu@gmail.com>`, with no Co-Authored-By trailer. No author.txt came
  with the evidence; this was read from git.
- CI: not observable from this lease (`gh` not logged in, no Vercel token).
  Production serves 6997065, and `production` is `needs: checks`.
- Isolation tests: `npm ci` passed. The walk ran on a fresh local build
  (exit 0). The Planisphere isolation test reads `readdirSync(join(ROOT,
  "app"))`; see t-1161's verification.
- Lease: macOS arm64, Node 22.12.0, Google Chrome headless through
  playwright-core 1.x, axe-core 4. The probe scripts and screenshots are under
  `/tmp/acc` on the lease and are not committed (no binaries).
- No application source was changed and nothing was deployed.
