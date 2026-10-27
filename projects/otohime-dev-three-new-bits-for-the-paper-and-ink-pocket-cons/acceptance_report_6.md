---
plan_id: pm-255
run_id: run-8942
kind: acceptance_report
verdict: fail
cycle: 6
cited_sha: 6bb062c
---

| starting state | action | observable result | evidence |
| --- | --- | --- | --- |
| Production `https://otohime.dev`, build reported by `/api/health` as `9bb1daea85c600788c8209819e5c4d69e08b3a46` (contains delivered `9cb3833` and `6bb062c`) | `GET https://otohime.dev/api/health` | `{"ok":true,"sha":"9bb1daea85c600788c8209819e5c4d69e08b3a46"}` | curl, 2026-10-27 |
| Visitor on `/`, no session, 1366x768 and 390x844 | Load `/`, open the "Ask the console" chip | HTTP 200, title "Otohime", dialog opens at both widths | `/tmp/pm255/walk/walk-result.json`, `home-*.png` |
| Dialog open, tier off (`GET /api/ask` 404) | Type "shore", press Enter, wait 9 s | Canned answer `FOUND: Shore: A focus timer that leaves sea glass behind.` with link `/shore`; 0 visible error elements at both widths. Browser made 1 `GET /api/ask` and 0 POST (the walk aborts any POST, so none reached production) | walk-result.json, `ask-*.png` |
| Visitor on `/`, seasons layer and dial | `BASE_URL=https://otohime.dev EXPECT_SHA=9bb1dae… bash scripts/probe-seasons.sh` | Layer 59/59, dial 45/45, masthead and reduced-motion checks pass. **Joint 26/28: FAIL** at 390px and 1366px, `joint: motion welcome: no console or page errors`. The only console error is `404` for `GET https://otohime.dev/api/ask`, logged when the Ask dialog opens (confirmed with a response listener at both widths) | `probe-seasons-prod.log`; `url404` check |
| Same seasons probe, local `next build` + `next start` of `6bb062c` (delivered SHA) | `bash scripts/probe-seasons.sh` | Same result: joint 26/28. The two failures are the same console 404 for `GET /api/ask` on `localhost:4141` | `probe-seasons-local.log` |
| Unknown URL, 1366x768 and 390x844 | `GET /acc-run-8942-missing` | HTTP 404 with the torn-sheet page: heading "This page got lost", "torn out and crumpled up", links `/`, `/work`, `/projects`, `/notes`, `/play` present at both widths | walk-result.json, `404-*.png` (390px shows the sheet and links on screen) |
| Same | `BASE_URL=https://otohime.dev bash scripts/probe-lost.sh` (no EXPECT_SHA) | `probe: 34 ok, 0 failed`, exit 0 | `probe-lost-prod-clean.log` |
| Same | Local `scripts/probe-lost.sh` on `6bb062c` | `probe: 34 ok, 0 failed`, exit 0 | `probe-lost-local.log` |
| Work, Projects, Notes on production | `GET /work`, `/projects`, `/notes` | HTTP 200 each | walk-result.json |
| Delivered gate at `6bb062c` (archive export, `npm ci`, Node 22.23.3) | `npm test`; `npm run typecheck` | 2213/2213 pass, 0 fail, 0 skipped; typecheck exit 0 | `npm-test.log`, `typecheck.log` |
| Fake-model Ask probe, clean run (own log, not the QA run) | `bash scripts/probe-ask-llm-fake.sh` | exit 0, `probe: passed`, 64 ok, 0 not ok. Tier on 30 ok / 0 failed, 1 POST to fake model; on-control (non-JSON fake) 28 ok / 1 failed (negative control); off 27 ok / 2 failed, 0 fake requests (negative control); 8 of 8 tier verdicts | `fake-clean.log` |
| Ask model tier on production | Not exercised. Decider's instruction: no POST to production `/api/ask`, no env change, no redeploy | `GET /api/ask` 404 (tier off). Canned fallback is the visitor's state | curl, walk |
| Touched service logs (web, Vercel) | Look for a Vercel CLI and an authenticated `gh` | Neither is present (`command -v vercel` empty; `gh` not found). Log history **not read**; runtime error evidence is inconclusive | environment check |

## Verdict: fail

The outcome the idea asked for is visible to a visitor on https://otohime.dev at 1366x768 and 390x844:

- Seasons layer and dial are present and pass their layer, dial and masthead checks.
- The torn-sheet 404 is delivered and its links work.
- Ask the Ink answers with the canned offline fallback, with a citation, no visible error and no POST.

The acceptance bar is not met, because a required executable check fails at the delivered SHA: the seasons probe's joint block (`no console or page errors`, 26/28) fails at both widths, locally on `6bb062c` and on production. The only console error is the expected tier-off `GET /api/ask` 404 that the Ask dialog logs on open. Per the decider's rule, a failing required check is a fix cycle, not an acceptance. The fix choice belongs to the product owner (see `change_request_6.md`).

Not accepted and not claimed: live model tier. It is **not delivered**. It is built and fake-proven, and production execution is unproven. The deferred check `BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh` is owned by the Vercel-account holder under chore `set-env:ask-llm-production` (esc-413). It fails on any `not ok` line. It was not run here, since it POSTs one paid answer to production.

## Cited sha and build identities

- Production (`https://otohime.dev`), per `/api/health`: `9bb1daea85c600788c8209819e5c4d69e08b3a46`. It is a descendant of `9cb3833` and `6bb062c`.
- Delivered tier-probe SHA: `6bb062c` (author Otohime <quiinthieu@gmail.com>, no `Co-Authored-By` trailer). `9cb3833` (run-8909) is its predecessor, same identity and no trailer.
- Between `6bb062c` and production `9bb1dae`, only `app/(site)/not-found.tsx` and `components/ask-console.tsx` changed on the walked paths (a `RisoText` heading wrapper). The walk tested both.
- `author.txt`: not in the delivery evidence. Identity read from `git log` instead.

## Real and fake boundaries

- Real: production `https://otohime.dev` (read-only GET, plus one browser session per width with every POST to `/api/ask` aborted), Chrome from Playwright's cached headless shell, and a local `next build` / `next start` of `6bb062c`.
- Fake: the fake Anthropic server and throwaway Postgres in the fake-model probe, and the page-route fixtures in it. No live model call.
- Not checked: production runtime logs, CI history, Safari, assistive technology, real devices.

## History completeness

- Logs: not read (see table). Inconclusive.
- CI: not observed. No `gh`.

## Scan notes and collisions

- Two early runs of the local probes collided on one `.next` build. Those runs were killed and rerun sequentially. The reported local results are from clean sequential runs (seasons, then the 404 probe, then the fake probe run alone). The first fake-probe log was contaminated by a stray run and was replaced by `fake-clean.log`.
- The production 404 probe was first run with `EXPECT_SHA` and failed on "build-sha is 9bb1dae…: none", because the HTML does not expose the build sha (`/api/health` does). The rerun without it is the one cited (34/34).

## Defects

1. **Seasons joint console check fails at the delivered SHA** (both widths, local `6bb062c` and production `9bb1dae`). Failure: `joint: motion welcome: no console or page errors`, from the tier-off `GET /api/ask` 404 logged on dialog open. Owner: product owner (fix choice). See `change_request_6.md`.

## Deferred checks

- `BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh`. Owner: Vercel-account holder, chore `set-env:ask-llm-production` (esc-413). Fails on any `not ok` line. Not run by acceptance. Not delivered.
- Production runtime logs for the web service. Owner: acceptance, needs a Vercel CLI or an authenticated `gh`. Fails on any 5xx or error in `/api/ask` or the 404 route during a walk.
