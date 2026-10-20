---
plan_id: pm-203
run_id: run-6858
kind: acceptance_report
verdict: pass
cycle: 2
cited_sha: 21ab1481cfa4b7c72ca6986fb2b55e3f8b097e56
---

# Acceptance: Planisphere Star Wheel (pm-203), cycle 2

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, 2026-10-20 15:36 UTC | read `<meta name="build-sha">` on `/`, `/planisphere` and `/projects` | `21ab1481cfa4b7c72ca6986fb2b55e3f8b097e56` on all three. It contains t-1161 `4bb995f`, t-1162 `992bfb1`, t-1163 `6997065`, t-1173 `8ceec19` and t-1174 `b0c62e5` (`git merge-base --is-ancestor` exits 0 for each). 21ab148 differs from 8ceec19 only by `qa-t-1174.md`. | curl, git |
| production | `BASE_URL=https://otohime.dev EXPECT_SHA=21ab148… bash scripts/walk-planisphere.sh` | `walk: 83 ok, 0 failed`, exit 0, plus the `note:` line (the server log is not readable remotely) | walk-prod.log |
| production | `BASE_URL=https://otohime.dev bash scripts/probe-planisphere-touch.sh` | `probe: 34 ok, 0 failed`, exit 0 | probe-prod.log |
| local build of HEAD (same app code as 21ab148: `git diff 21ab148 HEAD -- . ':!projects'` is empty) | `bash scripts/walk-planisphere.sh` (:4037) | `walk: 97 ok, 0 failed`, exit 0; 14 `server log is clean` checks pass; :4037 free afterwards | walk-local.log |
| the same build, `next start -p 4071` with the walk's placeholder env | run my whole browser path (below) against it, then read the server log | path 35 ok, 0 failed. The log holds only the start banner (`▲ Next.js 16.4.2`, `✓ Ready in 79ms`); **0 lines matching `Error`, `⨯` or `unstable value`**; :4071 free afterwards | server-4071.log, path-local.log |
| JS off, 1366 light, 390 dark (mobile) and 320 dark | open `/planisphere` | "Star wheel for Ho Chi Minh City, 2026-10-20 22:30" (now); 917 `data-star`, 10 inked paths, no Now or Use my location buttons; `scrollWidth` equals the viewport at all three | nojs-default-*.png |
| same | choose Tokyo, date 2026-10-20, hour 21, press Show | URL `?city=tokyo&date=2026-10-20&hour=21`; north disc; 4 compass letters; "Up now: Vega, Capella, Altair, Aldebaran, Fomalhaut…", with no Sirius | nojs-tokyo-*.png |
| JS off, 1366 | `?city=hcmc&date=2026-10-20&hour=12` | `data-daylight`, and "The Sun is up over Ho Chi Minh City…" | nojs-noon-hcmc.png |
| same | `?city=sydney&date=2026-10-20&hour=21` | south disc, N at the top of the window; "Up now: Canopus, Rigil Kentaurus, Vega, Achernar, Hadar…" | nojs-sydney.png |
| same | `?city=nope&date=x&hour=99` | 200, Ho Chi Minh City selected | path |
| `/projects`, 1366 | read the list | one `a[href="/planisphere"]`: "Planisphere · live · Tonight's sky for your city, on a star wheel drawn in ink.", dot `rgb(118, 160, 226)` (blue) | projects.png |
| **390×844 phone** (isMobile, hasTouch), JS on, light, motion on, Tokyo 21:00, page at scrollY 150 | quarter-turn **finger** drag through CDP `Input.dispatchTouchEvent`, starting at 160° (left of centre; the probe starts below it), 40 moves | clockwise: 21:00 → **15:00**; anticlockwise: → **2026-10-21 03:00**. 0 `pointercancel`, scrollY 150 → 150. The URL (`hour=`, `date=`), the live region ("Tokyo, 2026-10-21 03:00") and the chart title all follow. Disc transition 0.4s | touch-tokyo-±90.png |
| 390×844, JS on, **dark**, **reduced motion**, Sydney 21:00 (south disc), scrollY 150 | the same finger quarter turns, starting at 225° | → 2026-10-21 03:00 and → 15:00; 0 `pointercancel`; scrollY unchanged; URL, live region and title follow; disc transition 0s | touch-sydney-±90.png |
| 390×844, JS on, Tokyo and Sydney | finger swipe up on the "up now" line (outside the wheel) | the page scrolls 201 → 455 and 201 → 386 | path |
| 1366, JS on, Tokyo 21:00 | **mouse** drag of 90° on the disc | 21:00 → 2026-10-21 03:00; the up-now line changes | path |
| 1366, Tokyo 23:30 | focus the disc, ArrowRight ×2, then Shift+ArrowLeft | 2026-10-21 00:00, then 2026-10-20 23:00; `aria-valuetext` 23:00; URL updated with `history.length` unchanged (replaceState) | path |
| 1366, HCMC 12:00 | Shift+ArrowRight ×9 | the daytime tint clears at 21:00 | path |
| 1366, HCMC 2001-01-01 03:00 | press **Now** | 2026-10-20 22:30, the present in Asia/Ho_Chi_Minh to the quarter (Tokyo: 2026-10-21 00:30) | path, now.mjs |
| 390, geolocation granted at −33.87, 151.21 | press **Use my location** | `?lat=-33.87&lon=151.21&tz=Australia/Sydney&date=2026-10-20&hour=21`; "Star wheel for Your location, …"; south disc; local storage, session storage and cookies empty | located.png |
| 390, geolocation not granted | press Use my location | live region: "Location was not shared, so the sky stays as it was."; Tokyo URL and north disc unchanged | path |
| everything above, production and local | console errors and page errors | 0 | path |
| repo at HEAD | `npm ci && npm test` | 658 pass, 0 fail. All eight group isolation tests (Barometer, Capsule, Elements, Orrery, Planisphere, Rotor, Shore, Vinyl) read `readdirSync(join(ROOT, "app"))` | npmtest.log |

**Verdict: pass.** Planisphere does what the idea asked, on otohime.dev, for a
person using it. The page shows tonight's sky for a chosen city as an inked
star wheel at `/planisphere`, with real stars, constellation lines, the Moon
corner and the "up now" line. It works before JavaScript through the GET form,
and it is listed once on `/projects` with a blue dot. With JavaScript on, the
wheel turns by mouse, by keyboard and now **by finger on a phone**. Cycle 1's
failure is gone: a quarter-turn touch drag moves exactly 6 h, with no
`pointercancel` and no page scroll, and a finger outside the wheel still
scrolls the page. The server log of a local `next start` of the deployed code
stays clean through the walk and through a full browser path. The Date.now()
prerender error from cycle 1 no longer appears.

## Delivery

- **Deployed sha:** `21ab1481cfa4b7c72ca6986fb2b55e3f8b097e56` (otohime.dev,
  Vercel). It contains every delivery: t-1161 `4bb995f`, t-1162 `992bfb1`,
  t-1163 `6997065`, t-1173 `8ceec19` and t-1174 `b0c62e5`. There is one
  service: the otohime Next.js app.
- **Commit identity:** every `pm-203/` commit, from c6b86fe to 65a91b2, is
  authored and committed by `Otohime <quiinthieu@gmail.com>`. There are 0
  `Co-Authored-By` trailers. No author.txt came with the evidence, so this
  was read from git.
- **CI:** the GitHub Actions API is not readable from this lease. Production
  serves 21ab148, and the `production` job is `needs: checks`, so `checks`
  passed for that push.
- **Logs:** Vercel's runtime logs are not reachable from a lease. As the plan
  states, the server log was read from a local `next start` of the same app
  code: 0 error lines.
- **Open advisory questions:** none on the plan.
- **Lease:** macOS arm64 (Darwin 27), Node 22.12.0, Next.js 16.4.2,
  Playwright 1.64.0 chromium (path script) and chromium headless shell (the
  repo's probe), axe-core from the probe.
- **Note on my own probe:** on the first run, the Now line failed because my
  selector `text=Now` matched the "Up now:" paragraph. I re-ran it with
  `getByRole('button', { name: 'Now', exact: true })` and it passed, so this
  was not a product fault (decision and lesson recorded). The path script and
  screenshots are under `/tmp/acc2` on the lease. They are not committed (no
  binaries).
- No application source was changed and nothing was deployed.
