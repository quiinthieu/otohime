---
plan_id: pm-180
run_id: run-6199
kind: acceptance_report
verdict: pass
cycle: 1
cited_sha: 7147cf842414f046f4bd6f48fe6673cb9d19d99f
---

# Acceptance: Ship The Bench (pm-180)

| Starting state | Action | Observable result | Evidence |
| --- | --- | --- | --- |
| Signed out, fresh browser, 1366x768 (Chromium and WebKit) | Open `https://otohime.dev/` | 200, title "Otohime", handheld LCD lists WORK -146, PLAY -136, NOTES -126, MUSIC -116, PROJECTS -106; no horizontal overflow | `<meta name="build-sha" content="7147cf842414f046f4bd6f48fe6673cb9d19d99f">` |
| Home, cursor on WORK | Click "▼ Down" four times | Readout steps PLAY, NOTES, MUSIC, then "PRESS A TO OPEN PROJECTS." | Playwright walk, both engines |
| Cursor on PROJECTS | Click "A Open" | Lands on `/projects`: sidebar "Main" with Fig. 01 Home to Fig. 06 Projects (Projects highlighted, `aria-current="page"`), h1 "Fig. 06 — Projects", box drawing, "Nothing on the bench yet", "Check back later."; title "Projects · Otohime" | build-sha 7147cf8 after client navigation; settled screenshot |
| Home again | Press ArrowDown x4, then Enter | Lands on `/projects` | keyboard path, both engines |
| On `/projects` | Click "Home" in the sidebar | Back on `/` | both engines |
| Signed out, 390x844 phone (Chromium mobile, WebKit) | Same three paths: tap ▼ Down x4 and A Open, keyboard, direct load | Same results. The sidebar becomes a scrollable pill strip; page text and drawing fit the width with no horizontal overflow | direct `/projects` 200 |
| Any page | Read the console and page errors during the walk | 0 errors at human pace in both engines and both sizes. Clicks about 100 ms apart cancelled `/play`, `/notes`, `/music` RSC prefetches and WebKit logged "access control checks"; this did not recur at 1.5 s per press. `curl /play?_rsc` gives 200 with `access-control-allow-origin: *` | follow-up run: idle 0, menu 0, nav 0 |
| curl, 2026-10-19T04:48Z | `GET /`, `GET /projects`, `GET /api/health` | 200 / 200 (two matches for "Nothing on the bench yet") / `{"ok":true}`; both pages build-sha 7147cf8 | edge age 324 s and 212 s |
| Clean checkout of 7f63d87, Node v22.12.0 | `npm ci`; `npm run build` with `GITHUB_SHA=7f63d87…`; `next start -p 4019`; same browser walk | Build passes; `/` and `/projects` 200; both carry build-sha `7f63d87d10c635414104bf0d42195f7a8b67f53e`; same LCD lines, same handheld path, 0 browser errors; server log has only the Ready lines | local walk.json |
| Same checkout | `npm test` on Node 22.12.0 | 21/21 pass | node test summary |
| origin/main | `git log` on c3cc730, 7f63d87, 7147cf8 | Author and committer `Otohime <quiinthieu@gmail.com>`; Co-Authored-By count 0 on each; `e097b14` and `7f63d87` are ancestors of `7147cf8`; 7f63d87..7147cf8 changes only `qa_report.md` | matches plan.commit_identity |

Verdict: **pass**.

## Deployed components

| Component | Sha / build | How read |
| --- | --- | --- |
| otohime.dev (Vercel production, Next.js 16.4.2) | `7147cf842414f046f4bd6f48fe6673cb9d19d99f` | `<meta name="build-sha">` on `/` and `/projects` |
| Delivery code (t-1045) | `7f63d87d10c635414104bf0d42195f7a8b67f53e` (code from `c3cc730`) | ancestor of the deployed sha. The only later change is a QA report. |
| Projects page (pm-171) | `e097b14` | ancestor of the deployed sha |

There is no `author.txt` in this run's evidence, so I read authorship from git on origin/main. It matches.

## What the idea asked for

"Verify pm-171, complete the plan, and ship it."

- **Verify pm-171:** a signed-out visitor reaches the Projects page through the handheld and through the sidebar, and it renders "Nothing on the bench yet" at 1366x768 and 390x844.
- **Complete it:** pm-171's revision-2 items are in the build. The test scripts carry `--experimental-strip-types`, so tests pass on Node 22.12. Every page carries `<meta name="build-sha">`, and the README has the two deploy rules.
- **Ship it:** otohime.dev serves a descendant of the delivery.

The author hypothesis held. The owner-authored commits deployed, and the commits authored by Viet Ky and Claude Code before them did not. This is inferred from the edge, not read from GitHub Actions.

## Observations (advisory, not blocking)

1. At 390x844, the active "Projects" pill starts at x=386.8 of 390 in the scrollable nav strip. On arrival a phone user sees only a sliver of it and has to swipe to see which page is highlighted. Scrolling the active pill into view would fix it.
2. The empty-state caption reads "Fig. — — Nothing on the bench yet". The doubled dash looks like an unfilled figure number.

Both come from pm-171's page design, not from this plan's delivery.

## Logs

The only touched service is the Vercel production site. No platform role can read its runtime logs. The repo is private with no `ci_token`; the lasting fix is a person's chore and outside this plan. Instead I watched the browser's console and page errors on production and read the local `next start` log, which had no errors. `/api/health` returns `{"ok":true}`.

## Method notes

- Installed Google Chrome cannot start child processes on this darwin lease: MachPortRendezvous and GPU process failures, even with `--no-sandbox`. The walk used Playwright's chromium-headless-shell 1248 and WebKit 2370, installed in `/tmp`, outside the repo.
- I did not edit any application source, mutate any workload, or deploy anything.
