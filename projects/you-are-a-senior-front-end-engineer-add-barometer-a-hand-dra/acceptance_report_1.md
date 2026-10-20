---
plan_id: pm-204
run_id: run-6824
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 992bfb13da87aed1045159bd5096abf0a29e9d8a
---

# Acceptance: Barometer Weather Station (pm-204)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| otohime.dev, 2026-10-20 13:56Z | read `<meta name="build-sha">` on `/`, `/barometer`, `/projects` | `992bfb13da87aed1045159bd5096abf0a29e9d8a` on all three; it descends from aa21469 (t-1164) and a4232ad (t-1165) | `git merge-base --is-ancestor` exits 0 for both |
| production | `BASE_URL=https://otohime.dev EXPECT_SHA=992bfb1… bash scripts/walk-barometer.sh` | `walk: 88 ok, 0 failed`, exit 0; `/barometer`, Tokyo, Mexico City and `?city=nope` all draw the `reading` face | /tmp/walk-prod.log |
| production, Tokyo 22:57 | GET `/barometer?city=tokyo` twice, 5 s apart | 200 both times (0.61 s, 1.02 s); "Tokyo, 22:45 local, 19.4 °C, 1018.3 hPa, partly cloudy." is 12 min behind Tokyo's clock, inside 35 min. QA saw "22:30 local" at 22:36 Tokyo, so the cache has refreshed since then | curl + `TZ=Asia/Tokyo date` |
| Chrome 1366×768, JS on | open `/barometer` | 200, "Ho Chi Minh City, 20:45 local, 27.5 °C, 1013.6 hPa, mainly clear."; needle `data-needle` 36.72° = `needleAngle(1013.6)`; the dial shows Stormy / Rain / Change / Fair / Very Dry, plus the thermometer, the N/E/S/W vane and the rain cup; the credit links Open-Meteo.com and CC BY 4.0 | probe 58/0; screenshot viewed: board, instruments, sentence, Set and credit all drawn correctly |
| same | press Set, reload | aria-live reads "Hand set at 1013.6 hPa."; localStorage `{"city":"hcmc","hpa":1013.6,"at":"2026-10-20T20:45"}`; after the reload `data-hand="set"`, the hand is visible at `--hand: 36.72deg`, and the note reads "The brass hand marks 1013.6 hPa, set 2026-10-20 20:45 local." | probe |
| hand set | change the select to Tokyo (no Read) | the URL becomes `/barometer?city=tokyo` and the Tokyo sentence shows, with no hand on Tokyo; back on `?city=hcmc` the hand returns; Clear removes it and empties storage | probe |
| JS on | dark and light schemes | paper rgb(43,29,20) dark and rgb(239,227,200) light | probe |
| JS on | axe-core WCAG 2.0/2.1 A+AA | 0 violations | probe |
| `/projects` | count the `/barometer` links, click, then "← All projects" | one link; the click opens Barometer and the back link returns to `/projects` | probe |
| Chrome 1366×768, JS off | open `/barometer`, choose Tokyo, press Read | no Set button; the URL becomes `?city=tokyo` with Tokyo selected and its sentence | probe |
| JS off | `?city=mexico-city` | "Mexico City, 07:45 local, 10.7 °C, 1023.3 hPa, overcast." (sea-level pressure, not 785) | probe |
| JS off | `?city=nope` | 200, Ho Chi Minh City | probe |
| Chrome 390×844 | every row above repeated | all pass; `scrollWidth` 390 = `clientWidth`, and no element passes the viewport's right edge; the board scales down and the form stacks | probe 58/0 total; screenshot viewed |
| all pages above | console and page errors | none | probe |
| local `next start` built from a7e19eb (the app is identical to 992bfb1), `BAROMETER_HOST=http://127.0.0.1:9` | curl `/barometer`, `?city=tokyo`, `?city=nope`, `?city=sydney` | 200 in 0.013 to 0.037 s, `data-face="quiet"`, "The station is quiet.", one Open-Meteo credit | curl log |
| same, Chrome 1366×768 and 390×844 | open `/barometer`; seed a stored hand, reload | quiet face, needle at rest (−135°), no Set button, both credit links; "Last reading: 1013.6 hPa on your last visit."; no sideways scroll, no console errors | quiet probe 18/0 |
| checkout a7e19eb | `QUIET=1 bash scripts/walk-barometer.sh` | `walk: 24 ok, 0 failed`. Dead host: 200, quiet face, credit, build-sha, each under 3 s. 10 s fake on 4057: `?city=paris` is 200 and quiet in 3.5 to 6.5 s, and the fake saw `/v1/forecast?…pressure_msl`. Ports 4051 and 4057 are free afterwards | /tmp/walk-quiet.log |
| checkout a7e19eb | `npm ci && npm run lint && npm run typecheck && npm test` | all exit 0; 656 tests, 656 pass | |
| README | read `## Live data` | ten rules with Barometer as the worked example: one server-only fetch module, `instant = false`, `"use cache"` + `cacheLife` 900/60, `AbortSignal.timeout`, a fixture-tested parser, a quiet face with 200, credit on every render, the reading's time, no network at build, host override + `QUIET=1` | README.md |
| git | author of aa21469, a4232ad, cc21750 | all `Otohime <quiinthieu@gmail.com>`, committer the same, no `Co-Authored-By` trailer | `git log --format='%an <%ae> %(trailers:key=Co-Authored-By)'` |

**Verdict: pass.** A visitor to https://otohime.dev/barometer gets the brass weather station the idea asked for: aneroid dial, thermometer, wind vane and rain cup, drawn by hand, for Ho Chi Minh City or any of 24 cities. The reading comes from Open-Meteo through the server only, and the credit (Open-Meteo.com, CC BY 4.0) shows on every render. The city picker works without JavaScript and reads on change with it. An unknown city still gives a 200. Set keeps the brass hand across reloads. When the feed is dead or hangs, the visitor sees a drawn quiet face with a 200 and the credit. Against the 10 s hang, the 4 s abort brings that face in 3.5 to 6.5 s. The README's `## Live data` section now states the fetch rules as the site's template.

## Components and shas

- **Web app (Vercel, otohime.dev):** serves `992bfb13da87aed1045159bd5096abf0a29e9d8a`. It contains t-1164 (`aa21469`) and t-1165 (`a4232ad`).
- **t-1166 (`cc21750`):** not in the deployed build. It changes only `scripts/walk-barometer.sh` and `README.md` (`git show --stat`), so the served page is the delivered page. `git diff 992bfb1 a7e19eb` touches no file under `app/`. I proved the quiet face on demand at a7e19eb, as the plan's Acceptance section asks.
- **CI:** not readable from the lease. The repo is private (the GitHub API answers 404) and `gh` has no login. In `ci.yml` the production job `needs: checks`, so production serving 992bfb1 implies the gated checks passed for it.

## Logs

- **Vercel runtime logs:** not reachable from the lease (no CLI or token). The production walk (88/0) and probe (58/0, no console errors) stand in for them.
- **Local `next start` with the dead host:** Barometer requests (reading and quiet) log nothing. The one error in the log, a BetterAuth "default secret", came from my readiness request to `/` on a server I started without `BETTER_AUTH_SECRET`. A second server I hit only on `/barometer` logged nothing until `/` was requested. The walk script exports that variable, so this is my harness, not Barometer.

## Open questions

None open on pm-204.
