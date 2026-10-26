---
plan_id: pm-251
run_id: run-8755
kind: acceptance_report
verdict: pass
cycle: 1
---
| Starting state | Action | Observable result | Evidence |
|---|---|---|---|
| Fresh `npm ci`, `next build` at main cce8ebc (contains all 9 task shas), `next start`, headless Chromium, 1366x768 and 390x844 touch | `scripts/probe-pond.sh` with screenshots: open /play, drip, comb, blow, pick inks, pull a print, set/clear background, reduced motion, JS off | Pond sits below the claw machine; still SVG first; drip/comb/blow change the water (screenshots 1366x768-comb.png, 390x844 touch-print.png show real marbled rings); 2400x1800 PNG download; JPEG background set before first paint and removed by Clear; reduced motion and no-JS show the SVG, no canvas | 99 ok / 0 not ok, exit 0 |
| Same build | `scripts/probe-zine.sh`: open /zine, A4 and Letter, print to PDF, footer link | 8-page sheet prints to exactly one page with the right MediaBox; one footer link | 54 ok / 0 not ok |
| Same build | `scripts/probe-letterpress.sh`: keys on /notes and others, hold a key, click with sound on/off | Buttons, nav items and cartridge titles are debossed with grain, press 1 px, forced colours handled; one soft press per click, none on own-sound controls (negative control caught) | 75 ok / 0 not ok |
| Live https://otohime.dev | GET /zine, /api/health | /zine 404; health `{"ok":true}` with no sha | curl; production lags main, deploys owned by pm-249 |

Identities: built sha cce8ebc92941cdab1ad575d9831b98ccebba5eaf (BUILD_SHA set for the build). Task commits are authored Otohime <quiinthieu@gmail.com>, 0 Co-Authored-By trailers in the last 9 Otohime commits; author.txt not supplied.

Real/fake boundary: real build, real Chromium, WebGL2 via SwiftShader (no GPU, no iOS Safari). Pond water sound and press cue were heard by no one: fake AudioContext only (probe-letterpress asserts the press cue; pond water has unit tests only, no browser probe). Negative controls seen: data-own-sound stripped, reduced-motion bypass, stopped rAF, wash 20% (from probes/QA). Server logs: probes' own server logs showed no console/page errors; no job queue or remote services, so no history to scan (n/a).

Defect/caveat, not a failure of this plan: the deployed site does not yet carry any of the three toys. Owner pm-249 (deploy of main, sha in /api/health). Fails if /api/health lacks a sha containing a main commit at or after 5cd6ee0 or /zine is still 404 after that deploy.
